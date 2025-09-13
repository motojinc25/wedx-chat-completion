import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import String, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.administration.schemas import UserV4Response, UserV4UpdateRequest
from shared.auth import get_current_user
from shared.database import get_db_session
from shared.models import ChatMessageV4, ChatSessionV4, DomainV4, EnvironmentV4, OrganizationV4, TenantV4, UserV4
from shared.utils import create_audit_log, get_user_dependency

router = APIRouter(tags=["Users"])
logger = logging.getLogger(__name__)


def format_user_response(
    item, tenant_display_name=None, organization_name=None, domain_name=None, environment_name=None
):
    return UserV4Response(
        id=str(item.id),
        tenant_id=str(item.tenant_id),
        oid=str(item.oid),
        issuer=item.issuer,
        display_name=item.display_name,
        upn=item.upn,
        email=item.email,
        roles=item.roles,
        groups=item.groups,
        last_login_at=item.last_login_at.isoformat() if item.last_login_at else None,
        organization_id=str(item.organization_id) if item.organization_id else None,
        domain_id=str(item.domain_id) if item.domain_id else None,
        environment_id=str(item.environment_id) if item.environment_id else None,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
        tenant_display_name=tenant_display_name,
        organization_name=organization_name,
        domain_name=domain_name,
        environment_name=environment_name,
    )


