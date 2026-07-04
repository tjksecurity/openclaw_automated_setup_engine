"""OpenClaw setup engine.

Everything the setup wizard talks to lives here: the catalog of known models,
integrations, and agent templates; the persisted user configuration; the
validator that inspects a proposed config for problems and returns fix-it
hints; and the deploy runner that materializes the config into the running
system (writes .env, restarts services, etc.) with automatic error handling.
"""

from .catalog import CATALOG
from .config_store import ConfigStore, DEFAULT_CONFIG
from .runner import DeployRunner
from .validator import validate_config

__all__ = ["CATALOG", "ConfigStore", "DEFAULT_CONFIG", "DeployRunner", "validate_config"]
