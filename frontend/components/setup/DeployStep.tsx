"use client";

import { useEffect, useRef, useState } from "react";
import { setupApi, type DeployRun } from "@/lib/setupClient";

// Deploy step: press Deploy → poll the run status → render a live step feed.
// On failure, we surface the hint + an auto-fix button if the runner gave us
// one.

const STEP_ICON: Record<string, string> = {
  running: "◌",
  ok: "✓",
  failed: "✗",
};

const STEP_COLOR: Record<string, string> = {
  running: "text-zinc-400",
  ok: "text-emerald-400",
  failed: "text-red-400",
};

export function DeployStep({
  onDone,
  onApplyFix,
  pushError,
  autoStart,
}: {
  onDone: () => void;
  onApplyFix: (fix: unknown) => Promise<void>;
  pushError: (msg: string) => void;
  autoStart: boolean;
}) {
  const [run, setRun] = useState<DeployRun | null>(null);
  const [blocked, setBlocked] = useState<{ findings: unknown[]; message?: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  async function start() {
    setStarting(true);
    setBlocked(null);
    try {
      const res = await setupApi.deploy(true);
      if (res.status === "blocked") {
        setBlocked({ findings: res.findings ?? [], message: res.message });
        setStarting(false);
        return;
      }
      if (res.run) {
        setRun(res.run);
        poll(res.run.id);
      }
    } catch (e) {
      pushError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  function poll(id: string) {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    const tick = async () => {
      try {
        const state = await setupApi.deployStatus(id);
        setRun(state);
        if (state.status === "running") {
          pollTimer.current = setTimeout(tick, 500);
        }
      } catch (e) {
        pushError((e as Error).message);
      }
    };
    pollTimer.current = setTimeout(tick, 250);
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      start();
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const failed = run?.status === "failed";
  const success = run?.status === "success";
  const failingStep = run?.steps.find((s) => s.status === "failed");

  return (
    <div className="space-y-4">
      {!run && !blocked && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
          {starting ? "Kicking off deploy…" : "Ready. Press Deploy to write your config and restart the runtime."}
        </div>
      )}

      {blocked && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-100">
          <div className="mb-2 font-medium">Can't deploy yet.</div>
          <div className="opacity-90">{blocked.message ?? "The validator flagged blocking errors."}</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {(blocked.findings as { message: string; fix?: string }[]).map((f, i) => (
              <li key={i}>
                {f.message}
                {f.fix && <span className="opacity-80"> — {f.fix}</span>}
              </li>
            ))}
          </ul>
          <button
            onClick={() => start()}
            className="mt-3 rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
          >
            Retry (auto-fix + redeploy)
          </button>
        </div>
      )}

      {run && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider">
            <span className="text-zinc-400">Run {run.id}</span>
            <span
              className={
                success
                  ? "text-emerald-400"
                  : failed
                    ? "text-red-400"
                    : "text-zinc-400"
              }
            >
              {run.status}
            </span>
          </div>
          <ol className="space-y-2">
            {run.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 font-mono text-lg leading-none ${STEP_COLOR[s.status]}`}>
                  {STEP_ICON[s.status]}
                </span>
                <div className="flex-1">
                  <div className={STEP_COLOR[s.status]}>{s.name}</div>
                  {s.detail && (
                    <div className="mt-0.5 text-xs text-zinc-500 whitespace-pre-line">{s.detail}</div>
                  )}
                  {s.hint && (
                    <div className="mt-1 rounded bg-amber-950/40 border border-amber-800/50 px-2 py-1 text-xs text-amber-100">
                      Hint: {s.hint}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {failed && failingStep && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {failingStep.auto_fix ? (
                <button
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true);
                    try {
                      await onApplyFix(failingStep.auto_fix);
                      await start();
                    } finally {
                      setRetrying(false);
                    }
                  }}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {retrying ? "Fixing…" : "Auto-fix & retry"}
                </button>
              ) : (
                <button
                  onClick={() => start()}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
                >
                  Retry
                </button>
              )}
              <span className="text-xs text-zinc-500">
                Nothing has been broken — a failed deploy is a no-op. Fix and re-run.
              </span>
            </div>
          )}

          {success && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-emerald-300">
                OpenClaw is live. Open the dashboard to see your agents at work.
              </span>
              <a
                href="/"
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
              >
                Open dashboard →
              </a>
              <button
                onClick={onDone}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Edit config
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
