from datetime import UTC, datetime
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from shared.models import TenantV4, UserV4


class UserManager:
    """Manages JIT provisioning of tenants and users from JWT claims."""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def get_or_create_tenant(self, tenant_id: str) -> TenantV4:
        """Get existing tenant or create new one."""
        # Convert string to UUID
        tenant_uuid = uuid.UUID(tenant_id)

        # Try to find existing tenant
        result = await self.db.execute(select(TenantV4).where(TenantV4.tenant_id == tenant_uuid))
        tenant = result.scalar_one_or_none()

        if tenant:
            return tenant

        # Create new tenant
        tenant = TenantV4(tenant_id=tenant_uuid)

        try:
            self.db.add(tenant)
            await self.db.commit()
            await self.db.refresh(tenant)
            return tenant
        except IntegrityError:
            # Handle race condition - another process may have created the tenant
            await self.db.rollback()
            result = await self.db.execute(select(TenantV4).where(TenantV4.tenant_id == tenant_uuid))
            return result.scalar_one()

    async def get_or_create_user(
        self,
        tenant_id: str,
        oid: str,
        issuer: str,
        display_name: str | None = None,
        upn: str | None = None,
        email: str | None = None,
        roles: list | None = None,
        groups: list | None = None,
    ) -> UserV4:
        """Get existing user or create new one with JIT provisioning."""
        # Convert strings to UUIDs
        tenant_uuid = uuid.UUID(tenant_id)
        oid_uuid = uuid.UUID(oid)

        # Ensure tenant exists
        await self.get_or_create_tenant(tenant_id)

        # Try to find existing user
        result = await self.db.execute(select(UserV4).where(UserV4.tenant_id == tenant_uuid, UserV4.oid == oid_uuid))
        user = result.scalar_one_or_none()

        if user:
            # Update user information
            updated = False

            if display_name and user.display_name != display_name:
                user.display_name = display_name
                updated = True

            if upn and user.upn != upn:
                user.upn = upn
                updated = True

            if email and user.email != email:
                user.email = email
                updated = True

            if roles is not None and user.roles != roles:
                user.roles = roles
                updated = True

            if groups is not None and user.groups != groups:
                user.groups = groups
                updated = True

            # Update last login time
            user.last_login_at = datetime.now(UTC)
            updated = True

            if updated:
                await self.db.commit()
                await self.db.refresh(user)

            return user

        # Create new user
        user = UserV4(
            tenant_id=tenant_uuid,
            oid=oid_uuid,
            issuer=issuer,
            display_name=display_name,
            upn=upn,
            email=email,
            roles=roles or [],
            groups=groups or [],
            last_login_at=datetime.now(UTC),
        )

        try:
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            return user
        except IntegrityError:
            # Handle race condition - another process may have created the user
            await self.db.rollback()
            result = await self.db.execute(
                select(UserV4).where(UserV4.tenant_id == tenant_uuid, UserV4.oid == oid_uuid)
            )
            return result.scalar_one()

    async def upsert_user_from_token(self, token_payload: dict) -> UserV4:
        """
        Create or update user from JWT token payload.

        Args:
            token_payload: Decoded JWT token containing user claims

        Returns:
            UserV4: The created or updated user object
        """
        # Extract required fields
        tenant_id = token_payload.get("tid")
        oid = token_payload.get("oid")
        issuer = token_payload.get("iss")

        if not all([tenant_id, oid, issuer]):
            raise ValueError("Missing required token claims: tid, oid, or iss")

        # Extract optional fields
        display_name = token_payload.get("name")
        upn = token_payload.get("preferred_username")
        email = token_payload.get("email")

        # Try alternative email fields if email is not present
        if not email:
            # Check common alternative email fields in Azure AD tokens
            email = (
                token_payload.get("unique_name") or token_payload.get("preferred_username") or token_payload.get("upn")
            )

        # Extract roles and groups (may not be present in all tokens)
        roles = token_payload.get("roles", [])
        groups = token_payload.get("groups", [])

        # Ensure roles and groups are lists
        if not isinstance(roles, list):
            roles = []
        if not isinstance(groups, list):
            groups = []

        return await self.get_or_create_user(
            tenant_id=tenant_id,
            oid=oid,
            issuer=issuer,
            display_name=display_name,
            upn=upn,
            email=email,
            roles=roles,
            groups=groups,
        )
