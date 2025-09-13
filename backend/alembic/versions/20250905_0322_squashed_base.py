"""squashed base

Revision ID: 2ba7cf13f9be
Revises:
Create Date: 2025-09-05 03:22:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision = "2ba7cf13f9be"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create audit_logs_v4 table
    op.create_table(
        "audit_logs_v4",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("user_id", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource", sa.String(length=100), nullable=True),
        sa.Column("resource_id", sa.String(length=100), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_v4_id"), "audit_logs_v4", ["id"], unique=False)

    # Create organization_v4 table
    op.create_table(
        "organization_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_organization_v4_code"), "organization_v4", ["code"], unique=False)
    op.create_index(op.f("ix_organization_v4_is_active"), "organization_v4", ["is_active"], unique=False)

    # Create domain_v4 table
    op.create_table(
        "domain_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_domain_v4_code"), "domain_v4", ["code"], unique=False)
    op.create_index(op.f("ix_domain_v4_is_active"), "domain_v4", ["is_active"], unique=False)

    # Create environment_v4 table
    op.create_table(
        "environment_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_environment_v4_code"), "environment_v4", ["code"], unique=False)
    op.create_index(op.f("ix_environment_v4_is_active"), "environment_v4", ["is_active"], unique=False)

    # Create audience_v4 table
    op.create_table(
        "audience_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_audience_v4_code"), "audience_v4", ["code"], unique=False)
    op.create_index(op.f("ix_audience_v4_is_active"), "audience_v4", ["is_active"], unique=False)

    # Create tenants_v4 table
    op.create_table(
        "tenants_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tenants_v4_tenant_id"), "tenants_v4", ["tenant_id"], unique=True)

    # Create settings_v4 table
    op.create_table(
        "settings_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_secret", sa.Boolean(), nullable=False, default=False),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=True),
        sa.Column("domain_id", UUID(as_uuid=True), nullable=True),
        sa.Column("environment_id", UUID(as_uuid=True), nullable=True),
        sa.Column("audience_id", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "specificity",
            sa.SmallInteger(),
            sa.Computed("""
        (CASE WHEN organization_id IS NOT NULL THEN 2 ELSE 0 END) +
        (CASE WHEN domain_id IS NOT NULL THEN 3 ELSE 0 END) +
        (CASE WHEN environment_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN audience_id IS NOT NULL THEN 10 ELSE 0 END)
    """),
            nullable=True,
        ),
        sa.Column(
            "scope_key",
            sa.Text(),
            sa.Computed("""
        COALESCE(organization_id::text,'-') || '|' ||
        COALESCE(domain_id::text,'-') || '|' ||
        COALESCE(environment_id::text,'-') || '|' ||
        COALESCE(audience_id::text,'-')
    """),
            nullable=True,
        ),
        sa.Column("version", sa.BigInteger(), nullable=False, default=1),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["audience_id"],
            ["audience_v4.id"],
        ),
        sa.ForeignKeyConstraint(
            ["domain_id"],
            ["domain_v4.id"],
        ),
        sa.ForeignKeyConstraint(
            ["environment_id"],
            ["environment_v4.id"],
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization_v4.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create users_v4 table
    op.create_table(
        "users_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("oid", UUID(as_uuid=True), nullable=False),
        sa.Column("issuer", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("upn", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("roles", JSONB(), nullable=False, default=sa.text("'[]'::jsonb")),
        sa.Column("groups", JSONB(), nullable=False, default=sa.text("'[]'::jsonb")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=True),
        sa.Column("domain_id", UUID(as_uuid=True), nullable=True),
        sa.Column("environment_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["domain_id"],
            ["domain_v4.id"],
        ),
        sa.ForeignKeyConstraint(
            ["environment_id"],
            ["environment_v4.id"],
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization_v4.id"],
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants_v4.tenant_id"], onupdate="CASCADE", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "oid", name="uq_users_v4_tenant_oid"),
    )
    op.create_index(op.f("ix_users_v4_upn"), "users_v4", ["upn"], unique=False)
    op.create_index(op.f("ix_users_v4_email"), "users_v4", ["email"], unique=False)

    # Create chat_sessions_v4 table
    op.create_table(
        "chat_sessions_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users_v4.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create chat_messages_v4 table
    op.create_table(
        "chat_messages_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_metadata", JSONB(), nullable=False, default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_chat_messages_v4_role"),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions_v4.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users_v4.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create otel_metrics_v4 table
    op.create_table(
        "otel_metrics_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("metric_name", sa.Text(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resource_attrs", JSONB(), nullable=True),
        sa.Column("scope_attrs", JSONB(), nullable=True),
        sa.Column("data", JSONB(), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create otel_spans_v4 table
    op.create_table(
        "otel_spans_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("trace_id", sa.Text(), nullable=False),
        sa.Column("span_id", sa.Text(), nullable=False),
        sa.Column("parent_id", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "duration_ms",
            sa.Numeric(),
            sa.Computed("EXTRACT(EPOCH FROM (end_time - start_time)) * 1000.0"),
            nullable=True,
        ),
        sa.Column("status_code", sa.Text(), nullable=True),
        sa.Column("service_name", sa.Text(), nullable=True),
        sa.Column("service_version", sa.Text(), nullable=True),
        sa.Column("operation_name", sa.Text(), sa.Computed("(attributes->>'gen_ai.operation.name')"), nullable=True),
        sa.Column("model_name", sa.Text(), sa.Computed("(attributes->>'gen_ai.request.model')"), nullable=True),
        sa.Column("resource_attr", JSONB(), nullable=True),
        sa.Column("attributes", JSONB(), nullable=True),
        sa.Column("events", JSONB(), nullable=True),
        sa.Column("links", JSONB(), nullable=True),
        sa.Column("raw", JSONB(), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create otel_logs_v4 table
    op.create_table(
        "otel_logs_v4",
        sa.Column("id", UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("event_name", sa.Text(), nullable=True),
        sa.Column("trace_id", sa.Text(), nullable=True),
        sa.Column("span_id", sa.Text(), nullable=True),
        sa.Column("trace_flags", sa.SmallInteger(), nullable=True),
        sa.Column("time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("observed_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("severity_number", sa.SmallInteger(), nullable=True),
        sa.Column("severity_text", sa.Text(), nullable=True),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("body_json", JSONB(), nullable=True),
        sa.Column("attributes", JSONB(), nullable=False, default=sa.text("'{}'::jsonb")),
        sa.Column("resource", JSONB(), nullable=False, default=sa.text("'{}'::jsonb")),
        sa.Column("dropped_attributes", sa.Integer(), nullable=True),
        sa.Column("service_name", sa.Text(), sa.Computed("(resource->'attributes'->>'service.name')"), nullable=True),
        sa.Column("code_function_name", sa.Text(), sa.Computed("(attributes->>'code.function.name')"), nullable=True),
        sa.Column("raw", JSONB(), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create triggers for updated_at columns
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Add triggers for tables with updated_at columns
    for table in [
        "organization_v4",
        "domain_v4",
        "environment_v4",
        "audience_v4",
        "tenants_v4",
        "users_v4",
        "chat_sessions_v4",
    ]:
        op.execute(f"""
            CREATE TRIGGER trigger_update_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at();
        """)


def downgrade() -> None:
    # Drop triggers
    for table in [
        "organization_v4",
        "domain_v4",
        "environment_v4",
        "audience_v4",
        "tenants_v4",
        "users_v4",
        "chat_sessions_v4",
    ]:
        op.execute(f"DROP TRIGGER IF EXISTS trigger_update_{table}_updated_at ON {table};")

    # Drop function
    op.execute("DROP FUNCTION IF EXISTS update_updated_at();")

    # Drop tables in reverse dependency order
    op.drop_table("otel_logs_v4")
    op.drop_table("otel_spans_v4")
    op.drop_table("otel_metrics_v4")
    op.drop_table("chat_messages_v4")
    op.drop_table("chat_sessions_v4")
    op.drop_table("users_v4")
    op.drop_table("settings_v4")
    op.drop_table("tenants_v4")
    op.drop_table("audience_v4")
    op.drop_table("environment_v4")
    op.drop_table("domain_v4")
    op.drop_table("organization_v4")
    op.drop_table("audit_logs_v4")
