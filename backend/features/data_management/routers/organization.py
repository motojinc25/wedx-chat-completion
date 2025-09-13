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
from shared.models import OrganizationV4
from shared.utils import create_audit_log, get_user_dependency

router = APIRouter(tags=["Organization"])


@router.get("/api/dm/organization", response_model=list[MasterTableResponse])
async def get_organizations(
    request: Request, current_user: dict = Depends(get_user_dependency()), db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(OrganizationV4).order_by(OrganizationV4.name))
    organizations = result.scalars().all()

    await create_audit_log(
        db, request, current_user, "list", "organization_v4", "all", f"Retrieved {len(organizations)} organizations"
    )

    return [format_master_table_response(org) for org in organizations]


@router.post("/api/dm/organization", response_model=MasterTableResponse)
async def create_organization(
    organization: MasterTableCreate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await create_master_item(organization, request, current_user, db, OrganizationV4, "organization")


@router.put("/api/dm/organization/{organization_id}", response_model=MasterTableResponse)
async def update_organization(
    organization_id: str,
    organization: MasterTableUpdate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await update_master_item(
        organization_id, organization, request, current_user, db, OrganizationV4, "organization"
    )


@router.delete("/api/dm/organization/{organization_id}")
async def delete_organization(
    organization_id: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await delete_master_item(organization_id, request, current_user, db, OrganizationV4, "organization")
