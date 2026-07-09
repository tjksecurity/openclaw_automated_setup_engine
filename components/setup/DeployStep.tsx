"use client";

// Step 5: run the real deploy. Streams NDJSON progress lines from
// /api/setup/deploy and renders each step with its live output. On error,
// shows the CLI stderr so the user can see exactly what went wrong.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { setupApi, type WizardState } from "@/lib/setupClient";

interface StepState {
  id: string;
  label: string;
  status: "pending" | "running" | "ok" | "failed";
  lines: string[];
}

const STEP_LABELS: Record<string, string> = {
  install: "Install OpenClaw",
  backup: "Locate config",
  patch: "Write config",
  validate: "Validate",
  start: "Start daemon",
};

export function DeployStep({
  state,
  autoStart,
}: {
  state: WizardState;
  autoStart: boolean;
}) {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setDone(false);
    setFailed(false);
    setError(null);
    setSteps([]);
    try {
      await setupApi.deploy(state, (line) => {
        setSteps((prev) => {
          const list = [...prev];
          const stepId = line.step || "?";
          const found = list.find((s) => s.id === stepId);
          const label = STEP_LABELS[stepId] || stepId;
          if (line.kind === "step") {
            if (found) {
              found.lines.push(line.text);
              found.status = line.ok ? "ok" : "running";
            } else {
              list.push({ id: stepId, label, status: line.ok ? "ok" : "running", lines: [line.text] });
            }
          } else if (line.kind === "log") {
            if (found) {
              found.lines.push(line.text);
            } else {
              list.push({ id: stepId, label, status: "running", lines: [line.text] });
            }
          } else if (line.kind === "error") {
            if (found) {
              found.status = "failed";
              found.lines.push(line.text);
            } else {
              list.push({ id: stepId, label, status: "failed", lines: [line.text] });
            }
            setFailed(true);
          } else if (line.kind === "done") {
            setDone(true);
          }
          return list;
        });
      });
    } catch (e) {
      setError((e as Error).message);
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {steps.length === 0 && !error && (
        <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
          {running ? "Kicking off deploy…" : "Ready to run."}
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-lg leading-none ${
                  s.status === "ok"
                    ? "text-emerald-400"
                    : s.status === "failed"
                      ? "text-red-400"
                      : "text-zinc-400"
                }`}
              >
                {s.status === "ok" ? "✓" : s.status === "failed" ? "✗" : "◌"}
              </span>
              <span className="text-sm font-medium">{s.label}</span>
              <span
                className={`ml-auto text-[10px] uppercase tracking-wide ${
                  s.status === "ok"
                    ? "text-emerald-400"
                    : s.status === "failed"
                      ? "text-red-400"
                      : "text-zinc-400"
                }`}
              >
                {s.status}
              </span>
            </div>
            {s.lines.length > 0 && (
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[11px] text-zinc-400">
                {s.lines.join("\n")}
              </pre>
            )}
          </li>
        ))}
      </ol>

      {done && !failed && (
        <div className="rounded border border-emerald-800 bg-emerald-950/40 p-3">
          <div className="text-sm text-emerald-200">
            OpenClaw is configured. Open the dashboard to see live channel + agent status.
          </div>
          <div className="mt-2 flex gap-2">
            <Link
              href="/dashboard"
              className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
            >
              Open dashboard →
            </Link>
            <button
              onClick={run}
              disabled={running}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              Re-run
            </button>
          </div>
        </div>
      )}

      {failed && !running && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3">
          <div className="text-sm text-red-100">
            Deploy failed. Nothing was permanently broken — the CLI validates before writing.
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={run}
              className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
