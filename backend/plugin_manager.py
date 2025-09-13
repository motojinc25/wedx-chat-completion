"""Global plugin manager for Semantic Kernel plugins."""

import asyncio
import logging
from typing import Any

from dotenv import load_dotenv
from semantic_kernel.connectors.mcp import MCPStdioPlugin
from semantic_kernel.core_plugins import (
    HttpPlugin,
    MathPlugin,
    TimePlugin,
)

load_dotenv()

logger = logging.getLogger(__name__)


class PluginManager:
    """Manages globally shared plugin instances."""

    def __init__(self):
        self.core_plugins: dict[str, Any] = {}
        self.mcp_plugins: dict[str, MCPStdioPlugin] = {}
        self._initialized = False
        self._lock = asyncio.Lock()

    async def initialize(self):
        """Initialize all plugins once globally."""
        async with self._lock:
            if self._initialized:
                return

            # Initialize core plugins
            self._initialize_core_plugins()

            # Initialize MCP plugins
            await self._initialize_mcp_plugins()

            self._initialized = True
            logger.info("Plugin manager initialized successfully")

    def _initialize_core_plugins(self):
        """Initialize core plugins."""
        try:
            # Create plugin instances
            self.core_plugins["Math"] = MathPlugin()
            self.core_plugins["Time"] = TimePlugin()
            self.core_plugins["Http"] = HttpPlugin()

            logger.info("Core plugins initialized: %s", list(self.core_plugins.keys()))

            # Log functions in each plugin
            for plugin_name, plugin in self.core_plugins.items():
                if hasattr(plugin, "functions"):
                    functions = list(plugin.functions.keys())
                    logger.info("Plugin '%s' has functions: %s", plugin_name, functions)

        except Exception as e:
            logger.error("Error initializing core plugins: %s", e)

    async def _initialize_mcp_plugins(self):
        """Initialize MCP plugins."""
        try:
            # Context7 Documentation Resolver
            context7_plugin = MCPStdioPlugin(
                name="context7",
                description="Context7 Documentation Resolver. Fetches information on code documentation.",
                command="npx",
                args=["-y", "@upstash/context7-mcp@latest"],
            )
            await context7_plugin.connect()
            self.mcp_plugins["context7"] = context7_plugin

            logger.info("MCP plugins initialized: %s", list(self.mcp_plugins.keys()))

        except Exception as e:
            logger.error("Error initializing MCP plugins: %s", e)

    def get_core_plugins(self) -> dict[str, Any]:
        """Get all core plugin instances."""
        return self.core_plugins.copy()

    def get_mcp_plugins(self) -> dict[str, MCPStdioPlugin]:
        """Get all MCP plugin instances."""
        return self.mcp_plugins.copy()

    async def cleanup(self):
        """Cleanup MCP plugin connections."""
        async with self._lock:
            for plugin_name, plugin in self.mcp_plugins.items():
                try:
                    await plugin.close()
                    logger.info("Closed MCP plugin: %s", plugin_name)
                except Exception as e:
                    logger.error("Error closing MCP plugin %s: %s", plugin_name, e)

            self.mcp_plugins.clear()
            self._initialized = False
            logger.info("Plugin manager cleaned up")


# Global instance
plugin_manager = PluginManager()
