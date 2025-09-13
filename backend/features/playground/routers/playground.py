import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_service import ai_service
from features.playground.schemas import (
    ChatMessageCreateRequest,
    ChatMessageEditRequest,
    ChatMessageResponse,
    ChatSessionCreateRequest,
    ChatSessionResponse,
)
from shared.auth import get_current_user
from shared.database import get_db_session
from shared.models import AuditLogV4, ChatMessageV4, ChatSessionV4, UserV4
from shared.utils import extract_user_info

router = APIRouter(tags=["Playground"])
logger = logging.getLogger(__name__)


# Chat sessions endpoints
@router.get("/api/playground/sessions", response_model=list[ChatSessionResponse])
async def get_chat_sessions(
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Get all chat sessions for the current user."""
    try:
        # Use the user's actual ID for database operations
        user_id = current_user.id

        stmt = select(ChatSessionV4).where(ChatSessionV4.user_id == user_id).order_by(ChatSessionV4.updated_at.desc())
        result = await db.execute(stmt)
        sessions = result.scalars().all()

        return [
            ChatSessionResponse(
                id=str(session.id),
                user_id=str(session.user_id),
                title=session.title,
                created_at=session.created_at.isoformat(),
                updated_at=session.updated_at.isoformat(),
            )
            for session in sessions
        ]
    except Exception as e:
        logger.error("Error getting chat sessions: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get chat sessions") from None


@router.post("/api/playground/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    session_request: ChatSessionCreateRequest,
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Create a new chat session."""
    try:
        # Use the user's actual ID for database operations (JIT provisioning ensures user exists)
        user_id = current_user.id

        new_session = ChatSessionV4(
            user_id=user_id,
            title=session_request.title,
        )

        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)

        return ChatSessionResponse(
            id=str(new_session.id),
            user_id=str(new_session.user_id),
            title=new_session.title,
            created_at=new_session.created_at.isoformat(),
            updated_at=new_session.updated_at.isoformat(),
        )
    except Exception as e:
        logger.error("Error creating chat session: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create chat session") from None


