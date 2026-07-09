"use client";

// Dashboard: reads the LIVE OpenClaw state from the CLI. Not a copy of the
// wizard state — this comes straight out of `openclaw config get`,
// `openclaw channels list`, `openclaw agents list`, `openclaw health`.

import Link from "next/link";
import { useEffect, useState } from "react";
import { setupApi, type StatusSnapshot } from "@/lib/setupClient";

export default function Dashboard() {
  const [status, setStatus] = useState<StatusSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState<string | null>(null);

  async function refresh() {
    try {
      setStatus(await setupApi.status());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  async function runDoctor(fix: boolean) {
    setDoctorRunning(true);
    try {
      const r = await setupApi.doctor(fix);
      setDoctorOutput(r.output);
      await refresh();
    } catch (e) {
      setDoctorOutput((e as Error).message);
    } finally {
      setDoctorRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400">
              OpenClaw dashboard
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Live state</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Straight from the running <code>openclaw</code> CLI. Refreshes every 5s.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/setup"
              className="rounded border border-emerald-700 bg-emerald-500/10 px-3 py-1.5 text-emerald-200 hover:bg-emerald-500/20"
            >
              Edit setup →
            </Link>
            <Link
              href="/"
              className="rounded border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
            >
              Home
            </Link>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!status && !error && (
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            Loading…
          </div>
        )}

        {status && !status.installed && (
          <div className="rounded border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
            OpenClaw isn't installed on this machine yet. Head to the{" "}
            <Link href="/setup" className="underline">setup wizard</Link>.
          </div>
        )}

        {status?.installed && (
          <>
            <section className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Card k="OpenClaw version" v={status.version || "unknown"} />
              <Card k="Config path" v={status.config_path || "—"} mono />
              <Card
                k="Gateway"
                v={status.gateway?.ok ? "healthy" : "not running"}
                accent={status.gateway?.ok ? "green" : "amber"}
              />
              <Card k="Channels configured" v={String(status.channels?.length ?? 0)} />
            </section>

            <section className="mb-6 rounded border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">Configured agents</h2>
              {!status.agents || status.agents.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No agents in <code>agents.list[]</code>. That's fine — OpenClaw runs a
                  default agent when the list is empty.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(status.agents as any[]).map((a, i) => (
                    <li
                      key={a.id || i}
                      className="rounded border border-zinc-800 bg-zinc-950/40 p-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.id}</span>
                        {a.default && (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                            default
                          </span>
                        )}
                      </div>
                      {a.skills && a.skills.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {a.skills.map((s: string) => (
                            <span
                              key={s}
                              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-6 rounded border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">Configured channels</h2>
              {!status.channels || status.channels.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  No channels configured. Add one in the wizard.
                </p>
              ) : (
                <pre className="max-h-64 overflow-auto rounded bg-black/40 p-2 text-[11px] text-zinc-400">
                  {JSON.stringify(status.channels, null, 2)}
                </pre>
              )}
            </section>

            <section className="mb-6 rounded border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-300">Doctor</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => runDoctor(false)}
                    disabled={doctorRunning}
                    className="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Diagnose
                  </button>
                  <button
                    onClick={() => runDoctor(true)}
                    disabled={doctorRunning}
                    className="rounded bg-emerald-500 px-3 py-1 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Diagnose &amp; fix
                  </button>
                </div>
              </div>
              {doctorOutput && (
                <pre className="max-h-48 overflow-auto rounded bg-black/40 p-2 text-[11px] text-zinc-400 whitespace-pre-wrap">
                  {doctorOutput}
                </pre>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({
  k,
  v,
  mono,
  accent,
}: {
  k: string;
  v: string;
  mono?: boolean;
  accent?: "green" | "amber";
}) {
  const accentClass =
    accent === "green"
      ? "border-emerald-800 bg-emerald-950/30 text-emerald-100"
      : accent === "amber"
        ? "border-amber-800 bg-amber-950/30 text-amber-100"
        : "border-zinc-800 bg-zinc-900/40";
  return (
    <div className={`rounded border p-3 ${accentClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{k}</div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono text-xs break-all" : ""}`}>{v}</div>
    </div>
  );
}
