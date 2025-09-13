from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.data_management.routers.shared import (
    create_master_item,
    delete_master_item,
    format_master_table_response,
    update_master_item,
)
from features.data_management.schemas import MasterTableCreate, MasterTableResponse, MasterTableUpdate
from shared.auth import get_current_user
from shared.database import get_db_session
from shared.models import AudienceV4
from shared.utils import create_audit_log, get_user_dependency

router = APIRouter(tags=["Audience"])


@router.get("/api/dm/audience", response_model=list[MasterTableResponse])
async def get_audiences(
    request: Request, current_user: dict = Depends(get_user_dependency()), db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(AudienceV4).order_by(AudienceV4.name))
    audiences = result.scalars().all()

    await create_audit_log(
        db, request, current_user, "list", "audience_v4", "all", f"Retrieved {len(audiences)} audiences"
    )

    return [format_master_table_response(audience) for audience in audiences]


@router.post("/api/dm/audience", response_model=MasterTableResponse)
async def create_audience(
    audience: MasterTableCreate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await create_master_item(audience, request, current_user, db, AudienceV4, "audience")


@router.put("/api/dm/audience/{audience_id}", response_model=MasterTableResponse)
async def update_audience(
    audience_id: str,
    audience: MasterTableUpdate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await update_master_item(audience_id, audience, request, current_user, db, AudienceV4, "audience")


@router.delete("/api/dm/audience/{audience_id}")
async def delete_audience(
    audience_id: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await delete_master_item(audience_id, request, current_user, db, AudienceV4, "audience")
