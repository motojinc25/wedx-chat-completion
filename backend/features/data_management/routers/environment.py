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
from shared.models import EnvironmentV4
from shared.utils import create_audit_log, get_user_dependency

router = APIRouter(tags=["Environment"])


@router.get("/api/dm/environment", response_model=list[MasterTableResponse])
async def get_environments(
    request: Request, current_user: dict = Depends(get_user_dependency()), db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(EnvironmentV4).order_by(EnvironmentV4.name))
    environments = result.scalars().all()

    await create_audit_log(
        db, request, current_user, "list", "environment_v4", "all", f"Retrieved {len(environments)} environments"
    )

    return [format_master_table_response(env) for env in environments]


@router.post("/api/dm/environment", response_model=MasterTableResponse)
async def create_environment(
    environment: MasterTableCreate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await create_master_item(environment, request, current_user, db, EnvironmentV4, "environment")


@router.put("/api/dm/environment/{environment_id}", response_model=MasterTableResponse)
async def update_environment(
    environment_id: str,
    environment: MasterTableUpdate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await update_master_item(
        environment_id, environment, request, current_user, db, EnvironmentV4, "environment"
    )


@router.delete("/api/dm/environment/{environment_id}")
async def delete_environment(
    environment_id: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await delete_master_item(environment_id, request, current_user, db, EnvironmentV4, "environment")
