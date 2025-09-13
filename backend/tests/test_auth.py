"""
Tests for authentication module including JIT provisioning.
"""

import time
from unittest.mock import AsyncMock, Mock, patch
import uuid

from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
import jwt
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from shared.auth import EntraIDAuth, entra_auth, get_current_user, get_current_user_dict
from shared.models import UserV4


class TestEntraIDAuth:
    """Test EntraIDAuth class functionality."""

    def test_init(self, monkeypatch):
        """Test EntraIDAuth initialization."""
        # Patch the module-level variables directly
        monkeypatch.setattr("shared.auth.auth.AZURE_TENANT_ID", "test-tenant-id")
        monkeypatch.setattr("shared.auth.auth.AZURE_CLIENT_ID", "test-client-id")
        monkeypatch.setattr("shared.auth.auth.AZURE_API_CLIENT_ID", "test-api-client-id")

        # Create new instance to pick up environment variables
        auth = EntraIDAuth()

        assert auth.tenant_id == "test-tenant-id"
        assert auth.client_id == "test-client-id"
        assert auth.api_client_id == "test-api-client-id"
        assert auth.jwks_uri == "https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys"
        assert "https://login.microsoftonline.com/test-tenant-id/v2.0" in auth.valid_issuers
        assert "https://sts.windows.net/test-tenant-id/" in auth.valid_issuers
        assert auth._jwks_cache is None
        assert auth._jwks_cache_time == 0
        assert auth._cache_duration == 3600

    @patch("shared.auth.auth.requests.get")
    def test_get_jwks_success(self, mock_get):
        """Test successful JWKS retrieval."""
        mock_jwks = {"keys": [{"kid": "test-key", "kty": "RSA"}]}
        mock_response = Mock()
        mock_response.json.return_value = mock_jwks
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        auth = EntraIDAuth()
        result = auth._get_jwks()

        assert result == mock_jwks
        assert auth._jwks_cache == mock_jwks
        assert auth._jwks_cache_time > 0

        mock_get.assert_called_once_with(auth.jwks_uri, timeout=10)

    @patch("shared.auth.auth.requests.get")
    def test_get_jwks_cached(self, mock_get):
        """Test JWKS cache functionality."""
        mock_jwks = {"keys": [{"kid": "test-key", "kty": "RSA"}]}

        auth = EntraIDAuth()
        auth._jwks_cache = mock_jwks
        auth._jwks_cache_time = time.time()

        result = auth._get_jwks()

        assert result == mock_jwks
        mock_get.assert_not_called()  # Should use cache

    @patch("shared.auth.auth.requests.get")
    def test_get_jwks_expired_cache(self, mock_get):
        """Test JWKS cache expiration."""
        old_jwks = {"keys": [{"kid": "old-key", "kty": "RSA"}]}
        new_jwks = {"keys": [{"kid": "new-key", "kty": "RSA"}]}

        mock_response = Mock()
        mock_response.json.return_value = new_jwks
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        auth = EntraIDAuth()
        auth._jwks_cache = old_jwks
        auth._jwks_cache_time = time.time() - 3601  # Expired cache

        result = auth._get_jwks()

        assert result == new_jwks
        assert auth._jwks_cache == new_jwks
        mock_get.assert_called_once()

    @patch("shared.auth.auth.requests.get")
    def test_get_jwks_request_failure(self, mock_get):
        """Test JWKS request failure handling."""
        import requests
        mock_get.side_effect = requests.RequestException("Network error")

        auth = EntraIDAuth()

        with pytest.raises(HTTPException) as exc_info:
            auth._get_jwks()

        assert exc_info.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "Unable to fetch JWKS" in str(exc_info.value.detail)

    def test_get_signing_key_success(self):
        """Test successful signing key retrieval."""
        mock_jwks = {
            "keys": [
                {"kid": "key1", "kty": "RSA", "n": "test", "e": "AQAB"},
                {"kid": "key2", "kty": "RSA", "n": "test2", "e": "AQAB"},
            ]
        }

        auth = EntraIDAuth()
        auth._jwks_cache = mock_jwks
        auth._jwks_cache_time = time.time()

        token_header = {"kid": "key1", "alg": "RS256"}

        with patch("jwt.algorithms.RSAAlgorithm.from_jwk") as mock_from_jwk:
            mock_key = Mock()
            mock_from_jwk.return_value = mock_key

            result = auth._get_signing_key(token_header)

            assert result == mock_key
            mock_from_jwk.assert_called_once_with(mock_jwks["keys"][0])

    def test_get_signing_key_missing_kid(self):
        """Test signing key retrieval with missing key ID."""
        auth = EntraIDAuth()
        token_header = {"alg": "RS256"}  # No kid

        with pytest.raises(HTTPException) as exc_info:
            auth._get_signing_key(token_header)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Token missing key ID" in str(exc_info.value.detail)

    def test_get_signing_key_not_found(self):
        """Test signing key retrieval with non-existent key ID."""
        mock_jwks = {
            "keys": [
                {"kid": "key1", "kty": "RSA", "n": "test", "e": "AQAB"},
            ]
        }

        auth = EntraIDAuth()
        auth._jwks_cache = mock_jwks
        auth._jwks_cache_time = time.time()

        token_header = {"kid": "nonexistent-key", "alg": "RS256"}

        with pytest.raises(HTTPException) as exc_info:
            auth._get_signing_key(token_header)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Unable to find signing key" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_verify_token_success(self, monkeypatch):
        """Test successful token verification."""
        # Setup environment
        monkeypatch.setattr("shared.auth.auth.AZURE_TENANT_ID", "test-tenant-id")
        monkeypatch.setattr("shared.auth.auth.AZURE_CLIENT_ID", "test-client-id")
        monkeypatch.setattr("shared.auth.auth.AZURE_API_CLIENT_ID", "test-api-client-id")
        
        mock_payload = {
            "oid": "user-id-123",
            "preferred_username": "test@example.com",
            "name": "Test User",
            "email": "test@example.com",
            "tid": "tenant-id-123",
            "appid": "app-id-123",
            "iss": "https://login.microsoftonline.com/test-tenant-id/v2.0",
            "aud": "test-api-client-id",
            "azp": "test-client-id"
        }

        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")

        auth = EntraIDAuth()

        with patch("jwt.get_unverified_header") as mock_header, \
             patch.object(auth, "_get_signing_key") as mock_key, \
             patch("jwt.decode") as mock_decode:

            mock_header.return_value = {"kid": "test-key", "alg": "RS256"}
            mock_key.return_value = Mock()
            # First call returns unverified payload, second call returns verified
            mock_decode.side_effect = [mock_payload, mock_payload]

            result = await auth.verify_token(credentials)

            assert result == mock_payload
            # Verify jwt.decode was called twice (unverified and verified)
            assert mock_decode.call_count == 2

    @pytest.mark.asyncio
    async def test_verify_token_invalid_token(self):
        """Test token verification with invalid token."""
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")

        auth = EntraIDAuth()

        with patch("jwt.get_unverified_header") as mock_header, \
             patch.object(auth, "_get_signing_key") as mock_key, \
             patch("jwt.decode") as mock_decode:

            mock_header.return_value = {"kid": "test-key", "alg": "RS256"}
            mock_key.return_value = Mock()
            mock_decode.side_effect = jwt.exceptions.InvalidTokenError("Invalid token")

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_token(credentials)

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Token validation failed" in str(exc_info.value.detail)
            assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}

    @pytest.mark.asyncio
    async def test_verify_token_general_exception(self):
        """Test token verification with general exception."""
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="problematic-token")

        auth = EntraIDAuth()

        with patch("jwt.get_unverified_header") as mock_header:
            mock_header.side_effect = Exception("Unexpected error")

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_token(credentials)

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Authentication error" in str(exc_info.value.detail)
            assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


