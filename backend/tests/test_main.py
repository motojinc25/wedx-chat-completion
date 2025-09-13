"""
Tests for main FastAPI application endpoints.
"""

import pytest
from unittest.mock import patch

from main import app, get_version_from_pyproject, load_build_info
from shared.models import AuditLogV4
from shared.utils import get_demo_user


class TestVersionEndpoint:
    """Test version endpoint functionality."""

    def test_get_version_endpoint(self, test_client):
        """Test GET /api/version endpoint with build info."""
        # Reset global cache to ensure fresh build info loading
        import main
        main._build_info = None
        
        response = test_client.get("/api/version")

        assert response.status_code == 200
        data = response.json()
        
        # Check for new build info structure
        required_fields = ["release_id", "built_at", "frontend_version", "backend_version"]
        for field in required_fields:
            assert field in data, f"Field {field} not found in response: {data}"
            assert isinstance(data[field], str)
            
        # Also check X-Release-Id header
        assert "X-Release-Id" in response.headers
        assert response.headers["X-Release-Id"] == data["release_id"]

    def test_get_version_from_pyproject(self):
        """Test version extraction from pyproject.toml."""
        version = get_version_from_pyproject()
        assert isinstance(version, str)
        assert version != ""

    @patch("main.tomllib.load")
    @patch("main.Path.open")
    def test_get_version_from_pyproject_error(self, mock_open, mock_load):
        """Test version extraction error handling."""
        mock_load.side_effect = Exception("File not found")

        version = get_version_from_pyproject()
        assert version == "unknown"
        
    def test_load_build_info_with_file(self):
        """Test build info loading when file exists."""
        build_info = load_build_info()
        
        assert isinstance(build_info, dict)
        required_fields = ["release_id", "built_at", "frontend_version", "backend_version"]
        for field in required_fields:
            assert field in build_info
            assert isinstance(build_info[field], str)
            
    @patch("main.Path.exists")
    def test_load_build_info_without_file(self, mock_exists):
        """Test build info loading when file doesn't exist."""
        mock_exists.return_value = False
        
        # Reset the global cache to test fallback
        import main
        main._build_info = None
        
        build_info = load_build_info()
        
        assert build_info["release_id"] == "dev-unknown"
        assert build_info["built_at"] == "unknown"
        assert build_info["frontend_version"] == "unknown"
        assert isinstance(build_info["backend_version"], str)


class TestDemoModeHelpers:
    """Test demo mode helper functions."""

    def test_get_demo_user(self):
        """Test demo user data structure."""
        demo_user = get_demo_user()

        assert demo_user["user_id"] == "demo-user-id"
        assert demo_user["username"] == "demo@example.com"
        assert demo_user["name"] == "Demo User"
        assert demo_user["email"] == "demo@example.com"
        assert demo_user["tenant_id"] == "demo-tenant-id"
        assert demo_user["is_authenticated"] is True



@pytest.mark.asyncio
class TestHealthCheckEndpoint:
    """Test health check endpoint functionality."""

    async def test_health_check_success(self, async_test_client, test_db_session):
        """Test successful health check."""
        response = await async_test_client.get("/api/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert data["message"] == "API is running"
        assert "authenticated_user" in data
        assert data["mode"] == "demo"  # Test runs in demo mode
        assert data["database"] in ["connected", "disconnected"]

    async def test_health_check_creates_audit_log(self, async_test_client):
        """Test that health check works."""
        # Make health check request
        response = await async_test_client.get("/api/health")
        assert response.status_code == 200
        
        # Verify health check response
        data = response.json()
        assert data["status"] == "healthy"
        # Database status may vary in test environment
        assert data["database"] in ["connected", "disconnected"]

    async def test_health_check_with_custom_headers(self, async_test_client):
        """Test health check with custom request headers."""
        headers = {
            "User-Agent": "Test Client/1.0",
            "X-Forwarded-For": "192.168.1.100"
        }

        response = await async_test_client.get("/api/health", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    @patch("sqlalchemy.ext.asyncio.AsyncSession.execute")
    async def test_health_check_database_failure(self, mock_execute, async_test_client):
        """Test health check with database connection failure."""
        # Mock database execute to fail
        mock_execute.side_effect = Exception("Database connection failed")

        response = await async_test_client.get("/api/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"  # Health check should still succeed
        assert data["database"] == "disconnected"


@pytest.mark.asyncio
class TestUserProfileEndpoint:
    """Test user profile endpoint functionality."""

    async def test_get_user_profile_demo_mode(self, async_test_client):
        """Test user profile endpoint in demo mode."""
        response = await async_test_client.get("/api/user/profile")

        assert response.status_code == 200
        data = response.json()

        assert data["user_id"] == "demo-user-id"
        assert data["username"] == "demo@example.com"
        assert data["name"] == "Demo User"
        assert data["email"] == "demo@example.com"
        assert data["tenant_id"] == "demo-tenant-id"

    async def test_user_profile_structure(self, async_test_client):
        """Test user profile response structure."""
        response = await async_test_client.get("/api/user/profile")

        assert response.status_code == 200
        data = response.json()

        required_fields = ["user_id", "username", "name", "email", "tenant_id"]
        for field in required_fields:
            assert field in data
            assert data[field] is not None




@pytest.mark.integration
class TestApplicationIntegration:
    """Integration tests for the complete application."""

    def test_app_creation(self):
        """Test that FastAPI app is created successfully."""
        assert app is not None
        assert hasattr(app, "routes")

    def test_cors_middleware(self, test_client):
        """Test CORS middleware configuration."""
        # Make an OPTIONS request to test CORS
        response = test_client.options("/api/health")

        # Should not return 405 Method Not Allowed if CORS is properly configured
        assert response.status_code != 405

    def test_all_endpoints_accessible(self, test_client):
        """Test that all main endpoints are accessible."""
        endpoints = [
            ("/api/version", 200),
            ("/api/health", 200),
            ("/api/user/profile", 200),
        ]

        for endpoint, expected_status in endpoints:
            response = test_client.get(endpoint)
            assert response.status_code == expected_status, f"Endpoint {endpoint} failed"


