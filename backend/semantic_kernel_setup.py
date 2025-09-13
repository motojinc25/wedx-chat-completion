from collections.abc import AsyncGenerator, Awaitable, Callable
import logging
import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ai_service import AIOptions

from dotenv import load_dotenv
from semantic_kernel import Kernel
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion
from semantic_kernel.contents import ChatHistory, TextContent
from semantic_kernel.filters import (
    FilterTypes,
    FunctionInvocationContext,
)

load_dotenv()

logger = logging.getLogger(__name__)


def serialize_function_result(result: Any) -> Any:
    """Convert non-JSON serializable objects to serializable format."""
    if result is None:
        return None

    # Handle TextContent objects
    if isinstance(result, TextContent):
        return result.text

    # Handle list of TextContent or mixed objects
    if isinstance(result, list):
        return [serialize_function_result(item) for item in result]

    # Handle dict with potential TextContent values
    if isinstance(result, dict):
        return {key: serialize_function_result(value) for key, value in result.items()}

    # Handle other Semantic Kernel content objects that might have text property
    if hasattr(result, "text"):
        return result.text

    # Handle objects with content property
    if hasattr(result, "content"):
        return serialize_function_result(result.content)

    # Handle objects with value property
    if hasattr(result, "value"):
        return serialize_function_result(result.value)

    # Try to convert to string if it's not a basic JSON type
    if not isinstance(result, str | int | float | bool | type(None)):
        try:
            return str(result)
        except Exception as e:
            logger.warning("Could not serialize function result %s: %s", type(result), e)
            return f"<Unserializable {type(result).__name__}>"

    return result


