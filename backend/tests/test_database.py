"""
Tests for database module.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import DatabaseConfig


class TestDatabaseConfig:
    """Test database configuration."""

    def test_default_config(self, mock_env_vars):
        """Test default database configuration."""
        # Clear existing env vars first
        mock_env_vars({
            "DB_HOST": "localhost",
            "DB_PORT": "5432",
            "DB_NAME": "admin_db",
            "DB_USER": "admin_user",
            "DB_PASSWORD": "admin_password",
            "DB_SSL_MODE": "prefer",
        })

        config = DatabaseConfig()

        assert config.host == "localhost"
        assert config.port == "5432"
        assert config.database == "admin_db"
        assert config.username == "admin_user"
        assert config.password == "admin_password"
        assert config.ssl_mode == "prefer"

    def test_custom_config(self, mock_env_vars):
        """Test custom database configuration."""
        env_vars = {
            "DB_HOST": "custom-host",
            "DB_PORT": "5433",
            "DB_NAME": "custom_db",
            "DB_USER": "custom_user",
            "DB_PASSWORD": "custom_password",
            "DB_SSL_MODE": "require",
        }
        mock_env_vars(env_vars)

        config = DatabaseConfig()

        assert config.host == "custom-host"
        assert config.port == "5433"
        assert config.database == "custom_db"
        assert config.username == "custom_user"
        assert config.password == "custom_password"
        assert config.ssl_mode == "require"

    def test_connection_url(self, mock_env_vars):
        """Test database connection URL generation."""
        mock_env_vars({
            "DB_HOST": "localhost",
            "DB_PORT": "5432",
            "DB_NAME": "admin_db",
            "DB_USER": "admin_user",
            "DB_PASSWORD": "admin_password",
            "DB_SSL_MODE": "prefer",
        })

        config = DatabaseConfig()
        url = config.database_url

        expected = "postgresql+asyncpg://admin_user:admin_password@localhost:5432/admin_db?ssl=prefer"
        assert url == expected


@pytest.mark.asyncio
class TestDatabaseManager:
    """Test database manager functionality."""

    async def test_database_connection(self, test_db_session):
        """Test database connection."""
        assert isinstance(test_db_session, AsyncSession)

    async def test_database_query(self, test_db_session):
        """Test basic database query."""
        result = await test_db_session.execute(text("SELECT 1 as test"))
        row = result.fetchone()
        assert row[0] == 1

    async def test_database_transaction_rollback(self, test_db_session):
        """Test database transaction rollback."""
        try:
            async with test_db_session.begin():
                await test_db_session.execute(text("SELECT 1/0"))  # This should fail
        except Exception:
            pass

        # Session should still be usable after rollback
        result = await test_db_session.execute(text("SELECT 1 as test"))
        row = result.fetchone()
        assert row[0] == 1
