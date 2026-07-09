// Client-side types + fetch helpers for the OpenClaw setup wizard.
//
// Everything here maps 1:1 to a real API route that either reads the
// system OpenClaw CLI or writes a real config. No proxies, no demo mode,
// no serverless — this runs locally against the user's machine.

export interface ModelEntry {
  id: string;
  label: string;
  provider: string;
  envVar: string | null;
  tier: "flagship" | "balanced" | "fast" | "local";
  recommended?: boolean;
  help: string;
}

export interface FieldSpec {
  name: string;
  label: string;
  help: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
}

export interface ChannelSpec {
  id: string;
  label: string;
  help: string;
  fields: FieldSpec[];
  supportsGroups?: boolean;
  recommended?: boolean;
}

export interface AgentTemplate {
  id: string;
  label: string;
  help: string;
  skills: string[];
  mentionPatterns?: string[];
  prompt: string;
  default?: boolean;
}

export interface DeployTarget {
  id: string;
  label: string;
  help: string;
  default?: boolean;
}

export interface Catalog {
  openclaw_installed: boolean;
  models: ModelEntry[];
  channels: ChannelSpec[];
  agent_templates: AgentTemplate[];
  deploy_targets: DeployTarget[];
}

export interface WizardState {
  model: { primary: string; fallbacks: string[] };
  secrets: Record<string, string>;
  channels: Record<
    string,
    {
      enabled: boolean;
      dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
      fields: Record<string, string>;
    }
  >;
  agents: {
    templates: string[];
    custom: Array<{ id: string; label: string; prompt: string; skills: string[] }>;
  };
  gateway: { port?: number; bind?: string };
  secretMode: "inline" | "env";
  deploy_target: string;
}

export function emptyState(): WizardState {
  return {
    model: { primary: "", fallbacks: [] },
    secrets: {},
    channels: {},
    agents: { templates: ["personal"], custom: [] },
    gateway: {},
    secretMode: "inline",
    deploy_target: "install_and_start",
  };
}

export interface Finding {
  severity: "error" | "warning";
  field: string;
  message: string;
  fix?: string;
}

export interface ValidateResult {
  ok: boolean;
  findings: Finding[];
  patch_preview: unknown;
  openclaw_current_valid: { ok: boolean; message: string } | null;
}

export interface StatusSnapshot {
  installed: boolean;
  version?: string;
  message?: string;
  config_path?: string;
  current_config?: unknown;
  channels?: unknown[];
  agents?: unknown[];
  gateway?: { ok: boolean; detail: string };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/setup${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = (data && (data.detail || data.error || data.message)) || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const setupApi = {
  catalog: () => req<Catalog>("GET", "/catalog"),
  status: () => req<StatusSnapshot>("GET", "/status"),
  validate: (state: WizardState) => req<ValidateResult>("POST", "/validate", state),

  deploy: async (
    state: WizardState,
    onLine: (line: { kind: string; text: string; step?: string; ok?: boolean }) => void,
  ) => {
    const res = await fetch("/api/setup/deploy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok || !res.body) throw new Error(`deploy request failed: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const p of parts) {
        if (!p.trim()) continue;
        try {
          onLine(JSON.parse(p));
        } catch {
          onLine({ kind: "log", text: p });
        }
      }
    }
    if (buf.trim()) {
      try {
        onLine(JSON.parse(buf));
      } catch {
        onLine({ kind: "log", text: buf });
      }
    }
  },

  doctor: (fix = false) =>
    req<{ ok: boolean; output: string; exit: number }>("POST", `/doctor?fix=${fix}`),
};
