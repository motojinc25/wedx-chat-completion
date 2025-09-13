from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import logging
import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()

logger = logging.getLogger(__name__)

# Base class for SQLAlchemy models
Base = declarative_base()


class DatabaseConfig:
    """Database configuration class."""

    def __init__(self):
        self.host = os.getenv("DB_HOST", "localhost")
        self.port = os.getenv("DB_PORT", "5432")
        self.database = os.getenv("DB_NAME", "admin_db")
        self.username = os.getenv("DB_USER", "admin_user")
        self.password = os.getenv("DB_PASSWORD", "admin_password")

        # Windows-specific SSL configuration
        self.ssl_mode = os.getenv("DB_SSL_MODE", "prefer")

    @property
    def database_url(self) -> str:
        """Generate database URL for SQLAlchemy."""
        base_url = f"postgresql+asyncpg://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        if self.ssl_mode != "disable":
            base_url += f"?ssl={self.ssl_mode}"
        return base_url

    @property
    def sync_database_url(self) -> str:
        """Generate synchronous database URL for migrations."""
        base_url = f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        if self.ssl_mode != "disable":
            base_url += f"?sslmode={self.ssl_mode}"
        return base_url


class DatabaseManager:
    """Database connection manager."""

    def __init__(self):
        self.config = DatabaseConfig()
        self.engine = None
        self.async_session_maker = None
        self._initialized = False

    def setup(self):
        """
        Sets up the database engine and session maker.
        This should be called before initialize.
        """
        logger.info("Setting up database engine and session maker...")
        self.engine = create_async_engine(
            self.config.database_url,
            echo=False,  # Set to True for SQL query logging in development
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,  # Validate connections before use
            pool_recycle=3600,  # Recycle connections every hour
        )
        self.async_session_maker = async_sessionmaker(bind=self.engine, class_=AsyncSession, expire_on_commit=False)

    async def initialize(self):
        """Initialize database connection."""
        if not self.engine:
            self.setup()

        try:
            logger.info("Initializing database connection...")

            # Test connection
            async with self.engine.begin() as conn:
                from sqlalchemy import text

                await conn.execute(text("SELECT 1"))

            logger.info("Database connection initialized successfully")

        except Exception as e:
            logger.error("Failed to initialize database connection: %s", e)
            raise

    async def close(self):
        """Close database connection."""
        if self.engine:
            logger.info("Closing database connection...")
            await self.engine.dispose()
            self.engine = None
            self.async_session_maker = None
            logger.info("Database connection closed")


# Global database manager instance
db_manager = DatabaseManager()


# Dependency for FastAPI
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a database session."""
    if not db_manager.async_session_maker:
        # This is a fallback, but setup should have been called at startup.
        # Consider logging a warning here.
        db_manager.setup()

    async with db_manager.async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def lifespan_handler():
    """Context manager for application lifespan."""
    # Startup
    try:
        await db_manager.initialize()
        yield
    finally:
        # Shutdown
        await db_manager.close()
