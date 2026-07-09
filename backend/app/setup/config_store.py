"""Persistent config for the OpenClaw setup wizard.

The config is a single JSON document at `config/openclaw.json`. The store
handles atomic writes (write-and-rename), migration of missing fields, and
provides a snapshot view for the wizard.

Secrets (API keys) live in the same document but are redacted when the wizard
fetches config — the frontend never has to re-enter a key it already saved.
The raw value is only exposed via a specific `reveal` endpoint if we ever need
it (not used today).
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Any


import os as _os

# REPO_ROOT is where deploy writes .env / config/agents.json. Overridable
# via env — Vercel's serverless runtime points this at /tmp/openclaw, where
# writes are actually permitted.
REPO_ROOT = Path(_os.environ.get("OPENCLAW_REPO_ROOT", str(Path(__file__).resolve().parents[3])))
CONFIG_DIR = REPO_ROOT / "config"
CONFIG_PATH = CONFIG_DIR / "openclaw.json"


DEFAULT_CONFIG: dict[str, Any] = {
    "version": 1,
    "profile": {
        "name": "My OpenClaw",
        "created_at": None,
    },
    "model": {
        "primary": "claude-sonnet-5",
        "fallback": "claude-haiku-4-5",
    },
    "integrations": {},
    "agents": {
        "enabled": ["research_assistant", "doc_qa", "compliance_scrubber"],
        "custom": [],
    },
    "deploy": {
        "target": "local_env",
        "autodemo_seed": True,
    },
    "secrets": {},
    "last_deploy": None,
}


REDACTED = "•" * 8


class ConfigStore:
    """Thread-safe JSON-backed config store."""

    def __init__(self, path: Path = CONFIG_PATH) -> None:
        self.path = path
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write_atomic(DEFAULT_CONFIG)

    # ------------------------------------------------------------------
    # Load / save
    # ------------------------------------------------------------------
    def _read_raw(self) -> dict[str, Any]:
        try:
            with self.path.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            data = {}
        return self._migrate(data)

    def _migrate(self, data: dict[str, Any]) -> dict[str, Any]:
        """Fill in any missing top-level keys with defaults."""
        merged = json.loads(json.dumps(DEFAULT_CONFIG))
        for key, value in data.items():
            merged[key] = value
        # Nested defaults for freshly-added keys.
        for k, v in DEFAULT_CONFIG.items():
            if isinstance(v, dict):
                for sub_k, sub_v in v.items():
                    merged.setdefault(k, {}).setdefault(sub_k, sub_v)
        return merged

    def _write_atomic(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=str(self.path.parent), prefix=".openclaw.", suffix=".json")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, sort_keys=False)
                f.write("\n")
            os.replace(tmp_path, self.path)
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def snapshot(self, redact_secrets: bool = True) -> dict[str, Any]:
        with self._lock:
            data = self._read_raw()
        if redact_secrets:
            data = json.loads(json.dumps(data))
            data["secrets"] = {k: REDACTED for k in data.get("secrets", {})}
        return data

    def update(self, patch: dict[str, Any]) -> dict[str, Any]:
        """Deep-merge ``patch`` into the stored config.

        Any secret value equal to REDACTED is treated as 'no change' — this
        lets the frontend round-trip the config safely without leaking keys.
        """
        with self._lock:
            data = self._read_raw()
            _deep_merge(data, patch, treat_redacted_as_unchanged=True)
            self._write_atomic(data)
            return json.loads(json.dumps(data))

    def set_secret(self, env_var: str, value: str | None) -> None:
        with self._lock:
            data = self._read_raw()
            if value is None or value == "":
                data.setdefault("secrets", {}).pop(env_var, None)
            elif value == REDACTED:
                # No change requested.
                return
            else:
                data.setdefault("secrets", {})[env_var] = value
            self._write_atomic(data)

    def get_secret(self, env_var: str) -> str | None:
        with self._lock:
            data = self._read_raw()
            return data.get("secrets", {}).get(env_var)

    def add_custom_agent(self, agent: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            data = self._read_raw()
            if not agent.get("id"):
                agent["id"] = f"custom_{uuid.uuid4().hex[:8]}"
            data.setdefault("agents", {}).setdefault("custom", []).append(agent)
            self._write_atomic(data)
            return agent

    def update_custom_agent(self, agent_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            data = self._read_raw()
            customs = data.setdefault("agents", {}).setdefault("custom", [])
            for entry in customs:
                if entry.get("id") == agent_id:
                    entry.update(patch)
                    self._write_atomic(data)
                    return entry
        return None

    def delete_custom_agent(self, agent_id: str) -> bool:
        with self._lock:
            data = self._read_raw()
            customs = data.setdefault("agents", {}).setdefault("custom", [])
            before = len(customs)
            data["agents"]["custom"] = [c for c in customs if c.get("id") != agent_id]
            enabled = data.setdefault("agents", {}).setdefault("enabled", [])
            data["agents"]["enabled"] = [e for e in enabled if e != agent_id]
            if len(data["agents"]["custom"]) != before:
                self._write_atomic(data)
                return True
        return False

    def record_deploy(self, result: dict[str, Any]) -> None:
        with self._lock:
            data = self._read_raw()
            data["last_deploy"] = result
            self._write_atomic(data)


def _deep_merge(dst: dict[str, Any], src: dict[str, Any], *, treat_redacted_as_unchanged: bool) -> None:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            _deep_merge(dst[k], v, treat_redacted_as_unchanged=treat_redacted_as_unchanged)
        else:
            if treat_redacted_as_unchanged and v == REDACTED:
                continue
            dst[k] = v
