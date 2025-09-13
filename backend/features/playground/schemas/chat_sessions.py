from pydantic import BaseModel


class ChatSessionCreateRequest(BaseModel):
    """Schema for creating a chat session."""

    title: str | None = None


class ChatSessionResponse(BaseModel):
    """Schema for chat session response."""

    id: str
    user_id: str
    title: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ChatMessageCreateRequest(BaseModel):
    """Schema for creating a chat message."""

    session_id: str
    role: str  # 'user', 'assistant', 'system'
    content: str
    metadata: dict | None = None


class ChatMessageEditRequest(BaseModel):
    """Schema for editing a chat message."""

    role: str  # 'user', 'assistant', 'system'
    content: str
    metadata: dict | None = None


class ChatMessageResponse(BaseModel):
    """Schema for chat message response."""

    id: str
    session_id: str
    user_id: str | None
    role: str
    content: str
    metadata: dict
    created_at: str

    class Config:
        from_attributes = True
