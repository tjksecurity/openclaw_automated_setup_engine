/**
 * Turn the wizard's collected state into a valid `openclaw config patch`
 * payload.
 *
 * We keep the transformer deterministic and pure so it's easy to test and
 * easy to reason about ("did I really produce that patch?"). The actual
 * validation happens on the CLI side via `openclaw config patch --stdin`,
 * which rejects unknown keys and invalid types outright — so if we produce
 * garbage, the CLI catches it before touching the on-disk config.
 */

import { CHANNELS, AGENT_TEMPLATES } from "./catalog";

export type SecretMode = "inline" | "env";

export interface WizardState {
  model: {
    primary: string;              // e.g. "anthropic/claude-sonnet-4-6"
    fallbacks: string[];
  };
  secrets: Record<string, string>; // ANTHROPIC_API_KEY → "sk-ant-..."
  channels: Record<
    string,                        // channel id
    {
      enabled: boolean;
      dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
      fields: Record<string, string>;
    }
  >;
  agents: {
    templates: string[];           // enabled template ids
    custom: Array<{ id: string; label: string; prompt: string; skills: string[] }>;
  };
  gateway?: {
    port?: number;
    bind?: string;
  };
  secretMode: SecretMode;          // "inline" writes secrets into the config; "env" writes SecretRef stubs and leaves the actual values in env
}

export interface ConfigPatch {
  agents?: Record<string, unknown>;
  channels?: Record<string, unknown>;
  gateway?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

/**
 * Produce the JSON patch to hand to `openclaw config patch --stdin`.
 */
export function toConfigPatch(state: WizardState): ConfigPatch {
  const patch: ConfigPatch = {};

  // ------------------------------------------------------------------
  // agents.defaults.model + agents.list[]
  // ------------------------------------------------------------------
  const agents: Record<string, any> = {};
  agents.defaults = {
    model: {
      primary: state.model.primary,
      fallbacks: state.model.fallbacks?.length ? state.model.fallbacks : undefined,
    },
  };

  // Union of template-derived skills + explicit custom-agent skills
  const enabledTemplates = state.agents.templates
    .map((id) => AGENT_TEMPLATES.find((t) => t.id === id))
    .filter((t): t is (typeof AGENT_TEMPLATES)[number] => !!t);

  if (enabledTemplates.length) {
    const skills = Array.from(new Set(enabledTemplates.flatMap((t) => t.skills)));
    if (skills.length) agents.defaults.skills = skills;
  }

  const agentList: any[] = [];
  for (const t of enabledTemplates) {
    agentList.push({
      id: t.id,
      default: !!t.default,
      skills: t.skills,
      groupChat: t.mentionPatterns ? { mentionPatterns: t.mentionPatterns } : undefined,
    });
  }
  for (const c of state.agents.custom) {
    agentList.push({
      id: c.id,
      skills: c.skills?.length ? c.skills : ["files"],
    });
  }
  if (agentList.length) agents.list = agentList;
  patch.agents = agents;

  // ------------------------------------------------------------------
  // channels.*
  // ------------------------------------------------------------------
  const channels: Record<string, any> = {};
  for (const [id, cfg] of Object.entries(state.channels)) {
    if (!cfg.enabled) continue;
    const spec = CHANNELS.find((c) => c.id === id);
    if (!spec) continue;
    const entry: Record<string, any> = { enabled: true };
    if (cfg.dmPolicy) entry.dmPolicy = cfg.dmPolicy;

    for (const field of spec.fields) {
      const raw = cfg.fields?.[field.name];
      if (raw === undefined || raw === null || raw === "") continue;

      if (field.name === "allowFrom" || field.name === "groupAllowFrom" || field.name === "publicOrigin") {
        // Comma-separated list → array
        entry[field.name] = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (field.secret && state.secretMode === "env") {
        // Point at an env var via a SecretRef
        const envKey = envKeyForField(id, field.name);
        entry[field.name] = { source: "env", provider: "default", id: envKey };
      } else if (field.name === "serviceAccountJson") {
        // Accept either raw JSON or path; if it parses, embed the object;
        // otherwise embed as-is (the CLI accepts both).
        entry[field.name] = tryJson(raw);
      } else {
        entry[field.name] = raw;
      }
    }

    channels[id] = entry;
  }
  if (Object.keys(channels).length) patch.channels = channels;

  // ------------------------------------------------------------------
  // gateway.*
  // ------------------------------------------------------------------
  if (state.gateway && (state.gateway.port || state.gateway.bind)) {
    patch.gateway = {};
    if (state.gateway.port) patch.gateway.port = state.gateway.port;
    if (state.gateway.bind) patch.gateway.bind = state.gateway.bind;
  }

  // ------------------------------------------------------------------
  // env.* — inline mode writes secrets into the config itself so
  // OpenClaw resolves them at read time. env mode leaves the values
  // in the user's shell env and only writes SecretRef stubs above.
  // ------------------------------------------------------------------
  if (state.secretMode === "inline" && Object.keys(state.secrets).length) {
    patch.env = { vars: { ...state.secrets } };
  }

  return patch;
}

/** Emit a shell script that exports the given secrets. Used when the wizard
 * runs in "env" secret mode — the user runs this script before starting the
 * OpenClaw daemon so the SecretRefs resolve. */
export function toEnvScript(secrets: Record<string, string>): string {
  const lines = ["#!/usr/bin/env bash", "# Generated by openclaw-setup-engine", ""];
  for (const [k, v] of Object.entries(secrets)) {
    if (!v) continue;
    lines.push(`export ${k}=${shellEscape(v)}`);
  }
  return lines.join("\n") + "\n";
}

function envKeyForField(channelId: string, field: string): string {
  // Normalise to SCREAMING_SNAKE_CASE.
  const c = channelId.toUpperCase().replace(/-/g, "_");
  const f = field.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
  return `OPENCLAW_${c}_${f}`;
}

function shellEscape(v: string): string {
  return `'${v.replace(/'/g, `'\\''`)}'`;
}

function tryJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
