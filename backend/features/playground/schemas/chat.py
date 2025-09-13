from pydantic import BaseModel

from features.ai.schemas import ChatMessage


class ChatCompletionRequest(BaseModel):
    """Schema for chat completion request."""

    messages: list[ChatMessage]
    max_tokens: int = 1000
    temperature: float = 0.7
    stream: bool = False


class ChatCompletionResponse(BaseModel):
    """Schema for chat completion response."""

    id: str
    object: str
    created: int
    model: str
    choices: list[dict]
    usage: dict

    class Config:
        from_attributes = True


# AI service schemas
class AICompletionRequest(BaseModel):
    """Schema for AI completion requests."""

    prompt: str
    max_tokens: int = 1000
    temperature: float = 0.7


class AICompletionResponse(BaseModel):
    """Schema for AI completion response."""

    text: str
    usage: dict
