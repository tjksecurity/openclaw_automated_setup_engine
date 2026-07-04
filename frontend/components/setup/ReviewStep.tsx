"use client";

import { Tooltip } from "@/components/Tooltip";
import type { Catalog, Config, Finding } from "@/lib/setupClient";

// Review step: summary + validator findings with per-finding auto-fix action.

export function ReviewStep({
  catalog,
  config,
  findings,
  onApplyFix,
  onConfig,
}: {
  catalog: Catalog;
  config: Config;
  findings: Finding[];
  onApplyFix: (fix: unknown) => Promise<void>;
  onConfig: (patch: Partial<Config>) => void;
}) {
  const enabledIntegrations = Object.entries(config.integrations).filter(([, v]) => v.enabled);
  const enabledAgents = config.agents.enabled;
  const model = catalog.models.find((m) => m.id === config.model.primary);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 text-sm font-medium text-zinc-200">Summary</div>
        <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <SummaryRow k="Model" v={model?.label ?? config.model.primary} help="The main brain your agents will use." />
          <SummaryRow k="Fallback model" v={config.model.fallback || "— none —"} help="Kicks in if the primary model is throttled or errors." />
          <SummaryRow
            k="Integrations"
            v={enabledIntegrations.length ? enabledIntegrations.map(([id]) => catalog.integrations.find((i) => i.id === id)?.label ?? id).join(", ") : "none"}
            help="Data sources feeding events into the system."
          />
          <SummaryRow
            k="Agents"
            v={enabledAgents.length ? `${enabledAgents.length} enabled` : "none"}
            help="Agents read events and produce opportunity cards."
          />
          <SummaryRow
            k="Deploy target"
            v={catalog.deploy_targets.find((t) => t.id === config.deploy.target)?.label ?? config.deploy.target}
            help="Where OpenClaw will apply this config."
          />
        </dl>
      </section>

      <section>
        <label className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Deploy target
          <Tooltip text="Local .env is the simplest — a single file the backend re-reads on the fly. Docker mode writes the same file and expects you to run docker compose up yourself." />
        </label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {catalog.deploy_targets.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${
                config.deploy.target === t.id ? "border-emerald-700/60 bg-emerald-500/5" : "border-zinc-800"
              }`}
            >
              <input
                type="radio"
                checked={config.deploy.target === t.id}
                onChange={() => onConfig({ deploy: { ...config.deploy, target: t.id } })}
                className="accent-emerald-500"
              />
              <span className="text-sm font-medium">{t.label}</span>
              <Tooltip text={t.help} />
            </label>
          ))}
        </div>
      </section>

      {findings.length > 0 && (
        <section>
          <div className="mb-2 text-sm font-medium text-zinc-200">Checks</div>
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li
                key={i}
                className={`rounded-lg border p-3 text-xs ${
                  f.severity === "error"
                    ? "border-red-800 bg-red-950/30 text-red-100"
                    : f.severity === "warning"
                      ? "border-amber-800 bg-amber-950/30 text-amber-100"
                      : "border-zinc-800 text-zinc-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="mr-2 rounded bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      {f.severity}
                    </span>
                    <span className="font-medium">{f.message}</span>
                    {f.fix && <div className="mt-1 opacity-90">Fix: {f.fix}</div>}
                    <div className="mt-1 opacity-60">Field: {f.field}</div>
                  </div>
                  {f.auto_fix ? (
                    <button
                      onClick={() => onApplyFix(f.auto_fix)}
                      className="whitespace-nowrap rounded border border-current px-2 py-1 text-[10px] uppercase tracking-wide"
                    >
                      Apply fix
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SummaryRow({ k, v, help }: { k: string; v: string; help: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center text-[10px] uppercase tracking-wide text-zinc-500">
        {k}
        <Tooltip text={help} />
      </div>
      <div className="mt-0.5 text-sm">{v}</div>
    </div>
  );
}
