import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.administration.schemas import TenantV4Response
from shared.auth import get_current_user
from shared.database import get_db_session
from shared.models import TenantV4, UserV4
from shared.utils import create_audit_log, get_user_dependency

router = APIRouter(tags=["Tenants"])
logger = logging.getLogger(__name__)


def format_tenant_response(item):
    return TenantV4Response(
        id=str(item.id),
        tenant_id=str(item.tenant_id),
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


@router.get("/api/admin/tenants", response_model=list[TenantV4Response])
async def get_tenants(
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
):
    try:
        query = select(TenantV4)

        # Add search filter
        if search:
            query = query.filter(TenantV4.tenant_id.cast(String).ilike(f"%{search}%"))

        query = query.order_by(TenantV4.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        tenants = result.scalars().all()

        await create_audit_log(
            db, request, current_user, "list", "tenants_v4", "all", f"Retrieved {len(tenants)} tenants"
        )

        return [format_tenant_response(tenant) for tenant in tenants]
    except Exception as e:
        logger.exception("Error retrieving tenants: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve tenants: {e!s}") from None


@router.delete("/api/admin/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        tenant_uuid = uuid.UUID(tenant_id)

        # Check if tenant exists
        query = select(TenantV4).filter(TenantV4.id == tenant_uuid)
        result = await db.execute(query)
        tenant = result.scalar_one_or_none()

        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Check if there are users associated with this tenant
        users_count_query = select(func.count(UserV4.id)).filter(UserV4.tenant_id == tenant.tenant_id)
        users_count_result = await db.execute(users_count_query)
        users_count = users_count_result.scalar()

        if users_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete tenant. There are {users_count} user(s) associated with this tenant. Please delete all users first.",
            )

        # Delete the tenant
        await db.delete(tenant)
        await db.commit()

        await create_audit_log(
            db,
            request,
            current_user,
            "delete",
            "tenants_v4",
            str(tenant_id),
            f"Deleted tenant {tenant.tenant_id}",
        )

        return {"message": "Tenant deleted successfully"}

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID format") from None
    except HTTPException:
        # Re-raise HTTPExceptions (like our 400 error) without modification
        raise
    except Exception as e:
        logger.error("Error deleting tenant: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete tenant") from None


@router.get("/api/admin/tenants/count")
async def get_tenants_count(
    _current_user: dict = Depends(get_user_dependency()),
    db: AsyncSession = Depends(get_db_session),
    search: str | None = None,
):
    try:
        query = select(func.count(TenantV4.id))

        # Add search filter
        if search:
            query = query.filter(TenantV4.tenant_id.cast(String).ilike(f"%{search}%"))

        result = await db.execute(query)
        count = result.scalar()

        return {"count": count}
    except Exception as e:
        logger.error("Error getting tenants count: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get tenants count") from None
