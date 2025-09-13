import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db_session
from shared.models import OtelLogsV4
from shared.utils import get_user_dependency

router = APIRouter(tags=["Observability Logs"])
logger = logging.getLogger(__name__)


@router.get("/api/observability/logs")
async def get_observability_logs(
    limit: int = 100,
    severity_min: int | None = None,
    trace_id: str | None = None,
    _current_user: dict = Depends(get_user_dependency()),
    db: AsyncSession = Depends(get_db_session),
):
    """Get observability logs with optional filtering."""
    try:
        query = select(OtelLogsV4).order_by(OtelLogsV4.time.desc()).limit(limit)

        if severity_min is not None:
            query = query.filter(OtelLogsV4.severity_number >= severity_min)

        if trace_id is not None:
            query = query.filter(OtelLogsV4.trace_id == trace_id)

        result = await db.execute(query)
        logs = result.scalars().all()

        # Count total matching logs
        count_query = select(func.count(OtelLogsV4.id))
        if severity_min is not None:
            count_query = count_query.filter(OtelLogsV4.severity_number >= severity_min)
        if trace_id is not None:
            count_query = count_query.filter(OtelLogsV4.trace_id == trace_id)

        count_result = await db.execute(count_query)
        total_count = count_result.scalar()

        response_logs = []
        for log in logs:
            log_entry = {
                "id": str(log.id),  # Convert UUID to string
                "time": log.time.isoformat() if log.time else None,
                "severity_number": log.severity_number,
                "severity_text": log.severity_text,
                "body": log.body_json or log.body_text,
                "attributes": log.attributes or {},
                "trace_id_hex": log.trace_id,
                "span_id_hex": log.span_id,
                "resource_attributes": log.resource or {},
                "scope_name": (log.resource or {}).get("scope", {}).get("name"),
            }
            response_logs.append(log_entry)

        response = {
            "logs": response_logs,
            "count": total_count,
        }

        return response

    except Exception as e:
        logger.exception("Error getting observability logs: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get observability logs") from e
