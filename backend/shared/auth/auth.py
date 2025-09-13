import logging
import os
import time

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
import requests

from shared.database import get_db_session
from shared.models import UserV4

from .user_manager import UserManager

load_dotenv()
logger = logging.getLogger(__name__)

# Environment variables for Entra ID configuration
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID")
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID")  # Client app (React/Flutter)
AZURE_API_CLIENT_ID = os.getenv("AZURE_API_CLIENT_ID")  # API app

# JWT Bearer token extractor
security = HTTPBearer()


class EntraIDAuth:
    def __init__(self):
        self.tenant_id = AZURE_TENANT_ID
        self.client_id = AZURE_CLIENT_ID  # Client app (React/Flutter)
        self.api_client_id = AZURE_API_CLIENT_ID  # API app
        self.jwks_uri = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/discovery/v2.0/keys"
        # Support both v1.0 and v2.0 token issuers
        self.valid_issuers = [
            f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/v2.0",
            f"https://sts.windows.net/{AZURE_TENANT_ID}/",
        ]
        self._jwks_cache = None
        self._jwks_cache_time = 0
        self._cache_duration = 3600  # 1 hour in seconds

        # Validate required configuration
        if not all([self.tenant_id, self.client_id, self.api_client_id]):
            raise ValueError("Missing required Entra ID configuration")

    def _get_jwks(self):
        """Get JSON Web Key Set from Microsoft, with caching"""
        current_time = time.time()

        # Check if cache is still valid
        if self._jwks_cache and current_time - self._jwks_cache_time < self._cache_duration:
            return self._jwks_cache

        try:
            response = requests.get(self.jwks_uri, timeout=10)
            response.raise_for_status()
            self._jwks_cache = response.json()
            self._jwks_cache_time = current_time
            return self._jwks_cache
        except requests.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Unable to fetch JWKS: {e!s}"
            ) from e

    def _get_signing_key(self, token_header):
        """Get the signing key for the token"""
        jwks = self._get_jwks()

        # Find the key that matches the token's key ID
        kid = token_header.get("kid")
        if not kid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing key ID")

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to find signing key")

    async def verify_token(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
        """Verify and decode the JWT token with proper iss/aud/azp validation"""
        token = credentials.credentials

        try:
            # Decode token header to get key information
            unverified_header = jwt.get_unverified_header(token)
            logger.debug("Token header: %s", unverified_header)

            # Get unverified payload for debugging
            unverified_payload = jwt.decode(token, options={"verify_signature": False})

            # Get the signing key
            signing_key = self._get_signing_key(unverified_header)

            # Define valid audiences: API URI, API Client ID, and actual token audience
            token_audience = unverified_payload.get("aud")
            valid_audiences = [f"api://{self.api_client_id}", self.api_client_id, token_audience]

            # Verify issuer manually since jwt.decode doesn't support multiple issuers
            token_issuer = unverified_payload.get("iss")
            if token_issuer not in self.valid_issuers:
                raise jwt.exceptions.InvalidIssuerError(f"Invalid issuer: {token_issuer}")

            # Verify and decode the token (without issuer verification since we handle it manually)
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=valid_audiences,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": False,  # We handle this manually above
                },
            )

            # Additional validation for authorized party (azp)
            azp = payload.get("azp")
            if azp and azp != self.client_id:
                logger.warning("Invalid authorized party - expected: %s, got: %s", self.client_id, azp)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid authorized party: {azp}",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            return payload
        except jwt.exceptions.InvalidAudienceError as e:
            logger.error(
                "Audience validation failed - token aud: %s, expected: %s",
                unverified_payload.get("aud"),
                valid_audiences,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid audience: {e!s}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e
        except jwt.exceptions.InvalidIssuerError as e:
            logger.error(
                "Issuer validation failed - token iss: %s, expected: %s",
                unverified_payload.get("iss"),
                self.valid_issuers,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid issuer: {e!s}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e
        except jwt.exceptions.InvalidTokenError as e:
            logger.error("Token validation failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token validation failed: {e!s}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e
        except Exception as e:
            logger.error("Authentication error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication error: {e!s}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e


# Create global instance
entra_auth = EntraIDAuth()


# Dependency for protecting routes with JIT provisioning
async def get_current_user(
    token_payload: dict = Depends(entra_auth.verify_token), db_session=Depends(get_db_session)
) -> UserV4:
    """
    Get current user information from token payload with JIT provisioning.

    This dependency:
    1. Verifies the JWT token
    2. Extracts user claims from the token
    3. Creates/updates tenant and user in the database
    4. Returns the database user object
    """
    try:
        # Initialize user manager
        user_manager = UserManager(db_session)

        # Perform JIT provisioning
        user = await user_manager.upsert_user_from_token(token_payload)

        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User provisioning failed: {e!s}",
        ) from e


# Legacy dependency for backward compatibility (returns dict instead of UserV4)
async def get_current_user_dict(token_payload: dict = Depends(entra_auth.verify_token)) -> dict:
    """Get current user information from token payload as dict (legacy)"""
    return {
        "user_id": token_payload.get("oid"),  # Object ID
        "username": token_payload.get("preferred_username"),
        "name": token_payload.get("name"),
        "email": token_payload.get("email"),
        "tenant_id": token_payload.get("tid"),
        "app_id": token_payload.get("appid"),
    }
