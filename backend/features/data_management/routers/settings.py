import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.data_management.schemas import (
    SettingsResolveRequest,
    SettingsResolveResponse,
    SettingsV4Create,
    SettingsV4Response,
    SettingsV4Update,
)
from shared.auth import get_current_user
from shared.database import get_db_session
from shared.models import AudienceV4, DomainV4, EnvironmentV4, OrganizationV4, SettingsV4, UserV4
from shared.utils import create_audit_log

router = APIRouter(tags=["Settings"])
logger = logging.getLogger(__name__)


@router.get("/api/dm/settings", response_model=list[SettingsV4Response])
async def get_settings(
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        # Get all settings first
        settings_result = await db.execute(
            select(SettingsV4).order_by(SettingsV4.specificity.desc().nulls_last(), SettingsV4.key)
        )
        settings = settings_result.scalars().all()

        # Get all master tables for name lookups
        org_result = await db.execute(select(OrganizationV4))
        domain_result = await db.execute(select(DomainV4))
        env_result = await db.execute(select(EnvironmentV4))
        aud_result = await db.execute(select(AudienceV4))

        # Create lookup dictionaries
        orgs = {str(org.id): org.name for org in org_result.scalars().all()}
        domains = {str(domain.id): domain.name for domain in domain_result.scalars().all()}
        envs = {str(env.id): env.name for env in env_result.scalars().all()}
        auds = {str(aud.id): aud.name for aud in aud_result.scalars().all()}

        settings_list = []
        for setting in settings:
            org_name = orgs.get(str(setting.organization_id)) if setting.organization_id else None
            domain_name = domains.get(str(setting.domain_id)) if setting.domain_id else None
            env_name = envs.get(str(setting.environment_id)) if setting.environment_id else None
            aud_name = auds.get(str(setting.audience_id)) if setting.audience_id else None
            settings_list.append(format_settings_response(setting, org_name, domain_name, env_name, aud_name))

        await create_audit_log(
            db, request, current_user, "list", "settings_v4", "all", f"Retrieved {len(settings_list)} settings"
        )

        return settings_list
    except Exception as e:
        logger.error("Error retrieving settings: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve settings") from None


# Settings V4 helper functions
def format_settings_response(item, organization_name=None, domain_name=None, environment_name=None, audience_name=None):
    return SettingsV4Response(
        id=str(item.id),
        key=item.key,
        payload=item.payload,
        description=item.description,
        is_secret=item.is_secret,
        organization_id=str(item.organization_id) if item.organization_id else None,
        domain_id=str(item.domain_id) if item.domain_id else None,
        environment_id=str(item.environment_id) if item.environment_id else None,
        audience_id=str(item.audience_id) if item.audience_id else None,
        specificity=item.specificity,
        scope_key=item.scope_key,
        version=item.version,
        is_active=item.is_active,
        created_by=item.created_by,
        created_at=item.created_at.isoformat(),
        updated_by=item.updated_by,
        updated_at=item.updated_at.isoformat(),
        organization_name=organization_name,
        domain_name=domain_name,
        environment_name=environment_name,
        audience_name=audience_name,
    )


@router.post("/api/dm/settings", response_model=SettingsV4Response)
async def create_setting(
    setting: SettingsV4Create,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        # Check if key already exists in same scope
        filters = [SettingsV4.key == setting.key]
        if setting.organization_id:
            filters.append(SettingsV4.organization_id == uuid.UUID(setting.organization_id))
        else:
            filters.append(SettingsV4.organization_id.is_(None))
        if setting.domain_id:
            filters.append(SettingsV4.domain_id == uuid.UUID(setting.domain_id))
        else:
            filters.append(SettingsV4.domain_id.is_(None))
        if setting.environment_id:
            filters.append(SettingsV4.environment_id == uuid.UUID(setting.environment_id))
        else:
            filters.append(SettingsV4.environment_id.is_(None))
        if setting.audience_id:
            filters.append(SettingsV4.audience_id == uuid.UUID(setting.audience_id))
        else:
            filters.append(SettingsV4.audience_id.is_(None))

        result = await db.execute(select(SettingsV4).filter(and_(*filters)))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail="Setting key already exists in this scope")

        user_id = (
            current_user.get("user_id") if isinstance(current_user, dict) else str(getattr(current_user, "oid", None))
        )

        new_setting = SettingsV4(
            key=setting.key,
            payload=setting.payload,
            description=setting.description,
            is_secret=setting.is_secret,
            organization_id=uuid.UUID(setting.organization_id) if setting.organization_id else None,
            domain_id=uuid.UUID(setting.domain_id) if setting.domain_id else None,
            environment_id=uuid.UUID(setting.environment_id) if setting.environment_id else None,
            audience_id=uuid.UUID(setting.audience_id) if setting.audience_id else None,
            is_active=setting.is_active,
            created_by=user_id,
            updated_by=user_id,
        )

        db.add(new_setting)
        await db.commit()
        await db.refresh(new_setting)

        await create_audit_log(
            db,
            request,
            current_user,
            "create",
            "settings_v4",
            str(new_setting.id),
            f"Created setting: {setting.key}",
        )

        return format_settings_response(new_setting)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating setting: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create setting") from None


@router.put("/api/dm/settings/{setting_id}", response_model=SettingsV4Response)
async def update_setting(
    setting_id: str,
    setting: SettingsV4Update,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        result = await db.execute(select(SettingsV4).filter(SettingsV4.id == uuid.UUID(setting_id)))
        existing_setting = result.scalars().first()

        if not existing_setting:
            raise HTTPException(status_code=404, detail="Setting not found")

        # Update fields
        update_data = setting.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field in ["organization_id", "domain_id", "environment_id", "audience_id"] and value:
                setattr(existing_setting, field, uuid.UUID(value))
            else:
                setattr(existing_setting, field, value)

        user_id = (
            current_user.get("user_id") if isinstance(current_user, dict) else str(getattr(current_user, "oid", None))
        )
        existing_setting.updated_by = user_id

        await db.commit()
        await db.refresh(existing_setting)

        await create_audit_log(
            db,
            request,
            current_user,
            "update",
            "settings_v4",
            setting_id,
            f"Updated setting: {existing_setting.key}",
        )

        return format_settings_response(existing_setting)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating setting: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update setting") from None


@router.delete("/api/dm/settings/{setting_id}")
async def delete_setting(
    setting_id: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        result = await db.execute(select(SettingsV4).filter(SettingsV4.id == uuid.UUID(setting_id)))
        existing_setting = result.scalars().first()

        if not existing_setting:
            raise HTTPException(status_code=404, detail="Setting not found")

        await db.delete(existing_setting)
        await db.commit()

        await create_audit_log(
            db,
            request,
            current_user,
            "delete",
            "settings_v4",
            setting_id,
            f"Deleted setting: {existing_setting.key}",
        )

        return {"message": "Setting deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting setting: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete setting") from None


@router.post("/api/dm/settings/resolve", response_model=SettingsResolveResponse)
async def resolve_setting(
    resolve_request: SettingsResolveRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Resolve settings using metadata-driven approach with priority:
    Global → Environment → Organization → Domain → Audience
    For same specificity, latest updated_at wins.
    """
    try:
        key = resolve_request.key
        audience_key = resolve_request.audience_key
        oid = resolve_request.oid
        user_org_id = None
        user_domain_id = None
        user_env_id = None

        if oid:
            try:
                user_result = await db.execute(
                    select(UserV4.organization_id, UserV4.domain_id, UserV4.environment_id).filter(UserV4.oid == oid)
                )
                user_data = user_result.first()
                if user_data:
                    user_org_id, user_domain_id, user_env_id = user_data
            except Exception as e:
                logger.warning("Error fetching user metadata for oid '%s': %s", oid, e)

        # Get audience_id from audience_key
        audience_id = None
        if audience_key:
            audience_result = await db.execute(
                select(AudienceV4.id).filter(AudienceV4.code == audience_key, AudienceV4.is_active)
            )
            audience_data = audience_result.first()
            if audience_data:
                audience_id = audience_data[0]

        # Single SQL query with proper filtering logic
        # This query finds the best matching setting based on scope hierarchy
        query = (
            select(SettingsV4)
            .filter(
                SettingsV4.key == key,
                SettingsV4.is_active,
                ~SettingsV4.is_secret,
                # Scope matching: NULL means "applies to all", specific ID means "applies to that specific item"
                or_(SettingsV4.organization_id.is_(None), SettingsV4.organization_id == user_org_id),
                or_(SettingsV4.domain_id.is_(None), SettingsV4.domain_id == user_domain_id),
                or_(SettingsV4.environment_id.is_(None), SettingsV4.environment_id == user_env_id),
                or_(SettingsV4.audience_id.is_(None), SettingsV4.audience_id == audience_id),
            )
            .order_by(SettingsV4.specificity.desc().nulls_last(), SettingsV4.updated_at.desc())
            .limit(1)
        )

        result = await db.execute(query)
        setting = result.scalars().first()

        if setting:
            # Determine scope description for logging
            scope_parts = []
            if setting.organization_id:
                scope_parts.append("Organization")
            if setting.domain_id:
                scope_parts.append("Domain")
            if setting.environment_id:
                scope_parts.append("Environment")
            if setting.audience_id:
                scope_parts.append("Audience")

            scope_desc = "+".join(scope_parts) if scope_parts else "Global"

            await create_audit_log(
                db,
                request,
                current_user,
                "resolve",
                "settings_v4",
                str(setting.id),
                f"Resolved setting '{key}' from {scope_desc}",
            )

            return SettingsResolveResponse(
                key=key,
                resolved_payload=setting.payload,
                resolved_from=scope_desc,
                specificity=setting.specificity or 0,
                found=True,
            )

        # No setting found, log warning
        logger.warning("No setting found for key '%s' with oid='%s', audience_key='%s'", key, oid, audience_key)

        await create_audit_log(
            db, request, current_user, "resolve", "settings_v4", "none", f"Setting '{key}' not found - using default"
        )

        return SettingsResolveResponse(
            key=key,
            resolved_payload=None,
            resolved_from="Default (no setting found)",
            specificity=0,
            found=False,
        )

    except Exception as e:
        logger.error("Error resolving setting '%s': %s", resolve_request.key, e)
        raise HTTPException(status_code=500, detail="Failed to resolve setting") from None
