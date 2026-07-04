# OpenClaw automated setup engine

A web-based setup wizard for OpenClaw. Anyone can walk through five
plain-English steps and end up with a fully configured, deployed OpenClaw
instance — no shell, no guesswork, no "did I spell the env var right?"
moments.

Every option carries a hover/tap tooltip. Every blocking error offers a
one-click auto-fix. Every deploy step is non-destructive and retryable.

![five-step wizard](docs/wizard.png)

---

## The five steps

1. **Pick your model** — Claude Opus/Sonnet/Haiku, OpenAI GPT-4o(/mini), or
   local Ollama. Paste the API key once; it's stored in `.env` and redacted
   on the way back out (the wizard never re-shows a saved key).
2. **Turn on your data sources** — one toggle per integration (web search,
   browser automation, vector store, code sandbox, file storage, email,
   Slack, GitHub, Notion, observability). Keyless integrations work out of
   the box; keyed ones prompt for a key you can paste in the same form.
3. **Pick or create agents** — enable the built-in agents (Research
   Assistant, Code Reviewer, Meeting Note-taker, Document Q&A, Web Scraper,
   Data Analyst, Customer Support, Compliance Scrubber) or **create a fully
   custom agent from a plain-English prompt**, one button press.
4. **Review** — compact summary plus validator findings. Every finding
   marked "error" comes with an **Apply fix** button. Warnings are shown but
   don't block deploy.
5. **Deploy** — writes your `.env`, updates the agent registry
   (`config/agents.json`), sanity-checks your model key, and hot-reloads the
   backend. Any step that fails surfaces a plain-English hint and an
   auto-fix retry button; failures are non-destructive.

---

## Quick start

### Docker Compose (backend + frontend)

```bash
docker compose up --build
```

- Wizard:  http://localhost:3000/setup
- API:     http://localhost:8000 (docs at `/docs`)

### Local dev

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend
npm install
API_URL=http://localhost:8000 npm run dev
```

Then open http://localhost:3000/setup.

---

## Architecture

```
frontend/  → Next.js 14 wizard (App Router, Tailwind)
             app/setup/            — the five-step page
             app/api/setup/*       — proxies to the FastAPI backend
             components/setup/     — one component per step
             components/Tooltip    — accessible hover/tap balloon

backend/   → FastAPI service
             app/routers/setup.py  — REST endpoints
             app/setup/catalog.py  — the ONE file to edit if you want to add
                                     a model, integration, or agent template
             app/setup/config_store.py
             app/setup/validator.py
             app/setup/runner.py   — deploy pipeline (background thread)

config/    → user-specific state (git-ignored)
             openclaw.json         — everything you clicked through the wizard
             agents.json           — the materialized agent registry the
                                     runtime reads to know what to run
```

**The catalog is the single source of truth.** Add a new integration by
appending one dict to `backend/app/setup/catalog.py` — the wizard picks it
up automatically. No frontend code to edit. No schema migration to write.

---

## REST API

| Method | Path | Purpose |
|--------|------|--------|
| GET  | `/setup/catalog` | Models, integrations, agent templates, deploy targets |
| GET  | `/setup/config` | Saved config (secrets redacted) |
| PUT  | `/setup/config` | Merge a config patch |
| POST | `/setup/validate` | Findings with severity + auto-fix payloads |
| POST | `/setup/agents` | Create a custom agent |
| PUT  | `/setup/agents/{id}` | Edit a custom agent |
| DEL  | `/setup/agents/{id}` | Remove a custom agent |
| POST | `/setup/deploy` | Kick off a deploy; returns run stub |
| GET  | `/setup/deploy/{run_id}` | Poll a running deploy |
| GET  | `/setup/deploys` | Recent runs |
| GET  | `/setup/effective/agents` | What agents the runtime is actually running |

---

## Tests

```bash
cd backend
pytest -q
```

Pins the contract: catalog integrity (unique ids, tooltip help text on every
option), validator behavior (every default error auto-fixable), config store
atomicity, redacted-secret round-trip safety, runner happy path, and bad-key
detection.

---

## Persistent state

Everything the wizard saves lives in `config/openclaw.json`. The deploy
step writes:

- `.env` at the repo root — model keys and integration env vars
- `config/agents.json` — the enabled agents with their prompts and models

Both files are git-ignored. Delete `config/openclaw.json` to reset the
wizard; delete `.env` to un-configure OpenClaw itself.

---

## License

MIT. See [LICENSE](LICENSE).
