"use client";

// Step 2: pick messaging channels. Each channel has real, hand-curated
// per-channel field specs (bot token, phone number, service-account JSON,
// etc.) drawn from OpenClaw's channel docs. The wizard writes these under
// `channels.<id>.*` in ~/.openclaw/openclaw.json.

import { Tooltip } from "@/components/Tooltip";
import type { Catalog, WizardState } from "@/lib/setupClient";

const DM_POLICIES = [
  { id: "pairing", help: "Unknown senders get a pairing code they must approve. Default." },
  { id: "allowlist", help: "Only senders you list ahead of time can DM the bot." },
  { id: "open", help: "Anyone can DM. Only pick this on channels behind auth (Slack, Teams)." },
  { id: "disabled", help: "Bot ignores DMs entirely." },
] as const;

export function ChannelsStep({
  catalog,
  state,
  onChange,
}: {
  catalog: Catalog;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  function toggle(id: string, enabled: boolean) {
    onChange({
      channels: {
        ...state.channels,
        [id]: {
          ...(state.channels[id] || { fields: {}, dmPolicy: "pairing" as const }),
          enabled,
        },
      },
    });
  }
  function setField(id: string, field: string, value: string) {
    const existing = state.channels[id] || { enabled: true, fields: {}, dmPolicy: "pairing" as const };
    onChange({
      channels: {
        ...state.channels,
        [id]: { ...existing, fields: { ...existing.fields, [field]: value } },
      },
    });
  }
  function setDmPolicy(id: string, policy: (typeof DM_POLICIES)[number]["id"]) {
    const existing = state.channels[id] || { enabled: true, fields: {} };
    onChange({
      channels: {
        ...state.channels,
        [id]: { ...existing, dmPolicy: policy },
      },
    });
  }

  return (
    <div className="space-y-3">
      {catalog.channels.map((c) => {
        const cfg = state.channels[c.id];
        const enabled = !!cfg?.enabled;
        return (
          <div
            key={c.id}
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
                  onChange={(e) => toggle(c.id, e.target.checked)}
                />
                <span className="h-5 w-9 rounded-full bg-zinc-700 transition peer-checked:bg-emerald-500" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
              </label>
              <span className="text-sm font-medium">{c.label}</span>
              <Tooltip text={c.help} />
              {c.recommended && (
                <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                  suggested
                </span>
              )}
            </div>

            {enabled && (
              <div className="mt-4 space-y-3">
                {c.fields.map((f) => (
                  <div key={f.name}>
                    <div className="mb-1 flex items-center text-xs font-medium text-zinc-300">
                      {f.label}
                      {f.required && <span className="ml-1 text-red-400">*</span>}
                      <Tooltip text={f.help} />
                    </div>
                    {f.name === "serviceAccountJson" ? (
                      <textarea
                        value={cfg?.fields?.[f.name] || ""}
                        onChange={(e) => setField(c.id, f.name, e.target.value)}
                        rows={4}
                        placeholder={f.placeholder || "{ ... }"}
                        className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
                      />
                    ) : (
                      <input
                        type={f.secret ? "password" : "text"}
                        autoComplete="off"
                        spellCheck={false}
                        value={cfg?.fields?.[f.name] || ""}
                        onChange={(e) => setField(c.id, f.name, e.target.value)}
                        placeholder={f.placeholder || (f.required ? "required" : "optional")}
                        className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
                      />
                    )}
                  </div>
                ))}

                <div>
                  <div className="mb-1 flex items-center text-xs font-medium text-zinc-300">
                    DM policy
                    <Tooltip text="How the bot handles direct messages from senders it doesn't recognize." />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DM_POLICIES.map((p) => (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                          (cfg?.dmPolicy ?? "pairing") === p.id
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-100"
                            : "border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <input
                          type="radio"
                          className="hidden"
                          checked={(cfg?.dmPolicy ?? "pairing") === p.id}
                          onChange={() => setDmPolicy(c.id, p.id)}
                        />
                        {p.id}
                        <Tooltip text={p.help} />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
