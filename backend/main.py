"""Main FastAPI application with Function-First architecture."""

from contextlib import asynccontextmanager
import json
import logging
import logging.config
import os
from pathlib import Path
import tomllib

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import yaml

from ai_service import ai_service
from features.administration import tenants_router, users_router
from features.ai.routers import chat as ai_chat_router
from features.dashboard import dashboard_router
from features.data_management import settings_router
from features.data_management.routers import audience, domain, environment, organization
from features.observability.routers import logs, metrics, overview, traces
from features.playground import playground_router
from kernel_manager import kernel_manager
from shared.database import db_manager
from telemetry_config import setup_telemetry, shutdown_telemetry

# Load environment variables
load_dotenv()

# Constants for documentation URLs
APP_MODE = os.getenv("APP_MODE", "development")
DOCS_URL = "/docs" if APP_MODE == "development" else None
REDOC_URL = "/redoc" if APP_MODE == "development" else None
OPENAPI_URL = "/openapi.json" if APP_MODE == "development" else None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Application lifecycle manager."""
    logger = logging.getLogger("app")

    try:
        logger.info("Application startup initiated")

        # Initialize telemetry
        setup_telemetry()

        # Initialize database
        await db_manager.initialize()

        # Initialize AI service and kernel manager
        await ai_service.initialize()
        await kernel_manager.start()

        logger.info("Application startup complete")
        yield

    except Exception as e:
        logger.error("Error during application startup: %s", e)
        raise
    finally:
        logger.info("Application shutdown initiated")

        # Cleanup in reverse order
        try:
            await kernel_manager.stop()
        except Exception as e:
            logger.error("Error stopping kernel manager: %s", e)

        try:
            await ai_service.cleanup()
        except Exception as e:
            logger.error("Error cleaning up AI service: %s", e)

        try:
            await db_manager.close()
        except Exception as e:
            logger.error("Error closing database: %s", e)

        try:
            await shutdown_telemetry()
        except Exception as e:
            logger.error("Error shutting down telemetry: %s", e)

        logger.info("Application shutdown complete")


# Initialize FastAPI app
app = FastAPI(
    docs_url=DOCS_URL,
    redoc_url=REDOC_URL,
    openapi_url=OPENAPI_URL,
    lifespan=lifespan,
)

# Setup logging
logging_config_path = Path(__file__).parent / "log_conf.yaml"
if logging_config_path.exists():
    with logging_config_path.open() as f:
        config = yaml.safe_load(f.read())
        logging.config.dictConfig(config)
else:
    logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("app")

# Global build info cache
_build_info = None


def load_build_info():
    """Load build info from build-info.json file."""
    global _build_info
    if _build_info is not None:
        return _build_info

    try:
        build_info_path = Path(__file__).parent / "build-info.json"
        if build_info_path.exists():
            with build_info_path.open() as f:
                _build_info = json.load(f)
        else:
            # Fallback when build-info.json doesn't exist
            _build_info = {
                "release_id": "dev-unknown",
                "built_at": "unknown",
                "frontend_version": "unknown",
                "backend_version": get_version_from_pyproject(),
            }
    except Exception as e:
        logger.error("Error loading build info: %s", e)
        _build_info = {
            "release_id": "dev-error",
            "built_at": "unknown",
            "frontend_version": "unknown",
            "backend_version": get_version_from_pyproject(),
        }

    return _build_info


@app.middleware("http")
async def add_release_id_header(request: Request, call_next):
    """Add X-Release-Id header to all responses."""
    response = await call_next(request)
    build_info = load_build_info()
    response.headers["X-Release-Id"] = build_info["release_id"]
    return response


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


def get_version_from_pyproject():
    """Get version from pyproject.toml file."""
    try:
        pyproject_path = Path(__file__).parent / "pyproject.toml"
        with pyproject_path.open("rb") as f:
            pyproject_data = tomllib.load(f)
        version = pyproject_data["project"]["version"]
        return version
    except Exception as e:
        logger.error("Error reading version from pyproject.toml: %s", e)
        return "unknown"


# Basic health and version endpoints
@app.get("/api/version")
async def get_version():
    """Get application version and build information."""
    build_info = load_build_info()
    return JSONResponse(content=build_info)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse(content={"status": "healthy"})


@app.options("/api/health")
async def health_check_options():
    """Health check OPTIONS endpoint."""
    return JSONResponse(content={"status": "healthy"})


# Include all feature routers
app.include_router(settings_router)
app.include_router(organization.router)
app.include_router(domain.router)
app.include_router(environment.router)
app.include_router(audience.router)
app.include_router(tenants_router)
app.include_router(users_router)
app.include_router(dashboard_router)
app.include_router(overview.router)
app.include_router(logs.router)
app.include_router(traces.router)
app.include_router(metrics.router)
app.include_router(ai_chat_router.router)
app.include_router(playground_router)

# Mount static files for frontend
dist_path = Path(__file__).parent / "dist"
if dist_path.exists():
    logger.info("Mounting static files from: %s", dist_path)

    # Mount assets directory (CSS, JS files) to /assets
    assets_path = dist_path / "assets"
    if assets_path.exists():
        logger.info("Mounting assets from: %s", assets_path)
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    # Mount the root static files (HTML, favicon, etc.)
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="static")
else:
    logger.info("Static files directory not found, skipping mount")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
