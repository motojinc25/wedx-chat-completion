import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db_session
from shared.models import OtelSpansV4
from shared.utils import get_user_dependency

router = APIRouter(tags=["Observability Traces"])
logger = logging.getLogger(__name__)


@router.get("/api/observability/traces")
async def get_observability_traces(
    limit: int = 100,
    min_duration_ms: int | None = None,
    status_code: str | None = None,
    trace_id: str | None = None,
    _current_user: dict = Depends(get_user_dependency()),
    db: AsyncSession = Depends(get_db_session),
):
    """Get observability traces with optional filtering."""
    try:
        query = select(OtelSpansV4).order_by(OtelSpansV4.start_time.desc()).limit(limit)

        if min_duration_ms is not None:
            query = query.filter(text("EXTRACT(EPOCH FROM (end_time - start_time)) * 1000 >= :min_duration")).params(
                min_duration=min_duration_ms
            )

        if status_code is not None:
            query = query.filter(OtelSpansV4.status_code == status_code)

        if trace_id is not None:
            query = query.filter(OtelSpansV4.trace_id.ilike(f"%{trace_id}%"))

        result = await db.execute(query)
        spans = result.scalars().all()

        # Count total matching spans
        count_query = select(func.count(OtelSpansV4.id))
        if min_duration_ms is not None:
            count_query = count_query.filter(
                text("EXTRACT(EPOCH FROM (end_time - start_time)) * 1000 >= :min_duration")
            ).params(min_duration=min_duration_ms)
        if status_code is not None:
            count_query = count_query.filter(OtelSpansV4.status_code == status_code)
        if trace_id is not None:
            count_query = count_query.filter(OtelSpansV4.trace_id.ilike(f"%{trace_id}%"))

        count_result = await db.execute(count_query)
        total_count = count_result.scalar()

        return {
            "traces": [
                {
                    "id": span.id,
                    "trace_id_hex": span.trace_id,
                    "span_id_hex": span.span_id,
                    "parent_span_id_hex": span.parent_id,
                    "name": span.name,
                    "kind": span.kind,
                    "start_time": span.start_time.isoformat() if span.start_time else None,
                    "end_time": span.end_time.isoformat() if span.end_time else None,
                    "duration_ms": (
                        (span.end_time - span.start_time).total_seconds() * 1000
                        if span.start_time and span.end_time
                        else 0
                    ),
                    "status_code": span.status_code,
                    "status_message": None,  # Not stored in current model
                    "attributes": span.attributes or {},
                    "resource_attributes": span.resource_attr or {},
                    "scope_name": span.service_name,
                }
                for span in spans
            ],
            "count": total_count,
        }

    except Exception as e:
        logger.error("Error getting observability traces: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get observability traces") from None
