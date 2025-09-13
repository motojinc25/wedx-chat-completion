from pydantic import BaseModel


class ChatMessage(BaseModel):
    """Schema for chat message."""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Schema for chat request with system message support."""

    messages: list[ChatMessage]
    system_message: str | None = None
    max_tokens: int = 2000
    temperature: float = 0.7
    top_p: float = 0.9
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    function_calling: bool = True