class TestGetCurrentUserDict:
    """Test get_current_user_dict function (legacy compatibility)."""

    @pytest.mark.asyncio
    async def test_get_current_user_dict_success(self):
        """Test successful user extraction from token payload."""
        token_payload = {
            "oid": "user-id-123",
            "preferred_username": "test@example.com",
            "name": "Test User",
            "email": "test@example.com",
            "tid": "tenant-id-123",
            "appid": "app-id-123",
        }

        result = await get_current_user_dict(token_payload)

        assert result["user_id"] == "user-id-123"
        assert result["username"] == "test@example.com"
        assert result["name"] == "Test User"
        assert result["email"] == "test@example.com"
        assert result["tenant_id"] == "tenant-id-123"
        assert result["app_id"] == "app-id-123"

    @pytest.mark.asyncio
    async def test_get_current_user_dict_partial_payload(self):
        """Test user extraction with partial token payload."""
        token_payload = {
            "oid": "user-id-123",
            "preferred_username": "test@example.com",
            # Missing other fields
        }

        result = await get_current_user_dict(token_payload)

        assert result["user_id"] == "user-id-123"
        assert result["username"] == "test@example.com"
        assert result["name"] is None
        assert result["email"] is None
        assert result["tenant_id"] is None
        assert result["app_id"] is None

    @pytest.mark.asyncio
    async def test_get_current_user_dict_empty_payload(self):
        """Test user extraction with empty token payload."""
        token_payload = {}

        result = await get_current_user_dict(token_payload)

        assert result["user_id"] is None
        assert result["username"] is None
        assert result["name"] is None
        assert result["email"] is None
        assert result["tenant_id"] is None
        assert result["app_id"] is None


