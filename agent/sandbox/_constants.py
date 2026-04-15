"""Shared constants for the sandbox package.

This module has **no internal dependencies**, so it can be safely imported
by both ``daytona_client.py`` and every mixin without circular imports.
"""


class TimeoutConfig:
    """Timeout constants (seconds)."""
    STATE_TRANSITION = 60
    COMMAND_EXEC = 60
    POLL_INTERVAL = 1


class PathConfig:
    """Path constants (relative to the sandbox home directory)."""
    SKILLS_DIR = "skills"
    CORE_SKILLS_FILE = "core_skills.yaml"
    WORKSPACE_DIR = "workspace"
    CONFIG_DIR = ".config/artisan"
    SKILLS_MANIFEST_FILE = "skills.json"


class SandboxState:
    """Sandbox state constants."""
    STARTED = "started"
    STOPPED = "stopped"
    ARCHIVED = "archived"
    STARTING = "starting"
    STOPPING = "stopping"
    ARCHIVING = "archiving"
    ERROR = "error"
