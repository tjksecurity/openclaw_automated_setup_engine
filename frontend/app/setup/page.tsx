"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { setupApi, type Catalog, type Config, type Finding } from "@/lib/setupClient";
import { StepShell } from "@/components/setup/StepShell";
import { ModelStep } from "@/components/setup/ModelStep";
import { IntegrationsStep } from "@/components/setup/IntegrationsStep";
import { AgentsStep } from "@/components/setup/AgentsStep";
import { ReviewStep } from "@/components/setup/ReviewStep";
import { DeployStep } from "@/components/setup/DeployStep";
import { ToastStrip, type Toast } from "@/components/setup/Toast";

// The OpenClaw setup wizard.
//
// Single page, multi-step. State kept locally, persisted to the backend on
// each Next / auto-save. All network errors surface via the ToastStrip; the
// wizard never blocks on a failed save — it queues and retries.

const STEPS = ["Model", "Integrations", "Agents", "Review", "Deploy"] as const;

export default function SetupPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [step, setStep] = useState<number>(0);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [saving, setSaving] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { ...toast, id }]);
  }, []);
  const pushError = useCallback((msg: string) => pushToast({ kind: "error", message: msg }), [pushToast]);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // Initial load.
  useEffect(() => {
    (async () => {
      try {
        const [cat, cfg] = await Promise.all([setupApi.catalog(), setupApi.getConfig()]);
        setCatalog(cat);
        setConfig(cfg);
      } catch (e) {
        setDemoMode(true);
        pushToast({
          kind: "warning",
          message:
            "Backend not reachable — running the wizard in demo mode. Start the FastAPI backend on :8000 and refresh to enable deploy.",
        });
      }
    })();
  }, [pushToast]);

  // Auto-save to the backend on every config edit (debounced).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyConfig = useCallback(
    (patch: Partial<Config>) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = deepMerge(structuredClone(prev) as unknown as Record<string, unknown>, patch as Record<string, unknown>);
        return next as unknown as Config;
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          const saved = await setupApi.putConfig(patch);
          // Merge redacted secrets back so the UI shows saved-key placeholders.
          setConfig((prev) => (prev ? ({ ...prev, secrets: saved.secrets }) : prev));
        } catch (e) {
          pushError(`Couldn't save: ${(e as Error).message}`);
        } finally {
          setSaving(false);
        }
      }, 350);
    },
    [pushError],
  );

  const refreshFromServer = useCallback(async () => {
    try {
      const cfg = await setupApi.getConfig();
      setConfig(cfg);
    } catch (e) {
      pushError((e as Error).message);
    }
  }, [pushError]);

  // Validate whenever the config changes, on Review + Deploy steps.
  useEffect(() => {
    if (!config || step < 3) return;
    let cancelled = false;
    setupApi
      .validate()
      .then((res) => {
        if (!cancelled) setFindings(res.findings);
      })
      .catch(() => {
        /* silent — demo mode */
      });
    return () => {
      cancelled = true;
    };
  }, [config, step]);

  const applyAutoFix = useCallback(
    async (fix: unknown) => {
      if (!fix || typeof fix !== "object") return;
      applyConfig(fix as Partial<Config>);
      // Immediate PUT so the deploy retry sees fresh state.
      try {
        await setupApi.putConfig(fix as Partial<Config>);
      } catch (e) {
        pushError((e as Error).message);
      }
    },
    [applyConfig, pushError],
  );

  const stepIsValid = useMemo(() => {
    if (!config) return false;
    if (step === 0) return !!config.model.primary;
    if (step === 1) return Object.values(config.integrations).some((v) => v.enabled);
    if (step === 2) return config.agents.enabled.length > 0;
    if (step === 3) return findings.every((f) => f.severity !== "error");
    return true;
  }, [step, config, findings]);

  return (
    <main className="min-h-screen bg-black text-white">
      <ToastStrip toasts={toasts} onDismiss={dismissToast} />

      <header className="border-b border-zinc-900 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400">OpenClaw setup engine</div>
            <h1 className="text-xl font-semibold">Configure your instance</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {saving && <span className="text-zinc-400">Saving…</span>}
            {demoMode && (
              <span className="rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-amber-200">
                Demo mode
              </span>
            )}
            <Link href="/" className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800">
              Dashboard
            </Link>
          </div>
        </div>
        <StepBar step={step} onGo={(i) => setStep(i)} />
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {(!catalog || !config) && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
            Loading the setup engine…
          </div>
        )}

        {catalog && config && step === 0 && (
          <StepShell
            index={1}
            total={STEPS.length}
            title="Pick your model"
            subtitle="This is the model your agents will reason with. You can change it later."
            onNext={() => setStep(1)}
            nextDisabled={!stepIsValid}
          >
            <ModelStep catalog={catalog} config={config} onConfig={applyConfig} />
          </StepShell>
        )}

        {catalog && config && step === 1 && (
          <StepShell
            index={2}
            total={STEPS.length}
            title="Turn on the integrations you want"
            subtitle="Each toggle enables a capability your agents can call — search the web, browse a page, remember something, send an email. Keyless integrations work out of the box."
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            nextDisabled={!stepIsValid}
          >
            <IntegrationsStep catalog={catalog} config={config} onConfig={applyConfig} />
          </StepShell>
        )}

        {catalog && config && step === 2 && (
          <StepShell
            index={3}
            total={STEPS.length}
            title="Pick or create your agents"
            subtitle="Toggle the built-in agents you want and, if you like, write your own from a plain-English prompt."
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextDisabled={!stepIsValid}
          >
            <AgentsStep
              catalog={catalog}
              config={config}
              onConfig={applyConfig}
              onRefresh={refreshFromServer}
              pushError={pushError}
            />
          </StepShell>
        )}

        {catalog && config && step === 3 && (
          <StepShell
            index={4}
            total={STEPS.length}
            title="Review and choose where to deploy"
            subtitle="OpenClaw checks your config and offers a one-click fix for anything that would break the deploy."
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextLabel="Deploy →"
            nextDisabled={!stepIsValid}
          >
            <ReviewStep
              catalog={catalog}
              config={config}
              findings={findings}
              onConfig={applyConfig}
              onApplyFix={applyAutoFix}
            />
          </StepShell>
        )}

        {catalog && config && step === 4 && (
          <StepShell
            index={5}
            total={STEPS.length}
            title="Deploy"
            subtitle="OpenClaw writes your .env, updates the agent registry, and hot-reloads the runtime. Failures are non-destructive — you can retry any time."
            onBack={() => setStep(3)}
            nextLabel="Finish"
            onNext={() => (window.location.href = "/")}
          >
            <DeployStep
              autoStart
              onDone={() => setStep(0)}
              onApplyFix={applyAutoFix}
              pushError={pushError}
            />
          </StepShell>
        )}
      </div>
    </main>
  );
}

function StepBar({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <div className="mx-auto mt-4 flex max-w-4xl items-center gap-2 overflow-x-auto text-xs">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <button
            key={label}
            onClick={() => (done ? onGo(i) : undefined)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 whitespace-nowrap ${
              current
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                : done
                  ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  : "border-zinc-800 text-zinc-500"
            }`}
            disabled={!done && !current}
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                done ? "bg-emerald-500 text-black" : current ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Minimal deep merge for local optimistic state — server does its own.
function deepMerge<T extends Record<string, unknown>>(dst: T, src: Record<string, unknown>): T {
  for (const [k, v] of Object.entries(src)) {
    const existing = (dst as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !Array.isArray(v) && existing && typeof existing === "object" && !Array.isArray(existing)) {
      (dst as Record<string, unknown>)[k] = deepMerge({ ...(existing as Record<string, unknown>) }, v as Record<string, unknown>);
    } else {
      (dst as Record<string, unknown>)[k] = v;
    }
  }
  return dst;
}
