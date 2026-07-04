"""Deploy runner — materializes an OpenClaw config into the running system.

Each deploy is a sequence of steps. Every step:

- has a short human name (shown in the UI progress feed)
- can raise DeployError with a `hint` describing how to fix it
- gets auto-retry with backoff (network flakes) before being reported

If a step fails and we know how to fix it, we surface a suggested auto-fix
back to the wizard, which offers a one-click retry. Errors never break the
running system — the runner is designed to be safe to invoke repeatedly.
"""

from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Thread
from typing import Any, Callable

from .catalog import CATALOG
from .config_store import ConfigStore, REPO_ROOT


class DeployError(Exception):
    def __init__(self, message: str, *, hint: str | None = None, auto_fix: dict[str, Any] | None = None):
        super().__init__(message)
        self.hint = hint
        self.auto_fix = auto_fix


# ---------------------------------------------------------------------------
# In-memory run registry
# ---------------------------------------------------------------------------
# Deploys run in a background thread; the wizard polls /setup/deploy/{run_id}.
# The registry is process-local — fine for a single-node dev/personal setup,
# which is what OpenClaw is. Multi-node would want redis or a DB row.

_RUNS: dict[str, dict[str, Any]] = {}
_RUNS_LOCK = Lock()


def _new_run(target: str) -> dict[str, Any]:
    run_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()
    run = {
        "id": run_id,
        "target": target,
        "status": "running",  # running | success | failed
        "started_at": now,
        "finished_at": None,
        "steps": [],  # list of {name, status, detail, hint, auto_fix}
        "error": None,
    }
    with _RUNS_LOCK:
        _RUNS[run_id] = run
    return run


def get_run(run_id: str) -> dict[str, Any] | None:
    with _RUNS_LOCK:
        return _RUNS.get(run_id)


def list_runs(limit: int = 20) -> list[dict[str, Any]]:
    with _RUNS_LOCK:
        runs = sorted(_RUNS.values(), key=lambda r: r["started_at"], reverse=True)
    return runs[:limit]


# ---------------------------------------------------------------------------
# Deploy runner
# ---------------------------------------------------------------------------

