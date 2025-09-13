import logging
import os

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from shared.auth import get_current_user_dict
from shared.models import AuditLogV4, UserV4

logger = logging.getLogger(__name__)

# App mode configuration
APP_MODE = os.getenv("APP_MODE", "development").lower()
IS_AUTH_DISABLED = APP_MODE == "demo"


def get_demo_user():
    """Return demo user data when authentication is disabled"""
    return {
        "user_id": "demo-user-id",
        "username": "demo@example.com",
        "name": "Demo User",
        "email": "demo@example.com",
        "tenant_id": "demo-tenant-id",
        "is_authenticated": True,
    }


def extract_user_info(current_user: dict | UserV4) -> tuple[str, str]:
    """Extract user_id and tenant_id from current_user (dict or UserV4) consistently.

    Returns:
        tuple: (user_id, tenant_id)
    """
    # Handle UserV4 objects
    if hasattr(current_user, "oid"):
        user_id = str(current_user.oid)
        tenant_id = str(current_user.tenant_id)
        return user_id, tenant_id

    # Handle dict format
    if isinstance(current_user, dict):
        # For user_id, always prefer "user_id" over "id"
        user_id = current_user.get("user_id")
        if not user_id:
            user_id = current_user.get("id")
        if not user_id:
            user_id = current_user.get("oid")  # For direct token payload

        # For tenant_id, use "tenant_id" or "tid" or default
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            tenant_id = current_user.get("tid")  # For direct token payload
        if not tenant_id:
            tenant_id = "default"

        return str(user_id), str(tenant_id)

    raise ValueError(f"Unsupported current_user type: {type(current_user)}")


def get_user_dependency():
    """Return appropriate user dependency based on app mode"""
    if IS_AUTH_DISABLED:
        # Return a function that always returns demo user
        def demo_user_dependency():
            return get_demo_user()

        return demo_user_dependency
    else:
        # Return the dict-compatible authentication dependency
        return get_current_user_dict


async def create_audit_log(
    db: AsyncSession,
    request: Request,
    current_user: dict | UserV4,
    action: str,
    resource: str,
    resource_id: str,
    details: str,
):
    """Create audit log entry."""
    try:
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # current user can be a dict or a UserV4 class instance. Handle both cases carefully
        user_id = (
            current_user.get("user_id") if isinstance(current_user, dict) else str(getattr(current_user, "oid", None))
        )

        audit_log = AuditLogV4(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details,
            ip_address=client_ip,
            user_agent=user_agent,
        )

        db.add(audit_log)
        await db.commit()
    except Exception as e:
        logger.error("Failed to create audit log: %s", e)
        await db.rollback()
