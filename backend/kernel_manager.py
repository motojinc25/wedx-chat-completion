"""Per-user Semantic Kernel Manager with lifecycle management."""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta
import logging
from typing import Any
import uuid

from plugin_manager import plugin_manager
from semantic_kernel_setup import SemanticKernelManager

logger = logging.getLogger(__name__)


class UserKernel:
    """Represents a user-specific kernel instance with metadata."""

    def __init__(self, user_id: str, tenant_id: str):
        self.id = str(uuid.uuid4())
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.created_at = datetime.utcnow()
        self.last_accessed = datetime.utcnow()
        self.access_count = 0
        self.kernel_manager = SemanticKernelManager(plugin_manager=plugin_manager)
        self.is_active = True

    async def initialize(self):
        """Initialize the kernel and register plugins."""
        # Register pre-created plugins to this kernel
        self.kernel_manager.register_plugins(
            core_plugins=plugin_manager.get_core_plugins(), mcp_plugins=plugin_manager.get_mcp_plugins()
        )
        logger.info("Kernel initialized for user %s", self.user_id)

    async def cleanup(self):
        """Cleanup kernel resources."""
        if self.is_active:
            self.is_active = False
            await self.kernel_manager.cleanup()
            logger.info("Kernel cleaned up for user %s", self.user_id)

    def update_access(self):
        """Update last access time and increment access count."""
        self.last_accessed = datetime.utcnow()
        self.access_count += 1

    def get_info(self) -> dict:
        """Get kernel information for monitoring."""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "tenant_id": str(self.tenant_id),
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat(),
            "access_count": self.access_count,
            "is_active": self.is_active,
            "uptime_seconds": (datetime.utcnow() - self.created_at).total_seconds(),
        }


class KernelManager:
    """Manages per-user kernel instances with lifecycle management."""

    def __init__(
        self, max_idle_time: timedelta = timedelta(minutes=30), cleanup_interval: timedelta = timedelta(minutes=5)
    ):
        self._kernels: dict[str, UserKernel] = {}
        self._lock = asyncio.Lock()
        self.max_idle_time = max_idle_time
        self.cleanup_interval = cleanup_interval
        self._cleanup_task = None

    async def start(self):
        """Start the kernel manager and cleanup task."""
        # Initialize global plugins first
        await plugin_manager.initialize()
        logger.info("Plugin manager initialized")

        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("KernelManager started")

    async def stop(self):
        """Stop the kernel manager and cleanup all kernels."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._cleanup_task

        # Cleanup all active kernels
        async with self._lock:
            cleanup_tasks = [kernel.cleanup() for kernel in self._kernels.values()]
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
            self._kernels.clear()

        # Cleanup global plugins
        await plugin_manager.cleanup()
        logger.info("Plugin manager cleaned up")

        logger.info("KernelManager stopped")

    async def _cleanup_loop(self):
        """Periodically cleanup idle kernels."""
        while True:
            try:
                await asyncio.sleep(self.cleanup_interval.total_seconds())
                await self._cleanup_idle_kernels()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in cleanup loop: %s", e)

    async def _cleanup_idle_kernels(self):
        """Remove kernels that have been idle for too long."""
        now = datetime.utcnow()
        async with self._lock:
            idle_kernels = []
            for user_id, kernel in self._kernels.items():
                if now - kernel.last_accessed > self.max_idle_time:
                    idle_kernels.append((user_id, kernel))

            for user_id, kernel in idle_kernels:
                logger.info("Cleaning up idle kernel for user %s", user_id)
                await kernel.cleanup()
                del self._kernels[user_id]

    @asynccontextmanager
    async def get_kernel(self, user_id: str, tenant_id: str) -> AsyncGenerator[UserKernel, None]:
        """Get or create a kernel for a user with automatic lifecycle management."""
        # Normalize user_id to ensure consistency across different calls
        normalized_user_id = str(user_id).strip()

        logger.debug(
            "get_kernel called with user_id=%s (normalized=%s), tenant_id=%s", user_id, normalized_user_id, tenant_id
        )
        logger.debug("Current kernels: %s", list(self._kernels.keys()))

        async with self._lock:
            if normalized_user_id not in self._kernels:
                # Create new kernel
                kernel = UserKernel(normalized_user_id, tenant_id)
                await kernel.initialize()
                self._kernels[normalized_user_id] = kernel
                logger.info("Created new kernel for user %s (normalized: %s)", user_id, normalized_user_id)
            else:
                kernel = self._kernels[normalized_user_id]
                logger.debug("Reusing existing kernel for user %s (normalized: %s)", user_id, normalized_user_id)

        # Update access time
        kernel.update_access()

        try:
            yield kernel
        except Exception as e:
            logger.error("Error using kernel for user %s: %s", normalized_user_id, e)
            # Consider removing the kernel if there's a critical error
            if isinstance(e, RuntimeError | ConnectionError):
                async with self._lock:
                    if normalized_user_id in self._kernels:
                        await self._kernels[normalized_user_id].cleanup()
                        del self._kernels[normalized_user_id]
            raise

    async def remove_kernel(self, user_id: str):
        """Manually remove a user's kernel."""
        normalized_user_id = str(user_id).strip()
        async with self._lock:
            if normalized_user_id in self._kernels:
                kernel = self._kernels[normalized_user_id]
                await kernel.cleanup()
                del self._kernels[normalized_user_id]
                logger.info("Removed kernel for user %s (normalized: %s)", user_id, normalized_user_id)

    def get_metrics(self) -> dict[str, Any]:
        """Get metrics about active kernels."""
        active_kernels = []
        tenant_stats = {}

        for kernel in self._kernels.values():
            kernel_info = kernel.get_info()
            active_kernels.append(kernel_info)

            # Aggregate by tenant
            tenant_id = str(kernel.tenant_id)
            if tenant_id not in tenant_stats:
                tenant_stats[tenant_id] = {
                    "count": 0,
                    "total_access_count": 0,
                    "avg_uptime_seconds": 0,
                }
            tenant_stats[tenant_id]["count"] += 1
            tenant_stats[tenant_id]["total_access_count"] += kernel.access_count

        # Calculate average uptime per tenant
        for tenant_id, stats in tenant_stats.items():
            tenant_kernels = [k for k in self._kernels.values() if str(k.tenant_id) == tenant_id]
            if tenant_kernels:
                avg_uptime = sum((datetime.utcnow() - k.created_at).total_seconds() for k in tenant_kernels) / len(
                    tenant_kernels
                )
                stats["avg_uptime_seconds"] = avg_uptime

        return {
            "total_kernels": len(self._kernels),
            "active_kernels": active_kernels,
            "tenant_stats": tenant_stats,
            "max_idle_time_seconds": self.max_idle_time.total_seconds(),
            "cleanup_interval_seconds": self.cleanup_interval.total_seconds(),
        }


# Global instance
kernel_manager = KernelManager()