@router.get("/api/playground/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_chat_messages(
    session_id: str,
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Get all messages for a specific chat session."""
    try:
        # Use the user's actual ID for database operations
        user_id = current_user.id

        # Verify session belongs to current user
        session_stmt = select(ChatSessionV4).where(
            and_(ChatSessionV4.id == session_id, ChatSessionV4.user_id == user_id)
        )
        session_result = await db.execute(session_stmt)
        session = session_result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Get messages
        stmt = select(ChatMessageV4).where(ChatMessageV4.session_id == session_id).order_by(ChatMessageV4.created_at)
        result = await db.execute(stmt)
        messages = result.scalars().all()

        return [
            ChatMessageResponse(
                id=str(message.id),
                session_id=str(message.session_id),
                user_id=str(message.user_id) if message.user_id else None,
                role=message.role,
                content=message.content,
                metadata=message.message_metadata,
                created_at=message.created_at.isoformat(),
            )
            for message in messages
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting chat messages: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get chat messages") from None


@router.post("/api/playground/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def create_chat_message(
    session_id: str,
    message_request: ChatMessageCreateRequest,
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Save a chat message to a session."""
    try:
        # Use the user's actual ID for database operations
        user_id = current_user.id

        # Verify session belongs to current user
        session_stmt = select(ChatSessionV4).where(
            and_(ChatSessionV4.id == session_id, ChatSessionV4.user_id == user_id)
        )
        session_result = await db.execute(session_stmt)
        session = session_result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Create message
        new_message = ChatMessageV4(
            session_id=session_id,
            user_id=user_id if message_request.role == "user" else None,
            role=message_request.role,
            content=message_request.content,
            message_metadata=message_request.metadata or {},
        )

        db.add(new_message)

        # Update session updated_at
        session.updated_at = func.now()

        await db.commit()
        await db.refresh(new_message)

        return ChatMessageResponse(
            id=str(new_message.id),
            session_id=str(new_message.session_id),
            user_id=str(new_message.user_id) if new_message.user_id else None,
            role=new_message.role,
            content=new_message.content,
            metadata=new_message.message_metadata,
            created_at=new_message.created_at.isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error saving chat message: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save chat message") from None


@router.put("/api/playground/sessions/{session_id}/title")
async def update_chat_session_title(
    session_id: str,
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Generate and update a session title based on the conversation."""
    try:
        # Use the user's actual info for operations
        user_id = current_user.id
        user_id_str, tenant_id = extract_user_info(current_user)

        # Verify session belongs to current user
        session_stmt = select(ChatSessionV4).where(
            and_(ChatSessionV4.id == session_id, ChatSessionV4.user_id == user_id)
        )
        session_result = await db.execute(session_stmt)
        session = session_result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Get first few messages to generate title
        stmt = (
            select(ChatMessageV4)
            .where(ChatMessageV4.session_id == session_id)
            .order_by(ChatMessageV4.created_at)
            .limit(4)
        )
        result = await db.execute(stmt)
        messages = result.scalars().all()

        if not messages:
            raise HTTPException(status_code=400, detail="No messages found in session")

        try:
            # Convert messages to dict format for AI service
            conversation_messages = [{"role": msg.role, "content": msg.content} for msg in messages]

            # Use AI service to generate title - use string format for consistency with chat completion
            generated_title = await ai_service.generate_title(user_id_str, tenant_id, conversation_messages)

        except Exception as e:
            logger.warning("Failed to generate title with AI service: %s", e)
            # Fallback to first user message
            first_user_msg = next((msg for msg in messages if msg.role == "user"), None)
            if first_user_msg:
                generated_title = (
                    first_user_msg.content[:30] + "..." if len(first_user_msg.content) > 30 else first_user_msg.content
                )
            else:
                generated_title = "Chat Session"

        # Update session title
        session.title = generated_title
        await db.commit()

        return {"title": generated_title}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating session title: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update session title") from None


@router.put("/api/playground/sessions/{session_id}/messages/{message_id}/edit")
async def edit_chat_message(
    session_id: str,
    message_id: str,
    message_request: ChatMessageEditRequest,
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Edit a chat message and delete all subsequent messages."""
    try:
        user_id = current_user.id

        # Verify session belongs to current user
        session_stmt = select(ChatSessionV4).where(
            and_(ChatSessionV4.id == session_id, ChatSessionV4.user_id == user_id)
        )
        session_result = await db.execute(session_stmt)
        session = session_result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Find the message being edited
        message_stmt = select(ChatMessageV4).where(
            and_(ChatMessageV4.id == message_id, ChatMessageV4.session_id == session_id)
        )
        message_result = await db.execute(message_stmt)
        message_to_edit = message_result.scalar_one_or_none()

        if not message_to_edit:
            raise HTTPException(status_code=404, detail="Message not found")

        # Get all messages in the session ordered by creation time
        all_messages_stmt = (
            select(ChatMessageV4).where(ChatMessageV4.session_id == session_id).order_by(ChatMessageV4.created_at)
        )
        all_messages_result = await db.execute(all_messages_stmt)
        all_messages = all_messages_result.scalars().all()

        # Find the index of the message being edited
        edit_index = None
        for i, msg in enumerate(all_messages):
            if str(msg.id) == message_id:
                edit_index = i
                break

        if edit_index is None:
            raise HTTPException(status_code=404, detail="Message not found in session")

        # Delete all messages from the edited message onwards
        messages_to_delete = all_messages[edit_index:]
        for msg in messages_to_delete:
            await db.delete(msg)

        # Create new edited message
        new_message = ChatMessageV4(
            session_id=session_id,
            user_id=user_id if message_request.role == "user" else None,
            role=message_request.role,
            content=message_request.content,
            message_metadata=message_request.metadata or {},
        )

        db.add(new_message)

        # Update session updated_at
        session.updated_at = func.now()

        await db.commit()
        await db.refresh(new_message)

        return ChatMessageResponse(
            id=str(new_message.id),
            session_id=str(new_message.session_id),
            user_id=str(new_message.user_id) if new_message.user_id else None,
            role=new_message.role,
            content=new_message.content,
            metadata=new_message.message_metadata,
            created_at=new_message.created_at.isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error editing chat message: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to edit chat message") from None


@router.delete("/api/playground/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: UserV4 = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Delete a chat session and all its messages."""
    try:
        # Use the user's actual ID for database operations
        user_id = current_user.id
        user_id_str, _ = extract_user_info(current_user)

        # Verify session belongs to current user
        session_stmt = select(ChatSessionV4).where(
            and_(ChatSessionV4.id == session_id, ChatSessionV4.user_id == user_id)
        )
        session_result = await db.execute(session_stmt)
        session = session_result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Delete all messages in the session first
        delete_messages_stmt = select(ChatMessageV4).where(ChatMessageV4.session_id == session_id)
        messages_result = await db.execute(delete_messages_stmt)
        messages = messages_result.scalars().all()

        for message in messages:
            await db.delete(message)

        # Delete the session
        await db.delete(session)
        await db.commit()

        # Create audit log
        audit_log = AuditLogV4(
            user_id=user_id_str,
            action="delete_chat_session",
            resource="chat_session",
            resource_id=session_id,
            details=f"Deleted chat session with {len(messages)} messages",
        )
        db.add(audit_log)
        await db.commit()

        return {"message": "Session deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting chat session: %s", e)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete chat session") from None
