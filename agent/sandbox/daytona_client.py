"""
Daytona Sandbox Client — singleton wrapping the Daytona SDK.

The heavy implementation is split across four mixin modules:

* :pymod:`sandbox._lifecycle`  — sandbox create / get / remove / ensure-running
* :pymod:`sandbox._file_ops`   — file read / write / list / delete / path helpers
* :pymod:`sandbox._exec`       — shell command execution
* :pymod:`sandbox._skills`     — skills upload / enable / disable / query
"""

from __future__ import annotations

import logging
from typing import Optional

from daytona import AsyncDaytona, DaytonaConfig

from config import (
    DAYTONA_API_KEY,
    DAYTONA_DEFAULT_SNAPSHOT,
    DAYTONA_ORG_ID,
    DAYTONA_SERVER_URL,
    SKILLS_LOCAL_DIR,
)
from sandbox.daytona_exec_patch import apply_exec_patch

from ._constants import PathConfig, SandboxState, TimeoutConfig
from ._exec import DaytonaExecMixin
from ._file_ops import DaytonaFileOpsMixin
from ._lifecycle import DaytonaLifecycleMixin
from ._skills import DaytonaSkillsMixin

logger = logging.getLogger(__name__)


# =============================================================================
# DaytonaClient — singleton that combines all mixins
# =============================================================================

class DaytonaClient(
    DaytonaLifecycleMixin,
    DaytonaFileOpsMixin,
    DaytonaExecMixin,
    DaytonaSkillsMixin,
):
    """Daytona client singleton.

    All sandbox operations are inherited from the four mixin classes.
    This class only handles connection initialisation and the singleton
    pattern.
    """

    _instance: Optional[DaytonaClient] = None
    _initialized: bool

    def __new__(cls) -> DaytonaClient:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._init_client()
        self._initialized = True

    def _init_client(self) -> None:
        """Create the underlying ``AsyncDaytona`` connection."""
        self.api_key = DAYTONA_API_KEY
        self.server_url = DAYTONA_SERVER_URL
        self.default_snapshot = DAYTONA_DEFAULT_SNAPSHOT
        self.org_id = DAYTONA_ORG_ID
        self.skills_local_dir = SKILLS_LOCAL_DIR

        config = DaytonaConfig(
            api_key=self.api_key,
            api_url=self.server_url,
            organization_id=self.org_id,
        )

        try:
            self.client = AsyncDaytona(config=config)
            apply_exec_patch()
            logger.info(f"Daytona Client initialized with AsyncDaytona (Server: {self.server_url})")
        except Exception as e:
            logger.error(f"Failed to initialize Daytona client: {e}")
            raise


# Re-export constants so existing ``from .daytona_client import PathConfig``
# in __init__.py and other consumers keeps working.
__all__ = [
    "DaytonaClient",
    "TimeoutConfig",
    "PathConfig",
    "SandboxState",
]
