import uuid

import sqlalchemy as sa
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from shared.database import Base


class AuditLogV4(Base):
    """Audit log model for tracking user actions."""

    __tablename__ = "audit_logs_v4"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(255), nullable=True)  # Can be null for system actions, stores UUID as string
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)  # Supports IPv6
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<AuditLogV4(id={self.id}, action='{self.action}', user_id={self.user_id})>"


class OrganizationV4(Base):
    """Organization master table."""

    __tablename__ = "organization_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<OrganizationV4(id={self.id}, code='{self.code}', name='{self.name}')>"


class DomainV4(Base):
    """Domain master table."""

    __tablename__ = "domain_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<DomainV4(id={self.id}, code='{self.code}', name='{self.name}')>"


class EnvironmentV4(Base):
    """Environment master table."""

    __tablename__ = "environment_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<EnvironmentV4(id={self.id}, code='{self.code}', name='{self.name}')>"


class AudienceV4(Base):
    """Audience master table."""

    __tablename__ = "audience_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<AudienceV4(id={self.id}, code='{self.code}', name='{self.name}')>"


class SettingsV4(Base):
    """Settings v4 model with scope-audience-key design for unified configuration management."""

    __tablename__ = "settings_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(Text, nullable=False)
    payload = Column(JSONB, nullable=False)
    description = Column(Text, nullable=True)
    is_secret = Column(Boolean, default=False, nullable=False)

    # Scope references (NULL means "common/general")
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organization_v4.id"), nullable=True)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("domain_v4.id"), nullable=True)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environment_v4.id"), nullable=True)
    audience_id = Column(UUID(as_uuid=True), ForeignKey("audience_v4.id"), nullable=True)

    # Auto-computed columns (handled by DB triggers/computed columns)
    # These are generated columns and should not be inserted/updated directly
    specificity = Column(
        SmallInteger,
        Computed("""
        (CASE WHEN organization_id IS NOT NULL THEN 2 ELSE 0 END) +
        (CASE WHEN domain_id IS NOT NULL THEN 3 ELSE 0 END) +
        (CASE WHEN environment_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN audience_id IS NOT NULL THEN 10 ELSE 0 END)
    """),
        nullable=True,
    )  # Auto-computed specificity score
    scope_key = Column(
        Text,
        Computed("""
        COALESCE(organization_id::text,'-') || '|' ||
        COALESCE(domain_id::text,'-') || '|' ||
        COALESCE(environment_id::text,'-') || '|' ||
        COALESCE(audience_id::text,'-')
    """),
        nullable=True,
    )  # Auto-computed scope key for uniqueness

    # Versioning and metadata
    version = Column(BigInteger, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    organization = relationship("OrganizationV4", backref="settings")
    domain = relationship("DomainV4", backref="settings")
    environment = relationship("EnvironmentV4", backref="settings")
    audience = relationship("AudienceV4", backref="settings")

    def __repr__(self):
        scope_parts = []
        if self.organization_id:
            scope_parts.append(f"org={self.organization_id}")
        if self.domain_id:
            scope_parts.append(f"domain={self.domain_id}")
        if self.environment_id:
            scope_parts.append(f"env={self.environment_id}")
        if self.audience_id:
            scope_parts.append(f"aud={self.audience_id}")

        scope_str = f"[{','.join(scope_parts)}]" if scope_parts else "[global]"
        return f"<SettingsV4(id={self.id}, key='{self.key}', scope={scope_str})>"


class TenantV4(Base):
    """Tenant v4 model for multi-tenancy support."""

    __tablename__ = "tenants_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<TenantV4(id={self.id}, tenant_id={self.tenant_id})>"


class UserV4(Base):
    """User v4 model for user management with Entra ID integration."""

    __tablename__ = "users_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True), ForeignKey("tenants_v4.tenant_id", onupdate="CASCADE", ondelete="CASCADE"), nullable=False
    )
    oid = Column(UUID(as_uuid=True), nullable=False)  # Entra ID Object ID
    issuer = Column(Text, nullable=False)  # Token issuer for verification
    display_name = Column(Text, nullable=True)
    upn = Column(Text, nullable=True, index=True)  # User Principal Name
    email = Column(Text, nullable=True, index=True)
    roles = Column(JSONB, nullable=False, default=list)
    groups = Column(JSONB, nullable=False, default=list)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Master data references (optional)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organization_v4.id"), nullable=True)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("domain_v4.id"), nullable=True)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environment_v4.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant = relationship("TenantV4", backref="users")
    organization = relationship("OrganizationV4", backref="users")
    domain = relationship("DomainV4", backref="users")
    environment = relationship("EnvironmentV4", backref="users")

    # Unique constraint on tenant_id + oid
    __table_args__ = (sa.UniqueConstraint("tenant_id", "oid", name="uq_users_v4_tenant_oid"),)

    def __repr__(self):
        return f"<UserV4(id={self.id}, oid={self.oid}, upn='{self.upn}', email='{self.email}')>"


