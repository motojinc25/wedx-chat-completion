from pydantic import BaseModel


class SettingsV4Base(BaseModel):
    key: str
    payload: dict | list | str | int | float | bool
    description: str | None = None
    is_secret: bool = False
    organization_id: str | None = None
    domain_id: str | None = None
    environment_id: str | None = None
    audience_id: str | None = None
    is_active: bool = True


class SettingsV4Create(SettingsV4Base):
    pass


class SettingsV4Update(BaseModel):
    key: str | None = None
    payload: dict | list | str | int | float | bool | None = None
    description: str | None = None
    is_secret: bool | None = None
    organization_id: str | None = None
    domain_id: str | None = None
    environment_id: str | None = None
    audience_id: str | None = None
    is_active: bool | None = None


class SettingsV4Response(SettingsV4Base):
    id: str
    specificity: int | None
    scope_key: str | None
    version: int
    created_by: str | None
    created_at: str
    updated_by: str | None
    updated_at: str
    # Joined master data
    organization_name: str | None = None
    domain_name: str | None = None
    environment_name: str | None = None
    audience_name: str | None = None

    class Config:
        from_attributes = True


class SettingsResolveRequest(BaseModel):
    key: str
    audience_key: str = "react_admin"
    oid: str | None = None  # Microsoft Entra ID Object ID for user lookup


class SettingsResolveResponse(BaseModel):
    key: str
    resolved_payload: dict | list | str | int | float | bool
    resolved_from: str  # Description of which scope resolved this setting
    specificity: int
    found: bool
