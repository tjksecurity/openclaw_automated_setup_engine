import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Landing() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        <div className="text-xs uppercase tracking-widest text-emerald-400">
          OpenClaw setup engine
        </div>
        <h1 className="mt-2 text-4xl md:text-5xl font-semibold leading-tight">
          Configure your OpenClaw in five clicks.
        </h1>
        <p className="mt-4 text-zinc-400 text-lg leading-relaxed">
          Pick a model. Wire up your messaging channels. Enable the built-in
          agents or write your own. Deploy — the wizard installs OpenClaw,
          writes <code className="text-zinc-300">~/.openclaw/openclaw.json</code>,
          and starts the daemon. Every option has a tooltip; every failure shows
          the real CLI output.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/setup"
            className="rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-medium text-black hover:bg-emerald-400"
          >
            Open the wizard →
          </Link>
          <a
            href="https://github.com/tjksecurity/openclaw_automated_setup_engine"
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            View source
          </a>
        </div>

        <ul className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {[
            "Live model list pulled from openclaw capability model list",
            "10 messaging channels — Discord, Telegram, Signal, Slack, and more",
            "Custom agents via prompt, saved as real agents.list[] entries",
            "Deploy runs `npm install -g openclaw` + `openclaw config patch` for real",
          ].map((s) => (
            <li
              key={s}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-zinc-300"
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