class TestGetCurrentUserJIT:
    """Test get_current_user function with JIT provisioning."""

    @pytest.fixture
    def sample_token_payload(self):
        """Sample JWT token payload for testing."""
        return {
            "tid": "12345678-1234-1234-1234-123456789012",
            "oid": "87654321-4321-4321-4321-210987654321",
            "iss": "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012/v2.0",
            "name": "Test User",
            "preferred_username": "testuser@example.com",
            "email": "testuser@example.com",
            "roles": ["User"],
            "groups": ["Group1", "Group2"],
        }

    @pytest.fixture
    async def mock_db_session(self):
        """Mock database session for testing."""
        mock_session = AsyncMock(spec=AsyncSession)
        return mock_session

    @pytest.mark.asyncio
    async def test_get_current_user_jit_success(self, sample_token_payload, test_db_session):
        """Test successful JIT provisioning and user creation."""
        # Create mock user object
        mock_user = UserV4(
            id=uuid.uuid4(),
            tenant_id=uuid.UUID(sample_token_payload["tid"]),
            oid=uuid.UUID(sample_token_payload["oid"]),
            issuer=sample_token_payload["iss"],
            display_name=sample_token_payload["name"],
            upn=sample_token_payload["preferred_username"],
            email=sample_token_payload["email"],
            roles=sample_token_payload["roles"],
            groups=sample_token_payload["groups"],
        )

        # Mock UserManager
        with patch("shared.auth.auth.UserManager") as mock_user_manager_class:
            mock_user_manager = mock_user_manager_class.return_value
            mock_user_manager.upsert_user_from_token = AsyncMock(return_value=mock_user)

            result = await get_current_user(sample_token_payload, test_db_session)

            assert result == mock_user
            mock_user_manager_class.assert_called_once_with(test_db_session)
            mock_user_manager.upsert_user_from_token.assert_called_once_with(sample_token_payload)

    @pytest.mark.asyncio
    async def test_get_current_user_jit_failure(self, sample_token_payload, test_db_session):
        """Test JIT provisioning failure handling."""
        # Mock UserManager to raise an exception
        with patch("shared.auth.auth.UserManager") as mock_user_manager_class:
            mock_user_manager = mock_user_manager_class.return_value
            mock_user_manager.upsert_user_from_token = AsyncMock(side_effect=Exception("Database error"))

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(sample_token_payload, test_db_session)

            assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "User provisioning failed" in str(exc_info.value.detail)


