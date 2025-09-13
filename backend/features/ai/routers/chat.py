import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service import AIOptions, ai_service
from features.ai.schemas import ChatRequest
from shared.auth import get_current_user
from shared.database import get_db_session
from shared.models import AuditLogV4, UserV4
from shared.utils import extract_user_info

router = APIRouter(tags=["AI"])
logger = logging.getLogger(__name__)


@router.post("/api/ai/chat/completion")
async def chat_completion_stream_v1(
    chat_request: ChatRequest,
    request: Request,
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    user_id, tenant_id = extract_user_info(current_user)
    user_name = current_user.display_name or current_user.upn

    try:
        # Create audit log for chat request
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        audit_log = AuditLogV4(
            user_id=user_id,
            action="chat_completion",
            resource="api",
            resource_id="chat",
            details=f"Chat completion request with {len(chat_request.messages)} messages",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        db.add(audit_log)
        await db.commit()

        logger.info("Chat completion request from user: %s", user_name)

        # Convert Pydantic models to dict format
        messages = [{"role": msg.role, "content": msg.content} for msg in chat_request.messages]

        async def generate_stream():
            try:
                # Create AI options for streaming with all parameters
                options = AIOptions(
                    streaming=True,
                    system_message=chat_request.system_message,
                    max_tokens=chat_request.max_tokens,
                    temperature=chat_request.temperature,
                    top_p=chat_request.top_p,
                    frequency_penalty=chat_request.frequency_penalty,
                    presence_penalty=chat_request.presence_penalty,
                    function_calling=chat_request.function_calling,
                )

                # Use AI service for streaming completion
                async for chunk in ai_service.chat_completion_streaming(user_id, tenant_id, messages, options):
                    # Format as Server-Sent Events
                    chunk_json = json.dumps(chunk, ensure_ascii=False)
                    yield f"data: {chunk_json}\n\n"

                # Send final event to indicate completion
                yield "data: [DONE]\n\n"

            except Exception as e:
                logger.error("Error in chat completion streaming: %s", e)
                error_chunk = {
                    "content": f"Error: {e!s}",
                    "function_calls": [],
                    "finish_reason": "error",
                    "role": "assistant",
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/plain; charset=utf-8",
            },
        )

    except Exception as e:
        logger.error("Error in chat completion endpoint: %s", e)
        await db.rollback()
        return JSONResponse(status_code=500, content={"error": f"Internal server error: {e!s}"})