@router.get("/api/admin/users", response_model=list[UserV4Response])
async def get_users(
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    tenant_id: str | None = None,
):
    try:
        # Build query with joins to get related names
        query = (
            select(
                UserV4,
                OrganizationV4.name.label("organization_name"),
                DomainV4.name.label("domain_name"),
                EnvironmentV4.name.label("environment_name"),
            )
            .join(TenantV4, UserV4.tenant_id == TenantV4.tenant_id)
            .outerjoin(OrganizationV4, UserV4.organization_id == OrganizationV4.id)
            .outerjoin(DomainV4, UserV4.domain_id == DomainV4.id)
            .outerjoin(EnvironmentV4, UserV4.environment_id == EnvironmentV4.id)
        )

        # Add filters
        filters = []
        if search:
            filters.append(
                or_(
                    UserV4.display_name.ilike(f"%{search}%"),
                    UserV4.upn.ilike(f"%{search}%"),
                    UserV4.email.ilike(f"%{search}%"),
                    UserV4.oid.cast(String).ilike(f"%{search}%"),
                    OrganizationV4.name.ilike(f"%{search}%"),
                    DomainV4.name.ilike(f"%{search}%"),
                    EnvironmentV4.name.ilike(f"%{search}%"),
                )
            )

        if tenant_id:
            filters.append(UserV4.tenant_id == uuid.UUID(tenant_id))

        if filters:
            query = query.filter(and_(*filters))

        query = query.order_by(UserV4.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        users_with_data = result.all()

        await create_audit_log(
            db, request, current_user, "list", "users_v4", "all", f"Retrieved {len(users_with_data)} users"
        )

        return [
            format_user_response(user, organization_name, domain_name, environment_name)
            for user, organization_name, domain_name, environment_name in users_with_data
        ]
    except Exception as e:
        logger.error("Error retrieving users: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve users") from None


@router.get("/api/admin/users/count")
async def get_users_count(
    _current_user: dict = Depends(get_user_dependency()),
    db: AsyncSession = Depends(get_db_session),
    search: str | None = None,
    tenant_id: str | None = None,
):
    try:
        query = select(func.count(UserV4.id)).join(TenantV4, UserV4.tenant_id == TenantV4.tenant_id)

        # Add filters
        filters = []
        if search:
            filters.append(
                or_(
                    UserV4.display_name.ilike(f"%{search}%"),
                    UserV4.upn.ilike(f"%{search}%"),
                    UserV4.email.ilike(f"%{search}%"),
                    UserV4.oid.cast(String).ilike(f"%{search}%"),
                )
            )

        if tenant_id:
            filters.append(UserV4.tenant_id == uuid.UUID(tenant_id))

        if filters:
            query = query.filter(and_(*filters))

        result = await db.execute(query)
        count = result.scalar()

        return {"count": count}
    except Exception as e:
        logger.error("Error getting users count: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get users count") from None


@router.put("/api/admin/users/{user_id}", response_model=UserV4Response)
async def update_user(
    user_id: str,
    request: Request,
    user_update: UserV4UpdateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        user_uuid = uuid.UUID(user_id)

        # Get the user with related data
        query = (
            select(
                UserV4,
                OrganizationV4.name.label("organization_name"),
                DomainV4.name.label("domain_name"),
                EnvironmentV4.name.label("environment_name"),
            )
            .join(TenantV4, UserV4.tenant_id == TenantV4.tenant_id)
            .outerjoin(OrganizationV4, UserV4.organization_id == OrganizationV4.id)
            .outerjoin(DomainV4, UserV4.domain_id == DomainV4.id)
            .outerjoin(EnvironmentV4, UserV4.environment_id == EnvironmentV4.id)
            .filter(UserV4.id == user_uuid)
        )

        result = await db.execute(query)
        user_data = result.first()

        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")

        user = user_data[0]

        # Validate foreign key references if provided
        if user_update.organization_id:
            org_query = select(OrganizationV4).filter(
                OrganizationV4.id == uuid.UUID(user_update.organization_id), OrganizationV4.is_active
            )
            org_result = await db.execute(org_query)
            if not org_result.first():
                raise HTTPException(status_code=400, detail="Invalid or inactive organization")

        if user_update.domain_id:
            domain_query = select(DomainV4).filter(DomainV4.id == uuid.UUID(user_update.domain_id), DomainV4.is_active)
            domain_result = await db.execute(domain_query)
            if not domain_result.first():
                raise HTTPException(status_code=400, detail="Invalid or inactive domain")

        if user_update.environment_id:
            env_query = select(EnvironmentV4).filter(
                EnvironmentV4.id == uuid.UUID(user_update.environment_id), EnvironmentV4.is_active
            )
            env_result = await db.execute(env_query)
            if not env_result.first():
                raise HTTPException(status_code=400, detail="Invalid or inactive environment")

        # Update user fields
        user.organization_id = uuid.UUID(user_update.organization_id) if user_update.organization_id else None
        user.domain_id = uuid.UUID(user_update.domain_id) if user_update.domain_id else None
        user.environment_id = uuid.UUID(user_update.environment_id) if user_update.environment_id else None

        await db.commit()
        await db.refresh(user)

        # Get updated data with names
        updated_query = (
            select(
                UserV4,
                OrganizationV4.name.label("organization_name"),
                DomainV4.name.label("domain_name"),
                EnvironmentV4.name.label("environment_name"),
            )
            .join(TenantV4, UserV4.tenant_id == TenantV4.tenant_id)
            .outerjoin(OrganizationV4, UserV4.organization_id == OrganizationV4.id)
            .outerjoin(DomainV4, UserV4.domain_id == DomainV4.id)
            .outerjoin(EnvironmentV4, UserV4.environment_id == EnvironmentV4.id)
            .filter(UserV4.id == user_uuid)
        )

        updated_result = await db.execute(updated_query)
        updated_data = updated_result.first()

        await create_audit_log(
            db,
            request,
            current_user,
            "update",
            "users_v4",
            str(user_id),
            "Updated organization/domain/environment assignments",
        )

        return format_user_response(*updated_data)

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format") from None
    except HTTPException:
        # Re-raise HTTPExceptions without modification
        raise
    except Exception as e:
        logger.error("Error updating user: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update user") from None


@router.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        user_uuid = uuid.UUID(user_id)

        # Check if user exists
        query = select(UserV4).filter(UserV4.id == user_uuid)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Delete related chat messages first
        messages_query = select(ChatMessageV4).filter(ChatMessageV4.user_id == user_uuid)
        messages_result = await db.execute(messages_query)
        messages = messages_result.scalars().all()
        for message in messages:
            await db.delete(message)

        # Delete related chat sessions
        sessions_query = select(ChatSessionV4).filter(ChatSessionV4.user_id == user_uuid)
        sessions_result = await db.execute(sessions_query)
        sessions = sessions_result.scalars().all()
        for session in sessions:
            await db.delete(session)

        # Delete the user
        await db.delete(user)
        await db.commit()

        await create_audit_log(
            db,
            request,
            current_user,
            "delete",
            "users_v4",
            str(user_id),
            f"Deleted user {user.display_name or user.upn}",
        )

        return {"message": "User deleted successfully"}

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format") from None
    except HTTPException:
        # Re-raise HTTPExceptions without modification
        raise
    except Exception as e:
        logger.error("Error deleting user: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete user") from None


@router.get("/api/admin/users/master-data-options")
async def get_master_data_options(
    _current_user: dict = Depends(get_user_dependency()),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        # Get active organizations
        org_query = select(OrganizationV4).filter(OrganizationV4.is_active).order_by(OrganizationV4.name)
        org_result = await db.execute(org_query)
        organizations = [{"id": str(org.id), "name": org.name, "code": org.code} for org in org_result.scalars().all()]

        # Get active domains
        domain_query = select(DomainV4).filter(DomainV4.is_active).order_by(DomainV4.name)
        domain_result = await db.execute(domain_query)
        domains = [
            {"id": str(domain.id), "name": domain.name, "code": domain.code} for domain in domain_result.scalars().all()
        ]

        # Get active environments
        env_query = select(EnvironmentV4).filter(EnvironmentV4.is_active).order_by(EnvironmentV4.name)
        env_result = await db.execute(env_query)
        environments = [{"id": str(env.id), "name": env.name, "code": env.code} for env in env_result.scalars().all()]

        return {"organizations": organizations, "domains": domains, "environments": environments}
    except Exception as e:
        logger.error("Error getting master data options: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get master data options") from None
