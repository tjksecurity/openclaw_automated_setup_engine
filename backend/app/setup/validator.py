"""Validate a proposed OpenClaw config and return actionable warnings.

Every problem the validator returns has:
- `severity`  — "error" blocks deploy; "warning" is fine to deploy; "info" is FYI
- `field`     — dotted path to the offending field so the UI can jump to it
- `message`   — one sentence describing the problem in plain English
- `fix`       — one sentence describing the recommended fix. When we can
                auto-apply the fix, `auto_fix` is a dict the caller can
                merge back into the config to resolve the problem.

The validator never mutates the config itself — the wizard decides which
auto-fixes to apply.
"""

from __future__ import annotations

from typing import Any

from .catalog import CATALOG


def validate_config(config: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    model_ids = {m["id"] for m in CATALOG["models"]}
    integration_ids = {i["id"] for i in CATALOG["integrations"]}
    template_ids = {t["id"] for t in CATALOG["agent_templates"]}

    # --- Model ---------------------------------------------------------
    primary = (config.get("model") or {}).get("primary")
    if not primary:
        findings.append({
            "severity": "error",
            "field": "model.primary",
            "message": "No primary model selected.",
            "fix": "Pick a model on the Model step. Claude Sonnet 5 is a good default.",
            "auto_fix": {"model": {"primary": "claude-sonnet-5"}},
        })
    elif primary not in model_ids:
        findings.append({
            "severity": "error",
            "field": "model.primary",
            "message": f"Unknown model '{primary}'.",
            "fix": "Pick a model from the catalog.",
            "auto_fix": {"model": {"primary": "claude-sonnet-5"}},
        })
    else:
        model = next(m for m in CATALOG["models"] if m["id"] == primary)
        env = model.get("env_var")
        secrets = config.get("secrets", {})
        if env and not model.get("keyless") and not secrets.get(env):
            findings.append({
                "severity": "warning",
                "field": f"secrets.{env}",
                "message": f"{model['label']} needs an API key ({env}) — none saved yet.",
                "fix": f"Paste your {model['provider']} key on the Model step. Without it, agents will fall back to sample responses.",
            })

    # --- Integrations --------------------------------------------------
    integrations_cfg = config.get("integrations", {})
    if not any(v.get("enabled") for v in integrations_cfg.values()):
        findings.append({
            "severity": "warning",
            "field": "integrations",
            "message": "No integrations enabled.",
            "fix": "Turn on at least one integration on the Integrations step. Web search and the vector store are the usual minimum.",
            "auto_fix": {
                "integrations": {
                    "web_search": {"enabled": True},
                    "vector_store": {"enabled": True},
                }
            },
        })

    for integ_id, integ_cfg in integrations_cfg.items():
        if integ_id not in integration_ids:
            findings.append({
                "severity": "info",
                "field": f"integrations.{integ_id}",
                "message": f"Unknown integration '{integ_id}' in config — will be ignored.",
                "fix": "Remove it from the config, or update to a newer catalog.",
            })

    # --- Agents --------------------------------------------------------
    agents_cfg = config.get("agents", {})
    enabled = agents_cfg.get("enabled") or []
    if not enabled:
        findings.append({
            "severity": "warning",
            "field": "agents.enabled",
            "message": "No agents are enabled — OpenClaw will boot but do nothing until you turn one on.",
            "fix": "Enable at least the Research Assistant on the Agents step.",
            "auto_fix": {"agents": {"enabled": ["research_assistant"]}},
        })

    all_agent_ids = set(template_ids) | {a.get("id") for a in agents_cfg.get("custom", []) if a.get("id")}
    for agent_id in enabled:
        if agent_id not in all_agent_ids:
            findings.append({
                "severity": "error",
                "field": "agents.enabled",
                "message": f"Enabled agent '{agent_id}' does not exist.",
                "fix": "Remove it from the enabled list, or create a custom agent with that id.",
            })

    for i, agent in enumerate(agents_cfg.get("custom", [])):
        if not agent.get("prompt"):
            findings.append({
                "severity": "error",
                "field": f"agents.custom[{i}].prompt",
                "message": f"Custom agent '{agent.get('label') or agent.get('id')}' has no prompt.",
                "fix": "Open the agent and write a prompt describing what it should do.",
            })
        if not agent.get("label"):
            findings.append({
                "severity": "warning",
                "field": f"agents.custom[{i}].label",
                "message": "Custom agent has no display name.",
                "fix": "Give the agent a short readable name so it's easy to find later.",
            })

    # --- Deploy target -------------------------------------------------
    target = (config.get("deploy") or {}).get("target")
    valid_targets = {t["id"] for t in CATALOG["deploy_targets"]}
    if target and target not in valid_targets:
        findings.append({
            "severity": "error",
            "field": "deploy.target",
            "message": f"Unknown deploy target '{target}'.",
            "fix": "Pick a target on the Deploy step.",
            "auto_fix": {"deploy": {"target": "local_env"}},
        })

    return findings


def apply_auto_fixes(config: dict[str, Any], findings: list[dict[str, Any]]) -> dict[str, Any]:
    """Merge every `auto_fix` payload from ``findings`` into ``config``."""
    from .config_store import _deep_merge  # local import: avoids cycle in typing tools

    for f in findings:
        fix = f.get("auto_fix")
        if fix:
            _deep_merge(config, fix, treat_redacted_as_unchanged=False)
    return config
