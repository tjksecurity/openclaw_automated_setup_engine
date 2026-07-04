"""Tests for the OpenClaw setup engine.

Cover the pieces that would break the wizard silently if regressed:
- catalog integrity (unique ids, tooltip help text on every option)
- validator produces at least one blocking error on an empty config
- validator has an auto-fix on every blocking error (so the UI can always
  offer a one-click retry)
- config store deep-merges without losing existing sub-keys
- redacted secrets round-trip via update() without wiping the real value
- runner completes a happy-path deploy end-to-end without shelling out
"""

from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

from app.setup import CATALOG, ConfigStore, DeployRunner, validate_config
from app.setup.config_store import REDACTED
from app.setup.runner import get_run
from app.setup.validator import apply_auto_fixes


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

def test_catalog_ids_are_unique():
    for section in ("models", "integrations", "agent_templates", "deploy_targets"):
        ids = [e["id"] for e in CATALOG[section]]
        assert len(ids) == len(set(ids)), f"duplicate ids in {section}: {ids}"


def test_catalog_every_option_has_help():
    for section in ("models", "integrations", "agent_templates", "deploy_targets"):
        for entry in CATALOG[section]:
            assert entry.get("help"), f"missing help for {section}/{entry['id']}"


def test_catalog_env_var_specs_have_help():
    for integ in CATALOG["integrations"]:
        for spec in integ.get("env_vars", []):
            assert spec.get("help"), f"missing help for env {integ['id']}/{spec['name']}"


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

def test_empty_config_flags_missing_model():
    findings = validate_config({})
    severities = {f["severity"] for f in findings}
    assert "error" in severities
    fields = {f["field"] for f in findings}
    assert "model.primary" in fields


def test_every_blocking_error_carries_auto_fix_or_is_user_input():
    # Blocking errors that stem from bad user input (an enabled agent that
    # doesn't exist, custom agent missing prompt) are legitimate exceptions.
    # But the *default* empty-config errors must all be auto-fixable, so a
    # brand-new user can hit "deploy" and land on a working setup.
    findings = validate_config({})
    for f in findings:
        if f["severity"] != "error":
            continue
        assert f.get("auto_fix") is not None, f"error without auto_fix: {f}"


def test_apply_auto_fixes_resolves_empty_config():
    config: dict = {}
    findings = validate_config(config)
    apply_auto_fixes(config, findings)
    later = validate_config(config)
    assert not [f for f in later if f["severity"] == "error"]


# ---------------------------------------------------------------------------
# Config store
# ---------------------------------------------------------------------------

def _store(tmpdir: Path) -> ConfigStore:
    return ConfigStore(path=tmpdir / "openclaw.json")


def test_store_snapshot_redacts_secrets(tmp_path):
    s = _store(tmp_path)
    s.update({"secrets": {"ANTHROPIC_API_KEY": "sk-ant-realkey"}})
    snap = s.snapshot(redact_secrets=True)
    assert snap["secrets"]["ANTHROPIC_API_KEY"] == REDACTED
    raw = s.snapshot(redact_secrets=False)
    assert raw["secrets"]["ANTHROPIC_API_KEY"] == "sk-ant-realkey"


def test_store_treats_redacted_as_no_change(tmp_path):
    s = _store(tmp_path)
    s.update({"secrets": {"OPENAI_API_KEY": "sk-real"}})
    # Simulate the frontend sending back a config where the secret is still
    # the redacted sentinel — the store must not clobber the real value.
    s.update({"secrets": {"OPENAI_API_KEY": REDACTED, "NEW_KEY": "value"}})
    raw = s.snapshot(redact_secrets=False)
    assert raw["secrets"]["OPENAI_API_KEY"] == "sk-real"
    assert raw["secrets"]["NEW_KEY"] == "value"


def test_custom_agent_crud(tmp_path):
    s = _store(tmp_path)
    a = s.add_custom_agent({"label": "Test Agent", "prompt": "do a thing"})
    assert a["id"].startswith("custom_")
    updated = s.update_custom_agent(a["id"], {"prompt": "do a different thing"})
    assert updated["prompt"] == "do a different thing"
    ok = s.delete_custom_agent(a["id"])
    assert ok
    snap = s.snapshot()
    assert not snap["agents"]["custom"]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def test_runner_happy_path(tmp_path, monkeypatch):
    # Redirect the runner + store to a temp dir so we don't touch the repo.
    from app.setup import config_store, runner
    monkeypatch.setattr(config_store, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(runner, "REPO_ROOT", tmp_path)

    (tmp_path / "backend" / "app").mkdir(parents=True, exist_ok=True)
    (tmp_path / "backend" / "app" / "main.py").write_text("# marker\n")

    store = ConfigStore(path=tmp_path / "config" / "openclaw.json")
    store.update({
        "model": {"primary": "claude-sonnet-5"},
        "integrations": {"web_search": {"enabled": True}},
        "agents": {"enabled": ["research_assistant"]},
        "secrets": {"ANTHROPIC_API_KEY": "sk-ant-testkeytestkey"},
        "deploy": {"target": "local_env", "autodemo_seed": True},
    })
    run = DeployRunner(store).start(store.snapshot(redact_secrets=False))

    # Poll until finished (background thread).
    for _ in range(50):
        state = get_run(run["id"])
        if state and state["status"] != "running":
            break
        time.sleep(0.05)

    assert state["status"] == "success", state
    assert all(s["status"] == "ok" for s in state["steps"])
    assert (tmp_path / ".env").exists()
    assert (tmp_path / "config" / "agents.json").exists()


def test_runner_flags_bad_key_format(tmp_path, monkeypatch):
    from app.setup import config_store, runner
    monkeypatch.setattr(config_store, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(runner, "REPO_ROOT", tmp_path)
    (tmp_path / "backend" / "app").mkdir(parents=True, exist_ok=True)
    (tmp_path / "backend" / "app" / "main.py").write_text("")

    store = ConfigStore(path=tmp_path / "config" / "openclaw.json")
    store.update({
        "model": {"primary": "claude-sonnet-5"},
        "integrations": {"web_search": {"enabled": True}},
        "agents": {"enabled": ["research_assistant"]},
        "secrets": {"ANTHROPIC_API_KEY": "not-a-real-format"},
        "deploy": {"target": "local_env"},
    })
    run = DeployRunner(store).start(store.snapshot(redact_secrets=False))
    for _ in range(50):
        state = get_run(run["id"])
        if state and state["status"] != "running":
            break
        time.sleep(0.05)
    assert state["status"] == "failed"
    failing = next(s for s in state["steps"] if s["status"] == "failed")
    assert failing["name"] == "Test model connection"
    assert failing.get("hint")
