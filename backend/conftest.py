"""
Pytest configuration and shared fixtures for the WeDX Chat Completion API.
"""

import os

from dotenv import load_dotenv
from fastapi import Request
from fastapi.testclient import TestClient
import pytest
import pytest_asyncio
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from shared.database import Base, DatabaseConfig

# Load environment variables
load_dotenv()


# Test database configuration - use PostgreSQL from .env
def get_test_database_config():
    """Get test database configuration from environment variables."""
    # Use the same database as production but with different schema/table cleanup
    return DatabaseConfig()


def get_test_database_urls():
    """Get test database URLs for PostgreSQL."""
    config = get_test_database_config()
    async_url = config.database_url
    sync_url = async_url.replace("+asyncpg", "")
    return async_url, sync_url


@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine."""
    async_url, sync_url = get_test_database_urls()
    engine = create_engine(sync_url, echo=False)
    return engine


@pytest.fixture
async def test_async_engine():
    """Create an async test database engine."""
    async_url, sync_url = get_test_database_urls()
    engine = create_async_engine(async_url, echo=False)

    # Create all tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Close engine cleanly
    await engine.dispose()


@pytest_asyncio.fixture
async def test_db_session(test_async_engine):
    """Create a test database session."""
    async_session = async_sessionmaker(test_async_engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session


@pytest.fixture
def test_app(monkeypatch, test_async_engine):
    """Create a test FastAPI application."""
    # Set test environment variables to avoid database connections
    monkeypatch.setenv("APP_MODE", "demo")
    monkeypatch.setenv("DB_HOST", "localhost")
    monkeypatch.setenv("DB_NAME", "test_db")

    # Create test database session maker
    async_session = async_sessionmaker(test_async_engine, class_=AsyncSession, expire_on_commit=False)

    async def get_test_db_session():
        """Get test database session."""
        async with async_session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    # Create a test app without database dependency
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(docs_url="/docs", redoc_url="/redoc", openapi_url="/openapi.json")

    # Add release ID header middleware for testing
    @app.middleware("http")
    async def add_release_id_header(request, call_next):
        response = await call_next(request)
        from main import load_build_info
        build_info = load_build_info()
        response.headers["X-Release-Id"] = build_info["release_id"]
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # Add endpoints for testing
    @app.get("/api/version")
    async def get_version():
        # Import build info functionality for testing
        from main import load_build_info
        return load_build_info()

    @app.get("/api/health")
    @app.options("/api/health")
    async def health_check(request: Request):
        from sqlalchemy import text

        # Simulate getting current user (demo mode)
        current_user = {
            "user_id": "demo-user-id",
            "username": "demo@example.com",
            "name": "Demo User",
            "email": "demo@example.com",
            "tenant_id": "demo-tenant-id",
        }

        user_name = current_user["name"] or current_user["username"]
        user_id = current_user.get("user_id")

        # Test database connection
        db_status = "connected"
        try:
            # Use a separate connection for health check to avoid session conflicts
            async with test_async_engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception:
            db_status = "disconnected"

        # Create audit log entry (simulate for testing)
        try:
            # Get client information
            client_ip = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

            # For testing, we'll create audit logs through the test_db_session fixture
            # This simulates audit log creation without actual database interaction

        except Exception:
            # Don't fail the health check if audit logging fails
            pass

        return {
            "status": "healthy",
            "message": "API is running",
            "authenticated_user": user_name,
            "mode": "demo",
            "database": db_status,
        }

    @app.get("/api/user/profile")
    async def get_user_profile():
        return {
            "user_id": "demo-user-id",
            "username": "demo@example.com",
            "name": "Demo User",
            "email": "demo@example.com",
            "tenant_id": "demo-tenant-id",
        }

    # Include playground router for testing
    from features.playground import playground_router
    from shared.database import get_db_session
    from shared.auth import get_current_user
    from shared.models import UserV4
    import uuid
    
    # Create demo user for testing
    def get_demo_user():
        return UserV4(
            id=uuid.UUID("12345678-1234-5678-9abc-123456789abc"),
            oid=uuid.UUID("12345678-1234-5678-9abc-123456789abc"),
            tenant_id=uuid.UUID("87654321-4321-8765-cba9-987654321cba"),
            issuer="https://login.microsoftonline.com/demo/v2.0",
            upn="demo@example.com",
            display_name="Demo User",
            email="demo@example.com"
        )
    
    # Override dependencies with test session and demo user
    app.dependency_overrides[get_db_session] = get_test_db_session
    app.dependency_overrides[get_current_user] = get_demo_user
    app.include_router(playground_router)

    return app


@pytest.fixture
def test_client(test_app):
    """Create a test client."""
    with TestClient(test_app) as client:
        yield client


@pytest_asyncio.fixture
async def async_test_client(test_app):
    """Create an async test client."""
    from fastapi.testclient import TestClient

    # Use the FastAPI test client which is actually synchronous
    # but wrap in async context for convenience
    client = TestClient(test_app)

    # Create a simple async wrapper
    class AsyncTestClient:
        def __init__(self, sync_client):
            self.client = sync_client

        async def get(self, url, **kwargs):
            return self.client.get(url, **kwargs)

        async def post(self, url, **kwargs):
            return self.client.post(url, **kwargs)

        async def put(self, url, **kwargs):
            return self.client.put(url, **kwargs)

        async def delete(self, url, **kwargs):
            return self.client.delete(url, **kwargs)

        async def options(self, url, **kwargs):
            return self.client.options(url, **kwargs)

    yield AsyncTestClient(client)


@pytest.fixture
def demo_user():
    """Demo user for testing authentication."""
    return {
        "user_id": "demo-user-id-12345",
        "name": "Demo User",
        "email": "demo@example.com",
        "preferred_username": "demo.user",
        "given_name": "Demo",
        "family_name": "User",
    }


@pytest.fixture
def auth_headers():
    """Authentication headers for testing."""
    return {"Authorization": "Bearer demo-token"}


@pytest.fixture(autouse=True)
def enable_demo_mode():
    """Enable demo mode for all tests by default."""
    os.environ["APP_MODE"] = "demo"
    os.environ["AZURE_TENANT_ID"] = "test-tenant-id"
    os.environ["AZURE_CLIENT_ID"] = "test-client-id"
    os.environ["AZURE_API_CLIENT_ID"] = "test-api-client-id"
    yield
    # Cleanup is handled by the test framework


@pytest.fixture
def mock_env_vars(monkeypatch):
    """Mock environment variables for testing."""

    def _mock_env_vars(env_vars: dict):
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

    return _mock_env_vars


# Pytest markers
pytest.mark.unit = pytest.mark.unit
pytest.mark.integration = pytest.mark.integration
pytest.mark.slow = pytest.mark.slow
