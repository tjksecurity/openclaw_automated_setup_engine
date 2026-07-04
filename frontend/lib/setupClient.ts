// Client-side helper for the setup wizard.
//
// All calls go through the Next.js /api/setup/* route handlers which proxy to
// the FastAPI backend when API_URL is set. If the backend is offline the
// route handlers still return a well-formed empty response so the wizard
// stays usable in demo mode.

export type Severity = "error" | "warning" | "info";

export interface Finding {
  severity: Severity;
  field: string;
  message: string;
  fix?: string;
  auto_fix?: unknown;
}

export interface ModelEntry {
  id: string;
  label: string;
  provider: string;
  env_var: string | null;
  keyless?: boolean;
  help: string;
  tier: string;
  recommended?: boolean;
  requires?: string[];
}

export interface EnvVarSpec {
  name: string;
  label: string;
  help: string;
  required?: boolean;
  secret?: boolean;
  default?: string;
}

export interface IntegrationEntry {
  id: string;
  label: string;
  help: string;
  env_vars: EnvVarSpec[];
  default?: boolean;
}

export interface AgentTemplate {
  id: string;
  label: string;
  help: string;
  default_model: string;
  prompt: string;
  default?: boolean;
}

export interface CustomAgent {
  id: string;
  label: string;
  prompt: string;
  model?: string;
  help?: string;
}

export interface DeployTarget {
  id: string;
  label: string;
  help: string;
  default?: boolean;
}

export interface Catalog {
  models: ModelEntry[];
  integrations: IntegrationEntry[];
  agent_templates: AgentTemplate[];
  deploy_targets: DeployTarget[];
}

export interface Config {
  version: number;
  profile: { name: string; created_at?: string | null };
  model: { primary: string; fallback?: string };
  integrations: Record<string, { enabled?: boolean; env?: Record<string, string> }>;
  agents: { enabled: string[]; custom: CustomAgent[] };
  deploy: { target: string; autodemo_seed: boolean };
  secrets: Record<string, string>;
  last_deploy?: { run_id: string; status: string; target: string; finished_at: string } | null;
}

export interface DeployStep {
  name: string;
  status: "running" | "ok" | "failed";
  detail?: string | null;
  hint?: string | null;
  auto_fix?: unknown;
}

export interface DeployRun {
  id: string;
  target: string;
  status: "running" | "success" | "failed";
  started_at: string;
  finished_at?: string | null;
  steps: DeployStep[];
  error?: string | null;
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
    const detail = (data && (data.detail || data.message)) || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const setupApi = {
  catalog: () => req<Catalog>("GET", "/catalog"),
  getConfig: () => req<Config>("GET", "/config"),
  putConfig: (patch: Partial<Config>) => req<Config>("PUT", "/config", patch),
  validate: (opts?: { apply_auto_fixes?: boolean; config?: Config }) =>
    req<{ findings: Finding[]; ok: boolean }>("POST", "/validate", opts ?? {}),
  createAgent: (a: Omit<CustomAgent, "id">) => req<CustomAgent>("POST", "/agents", a),
  updateAgent: (id: string, a: Omit<CustomAgent, "id">) => req<CustomAgent>("PUT", `/agents/${id}`, a),
  deleteAgent: (id: string) => req<{ status: string; id: string }>("DELETE", `/agents/${id}`),
  deploy: (apply_auto_fixes = true) =>
    req<{ status: "started" | "blocked"; run?: DeployRun; findings?: Finding[]; warnings?: Finding[]; message?: string }>(
      "POST",
      "/deploy",
      { apply_auto_fixes },
    ),
  deployStatus: (id: string) => req<DeployRun>("GET", `/deploy/${id}`),
};
