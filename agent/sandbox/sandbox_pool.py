"""
Sandbox Pool Manager

预热 Sandbox 池管理器，用于即时创建会话。
使用 PostgreSQL 进行持久化和协调。

主要功能：
- 维护预热 Sandbox 池
- 自动健康检查和清理
- 会话生命周期管理
"""

import asyncio
import logging
import uuid
from enum import Enum
from typing import Optional

from sandbox.daytona_client import DaytonaClient
from schemas.sessions import SessionPoolStats
from utils.db import ensure_session_metadata_table, get_db_connection

logger = logging.getLogger(__name__)


# =============================================================================
# 常量定义
# =============================================================================

class SandboxStatus(str, Enum):
    """Sandbox 在池中的状态"""
    CREATING = "creating"
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    ERROR = "error"


class TimeoutConfig:
    """超时配置常量"""
    CREATING_TIMEOUT_MINUTES = 5    # 创建超时时间（分钟）


class PoolConfig:
    """池配置常量"""
    DEFAULT_MIN_SIZE = 2                    # 默认最小可用 Sandbox 数量
    DEFAULT_MAINTENANCE_INTERVAL = 30       # 默认维护任务间隔（秒）
    DEFAULT_AUTO_STOP_MINUTES = 15          # 默认自动停止时间（分钟）
    DEFAULT_AUTO_ARCHIVE_MINUTES = 1440     # 默认自动归档时间（分钟，24小时）


# =============================================================================
# SandboxPool 单例类
# =============================================================================

