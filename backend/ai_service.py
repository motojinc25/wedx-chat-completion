"""AI Service for unified Semantic Kernel operations."""

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from enum import Enum
import logging
from typing import Any

from semantic_kernel.connectors.ai.function_choice_behavior import FunctionChoiceBehavior
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion
from semantic_kernel.contents import ChatHistory

from kernel_manager import kernel_manager

logger = logging.getLogger(__name__)


class OutputFormat(Enum):
    """Output format options for AI responses."""

    STREAMING = "streaming"
    TEXT = "text"
    JSON = "json"


@dataclass
class AIOptions:
    """Configuration options for AI operations."""

    streaming: bool = False
    max_tokens: int = 2000
    temperature: float = 0.7
    top_p: float = 0.9
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    function_calling: bool = True
    system_message: str | None = None

    def to_execution_settings(self, chat_completion: AzureChatCompletion):
        """Convert to Semantic Kernel execution settings."""
        settings = chat_completion.get_prompt_execution_settings_class()(
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            top_p=self.top_p,
            frequency_penalty=self.frequency_penalty,
            presence_penalty=self.presence_penalty,
        )

        if self.function_calling:
            settings.function_choice_behavior = FunctionChoiceBehavior.Auto()

        return settings


class AIService:
    """Unified service for AI operations using Semantic Kernel."""

    def __init__(self):
        self.kernel_manager = kernel_manager

    async def initialize(self):
        """Initialize the AI service."""
        logger.info("AI service initialized successfully")
        # AI service doesn't require specific initialization
        pass

    async def cleanup(self):
        """Cleanup the AI service."""
        logger.info("AI service cleanup completed")
        # AI service doesn't require specific cleanup
        pass

    async def chat_completion_streaming(
        self, user_id: str, tenant_id: str, messages: list[dict[str, str]], options: AIOptions
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Generate streaming chat completion with function calling support."""
        async with self.kernel_manager.get_kernel(user_id, tenant_id) as user_kernel:
            async for chunk in user_kernel.kernel_manager.chat_completion_streaming(
                messages=messages, system_message=options.system_message, options=options
            ):
                yield chunk

    async def chat_completion_text(
        self, user_id: str, tenant_id: str, messages: list[dict[str, str]], options: AIOptions
    ) -> str:
        """Generate text completion without streaming."""
        async with self.kernel_manager.get_kernel(user_id, tenant_id) as user_kernel:
            kernel = user_kernel.kernel_manager.kernel
            chat_completion = kernel.get_service(type=AzureChatCompletion)
            execution_settings = options.to_execution_settings(chat_completion)

            # Create chat history
            chat_history = ChatHistory()

            # Add system message if provided
            if options.system_message:
                chat_history.add_system_message(options.system_message)

            # Add conversation history
            for message in messages:
                if message["role"] == "user":
                    chat_history.add_user_message(message["content"])
                elif message["role"] == "assistant":
                    chat_history.add_assistant_message(message["content"])

            # Get response
            response = await chat_completion.get_chat_message_content(
                chat_history=chat_history,
                settings=execution_settings,
                kernel=kernel if options.function_calling else None,
            )

            return str(response.content) if response.content else ""

    async def simple_completion(
        self, user_id: str, tenant_id: str, prompt: str, options: AIOptions | None = None
    ) -> str:
        """Generate simple text completion from a single prompt."""
        if options is None:
            options = AIOptions(function_calling=False)

        messages = [{"role": "user", "content": prompt}]
        return await self.chat_completion_text(user_id, tenant_id, messages, options)

    async def generate_title(self, user_id: str, tenant_id: str, conversation_messages: list[dict[str, str]]) -> str:
        """Generate a concise title for a conversation using existing user kernel."""
        # Create conversation text
        conversation_text = ""
        for msg in conversation_messages:
            content = msg.get("content", "")
            if len(content) > 200:
                conversation_text += f"{msg['role']}: {content[:200]}...\n"
            else:
                conversation_text += f"{msg['role']}: {content}\n"

        title_prompt = f"""Generate a concise, descriptive title (5-8 words max) for this conversation:

{conversation_text}

Title:"""

        try:
            # Use existing user kernel directly for efficiency
            async with self.kernel_manager.get_kernel(user_id, tenant_id) as user_kernel:
                kernel = user_kernel.kernel_manager.kernel
                chat_completion = kernel.get_service(type=AzureChatCompletion)

                # Create execution settings for title generation
                execution_settings = chat_completion.get_prompt_execution_settings_class()(
                    max_tokens=1000,
                    temperature=0.7,
                    top_p=0.9,
                    frequency_penalty=0.0,
                    presence_penalty=0.0,
                )

                # Create chat history with title prompt
                chat_history = ChatHistory()
                chat_history.add_user_message(title_prompt)

                # Get response without function calling for efficiency
                response = await chat_completion.get_chat_message_content(
                    chat_history=chat_history,
                    settings=execution_settings,
                    kernel=None,  # No function calling needed for title generation
                )

                generated_title = str(response.content) if response.content else ""
                return generated_title.strip("\"'").strip()[:50]

        except Exception as e:
            logger.warning("Failed to generate title: %s", e)
            # Fallback to first user message
            first_user_msg = next((msg for msg in conversation_messages if msg["role"] == "user"), None)
            if first_user_msg:
                return first_user_msg["content"][:50].strip()
            return "Chat Conversation"

    async def get_available_plugins(self, user_id: str, tenant_id: str) -> dict[str, Any]:
        """Get information about available plugins for a user."""
        async with self.kernel_manager.get_kernel(user_id, tenant_id) as user_kernel:
            return user_kernel.kernel_manager.get_available_plugins()

    def get_kernel_metrics(self) -> dict[str, Any]:
        """Get metrics about active Semantic Kernel instances."""
        return self.kernel_manager.get_metrics()


# Global service instance
ai_service = AIService()
