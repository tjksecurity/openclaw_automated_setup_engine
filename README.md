# openclaw-setup-engine

Local web-based setup wizard for **[OpenClaw](https://github.com/openclaw/openclaw)** —
the self-hosted personal AI assistant.

Runs on your machine (nothing gets uploaded anywhere). Five plain-English
steps take you from empty to configured + running: pick a model, wire up
your messaging channels, enable or create agents, review the exact config
patch, deploy. Every option has a tooltip. Every failure surfaces the real
CLI stderr.

```bash
npx openclaw-setup-engine
```

That's it. Node ≥ 18.17 is the only requirement — the wizard installs
OpenClaw itself if it isn't already on your PATH.

## What it actually does

- **Live model catalog** — pulls the current model list from
  `openclaw capability model list --json` (98 models across 17 providers as
  of OpenClaw 2026.6). No stale hardcoded lists.
- **10 messaging channels** — Discord, Telegram, Signal, WhatsApp, Slack,
  iMessage, MS Teams, Matrix, Google Chat, and a web-chat widget. Each with
  the real per-channel config fields (bot token, phone number, service
  account JSON, DM policy, etc.).
- **Real config writes** — every "Deploy" call goes through
  `openclaw config patch --stdin`, which validates against OpenClaw's own
  JSON schema before touching the file. If your patch is malformed, the CLI
  refuses it and the wizard tells you why. Nothing hand-rolled.
- **Real agents** — enabled templates + custom agents become entries in
  `agents.list[]`, provisioned by OpenClaw with a real workspace dir.
- **Live dashboard** — shows what OpenClaw actually reports via
  `openclaw agents list`, `openclaw channels list`, `openclaw health`.
- **Doctor built in** — one-click `openclaw doctor` (with `--fix` for
  auto-repair).

## Under the hood

The whole thing is a small Next.js 14 app in a Node standalone bundle. The
`bin/openclaw-setup-engine.js` script picks a free port on 127.0.0.1, starts
the server, and opens your default browser.

```
app/
  page.tsx           landing
  setup/page.tsx     wizard (5 steps)
  dashboard/page.tsx live state from openclaw CLI
  api/setup/
    catalog/         merges live model list + hardcoded channel field specs
    validate/        pre-flight check + JSON patch preview
    deploy/          streams NDJSON: install → patch → validate → start
    status/          openclaw agents/channels/health snapshot
    doctor/          openclaw doctor [--fix]
src/openclaw/
  cli.ts             execa wrappers around openclaw commands
  catalog.ts         channel field specs + agent templates + fallback models
  configTransform.ts wizard state → `openclaw config patch` JSON
components/setup/    one component per wizard step
```

## Not for cloud hosting

This tool needs shell access to your machine — it installs OpenClaw via
`npm install -g`, writes to `~/.openclaw/openclaw.json`, and spawns the
OpenClaw daemon. **It won't work on Vercel / Netlify / any serverless host**
because those can't reach your local filesystem or run background daemons.
Run it locally with `npx openclaw-setup-engine`.

## Develop

```bash
git clone https://github.com/tjksecurity/openclaw_automated_setup_engine.git
cd openclaw_automated_setup_engine
npm install
npm run dev     # http://localhost:3000/setup
```

## License

MIT.
