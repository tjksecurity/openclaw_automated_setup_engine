"use client";

// Step 1: pick the primary model + a fallback + drop in the provider key.
// The model list is populated LIVE from `openclaw capability model list`,
// so users see whatever OpenClaw currently supports (98 models across 17
// providers as of this writing) rather than a stale hardcoded list.

import { useMemo } from "react";
import { Tooltip } from "@/components/Tooltip";
import type { Catalog, WizardState } from "@/lib/setupClient";

export function ModelStep({
  catalog,
  state,
  onChange,
}: {
  catalog: Catalog;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  // Group models by provider so the picker isn't a 98-row wall.
  const grouped = useMemo(() => {
    const map = new Map<string, Catalog["models"]>();
    for (const m of catalog.models) {
      if (!map.has(m.provider)) map.set(m.provider, []);
      map.get(m.provider)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog.models]);

  const primary = catalog.models.find((m) => m.id === state.model.primary);
  const providerEnvVars = Array.from(
    new Set(catalog.models.map((m) => m.envVar).filter((x): x is string => !!x)),
  );

  return (
    <div className="space-y-6">
      <section>
        <label className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Primary model
          <Tooltip text="The main model OpenClaw uses for every agent unless the agent overrides it. Anthropic's Claude Sonnet is a good default." />
        </label>
        <select
          value={state.model.primary}
          onChange={(e) => onChange({ model: { ...state.model, primary: e.target.value } })}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="">— choose a model —</option>
          {grouped.map(([provider, models]) => (
            <optgroup key={provider} label={provider}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.recommended ? " · recommended" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {primary && (
          <p className="mt-2 text-xs text-zinc-500">
            {primary.help}
          </p>
        )}
        {!catalog.openclaw_installed && (
          <p className="mt-2 text-xs text-amber-400">
            OpenClaw isn't installed yet — showing a small default model list. The wizard
            will pull the live catalog after install.
          </p>
        )}
      </section>

      <section>
        <label className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Fallback model
          <Tooltip text="Used automatically when the primary is rate-limited or errors. Pick a cheaper/faster model." />
        </label>
        <select
          value={state.model.fallbacks[0] || ""}
          onChange={(e) =>
            onChange({
              model: { ...state.model, fallbacks: e.target.value ? [e.target.value] : [] },
            })
          }
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="">— none —</option>
          {catalog.models.map((m) => (
            <option key={m.id} value={m.id} disabled={m.id === state.model.primary}>
              {m.label}
            </option>
          ))}
        </select>
      </section>

      <section>
        <div className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          API keys
          <Tooltip text="Stored either inside your local ~/.openclaw/openclaw.json (default) or as shell env vars — your choice." />
        </div>

        <div className="mb-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              className="accent-emerald-500"
              checked={state.secretMode === "inline"}
              onChange={() => onChange({ secretMode: "inline" })}
            />
            <span>
              <strong>Save keys in openclaw.json</strong> — simplest. Keys live in{" "}
              <code>~/.openclaw/openclaw.json</code>.
            </span>
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              className="accent-emerald-500"
              checked={state.secretMode === "env"}
              onChange={() => onChange({ secretMode: "env" })}
            />
            <span>
              <strong>Reference env vars</strong> — safer. The config points at{" "}
              <code>$ANTHROPIC_API_KEY</code> etc.; you keep the value in your shell env.
            </span>
          </label>
        </div>

        <div className="space-y-2">
          {providerEnvVars.map((env) => {
            const highlight = primary?.envVar === env;
            return (
              <KeyField
                key={env}
                env={env}
                value={state.secrets[env] || ""}
                onChange={(v) => onChange({ secrets: { ...state.secrets, [env]: v } })}
                highlight={highlight}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function KeyField({
  env,
  value,
  onChange,
  highlight,
}: {
  env: string;
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border ${
        highlight ? "border-emerald-700/70" : "border-zinc-800"
      } bg-zinc-900/40 p-3`}
    >
      <div className="mb-1 flex items-center text-xs font-medium text-zinc-300">
        {env}
        {highlight && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-400">
            needed for the selected model
          </span>
        )}
      </div>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="paste key here (or leave blank if it's already in your env)"
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
      />
    </div>
  );
}
