import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db_session
from shared.utils import get_user_dependency

router = APIRouter(tags=["Observability Overview"])
logger = logging.getLogger(__name__)


@router.get("/api/observability/overview")
async def get_observability_overview(
    _current_user: dict = Depends(get_user_dependency()),
    db: AsyncSession = Depends(get_db_session),
):
    """Get observability overview statistics."""
    try:
        # Get total counts
        total_logs_result = await db.execute(text("SELECT COUNT(*) FROM otel_logs_v4"))
        total_logs = total_logs_result.scalar()

        total_spans_result = await db.execute(text("SELECT COUNT(*) FROM otel_spans_v4"))
        total_spans = total_spans_result.scalar()

        total_metrics_result = await db.execute(text("SELECT COUNT(*) FROM otel_metrics_v4"))
        total_metrics = total_metrics_result.scalar()

        # Get recent errors (24h) - severity_number >= 17 is ERROR level
        recent_errors_result = await db.execute(
            text("""
            SELECT COUNT(*) FROM otel_logs_v4
            WHERE severity_number >= 17
            AND time >= NOW() - INTERVAL '24 hours'
        """)
        )
        recent_errors_24h = recent_errors_result.scalar()

        # Get slow spans (24h) - spans > 1 second duration
        slow_spans_result = await db.execute(
            text("""
            SELECT COUNT(*) FROM otel_spans_v4
            WHERE EXTRACT(EPOCH FROM (end_time - start_time)) > 1.0
            AND start_time >= NOW() - INTERVAL '24 hours'
        """)
        )
        slow_spans_24h = slow_spans_result.scalar()

        overview = {
            "total_logs": total_logs or 0,
            "total_spans": total_spans or 0,
            "total_metrics": total_metrics or 0,
            "recent_errors_24h": recent_errors_24h or 0,
            "slow_spans_24h": slow_spans_24h or 0,
        }

        return {"overview": overview}

    except Exception as e:
        logger.error("Error getting observability overview: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get observability overview") from None