class SemanticKernelManager:
    def __init__(self, plugin_manager=None):
        self.kernel = None
        self.plugin_manager = plugin_manager
        self._setup_kernel()

    def _setup_kernel(self):
        self.kernel = Kernel()

        # Azure OpenAI service setup
        azure_openai_chat_service = AzureChatCompletion(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
            service_id="default",
        )

        self.kernel.add_service(azure_openai_chat_service)

        # Add debug filters
        self._add_debug_filters()

    async def auto_function_invocation_filter(
        self, context: FunctionInvocationContext, next: Callable[[FunctionInvocationContext], Awaitable[None]]
    ):
        logger.debug(
            "Auto function invocation filter called for function: %s.%s",
            context.function.plugin_name,
            context.function.name,
        )
        await next(context)
        logger.debug(
            "Auto function invocation completed for function: %s.%s",
            context.function.plugin_name,
            context.function.name,
        )

    async def function_invocation_filter(
        self, context: FunctionInvocationContext, next: Callable[[FunctionInvocationContext], Awaitable[None]]
    ):
        logger.info(
            "Function invocation started: %s.%s",
            context.function.plugin_name,
            context.function.name,
        )
        result = await next(context)
        logger.info(
            "Function invocation completed: %s.%s with result: %s",
            context.function.plugin_name,
            context.function.name,
            serialize_function_result(result),
        )

    async def prompt_rendering_filter(
        self, context: FunctionInvocationContext, next: Callable[[FunctionInvocationContext], Awaitable[None]]
    ):
        logger.debug("Prompt rendering filter called for prompt: %s", context.prompt)
        result = await next(context)
        logger.debug("Prompt rendering completed with result: %s", result)

    def register_plugins(self, core_plugins=None, mcp_plugins=None):
        """Register pre-created plugins to this kernel."""
        # Register core plugins
        if core_plugins:
            for plugin_name, plugin in core_plugins.items():
                try:
                    self.kernel.add_plugin(plugin, plugin_name=plugin_name)
                    logger.debug("Registered core plugin '%s' to kernel", plugin_name)
                except Exception as e:
                    logger.error("Error registering core plugin '%s': %s", plugin_name, e)

        # Register MCP plugins
        if mcp_plugins:
            for plugin_name, plugin in mcp_plugins.items():
                try:
                    self.kernel.add_plugin(
                        plugin,
                        plugin_name=plugin_name,
                        description=plugin.description,
                    )
                    logger.debug("Registered MCP plugin '%s' to kernel", plugin_name)
                except Exception as e:
                    logger.error("Error registering MCP plugin '%s': %s", plugin_name, e)

        logger.info("Plugins registered to kernel: %s", list(self.kernel.plugins.keys()))

    def _add_debug_filters(self):
        # Add debug filters for function calling and prompt execution
        self.kernel.add_filter(FilterTypes.AUTO_FUNCTION_INVOCATION, self.auto_function_invocation_filter)
        self.kernel.add_filter(FilterTypes.FUNCTION_INVOCATION, self.function_invocation_filter)
        self.kernel.add_filter(FilterTypes.PROMPT_RENDERING, self.prompt_rendering_filter)

        logger.info("Debug filters added successfully")

    def _sanitize_message_content(self, content: str) -> str:
        """Sanitize message content to avoid Azure OpenAI content errors"""
        # Log original content for debugging
        logger.debug("Original message content: %s", content)

        # Replace potentially problematic patterns
        # Avoid patterns that might be interpreted as harmful instructions
        sanitized = content

        # Replace negative number patterns that might be misinterpreted
        import re

        # Replace patterns like "-100" with "負の100" or "マイナス100"
        sanitized = re.sub(r"-(\d+)", r"マイナス\1", sanitized)

        # Log sanitized content if it changed
        if sanitized != content:
            logger.debug("Sanitized message content: %s", sanitized)

        return sanitized

    async def chat_completion_streaming(
        self, messages: list[dict[str, str]], system_message: str | None = None, options: "AIOptions | None" = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        try:
            # Track sent function calls to avoid duplicates
            sent_function_calls = set()
            # Create chat history
            chat_history = ChatHistory()

            # Add system message if provided
            if system_message:
                chat_history.add_system_message(system_message)

            # Add conversation history with content sanitization
            for message in messages:
                if message["role"] == "user":
                    sanitized_content = self._sanitize_message_content(message["content"])
                    chat_history.add_user_message(sanitized_content)
                elif message["role"] == "assistant":
                    chat_history.add_assistant_message(message["content"])

            # Get chat completion service
            chat_completion = self.kernel.get_service(type=AzureChatCompletion)

            # Create execution settings with function calling enabled
            from semantic_kernel.connectors.ai.function_choice_behavior import FunctionChoiceBehavior

            # Use options if provided, otherwise use defaults
            max_tokens = options.max_tokens if options else 2000
            temperature = options.temperature if options else 0.7
            top_p = options.top_p if options else 0.9
            frequency_penalty = options.frequency_penalty if options else 0.0
            presence_penalty = options.presence_penalty if options else 0.0
            function_calling = options.function_calling if options else True

            execution_settings = chat_completion.get_prompt_execution_settings_class()(
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                frequency_penalty=frequency_penalty,
                presence_penalty=presence_penalty,
            )

            # Set function calling behavior based on options
            if function_calling:
                execution_settings.function_choice_behavior = FunctionChoiceBehavior.Auto()

            logger.debug("Execution settings: %s", execution_settings)
            logger.debug("Available plugins: %s", list(self.kernel.plugins.keys()))

            # Stream the response
            async for stream_message in chat_completion.get_streaming_chat_message_content(
                chat_history=chat_history,
                settings=execution_settings,
                kernel=self.kernel,
            ):
                if stream_message is not None:
                    # Check for function calls
                    function_calls = []

                    # Check if this is a function call message based on finish_reason
                    is_tool_call_message = stream_message.finish_reason == "tool_calls"

                    # For Semantic Kernel, check items for function call information
                    if hasattr(stream_message, "items") and stream_message.items:
                        for item in stream_message.items:
                            item_type_name = type(item).__name__

                            # Check for different types of function call items
                            # Only include function calls that have been executed (have results)
                            if "FunctionCall" in item_type_name or "ToolCall" in item_type_name:
                                logger.debug("Found function call item: %s", item)
                                # Only add if the function call has been executed and has a result
                                result = getattr(item, "result", None)
                                if result is not None:
                                    function_calls.append(
                                        {
                                            "name": getattr(item, "function_name", getattr(item, "name", "unknown")),
                                            "arguments": getattr(item, "arguments", getattr(item, "parameters", {})),
                                            "result": serialize_function_result(result),
                                        }
                                    )
                                else:
                                    logger.debug("Skipping function call without result (parameter setup only)")
                            elif "FunctionResult" in item_type_name:
                                logger.debug("Found function result item: %s", item)
                                # Function results always indicate completed execution
                                if hasattr(item, "function_name"):
                                    function_calls.append(
                                        {
                                            "name": item.function_name,
                                            "arguments": getattr(item, "arguments", {}),
                                            "result": serialize_function_result(
                                                getattr(item, "value", getattr(item, "result", None))
                                            ),
                                        }
                                    )

                    # Also check direct attributes for function calls
                    # Only include function calls that have been executed (have results)
                    for attr in ["function_calls", "tool_calls", "function_call", "function_results"]:
                        if hasattr(stream_message, attr):
                            attr_value = getattr(stream_message, attr)
                            if attr_value:
                                logger.debug("Found %s: %s (type: %s)", attr, attr_value, type(attr_value))
                                if isinstance(attr_value, list):
                                    for func_call in attr_value:
                                        result = getattr(func_call, "result", getattr(func_call, "value", None))
                                        # Only add if the function has been executed and has a result
                                        if result is not None:
                                            function_calls.append(
                                                {
                                                    "name": getattr(
                                                        func_call,
                                                        "name",
                                                        getattr(func_call, "function_name", "unknown"),
                                                    ),
                                                    "arguments": getattr(
                                                        func_call, "arguments", getattr(func_call, "parameters", {})
                                                    ),
                                                    "result": serialize_function_result(result),
                                                }
                                            )
                                        else:
                                            logger.debug("Skipping function call without result from %s", attr)
                                else:
                                    result = getattr(attr_value, "result", getattr(attr_value, "value", None))
                                    # Only add if the function has been executed and has a result
                                    if result is not None:
                                        function_calls.append(
                                            {
                                                "name": getattr(
                                                    attr_value, "name", getattr(attr_value, "function_name", "unknown")
                                                ),
                                                "arguments": getattr(
                                                    attr_value, "arguments", getattr(attr_value, "parameters", {})
                                                ),
                                                "result": serialize_function_result(result),
                                            }
                                        )
                                    else:
                                        logger.debug("Skipping single function call without result from %s", attr)

                    # Filter out duplicate function calls
                    unique_function_calls = []
                    for func_call in function_calls:
                        call_id = f"{func_call['name']}-{func_call['arguments']}"
                        if call_id not in sent_function_calls:
                            sent_function_calls.add(call_id)
                            unique_function_calls.append(func_call)

                    # Determine the appropriate finish_reason
                    finish_reason = stream_message.finish_reason
                    if is_tool_call_message and unique_function_calls:
                        finish_reason = "tool_calls"

                    # Only yield if there's content or new function calls
                    if stream_message.content or unique_function_calls:
                        chunk_data = {
                            "content": stream_message.content or "",
                            "function_calls": unique_function_calls,
                            "finish_reason": finish_reason,
                            "role": "assistant",
                        }

                        yield chunk_data

        except Exception as e:
            logger.error("Error in chat completion streaming: %s", e)
            logger.error("Error type: %s", type(e))
            logger.error("Error args: %s", getattr(e, "args", None))

            # Try to get more detailed error information
            if hasattr(e, "message"):
                logger.error("Error message: %s", e.message)
            if hasattr(e, "response"):
                logger.error("Error response: %s", e.response)
            if hasattr(e, "status_code"):
                logger.error("Error status code: %s", e.status_code)

            # Check for content filtering errors specifically
            error_message = str(e)
            if "content" in error_message.lower() and (
                "filter" in error_message.lower() or "policy" in error_message.lower()
            ):
                yield {
                    "content": "This message has been blocked by the content filter. Please try again with different wording.",
                    "function_calls": [],
                    "finish_reason": "content_filter",
                    "role": "assistant",
                }
            else:
                yield {"content": f"Error: {e!s}", "function_calls": [], "finish_reason": "error", "role": "assistant"}

    def get_available_plugins(self) -> dict[str, Any]:
        """Get information about available plugins and their functions"""
        plugins_info = {}

        for plugin_name, plugin in self.kernel.plugins.items():
            plugin_functions = []
            for function_name, function in plugin.functions.items():
                plugin_functions.append(
                    {
                        "name": function_name,
                        "description": function.description,
                        "parameters": [param.name for param in function.parameters],
                    }
                )

            plugins_info[plugin_name] = {"functions": plugin_functions}

        return plugins_info

    async def cleanup(self):
        """Cleanup kernel resources."""
        # Note: Plugins are managed globally and cleaned up by plugin_manager
        logger.debug("Kernel cleanup completed")
