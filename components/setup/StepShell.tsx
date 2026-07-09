"use client";

// Shared shell for every wizard step: title row, help text, and a persistent
// "Save & continue" / "Back" footer. Steps only need to render their body.

import { ReactNode } from "react";

export interface StepShellProps {
  index: number;
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
}

export function StepShell(p: StepShellProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-lg">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-emerald-400">
            Step {p.index} of {p.total}
          </div>
          <h2 className="mt-1 text-2xl font-semibold">{p.title}</h2>
          {p.subtitle && <p className="mt-1 text-sm text-zinc-400">{p.subtitle}</p>}
        </div>
      </div>

      <div className="space-y-4">{p.children}</div>

      <div className="mt-8 flex items-center justify-between border-t border-zinc-800 pt-4">
        <button
          type="button"
          onClick={p.onBack}
          disabled={!p.onBack || p.busy}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={p.onNext}
          disabled={p.nextDisabled || !p.onNext || p.busy}
          className="rounded-md bg-emerald-500 px-5 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {p.busy ? "Working…" : p.nextLabel ?? "Save & continue →"}
        </button>
      </div>
    </div>
  );
}
