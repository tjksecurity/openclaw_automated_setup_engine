"use client";

import { Tooltip } from "@/components/Tooltip";
import type { Catalog, Config } from "@/lib/setupClient";

// Integrations step: one toggleable card per public data source, with the
// (optional) API key fields the source uses.

export function IntegrationsStep({
  catalog,
  config,
  onConfig,
}: {
  catalog: Catalog;
  config: Config;
  onConfig: (patch: Partial<Config>) => void;
}) {
  function toggle(id: string, enabled: boolean) {
    onConfig({
      integrations: {
        ...config.integrations,
        [id]: { ...(config.integrations[id] || {}), enabled },
      },
    });
  }
  function setEnv(integId: string, name: string, value: string, secret?: boolean) {
    if (secret) {
      onConfig({ secrets: { ...config.secrets, [name]: value } });
      return;
    }
    onConfig({
      integrations: {
        ...config.integrations,
        [integId]: {
          ...(config.integrations[integId] || {}),
          env: { ...(config.integrations[integId]?.env || {}), [name]: value },
        },
      },
    });
  }
  return (
    <div className="space-y-3">
      {catalog.integrations.map((integ) => {
        const enabled = !!config.integrations[integ.id]?.enabled;
        return (
          <div
            key={integ.id}
            className={`rounded-lg border ${
              enabled ? "border-emerald-700/50 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/40"
            } p-4`}
          >
            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={enabled}
                  onChange={(e) => toggle(integ.id, e.target.checked)}
                />
                <span className="h-5 w-9 rounded-full bg-zinc-700 transition peer-checked:bg-emerald-500" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
              </label>
              <span className="text-sm font-medium">{integ.label}</span>
              <Tooltip text={integ.help} />
              {integ.default && (
                <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                  suggested
                </span>
              )}
            </div>
            {enabled && integ.env_vars.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {integ.env_vars.map((v) => {
                  const val = v.secret
                    ? config.secrets[v.name] || ""
                    : config.integrations[integ.id]?.env?.[v.name] ?? v.default ?? "";
                  return (
                    <div key={v.name} className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
                      <div className="mb-1 flex items-center text-xs font-medium text-zinc-300">
                        {v.label}
                        <Tooltip text={v.help} />
                      </div>
                      <input
                        type={v.secret ? "password" : "text"}
                        spellCheck={false}
                        autoComplete="off"
                        value={val}
                        placeholder={
                          val === "••••••••" ? "•••••••• (saved)" : v.default || "optional"
                        }
                        onChange={(e) => setEnv(integ.id, v.name, e.target.value, v.secret)}
                        className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
