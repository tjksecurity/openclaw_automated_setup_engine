"use client";

// Step 4: summary + validator findings + choice of deploy target + a
// scrollable preview of the exact JSON patch the wizard will send to
// `openclaw config patch --stdin`.

import { useEffect, useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import { setupApi, type Catalog, type WizardState, type Finding } from "@/lib/setupClient";

export function ReviewStep({
  catalog,
  state,
  onChange,
  onFindings,
}: {
  catalog: Catalog;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onFindings: (f: Finding[]) => void;
}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [patchPreview, setPatchPreview] = useState<unknown>(null);
  const [openclawValid, setOpenclawValid] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await setupApi.validate(state);
        setFindings(r.findings);
        setPatchPreview(r.patch_preview);
        setOpenclawValid(r.openclaw_current_valid);
        onFindings(r.findings);
      } catch (e) {
        setFindings([{ severity: "error", field: "validate", message: (e as Error).message }]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const primary = catalog.models.find((m) => m.id === state.model.primary);
  const enabledChannels = Object.entries(state.channels).filter(([, v]) => v.enabled);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Card k="Primary model" v={primary?.label ?? state.model.primary ?? "—"} />
        <Card
          k="Fallback"
          v={
            state.model.fallbacks[0]
              ? catalog.models.find((m) => m.id === state.model.fallbacks[0])?.label ??
                state.model.fallbacks[0]
              : "— none —"
          }
        />
        <Card
          k="Channels"
          v={
            enabledChannels.length
              ? enabledChannels.map(([id]) => catalog.channels.find((c) => c.id === id)?.label ?? id).join(", ")
              : "none"
          }
        />
        <Card
          k="Agents"
          v={`${state.agents.templates.length} built-in + ${state.agents.custom.length} custom`}
        />
        <Card k="Secret mode" v={state.secretMode === "inline" ? "in openclaw.json" : "shell env vars"} />
        <Card
          k="Deploy target"
          v={catalog.deploy_targets.find((t) => t.id === state.deploy_target)?.label ?? state.deploy_target}
        />
      </section>

      <section>
        <label className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Deploy target
          <Tooltip text="What the Deploy step actually does on this machine." />
        </label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {catalog.deploy_targets.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                state.deploy_target === t.id
                  ? "border-emerald-700/60 bg-emerald-500/5"
                  : "border-zinc-800"
              }`}
            >
              <input
                type="radio"
                checked={state.deploy_target === t.id}
                onChange={() => onChange({ deploy_target: t.id })}
                className="mt-0.5 accent-emerald-500"
              />
              <div className="flex-1">
                <div className="flex items-center text-sm font-medium">
                  {t.label}
                  <Tooltip text={t.help} />
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {openclawValid && !openclawValid.ok && (
        <section className="rounded border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-100">
          <div className="font-medium">Heads up — your current on-disk config is not valid.</div>
          <div className="mt-1 opacity-90">
            {openclawValid.message}
          </div>
          <div className="mt-2 opacity-80">
            Deploy will re-write the offending sections. If you'd rather try to auto-fix first, hit
            the Doctor button on the dashboard.
          </div>
        </section>
      )}

      {findings.length > 0 && (
        <section>
          <div className="mb-2 text-sm font-medium text-zinc-200">Checks</div>
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li
                key={i}
                className={`rounded border p-3 text-xs ${
                  f.severity === "error"
                    ? "border-red-800 bg-red-950/30 text-red-100"
                    : "border-amber-800 bg-amber-950/30 text-amber-100"
                }`}
              >
                <span className="mr-2 rounded bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {f.severity}
                </span>
                {f.message}
                {f.fix && <div className="mt-1 opacity-90">Fix: {f.fix}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center text-sm font-medium text-zinc-200">
          Config patch preview
          <Tooltip text="Exactly what gets sent to `openclaw config patch --stdin`. OpenClaw validates it against its JSON schema before writing to disk." />
        </div>
        <pre className="max-h-64 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300">
{JSON.stringify(patchPreview, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function Card({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
      <div className="mt-0.5 text-sm">{v}</div>
    </div>
  );
}
