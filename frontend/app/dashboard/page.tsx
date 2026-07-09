"use client";

// Post-deploy dashboard: renders the config the wizard produced. Reads the
// same /api/setup endpoints so it stays live-accurate. Not a full "app
// dashboard" — this is a status page confirming what's configured and
// pointing you back to /setup to change anything.

import Link from "next/link";
import { useEffect, useState } from "react";
import { setupApi, type Catalog, type Config } from "@/lib/setupClient";

interface EffectiveAgent {
  id: string;
  label: string;
  model: string;
  prompt: string;
  source: string;
}

export default function Dashboard() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [effective, setEffective] = useState<EffectiveAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cat, cfg, effRes] = await Promise.all([
          setupApi.catalog(),
          setupApi.getConfig(),
          fetch("/api/setup/effective/agents").then((r) => r.json()),
        ]);
        setCatalog(cat);
        setConfig(cfg);
        setEffective(effRes.agents ?? []);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const modelLabel = (id: string | undefined) =>
    catalog?.models.find((m) => m.id === id)?.label ?? id ?? "—";

  const integrationLabel = (id: string) =>
    catalog?.integrations.find((i) => i.id === id)?.label ?? id;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400">
              OpenClaw dashboard
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Live configuration</h1>
            <p className="mt-1 text-sm text-zinc-500">
              What your OpenClaw is running right now, straight from the backend.
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
            Couldn't reach the backend: {error}
          </div>
        )}

        {!catalog || !config ? (
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            Loading…
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card
                title="Primary model"
                value={modelLabel(config.model.primary)}
                sub={catalog.models.find((m) => m.id === config.model.primary)?.provider}
              />
              <Card
                title="Fallback model"
                value={config.model.fallback ? modelLabel(config.model.fallback) : "— none —"}
                sub="Kicks in when the primary errors"
              />
              <Card
                title="Deploy target"
                value={
                  catalog.deploy_targets.find((t) => t.id === config.deploy.target)?.label ??
                  config.deploy.target
                }
                sub="Where writes go on deploy"
              />
              <Card
                title="Last deploy"
                value={
                  config.last_deploy
                    ? `${config.last_deploy.status} · ${new Date(
                        config.last_deploy.finished_at ?? "",
                      ).toLocaleString()}`
                    : "never"
                }
                sub={config.last_deploy?.run_id ?? undefined}
              />
            </section>

            <section className="mb-6 rounded border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">Integrations</h2>
              {(() => {
                const enabled = Object.entries(config.integrations || {}).filter(
                  ([, v]) => v.enabled,
                );
                if (!enabled.length)
                  return <p className="text-xs text-zinc-500">None enabled yet.</p>;
                return (
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {enabled.map(([id]) => (
                      <li
                        key={id}
                        className="rounded border border-emerald-700/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100"
                      >
                        {integrationLabel(id)}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </section>

            <section className="mb-6 rounded border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">
                Active agents{" "}
                <span className="text-xs font-normal text-zinc-500">
                  (from the runtime registry — last deploy)
                </span>
              </h2>
              {!effective || !effective.length ? (
                <p className="text-xs text-zinc-500">
                  No agents active yet. Run the wizard's Deploy step to write the agent
                  registry.
                </p>
              ) : (
                <ul className="space-y-2">
                  {effective.map((a) => (
                    <li
                      key={a.id}
                      className="rounded border border-zinc-800 bg-zinc-950/40 p-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.label}</span>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                          {a.source}
                        </span>
                        <span className="ml-auto text-xs text-zinc-500">
                          {modelLabel(a.model)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{a.prompt}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-300">API keys saved</h2>
              {Object.keys(config.secrets || {}).length === 0 ? (
                <p className="text-xs text-zinc-500">None yet.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {Object.keys(config.secrets).map((k) => (
                    <li
                      key={k}
                      className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 font-mono text-xs"
                    >
                      <span className="text-zinc-400">{k}</span>
                      <span className="text-emerald-400">••••••••</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-0.5 text-sm">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>}
    </div>
  );
}