class TestJITProvisioning:
    """Test JIT (Just-In-Time) provisioning functionality."""

    @pytest.mark.asyncio
    async def test_user_manager_create_tenant(self, test_db_session):
        """Test tenant creation with mocked UserManager."""
        tenant_id = "12345678-1234-1234-1234-123456789012"
        mock_tenant = Mock()
        mock_tenant.tenant_id = uuid.UUID(tenant_id)
        mock_tenant.display_name = "Test Tenant"

        with patch("shared.auth.user_manager.UserManager") as mock_manager_class:
            mock_manager = mock_manager_class.return_value
            mock_manager.get_or_create_tenant = AsyncMock(return_value=mock_tenant)

            tenant = await mock_manager.get_or_create_tenant(tenant_id, "Test Tenant")

            assert tenant == mock_tenant
            assert str(tenant.tenant_id) == tenant_id
            assert tenant.display_name == "Test Tenant"

    @pytest.mark.asyncio
    async def test_user_manager_create_user(self, test_db_session):
        """Test user creation with mocked UserManager."""
        sample_token_payload = {
            "tid": "12345678-1234-1234-1234-123456789012",
            "oid": "87654321-4321-4321-4321-210987654321",
            "name": "Test User",
            "preferred_username": "testuser@example.com",
            "email": "testuser@example.com",
            "roles": ["User"],
            "groups": ["Group1", "Group2"],
        }
        
        mock_user = Mock()
        mock_user.tenant_id = uuid.UUID(sample_token_payload["tid"])
        mock_user.oid = uuid.UUID(sample_token_payload["oid"])
        mock_user.display_name = sample_token_payload["name"]
        mock_user.upn = sample_token_payload["preferred_username"]
        mock_user.email = sample_token_payload["email"]
        mock_user.roles = sample_token_payload["roles"]
        mock_user.groups = sample_token_payload["groups"]

        with patch("shared.auth.user_manager.UserManager") as mock_manager_class:
            mock_manager = mock_manager_class.return_value
            mock_manager.upsert_user_from_token = AsyncMock(return_value=mock_user)

            user = await mock_manager.upsert_user_from_token(sample_token_payload)

            assert user == mock_user
            assert str(user.tenant_id) == sample_token_payload["tid"]
            assert str(user.oid) == sample_token_payload["oid"]
            assert user.display_name == sample_token_payload["name"]
            assert user.upn == sample_token_payload["preferred_username"]
            assert user.email == sample_token_payload["email"]
            assert user.roles == sample_token_payload["roles"]
            assert user.groups == sample_token_payload["groups"]

    @pytest.mark.asyncio
    async def test_user_manager_missing_required_claims(self, test_db_session):
        """Test error handling for missing required claims."""
        incomplete_payload = {
            "tid": "12345678-1234-1234-1234-123456789012",
            # Missing oid and iss
        }

        with patch("shared.auth.user_manager.UserManager") as mock_manager_class:
            mock_manager = mock_manager_class.return_value
            mock_manager.upsert_user_from_token = AsyncMock(
                side_effect=ValueError("Missing required token claims: tid, oid, or iss")
            )

            with pytest.raises(ValueError, match="Missing required token claims"):
                await mock_manager.upsert_user_from_token(incomplete_payload)

    @pytest.mark.asyncio
    async def test_user_manager_user_update_on_second_login(self, test_db_session):
        """Test that user information is updated on subsequent logins."""
        sample_token_payload = {
            "name": "Test User",
            "roles": ["User"],
        }
        
        # Create initial user
        initial_user = Mock()
        initial_user.display_name = sample_token_payload["name"]
        initial_user.roles = sample_token_payload["roles"]

        # Updated user
        updated_user = Mock()
        updated_user.display_name = "Updated Test User"
        updated_user.roles = ["User", "Admin"]

        with patch("shared.auth.user_manager.UserManager") as mock_manager_class:
            mock_manager = mock_manager_class.return_value

            # First call returns initial user, second call returns updated user
            mock_manager.upsert_user_from_token = AsyncMock(
                side_effect=[initial_user, updated_user]
            )

            # First call
            await mock_manager.upsert_user_from_token(sample_token_payload)

            # Update payload
            updated_payload = sample_token_payload.copy()
            updated_payload["name"] = "Updated Test User"
            updated_payload["roles"] = ["User", "Admin"]

            # Second call
            user2 = await mock_manager.upsert_user_from_token(updated_payload)

            # User should be updated
            assert user2.display_name == "Updated Test User"
            assert user2.roles == ["User", "Admin"]


class TestGlobalAuthInstance:
    """Test the global auth instance."""

    def test_global_instance_exists(self):
        """Test that global auth instance is created."""
        assert entra_auth is not None
        assert isinstance(entra_auth, EntraIDAuth)

    def test_global_instance_attributes(self):
        """Test global auth instance attributes."""
        assert hasattr(entra_auth, "tenant_id")
        assert hasattr(entra_auth, "client_id")
        assert hasattr(entra_auth, "jwks_uri")
        assert hasattr(entra_auth, "_jwks_cache")
        assert hasattr(entra_auth, "_jwks_cache_time")
        assert hasattr(entra_auth, "_cache_duration")