class ChatSessionV4(Base):
    """Chat session v4 model for storing conversation sessions."""

    __tablename__ = "chat_sessions_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users_v4.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("UserV4", backref="chat_sessions")
    messages = relationship("ChatMessageV4", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ChatSessionV4(id={self.id}, user_id={self.user_id}, title='{self.title}')>"


class ChatMessageV4(Base):
    """Chat message v4 model for storing individual messages in conversations."""

    __tablename__ = "chat_messages_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions_v4.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users_v4.id", ondelete="SET NULL"), nullable=True)
    role = Column(Text, nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    message_metadata = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("ChatSessionV4", back_populates="messages")
    user = relationship("UserV4", backref="chat_messages")

    # Check constraint for role
    __table_args__ = (sa.CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_chat_messages_v4_role"),)

    def __repr__(self):
        return f"<ChatMessageV4(id={self.id}, session_id={self.session_id}, role='{self.role}')>"


class OtelMetricsV4(Base):
    """OpenTelemetry Metric model."""

    __tablename__ = "otel_metrics_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_name = Column(Text, nullable=False)
    ts = Column(DateTime(timezone=True), nullable=False)
    resource_attrs = Column(JSONB, nullable=True)
    scope_attrs = Column(JSONB, nullable=True)
    data = Column(JSONB, nullable=True)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<OtelMetricsV4(id={self.id}, metric_name='{self.metric_name}')>"


class OtelSpansV4(Base):
    """OpenTelemetry Span model."""

    __tablename__ = "otel_spans_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trace_id = Column(Text, nullable=False)
    span_id = Column(Text, nullable=False)
    parent_id = Column(Text, nullable=True)  # Changed to nullable
    name = Column(Text, nullable=False)
    kind = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)

    # Add computed column for duration in milliseconds
    duration_ms = Column(sa.Numeric, Computed("EXTRACT(EPOCH FROM (end_time - start_time)) * 1000.0"), nullable=True)

    status_code = Column(Text, nullable=True)
    service_name = Column(Text, nullable=True)
    service_version = Column(Text, nullable=True)

    # Add GenAI computed columns
    operation_name = Column(Text, Computed("(attributes->>'gen_ai.operation.name')"), nullable=True)
    model_name = Column(Text, Computed("(attributes->>'gen_ai.request.model')"), nullable=True)

    resource_attr = Column(JSONB, nullable=True)
    attributes = Column(JSONB, nullable=True)
    events = Column(JSONB, nullable=True)
    links = Column(JSONB, nullable=True)
    raw = Column(JSONB, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<OtelSpansV4(id={self.id}, name='{self.name}')>"


class OtelLogsV4(Base):
    """OpenTelemetry Log model."""

    __tablename__ = "otel_logs_v4"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_name = Column(Text, nullable=True)
    trace_id = Column(Text, nullable=True)
    span_id = Column(Text, nullable=True)
    trace_flags = Column(SmallInteger, nullable=True)
    time = Column(DateTime(timezone=True), nullable=False)
    observed_time = Column(DateTime(timezone=True), nullable=True)
    severity_number = Column(SmallInteger, nullable=True)
    severity_text = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)
    body_json = Column(JSONB, nullable=True)
    attributes = Column(JSONB, nullable=False, default={})  # Changed to NOT NULL with default
    resource = Column(JSONB, nullable=False, default={})  # Changed to NOT NULL with default
    dropped_attributes = Column(Integer, nullable=True)

    # Add computed columns
    service_name = Column(Text, Computed("(resource->'attributes'->>'service.name')"), nullable=True)
    code_function_name = Column(Text, Computed("(attributes->>'code.function.name')"), nullable=True)

    raw = Column(JSONB, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<OtelLogsV4(id={self.id}, event_name='{self.event_name}')>"
