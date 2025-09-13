"""
Tests for database models.
"""

import pytest
import uuid
from datetime import datetime

from shared.models import AuditLogV4, SettingsV4, OrganizationV4, DomainV4, EnvironmentV4, AudienceV4


@pytest.mark.asyncio
class TestAuditLogV4Model:
    """Test AuditLogV4 model functionality."""

    async def test_create_audit_log(self, test_db_session):
        """Test creating an audit log entry."""
        audit_log = AuditLogV4(
            user_id=f"test-user-{uuid.uuid4()}",
            action=f"test_action_{uuid.uuid4()}",
            resource="test_resource",
            resource_id=f"test_resource_{uuid.uuid4()}",
            details="Test audit log entry",
            ip_address="192.168.1.1",
            user_agent="Test User Agent"
        )
        
        test_db_session.add(audit_log)
        await test_db_session.flush()
        
        # Refresh to get the auto-generated fields
        await test_db_session.refresh(audit_log)
        
        assert audit_log.id is not None
        assert audit_log.user_id.startswith("test-user-")
        assert audit_log.action.startswith("test_action_")
        assert audit_log.resource == "test_resource"
        assert audit_log.resource_id.startswith("test_resource_")
        assert audit_log.details == "Test audit log entry"
        assert audit_log.ip_address == "192.168.1.1"
        assert audit_log.user_agent == "Test User Agent"
        assert isinstance(audit_log.created_at, datetime)

    async def test_audit_log_nullable_fields(self, test_db_session):
        """Test audit log with nullable fields."""
        audit_log = AuditLogV4(action=f"minimal_action_{uuid.uuid4()}")
        
        test_db_session.add(audit_log)
        await test_db_session.flush()
        await test_db_session.refresh(audit_log)
        
        assert audit_log.id is not None
        assert audit_log.action.startswith("minimal_action_")
        assert audit_log.user_id is None
        assert audit_log.resource is None
        assert audit_log.resource_id is None
        assert audit_log.details is None
        assert audit_log.ip_address is None
        assert audit_log.user_agent is None
        assert isinstance(audit_log.created_at, datetime)

    async def test_audit_log_repr(self, test_db_session):
        """Test audit log string representation."""
        test_user_id = f"test-user-{uuid.uuid4()}"
        test_action = f"test_action_{uuid.uuid4()}"
        audit_log = AuditLogV4(
            user_id=test_user_id,
            action=test_action
        )
        
        test_db_session.add(audit_log)
        await test_db_session.flush()
        await test_db_session.refresh(audit_log)
        
        repr_str = repr(audit_log)
        assert "AuditLogV4" in repr_str
        assert test_action in repr_str
        assert test_user_id in repr_str



@pytest.mark.asyncio
class TestMasterTableModels:
    """Test master table models functionality."""

    async def test_create_organization(self, test_db_session):
        """Test creating an organization."""
        organization = OrganizationV4(
            code=f"test_org_{uuid.uuid4().hex[:8]}",
            name="Test Organization",
            description="Test organization description",
            created_by="test_user"
        )
        
        test_db_session.add(organization)
        await test_db_session.flush()
        await test_db_session.refresh(organization)
        
        assert organization.id is not None
        assert organization.code.startswith("test_org_")
        assert organization.name == "Test Organization"
        assert organization.description == "Test organization description"
        assert organization.is_active is True
        assert organization.created_by == "test_user"
        assert isinstance(organization.created_at, datetime)
        assert isinstance(organization.updated_at, datetime)

    async def test_create_domain(self, test_db_session):
        """Test creating a domain."""
        domain = DomainV4(
            code=f"test_domain_{uuid.uuid4().hex[:8]}",
            name="Test Domain",
            description="Test domain description"
        )
        
        test_db_session.add(domain)
        await test_db_session.flush()
        await test_db_session.refresh(domain)
        
        assert domain.id is not None
        assert domain.code.startswith("test_domain_")
        assert domain.name == "Test Domain"
        assert domain.is_active is True
        assert isinstance(domain.created_at, datetime)

    async def test_create_environment(self, test_db_session):
        """Test creating an environment."""
        environment = EnvironmentV4(
            code=f"test_env_{uuid.uuid4().hex[:8]}",
            name="Test Environment"
        )
        
        test_db_session.add(environment)
        await test_db_session.flush()
        await test_db_session.refresh(environment)
        
        assert environment.id is not None
        assert environment.code.startswith("test_env_")
        assert environment.name == "Test Environment"
        assert environment.is_active is True

    async def test_create_audience(self, test_db_session):
        """Test creating an audience."""
        audience = AudienceV4(
            code=f"test_aud_{uuid.uuid4().hex[:8]}",
            name="Test Audience"
        )
        
        test_db_session.add(audience)
        await test_db_session.flush()
        await test_db_session.refresh(audience)
        
        assert audience.id is not None
        assert audience.code.startswith("test_aud_")
        assert audience.name == "Test Audience"
        assert audience.is_active is True


