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
from shared.models import DomainV4
from shared.utils import create_audit_log, get_user_dependency

router = APIRouter(tags=["Domain"])


@router.get("/api/dm/domain", response_model=list[MasterTableResponse])
async def get_domains(
    request: Request, current_user: dict = Depends(get_user_dependency()), db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(DomainV4).order_by(DomainV4.name))
    domains = result.scalars().all()

    await create_audit_log(db, request, current_user, "list", "domain_v4", "all", f"Retrieved {len(domains)} domains")

    return [format_master_table_response(domain) for domain in domains]


@router.post("/api/dm/domain", response_model=MasterTableResponse)
async def create_domain(
    domain: MasterTableCreate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await create_master_item(domain, request, current_user, db, DomainV4, "domain")


@router.put("/api/dm/domain/{domain_id}", response_model=MasterTableResponse)
async def update_domain(
    domain_id: str,
    domain: MasterTableUpdate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await update_master_item(domain_id, domain, request, current_user, db, DomainV4, "domain")


@router.delete("/api/dm/domain/{domain_id}")
async def delete_domain(
    domain_id: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    return await delete_master_item(domain_id, request, current_user, db, DomainV4, "domain")
