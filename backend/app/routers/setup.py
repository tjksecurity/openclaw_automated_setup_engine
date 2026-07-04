"""HTTP endpoints backing the OpenClaw setup wizard.

The wizard is a single-page multi-step form. This router lets it:

- GET  /setup/catalog                  — list available models, integrations,
                                          agent templates, and deploy targets
- GET  /setup/config                   — read the saved config (secrets redacted)
- PUT  /setup/config                   — persist a full or partial config patch
- POST /setup/validate                 — return a list of findings for a config
- POST /setup/agents                   — create a custom agent
- PUT  /setup/agents/{agent_id}        — edit a custom agent
- DEL  /setup/agents/{agent_id}        — remove a custom agent
- POST /setup/deploy                   — apply the saved config; returns run stub
- GET  /setup/deploy/{run_id}          — poll a running deploy
- GET  /setup/deploys                  — recent runs (for a status banner)

Every mutating endpoint applies auto-fixes silently for `severity: error`
findings that carry an `auto_fix`, so the UI can offer 'Deploy anyway with
suggested fixes' as a single button.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

from ..setup import CATALOG, ConfigStore, DeployRunner, validate_config
from ..setup.runner import get_run, list_runs
from ..setup.validator import apply_auto_fixes


router = APIRouter(prefix="/setup", tags=["setup"])
_store = ConfigStore()
_runner = DeployRunner(_store)


# ---------------------------------------------------------------------------
# Read-side endpoints
# ---------------------------------------------------------------------------

@router.get("/catalog")
def get_catalog() -> dict[str, Any]:
    """Return the static catalog the wizard renders from."""
    return CATALOG


@router.get("/config")
def get_config() -> dict[str, Any]:
    """Return the saved config with secrets redacted."""
    return _store.snapshot(redact_secrets=True)


# ---------------------------------------------------------------------------
# Config update
# ---------------------------------------------------------------------------

class ConfigPatch(BaseModel):
    model: dict[str, Any] | None = None
    integrations: dict[str, Any] | None = None
    agents: dict[str, Any] | None = None
    deploy: dict[str, Any] | None = None
    profile: dict[str, Any] | None = None
    secrets: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.model_dump().items() if v is not None}


@router.put("/config")
def put_config(patch: ConfigPatch = Body(...)) -> dict[str, Any]:
    updated = _store.update(patch.as_dict())
    return _store.snapshot(redact_secrets=True) if updated else updated


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class ValidateBody(BaseModel):
    config: dict[str, Any] | None = None
    apply_auto_fixes: bool = False


@router.post("/validate")
def post_validate(body: ValidateBody = Body(default_factory=ValidateBody)) -> dict[str, Any]:
    config = body.config or _store.snapshot(redact_secrets=False)
    findings = validate_config(config)
    if body.apply_auto_fixes:
        config = apply_auto_fixes(config, findings)
        _store.update(_strip_redacted(config))
        findings = validate_config(config)
    return {"findings": findings, "ok": not any(f["severity"] == "error" for f in findings)}


def _strip_redacted(config: dict[str, Any]) -> dict[str, Any]:
    # We never want to overwrite real secrets with the redacted sentinel.
    from ..setup.config_store import REDACTED

    cleaned = {**config}
    if isinstance(cleaned.get("secrets"), dict):
        cleaned["secrets"] = {k: v for k, v in cleaned["secrets"].items() if v != REDACTED}
    return cleaned


# ---------------------------------------------------------------------------
# Custom agents
# ---------------------------------------------------------------------------

class AgentBody(BaseModel):
    id: str | None = None
    label: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    model: str | None = None
    help: str | None = None


@router.post("/agents")
def create_agent(body: AgentBody = Body(...)) -> dict[str, Any]:
    agent = _store.add_custom_agent(body.model_dump())
    return agent


@router.put("/agents/{agent_id}")
def update_agent(agent_id: str, body: AgentBody = Body(...)) -> dict[str, Any]:
    updated = _store.update_custom_agent(agent_id, body.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="agent not found")
    return updated


@router.delete("/agents/{agent_id}")
def delete_agent(agent_id: str) -> dict[str, Any]:
    ok = _store.delete_custom_agent(agent_id)
    if not ok:
        raise HTTPException(status_code=404, detail="agent not found")
    return {"status": "deleted", "id": agent_id}


# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

class DeployBody(BaseModel):
    apply_auto_fixes: bool = True


@router.post("/deploy")
def post_deploy(body: DeployBody = Body(default_factory=DeployBody)) -> dict[str, Any]:
    config = _store.snapshot(redact_secrets=False)
    findings = validate_config(config)
    if body.apply_auto_fixes:
        config = apply_auto_fixes(config, findings)
        _store.update(_strip_redacted(config))
        findings = validate_config(config)
    blocking = [f for f in findings if f["severity"] == "error"]
    if blocking:
        return {
            "status": "blocked",
            "message": "Fix the errors below before deploying.",
            "findings": blocking,
        }
    run = _runner.start(config)
    return {"status": "started", "run": run, "warnings": [f for f in findings if f["severity"] != "error"]}


@router.get("/deploy/{run_id}")
def get_deploy(run_id: str) -> dict[str, Any]:
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return run


@router.get("/deploys")
def get_deploys() -> dict[str, Any]:
    return {"runs": list_runs()}


@router.get("/effective/agents")
def get_effective_agents() -> dict[str, Any]:
    """What agents are actually live in the runtime right now.

    Reads ``config/agents.json`` — written by the deploy step. Empty list if
    the wizard has never run.
    """
    import json

    from ..setup.config_store import REPO_ROOT

    path = REPO_ROOT / "config" / "agents.json"
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"agents": []}
    return {"agents": list(data.get("agents") or [])}