@pytest.mark.asyncio
class TestSettingsV4Model:
    """Test SettingsV4 model functionality."""

    async def test_create_global_setting(self, test_db_session):
        """Test creating a global setting."""
        setting = SettingsV4(
            key=f"test.global.setting.{uuid.uuid4().hex[:8]}",
            payload={"test": "value", "number": 123},
            is_secret=False,
            created_by="test_user"
        )
        
        test_db_session.add(setting)
        await test_db_session.flush()
        await test_db_session.refresh(setting)
        
        assert setting.id is not None
        assert setting.key.startswith("test.global.setting.")
        assert setting.payload == {"test": "value", "number": 123}
        assert setting.is_secret is False
        assert setting.is_active is True
        assert setting.version == 1
        assert setting.created_by == "test_user"
        assert isinstance(setting.created_at, datetime)
        assert isinstance(setting.updated_at, datetime)
        
        # Global setting should have no scope references
        assert setting.organization_id is None
        assert setting.domain_id is None
        assert setting.environment_id is None
        assert setting.audience_id is None

    async def test_create_simple_scoped_setting(self, test_db_session):
        """Test creating a simple scoped setting."""
        # Create one master table entry
        organization = OrganizationV4(
            code=f"test_org_{uuid.uuid4().hex[:8]}",
            name="Test Organization"
        )
        
        test_db_session.add(organization)
        await test_db_session.flush()
        await test_db_session.refresh(organization)
        
        # Create scoped setting
        setting = SettingsV4(
            key=f"test.scoped.setting.{uuid.uuid4().hex[:8]}",
            payload={"scoped": True},
            organization_id=organization.id,
            is_secret=True
        )
        
        test_db_session.add(setting)
        await test_db_session.flush()
        await test_db_session.refresh(setting)
        
        assert setting.organization_id == organization.id
        assert setting.is_secret is True

    async def test_setting_secret_flag(self, test_db_session):
        """Test setting secret flag."""
        secret_setting = SettingsV4(
            key=f"test.secret.setting.{uuid.uuid4().hex[:8]}",
            payload={"password": "secret123"},
            is_secret=True
        )
        
        test_db_session.add(secret_setting)
        await test_db_session.flush()
        await test_db_session.refresh(secret_setting)
        
        assert secret_setting.is_secret is True

    async def test_setting_active_flag(self, test_db_session):
        """Test setting active flag."""
        inactive_setting = SettingsV4(
            key=f"test.inactive.setting.{uuid.uuid4().hex[:8]}",
            payload={"status": "disabled"},
            is_active=False
        )
        
        test_db_session.add(inactive_setting)
        await test_db_session.flush()
        await test_db_session.refresh(inactive_setting)
        
        assert inactive_setting.is_active is False

    async def test_setting_versioning(self, test_db_session):
        """Test setting version field."""
        setting = SettingsV4(
            key=f"test.version.setting.{uuid.uuid4().hex[:8]}",
            payload={"version": "1.0"},
            version=5
        )
        
        test_db_session.add(setting)
        await test_db_session.flush()
        await test_db_session.refresh(setting)
        
        assert setting.version == 5


