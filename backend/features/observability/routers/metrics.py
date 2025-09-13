import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db_session
from shared.models import OtelMetricsV4
from shared.utils import get_user_dependency

router = APIRouter(tags=["Observability Metrics"])
logger = logging.getLogger(__name__)


@router.get("/api/observability/metrics")
async def get_observability_metrics(
    limit: int = 100,
    metric_name: str | None = None,
    _current_user: dict = Depends(get_user_dependency()),
    db: AsyncSession = Depends(get_db_session),
):
    """Get observability metrics with optional filtering."""
    try:
        query = select(OtelMetricsV4).order_by(OtelMetricsV4.ts.desc()).limit(limit)

        if metric_name is not None:
            query = query.filter(OtelMetricsV4.metric_name.ilike(f"%{metric_name}%"))

        result = await db.execute(query)
        metrics = result.scalars().all()

        # Count total matching metrics
        count_query = select(func.count(OtelMetricsV4.id))
        if metric_name is not None:
            count_query = count_query.filter(OtelMetricsV4.metric_name.ilike(f"%{metric_name}%"))

        count_result = await db.execute(count_query)
        total_count = count_result.scalar()

        return {
            "metrics": [
                {
                    "id": str(metric.id),
                    "name": metric.metric_name,
                    "type": "histogram",  # Default type based on structure
                    "unit": None,  # Not stored in current model
                    "description": None,  # Not stored in current model
                    "latest_value": (metric.data or {}).get("sum", 0) if metric.data else 0,
                    "latest_time": metric.ts.isoformat() if metric.ts else None,
                    "attributes": {},  # Not stored separately in current model
                    "resource_attributes": metric.resource_attrs or {},
                    "scope_name": (metric.scope_attrs or {}).get("name"),
                    "data": metric.data,  # Include full data for histogram charts
                    "ts": metric.ts.isoformat() if metric.ts else None,
                    "metric_name": metric.metric_name,
                    "resource_attrs": metric.resource_attrs,
                    "scope_attrs": metric.scope_attrs,
                }
                for metric in metrics
            ],
            "count": total_count,
        }

    except Exception as e:
        logger.error("Error getting observability metrics: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get observability metrics") from None
