from pydantic import BaseModel


class UserV4Response(BaseModel):
    id: str
    tenant_id: str
    oid: str
    issuer: str
    display_name: str | None
    upn: str | None
    email: str | None
    roles: list
    groups: list
    last_login_at: str | None
    organization_id: str | None = None
    domain_id: str | None = None
    environment_id: str | None = None
    created_at: str
    updated_at: str
    tenant_display_name: str | None = None
    organization_name: str | None = None
    domain_name: str | None = None
    environment_name: str | None = None

    class Config:
        from_attributes = True


class UserV4UpdateRequest(BaseModel):
    organization_id: str | None = None
    domain_id: str | None = None
    environment_id: str | None = None
