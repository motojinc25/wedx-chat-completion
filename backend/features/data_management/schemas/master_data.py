from pydantic import BaseModel


class MasterTableBase(BaseModel):
    code: str
    name: str
    description: str | None = None
    is_active: bool = True


class MasterTableCreate(MasterTableBase):
    pass


class MasterTableUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class MasterTableResponse(MasterTableBase):
    id: str
    created_by: str | None
    created_at: str
    updated_by: str | None
    updated_at: str

    class Config:
        from_attributes = True