class SandboxPool:
    """
    预热 Sandbox 池管理器（单例）
    
    架构：
    - PostgreSQL 表追踪 Sandbox 生命周期
    - 后台任务维护池大小
    - 会话从池中获取 Sandbox，而非按需创建
    """

    _instance: Optional["SandboxPool"] = None
    _initialized: bool

    def __new__(cls) -> "SandboxPool":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        
        # 运行时状态
        self._maintenance_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self._running = False
        self.daytona_client = DaytonaClient()
        
        self._initialized = True
        logger.info(
            f"SandboxPool initialized: min={PoolConfig.DEFAULT_MIN_SIZE}, "
            f"auto_stop={PoolConfig.DEFAULT_AUTO_STOP_MINUTES}min, auto_archive={PoolConfig.DEFAULT_AUTO_ARCHIVE_MINUTES}min"
        )

    # =========================================================================
    # 生命周期管理
    # =========================================================================

    async def start(self) -> None:
        """启动池维护后台任务"""
        if self._running:
            return

        await self._ensure_pool_table()
        self._running = True
        self._maintenance_task = asyncio.create_task(self._maintenance_loop())
        logger.info("SandboxPool maintenance started")

    async def stop(self) -> None:
        """停止池维护"""
        self._running = False
        if self._maintenance_task:
            self._maintenance_task.cancel()
            try:
                await self._maintenance_task
            except asyncio.CancelledError:
                pass
        logger.info("SandboxPool maintenance stopped")

    async def _ensure_pool_table(self) -> None:
        """确保数据库表存在"""
        await ensure_session_metadata_table()

        pool = await get_db_connection()
        async with pool.connection() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS sandbox_pool (
                    sandbox_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL DEFAULT 'creating',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    assigned_at TIMESTAMP WITH TIME ZONE,
                    assigned_to TEXT,
                    error_message TEXT
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_sandbox_pool_status 
                ON sandbox_pool(status)
            """)
        logger.info("sandbox_pool table ensured")

    # =========================================================================
    # 维护任务
    # =========================================================================

    async def _maintenance_loop(self) -> None:
        """后台维护循环"""
        while self._running:
            try:
                await self._run_maintenance()
            except Exception as e:
                logger.error(f"Pool maintenance error: {e}")
            await asyncio.sleep(PoolConfig.DEFAULT_MAINTENANCE_INTERVAL)

    async def _run_maintenance(self) -> None:
        """执行一次维护：健康检查 + 补充池"""
        async with self._lock:
            await self._health_check()
            await self._replenish_pool()

    async def _replenish_pool(self) -> None:
        """补充池中的 Sandbox"""
        available_count = await self._get_status_count(SandboxStatus.AVAILABLE)
        creating_count = await self._get_status_count(SandboxStatus.CREATING)

        needed = PoolConfig.DEFAULT_MIN_SIZE - available_count - creating_count

        if needed > 0:
            logger.info(
                f"Pool needs {needed} more sandboxes "
                f"(available={available_count}, creating={creating_count})"
            )
            for _ in range(needed):
                asyncio.create_task(self._create_sandbox())

    async def _health_check(self) -> None:
        """检查可用 Sandbox 的健康状态"""
        pool = await get_db_connection()

        async with pool.connection() as conn:
            result = await conn.execute(
                """
                SELECT sandbox_id, status FROM sandbox_pool 
                WHERE status IN (%s, %s)
                   OR (status = %s AND created_at < NOW() - make_interval(mins => %s))
                """,
                (
                    SandboxStatus.AVAILABLE,
                    SandboxStatus.ERROR,
                    SandboxStatus.CREATING,
                    TimeoutConfig.CREATING_TIMEOUT_MINUTES,
                )
            )
            rows = await result.fetchall()

            for sandbox_id, status in rows:
                should_remove = False
                
                if status == SandboxStatus.ERROR:
                    logger.info(f"Removing error sandbox: {sandbox_id}")
                    should_remove = True
                elif status == SandboxStatus.CREATING:
                    logger.info(f"Removing stuck sandbox: {sandbox_id}")
                    should_remove = True
                elif status == SandboxStatus.AVAILABLE:
                    if not await self.daytona_client.ensure_sandbox_running(sandbox_id):
                        logger.info(f"Removing unhealthy sandbox: {sandbox_id}")
                        should_remove = True
                
                if should_remove:
                    try:
                        await self.daytona_client.remove_sandbox(sandbox_id)
                    except Exception as e:
                        logger.warning(f"Failed to remove sandbox {sandbox_id} from Daytona: {e}")
                    
                    await conn.execute(
                        "DELETE FROM sandbox_pool WHERE sandbox_id = %s",
                        (sandbox_id,)
                    )
                    logger.info(f"Cleaned up sandbox: {sandbox_id}")
    
    # =========================================================================
    # Sandbox 创建
    # =========================================================================

    async def _create_sandbox(self) -> None:
        """创建新 Sandbox 并加入池"""
        sandbox_id = str(uuid.uuid4())
        pool = await get_db_connection()

        async with pool.connection() as conn:
            await conn.execute(
                "INSERT INTO sandbox_pool (sandbox_id, status) VALUES (%s, %s)",
                (sandbox_id, SandboxStatus.CREATING)
            )

        try:
            logger.info(f"Creating sandbox: {sandbox_id}")
            await self.daytona_client.create_sandbox(sandbox_id)

            async with pool.connection() as conn:
                await conn.execute(
                    "UPDATE sandbox_pool SET status = %s WHERE sandbox_id = %s",
                    (SandboxStatus.AVAILABLE, sandbox_id)
                )
            logger.info(f"Sandbox ready: {sandbox_id}")

        except Exception as e:
            logger.error(f"Failed to create sandbox {sandbox_id}: {e}")
            async with pool.connection() as conn:
                await conn.execute(
                    "UPDATE sandbox_pool SET status = %s, error_message = %s WHERE sandbox_id = %s",
                    (SandboxStatus.ERROR, str(e), sandbox_id)
                )

    async def _create_sandbox_on_demand(self, thread_id: str) -> str:
        """按需创建 Sandbox 并直接分配给会话"""
        sandbox_id = str(uuid.uuid4())
        pool = await get_db_connection()

        async with pool.connection() as conn:
            await conn.execute(
                "INSERT INTO sandbox_pool (sandbox_id, status, assigned_at, assigned_to) VALUES (%s, %s, NOW(), %s)",
                (sandbox_id, SandboxStatus.ASSIGNED, thread_id)
            )

        try:
            logger.info(f"Creating sandbox on-demand: {sandbox_id}")
            await self.daytona_client.create_sandbox(sandbox_id)

            # 配置生命周期
            await self.daytona_client.configure_session_lifecycle(
                sandbox_id,
                PoolConfig.DEFAULT_AUTO_STOP_MINUTES,
                PoolConfig.DEFAULT_AUTO_ARCHIVE_MINUTES
            )

            logger.info(f"On-demand sandbox ready: {sandbox_id}")
            return sandbox_id

        except Exception as e:
            logger.error(f"Failed to create on-demand sandbox {sandbox_id}: {e}")
            async with pool.connection() as conn:
                await conn.execute(
                    "DELETE FROM sandbox_pool WHERE sandbox_id = %s",
                    (sandbox_id,)
                )
            raise

    # =========================================================================
    # Sandbox 分配和释放
    # =========================================================================

    async def acquire(self, thread_id: str, wait_if_empty: bool = True) -> str:
        """从池中获取一个 Sandbox"""
        pool = await get_db_connection()

        async with self._lock:
            async with pool.connection() as conn:
                result = await conn.execute("""
                    UPDATE sandbox_pool 
                    SET status = %s, assigned_at = NOW(), assigned_to = %s
                    WHERE sandbox_id = (
                        SELECT sandbox_id FROM sandbox_pool 
                        WHERE status = %s 
                        ORDER BY created_at ASC 
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                    )
                    RETURNING sandbox_id
                """, (SandboxStatus.ASSIGNED, thread_id, SandboxStatus.AVAILABLE))

                row = await result.fetchone()

                if row:
                    sandbox_id = row[0]
                    logger.info(f"Acquired sandbox {sandbox_id} from pool for session {thread_id}")

                    # 配置生命周期
                    await self.daytona_client.configure_session_lifecycle(
                        sandbox_id,
                        PoolConfig.DEFAULT_AUTO_STOP_MINUTES,
                        PoolConfig.DEFAULT_AUTO_ARCHIVE_MINUTES
                    )

                    # 触发后台补充
                    asyncio.create_task(self._run_maintenance())
                    return sandbox_id

        # 池为空，按需创建
        if wait_if_empty:
            logger.warning(f"Pool empty, creating sandbox on-demand for session {thread_id}")
            return await self._create_sandbox_on_demand(thread_id)

        raise RuntimeError("Pool is empty and wait_if_empty is False")

    async def release(self, sandbox_id: str) -> None:
        """释放并删除 Sandbox"""
        pool = await get_db_connection()

        async with pool.connection() as conn:
            await conn.execute(
                "DELETE FROM sandbox_pool WHERE sandbox_id = %s",
                (sandbox_id,)
            )

        try:
            await self.daytona_client.remove_sandbox(sandbox_id)
            logger.info(f"Released and deleted sandbox: {sandbox_id}")
        except Exception as e:
            logger.warning(f"Failed to delete sandbox {sandbox_id} from Daytona: {e}")

    # =========================================================================
    # 统计和查询
    # =========================================================================

    async def get_stats(self) -> SessionPoolStats:
        """获取池统计信息"""
        pool = await get_db_connection()

        async with pool.connection() as conn:
            result = await conn.execute("""
                SELECT status, COUNT(*) 
                FROM sandbox_pool 
                GROUP BY status
            """)
            rows = await result.fetchall()

            stats: SessionPoolStats = {
                "creating": 0,
                "available": 0,
                "assigned": 0,
                "error": 0,
                "total": 0,
                "config": {
                    "min_pool_size": PoolConfig.DEFAULT_MIN_SIZE,
                    "auto_stop_minutes": PoolConfig.DEFAULT_AUTO_STOP_MINUTES,
                    "auto_archive_minutes": PoolConfig.DEFAULT_AUTO_ARCHIVE_MINUTES,
                },
            }
            for status, count in rows:
                if status == SandboxStatus.CREATING:
                    stats["creating"] = count
                elif status == SandboxStatus.AVAILABLE:
                    stats["available"] = count
                elif status == SandboxStatus.ASSIGNED:
                    stats["assigned"] = count
                elif status == SandboxStatus.ERROR:
                    stats["error"] = count

            stats["total"] = (
                stats["creating"]
                + stats["available"]
                + stats["assigned"]
                + stats["error"]
            )

            return stats

    async def _get_status_count(self, status: SandboxStatus) -> int:
        """获取指定状态的 Sandbox 数量"""
        pool = await get_db_connection()
        async with pool.connection() as conn:
            result = await conn.execute(
                "SELECT COUNT(*) FROM sandbox_pool WHERE status = %s",
                (status,)
            )
            row = await result.fetchone()
            return row[0] if row else 0