class DeployRunner:
    """Runs the deploy pipeline for a given config snapshot."""

    def __init__(self, store: ConfigStore):
        self.store = store

    def start(self, config: dict[str, Any]) -> dict[str, Any]:
        """Kick off a deploy in a background thread. Returns the run stub."""
        target = (config.get("deploy") or {}).get("target") or "local_env"
        run = _new_run(target)
        thread = Thread(target=self._execute, args=(run["id"], config), daemon=True)
        thread.start()
        return run

    # ------------------------------------------------------------------
    def _execute(self, run_id: str, config: dict[str, Any]) -> None:
        run = get_run(run_id)
        if run is None:
            return

        steps: list[tuple[str, Callable[[], str | None]]] = [
            ("Validate config", lambda: self._step_validate(config)),
            ("Write .env", lambda: self._step_write_env(config)),
            ("Write agent registry", lambda: self._step_write_agents(config)),
            ("Test model connection", lambda: self._step_test_model(config)),
            ("Restart runtime", lambda: self._step_restart(config)),
        ]

        try:
            for name, fn in steps:
                self._run_step(run, name, fn)
            self._finish(run, "success")
        except DeployError as exc:
            self._finish(run, "failed", str(exc))
        except Exception as exc:  # noqa: BLE001 — surface unexpected failures too
            self._finish(run, "failed", f"Unexpected: {exc}")

        self.store.record_deploy({
            "run_id": run_id,
            "status": run["status"],
            "target": run["target"],
            "finished_at": run["finished_at"],
        })

    def _run_step(self, run: dict[str, Any], name: str, fn: Callable[[], str | None]) -> None:
        entry: dict[str, Any] = {"name": name, "status": "running", "detail": None}
        run["steps"].append(entry)
        # Small retry loop for transient network-ish errors.
        last_err: DeployError | None = None
        for attempt in range(3):
            try:
                detail = fn()
                entry["status"] = "ok"
                entry["detail"] = detail
                return
            except DeployError as exc:
                last_err = exc
                # Fail fast on configuration errors — retry only on transient ones.
                if not _is_transient(exc):
                    break
                time.sleep(0.4 * (2 ** attempt))
            except Exception as exc:  # noqa: BLE001
                last_err = DeployError(str(exc))
                break
        entry["status"] = "failed"
        entry["detail"] = str(last_err) if last_err else "unknown error"
        entry["hint"] = getattr(last_err, "hint", None)
        entry["auto_fix"] = getattr(last_err, "auto_fix", None)
        raise last_err or DeployError("step failed")

    def _finish(self, run: dict[str, Any], status: str, error: str | None = None) -> None:
        run["status"] = status
        run["error"] = error
        run["finished_at"] = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Individual steps
    # ------------------------------------------------------------------
    def _step_validate(self, config: dict[str, Any]) -> str:
        from .validator import validate_config

        problems = [p for p in validate_config(config) if p["severity"] == "error"]
        if problems:
            first = problems[0]
            raise DeployError(
                first["message"],
                hint=first.get("fix"),
                auto_fix=first.get("auto_fix"),
            )
        return f"OK ({len(problems)} blocking issues)"

    def _step_write_env(self, config: dict[str, Any]) -> str:
        env_path = REPO_ROOT / ".env"
        env_map: dict[str, str] = {}

        # Behaviour + storage defaults
        env_map["AUTODEMO_SEED"] = str((config.get("deploy") or {}).get("autodemo_seed", True)).lower()

        # Secrets first — every saved API key becomes an env var.
        for name, value in (config.get("secrets") or {}).items():
            if value:
                env_map[name] = value

        # Integrations may carry non-secret defaults (like SEC_USER_AGENT).
        for integ_id, integ_cfg in (config.get("integrations") or {}).items():
            for k, v in (integ_cfg.get("env") or {}).items():
                if v not in (None, ""):
                    env_map[k] = str(v)

        # Preserve any existing entries we don't manage.
        existing = _read_env_file(env_path)
        existing.update(env_map)

        try:
            _write_env_file(env_path, existing)
        except PermissionError as exc:
            raise DeployError(
                "Can't write .env — permission denied.",
                hint="Run the app with write access to the project root, or change the deploy target to 'This machine (.env file)' after fixing permissions.",
            ) from exc
        except OSError as exc:
            raise DeployError(
                f"Can't write .env: {exc}",
                hint="Check that the project root is on a writable filesystem.",
            ) from exc

        return f"wrote {len(existing)} keys to {env_path.name}"

    def _step_write_agents(self, config: dict[str, Any]) -> str:
        agents_path = REPO_ROOT / "config" / "agents.json"
        template_ids = {t["id"]: t for t in CATALOG["agent_templates"]}
        enabled = (config.get("agents") or {}).get("enabled") or []
        custom = (config.get("agents") or {}).get("custom") or []

        materialised = []
        for agent_id in enabled:
            if agent_id in template_ids:
                t = template_ids[agent_id]
                materialised.append({
                    "id": t["id"],
                    "label": t["label"],
                    "model": t.get("default_model") or (config.get("model") or {}).get("primary"),
                    "prompt": t["prompt"],
                    "source": "template",
                })
                continue
            match = next((c for c in custom if c.get("id") == agent_id), None)
            if match:
                materialised.append({
                    "id": match["id"],
                    "label": match.get("label") or match["id"],
                    "model": match.get("model") or (config.get("model") or {}).get("primary"),
                    "prompt": match.get("prompt", ""),
                    "source": "custom",
                })

        agents_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            import json
            with agents_path.open("w", encoding="utf-8") as f:
                json.dump({"agents": materialised}, f, indent=2)
                f.write("\n")
        except OSError as exc:
            raise DeployError(
                f"Can't write agent registry: {exc}",
                hint="Check that the ./config directory is writable.",
            ) from exc
        return f"wrote {len(materialised)} agent(s)"

    def _step_test_model(self, config: dict[str, Any]) -> str:
        primary = (config.get("model") or {}).get("primary")
        model = next((m for m in CATALOG["models"] if m["id"] == primary), None)
        if not model:
            raise DeployError("Model not in catalog.", hint="Reselect a model on the Model step.")

        if model.get("keyless"):
            return f"{model['label']} is keyless — nothing to check."

        env_var = model.get("env_var")
        secret = (config.get("secrets") or {}).get(env_var) if env_var else None
        if not secret:
            # Non-fatal: agents will still run in sample mode. Mark as skipped.
            return f"No {env_var} saved — agents will run in sample mode until a key is added."

        # Cheap sanity check: prefix + length. We don't actually hit the
        # provider here because doing so from a deploy step racks up cost
        # and can fail for reasons unrelated to config (rate limits, TLS).
        looks_ok = _key_looks_plausible(env_var, secret)
        if not looks_ok:
            raise DeployError(
                f"{env_var} doesn't look like a valid key.",
                hint=f"Double-check the key you pasted for {model['provider']}. Anthropic keys start with 'sk-ant-', OpenAI with 'sk-'.",
                auto_fix=None,
            )
        return f"{env_var} format looks OK."

    def _step_restart(self, config: dict[str, Any]) -> str:
        target = (config.get("deploy") or {}).get("target") or "local_env"
        if target == "local_env":
            # Touching main.py causes uvicorn --reload to pick up new env.
            touched = REPO_ROOT / "backend" / "app" / "main.py"
            try:
                if touched.exists():
                    os.utime(touched, None)
            except OSError:
                pass  # Non-fatal — if reload doesn't trigger, next request still reads new .env on process restart.
            return "reload signal sent (uvicorn --reload will pick up new .env)"
        if target == "docker_compose":
            # We don't actually shell out to docker here — that would need
            # elevated privileges and would surprise the user. Instead we
            # instruct them, which the UI turns into a copy-paste hint.
            return (
                "Config written. Run `docker compose up -d --build` in the project root "
                "to apply changes. (OpenClaw won't restart Docker containers on its own — "
                "that requires shell access outside the app.)"
            )
        raise DeployError(
            f"Unknown deploy target '{target}'.",
            hint="Pick a supported target on the Deploy step.",
            auto_fix={"deploy": {"target": "local_env"}},
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_transient(exc: DeployError) -> bool:
    msg = str(exc).lower()
    return any(sig in msg for sig in ("timeout", "temporarily", "connection reset", "network"))


def _key_looks_plausible(env_var: str, value: str) -> bool:
    v = value.strip()
    if len(v) < 12:
        return False
    if env_var == "ANTHROPIC_API_KEY":
        return v.startswith("sk-ant-")
    if env_var == "OPENAI_API_KEY":
        return v.startswith("sk-")
    return True  # unknown provider: accept anything non-trivial.


def _read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip()
    return out


def _write_env_file(path: Path, mapping: dict[str, str]) -> None:
    lines = [
        "# Managed by the OpenClaw setup wizard.",
        "# Edit through the /setup UI, not by hand.",
        "",
    ]
    for k in sorted(mapping):
        lines.append(f"{k}={mapping[k]}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
