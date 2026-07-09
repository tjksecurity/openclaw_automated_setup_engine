"use client";

// The setup wizard controller. Five steps:
//   Model → Channels → Agents → Review → Deploy
// All state lives here; child steps get a slice + an onChange.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  setupApi,
  emptyState,
  type Catalog,
  type Finding,
  type WizardState,
} from "@/lib/setupClient";
import { StepShell } from "@/components/setup/StepShell";
import { ModelStep } from "@/components/setup/ModelStep";
import { ChannelsStep } from "@/components/setup/ChannelsStep";
import { AgentsStep } from "@/components/setup/AgentsStep";
import { ReviewStep } from "@/components/setup/ReviewStep";
import { DeployStep } from "@/components/setup/DeployStep";
import { ToastStrip, type Toast } from "@/components/setup/Toast";

const STEPS = ["Model", "Channels", "Agents", "Review", "Deploy"] as const;

export default function SetupPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<WizardState>(emptyState());
  const [step, setStep] = useState<number>(0);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [openclawInstalled, setOpenclawInstalled] = useState<boolean | null>(null);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await setupApi.catalog();
        setCatalog(c);
        setOpenclawInstalled(c.openclaw_installed);
        if (c.models.length && !state.model.primary) {
          const rec = c.models.find((m) => m.recommended) ?? c.models[0];
          setState((prev) => ({ ...prev, model: { ...prev.model, primary: rec.id } }));
        }
      } catch (e) {
        pushToast({
          kind: "error",
          message: `Couldn't load catalog: ${(e as Error).message}`,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const nextDisabled = useMemo(() => {
    if (!catalog) return true;
    if (step === 0) return !state.model.primary;
    if (step === 3) return findings.some((f) => f.severity === "error");
    return false;
  }, [step, catalog, state, findings]);

  return (
    <main className="min-h-screen bg-black text-white">
      <ToastStrip toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      <header className="border-b border-zinc-900 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400">
              OpenClaw setup engine
            </div>
            <h1 className="text-xl font-semibold">Configure your OpenClaw</h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {openclawInstalled === false && (
              <span className="rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-amber-200">
                OpenClaw not installed — the Deploy step will install it
              </span>
            )}
            {openclawInstalled === true && (
              <span className="rounded border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-emerald-200">
                OpenClaw detected
              </span>
            )}
            <Link
              href="/dashboard"
              className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
            >
              Dashboard
            </Link>
          </div>
        </div>
        <StepBar step={step} onGo={(i) => setStep(i)} />
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {!catalog && (
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
            Loading catalog from your local OpenClaw…
          </div>
        )}

        {catalog && step === 0 && (
          <StepShell
            index={1}
            total={STEPS.length}
            title="Pick your model"
            subtitle="This is the model your OpenClaw agents will reason with. You can change it any time."
            onNext={() => setStep(1)}
            nextDisabled={nextDisabled}
          >
            <ModelStep catalog={catalog} state={state} onChange={apply} />
          </StepShell>
        )}

        {catalog && step === 1 && (
          <StepShell
            index={2}
            total={STEPS.length}
            title="Wire up your messaging channels"
            subtitle="This is how you'll actually talk to OpenClaw — Discord, Telegram, Signal, etc. Enable one to start; you can add more later."
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          >
            <ChannelsStep catalog={catalog} state={state} onChange={apply} />
          </StepShell>
        )}

        {catalog && step === 2 && (
          <StepShell
            index={3}
            total={STEPS.length}
            title="Pick or write your agents"
            subtitle="Toggle the built-in agents you want, and add custom ones by writing a short prompt."
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          >
            <AgentsStep catalog={catalog} state={state} onChange={apply} />
          </StepShell>
        )}

        {catalog && step === 3 && (
          <StepShell
            index={4}
            total={STEPS.length}
            title="Review the exact config change"
            subtitle="OpenClaw validates every write against its JSON schema. The patch below is exactly what gets sent."
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextLabel="Deploy →"
            nextDisabled={nextDisabled}
          >
            <ReviewStep catalog={catalog} state={state} onChange={apply} onFindings={setFindings} />
          </StepShell>
        )}

        {catalog && step === 4 && (
          <StepShell
            index={5}
            total={STEPS.length}
            title="Deploy"
            subtitle="The wizard installs OpenClaw if needed, writes ~/.openclaw/openclaw.json via the real CLI, validates, and starts the daemon."
            onBack={() => setStep(3)}
            nextLabel="Finish"
            onNext={() => (window.location.href = "/dashboard")}
          >
            <DeployStep state={state} autoStart />
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
            onClick={() => (done || current ? onGo(i) : undefined)}
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
