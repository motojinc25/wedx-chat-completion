from pydantic import BaseModel


class TenantV4Response(BaseModel):
    id: str
    tenant_id: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
