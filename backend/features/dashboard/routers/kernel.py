import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from ai_service import ai_service
from shared.utils import get_user_dependency

router = APIRouter(tags=["Dashboard"])

logger = logging.getLogger(__name__)


@router.get("/api/dashboard/kernel/metrics")
async def get_kernel_metrics(
    _current_user: dict = Depends(get_user_dependency()),
):
    """Get metrics about active Semantic Kernel instances."""
    try:
        metrics = ai_service.get_kernel_metrics()
        return JSONResponse(content=metrics)
    except Exception as e:
        logger.error("Error getting kernel metrics: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get kernel metrics") from None
