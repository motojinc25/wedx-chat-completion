import logging
import uuid

from fastapi import HTTPException, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.data_management.schemas import MasterTableCreate, MasterTableResponse, MasterTableUpdate
from shared.utils import create_audit_log

logger = logging.getLogger(__name__)


def format_master_table_response(item):
    return MasterTableResponse(
        id=str(item.id),
        code=item.code,
        name=item.name,
        description=item.description,
        is_active=item.is_active,
        created_by=item.created_by,
        created_at=item.created_at.isoformat(),
        updated_by=item.updated_by,
        updated_at=item.updated_at.isoformat(),
    )


async def create_master_item(
    item_data: MasterTableCreate,
    request: Request,
    current_user,
    db: AsyncSession,
    model_class,
    entity_name: str,
):
    """Generic function to create master data items."""
    try:
        # Check if code already exists
        result = await db.execute(select(model_class).filter(model_class.code == item_data.code))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail=f"{entity_name.capitalize()} code already exists")

        user_id = (
            current_user.get("user_id") if isinstance(current_user, dict) else str(getattr(current_user, "oid", None))
        )

        new_item = model_class(
            code=item_data.code,
            name=item_data.name,
            description=item_data.description,
            is_active=item_data.is_active,
            created_by=user_id,
            updated_by=user_id,
        )

        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)

        await create_audit_log(
            db,
            request,
            current_user,
            "create",
            f"{entity_name}_v4",
            str(new_item.id),
            f"Created {entity_name}: {item_data.name}",
        )

        return format_master_table_response(new_item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating %s: %s", entity_name, e)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create {entity_name}") from None


async def update_master_item(
    item_id: str,
    item_data: MasterTableUpdate,
    request: Request,
    current_user,
    db: AsyncSession,
    model_class,
    entity_name: str,
):
    """Generic function to update master data items."""
    try:
        result = await db.execute(select(model_class).filter(model_class.id == uuid.UUID(item_id)))
        existing_item = result.scalars().first()

        if not existing_item:
            raise HTTPException(status_code=404, detail=f"{entity_name.capitalize()} not found")

        # Check if code already exists (excluding current item)
        if item_data.code and item_data.code != existing_item.code:
            result = await db.execute(
                select(model_class).filter(
                    and_(model_class.code == item_data.code, model_class.id != uuid.UUID(item_id))
                )
            )
            if result.scalars().first():
                raise HTTPException(status_code=400, detail=f"{entity_name.capitalize()} code already exists")

        # Update fields
        for field, value in item_data.dict(exclude_unset=True).items():
            setattr(existing_item, field, value)

        user_id = (
            current_user.get("user_id") if isinstance(current_user, dict) else str(getattr(current_user, "oid", None))
        )
        existing_item.updated_by = user_id

        await db.commit()
        await db.refresh(existing_item)

        await create_audit_log(
            db,
            request,
            current_user,
            "update",
            f"{entity_name}_v4",
            item_id,
            f"Updated {entity_name}: {existing_item.name}",
        )

        return format_master_table_response(existing_item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating %s: %s", entity_name, e)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update {entity_name}") from None


async def delete_master_item(
    item_id: str,
    request: Request,
    current_user,
    db: AsyncSession,
    model_class,
    entity_name: str,
):
    """Generic function to delete master data items."""
    try:
        result = await db.execute(select(model_class).filter(model_class.id == uuid.UUID(item_id)))
        existing_item = result.scalars().first()

        if not existing_item:
            raise HTTPException(status_code=404, detail=f"{entity_name.capitalize()} not found")

        item_name = existing_item.name
        await db.delete(existing_item)
        await db.commit()

        await create_audit_log(
            db,
            request,
            current_user,
            "delete",
            f"{entity_name}_v4",
            item_id,
            f"Deleted {entity_name}: {item_name}",
        )

        return {"message": f"{entity_name.capitalize()} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting %s: %s", entity_name, e)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete {entity_name}") from None
