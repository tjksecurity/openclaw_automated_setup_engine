"use client";

import { Tooltip } from "@/components/Tooltip";
import type { Catalog, Config } from "@/lib/setupClient";

// Model step: user picks the primary agent model + optional fallback + drops
// in the provider API key. All copy is deliberately plain-English; every
// technical term has a tooltip.

export function ModelStep({
  catalog,
  config,
  onConfig,
}: {
  catalog: Catalog;
  config: Config;
  onConfig: (patch: Partial<Config>) => void;
}) {
  const primary = catalog.models.find((m) => m.id === config.model.primary);
  const providerKeys = new Set(catalog.models.map((m) => m.env_var).filter(Boolean) as string[]);

  return (
    <div className="space-y-6">
      <section>
        <label className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Primary model
          <Tooltip text="The main brain your agents use. Pick something capable — Claude Sonnet 5 is a good default that balances cost and quality." />
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {catalog.models.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer flex-col rounded-lg border px-4 py-3 transition ${
                config.model.primary === m.id
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="primary-model"
                  className="accent-emerald-500"
                  checked={config.model.primary === m.id}
                  onChange={() => onConfig({ model: { ...config.model, primary: m.id } })}
                />
                <span className="text-sm font-medium">{m.label}</span>
                {m.recommended && (
                  <span className="ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                    Recommended
                  </span>
                )}
                <Tooltip text={m.help} />
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {m.provider} · {m.tier}
                {m.keyless && " · no API key needed"}
              </div>
            </label>
          ))}
        </div>
      </section>

      <section>
        <label className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Fallback model
          <Tooltip text="Used automatically when the primary model is rate-limited, slow, or errors. Pick a cheaper/faster model so cost stays bounded." />
        </label>
        <select
          value={config.model.fallback || ""}
          onChange={(e) => onConfig({ model: { ...config.model, fallback: e.target.value } })}
          className="w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="">— none —</option>
          {catalog.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </section>

      <section>
        <div className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          API keys
          <Tooltip text="Keys are stored locally on your machine (in .env), never sent anywhere but the model provider. Leave blank to run agents in offline sample mode." />
        </div>
        <div className="space-y-3">
          {Array.from(providerKeys).map((env) => (
            <KeyField
              key={env}
              env={env}
              value={config.secrets[env] || ""}
              hintProvider={
                catalog.models.find((m) => m.env_var === env)?.provider ?? env
              }
              onChange={(v) =>
                onConfig({ secrets: { ...config.secrets, [env]: v } })
              }
              highlighted={primary?.env_var === env}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function KeyField({
  env,
  value,
  onChange,
  hintProvider,
  highlighted,
}: {
  env: string;
  value: string;
  onChange: (v: string) => void;
  hintProvider: string;
  highlighted?: boolean;
}) {
  const isRedacted = value === "••••••••";
  return (
    <div className={`rounded-md border ${highlighted ? "border-emerald-700/70" : "border-zinc-800"} bg-zinc-900/40 p-3`}>
      <div className="mb-1 flex items-center text-xs font-medium text-zinc-300">
        {env}
        <Tooltip text={`API key for ${hintProvider}. Stored only on this machine.`} />
        {highlighted && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-400">
            Needed for selected model
          </span>
        )}
      </div>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={isRedacted ? "•••••••• (saved — paste to replace)" : "paste key here"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
      />
    </div>
  );
}
