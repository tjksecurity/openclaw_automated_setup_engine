"""Catalog of models, integrations, and agent templates the setup wizard offers.

Everything here is metadata: human-friendly labels, one-sentence tooltips, and
the machine-level keys they map to. The wizard renders straight from this
file, so adding a new integration or agent template is a single dict append.

Design rule: labels are for humans (no snake_case, no acronyms without a
tooltip), and every option has a `help` string short enough to fit in a
tooltip balloon.

Swap this catalog for your own if you want OpenClaw to configure a different
set of tools — the wizard, validator, and runner all read from it.
"""

from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
# Each entry describes an LLM the user can pick as the brain of their agents.
# `env_var` is the environment variable used to authenticate. `keyless` means
# the model can run without an API key (e.g. Ollama on localhost).

MODELS: list[dict[str, Any]] = [
    {
        "id": "claude-opus-4-8",
        "label": "Claude Opus 4.8",
        "provider": "Anthropic",
        "env_var": "ANTHROPIC_API_KEY",
        "help": "Anthropic's flagship model. Best for deep reasoning, long context, and careful analysis. Slowest and most expensive of the Claude family.",
        "tier": "flagship",
        "recommended": True,
    },
    {
        "id": "claude-sonnet-5",
        "label": "Claude Sonnet 5",
        "provider": "Anthropic",
        "env_var": "ANTHROPIC_API_KEY",
        "help": "Balanced Claude model — near-flagship quality at a fraction of the cost. Good default for most agents.",
        "tier": "balanced",
        "recommended": True,
    },
    {
        "id": "claude-haiku-4-5",
        "label": "Claude Haiku 4.5",
        "provider": "Anthropic",
        "env_var": "ANTHROPIC_API_KEY",
        "help": "Fast, cheap Claude model. Use for high-volume classification, tagging, or short summarization steps.",
        "tier": "fast",
    },
    {
        "id": "gpt-4o",
        "label": "OpenAI GPT-4o",
        "provider": "OpenAI",
        "env_var": "OPENAI_API_KEY",
        "help": "OpenAI's multimodal flagship. Good general reasoning and JSON tool use.",
        "tier": "flagship",
    },
    {
        "id": "gpt-4o-mini",
        "label": "OpenAI GPT-4o mini",
        "provider": "OpenAI",
        "env_var": "OPENAI_API_KEY",
        "help": "OpenAI's small model. Very cheap; use for bulk enrichment or first-pass filtering.",
        "tier": "fast",
    },
    {
        "id": "ollama-llama3",
        "label": "Local Llama 3 (Ollama)",
        "provider": "Ollama",
        "env_var": None,
        "keyless": True,
        "help": "Runs on your own machine via Ollama. No API key needed, no data leaves your box. Slower than cloud models.",
        "tier": "local",
        "requires": ["ollama_installed"],
    },
    {
        "id": "ollama-mistral",
        "label": "Local Mistral (Ollama)",
        "provider": "Ollama",
        "env_var": None,
        "keyless": True,
        "help": "Local Mistral via Ollama. Good local default if Llama 3 is too heavy for your machine.",
        "tier": "local",
        "requires": ["ollama_installed"],
    },
]


# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------
# Each integration is a capability an agent can use. Toggle it on, paste the
# API key (if any), and it becomes available. Every integration ships with an
# offline stub mode so agents keep working while you get keys sorted.

INTEGRATIONS: list[dict[str, Any]] = [
    {
        "id": "web_search",
        "label": "Web search",
        "help": "Lets your agents search the live web. Free tier at Tavily / Brave works fine for personal use.",
        "env_vars": [
            {"name": "TAVILY_API_KEY", "label": "Tavily key", "help": "Get one free at tavily.com. Best default web-search provider.", "secret": True, "required": False},
            {"name": "BRAVE_SEARCH_API_KEY", "label": "Brave Search key (optional)", "help": "Alternative to Tavily. Get one at brave.com/search/api.", "secret": True, "required": False},
        ],
        "default": True,
    },
    {
        "id": "browser",
        "label": "Browser automation",
        "help": "Headless Chrome via Playwright — click, scroll, fill forms, take screenshots. Runs locally, no key.",
        "env_vars": [
            {"name": "OPENCLAW_BROWSER_HEADLESS", "label": "Run headless", "help": "true = no visible window (safer on servers). false = launch a real window (useful for debugging).", "required": False, "default": "true"},
        ],
    },
    {
        "id": "vector_store",
        "label": "Vector store (memory / RAG)",
        "help": "Long-term memory + retrieval. Chroma runs locally with no setup; Pinecone / Weaviate are cloud alternatives.",
        "env_vars": [
            {"name": "OPENCLAW_VECTOR_BACKEND", "label": "Backend", "help": "chroma (default, local), pinecone, or weaviate.", "required": False, "default": "chroma"},
            {"name": "PINECONE_API_KEY", "label": "Pinecone key (optional)", "help": "Only needed if you set the backend to pinecone.", "secret": True, "required": False},
            {"name": "WEAVIATE_URL", "label": "Weaviate URL (optional)", "help": "Only needed if you set the backend to weaviate.", "required": False},
        ],
        "default": True,
    },
    {
        "id": "code_exec",
        "label": "Code execution sandbox",
        "help": "Lets your agents run Python/JS in an isolated sandbox — safe for arbitrary code, network policy enforced.",
        "env_vars": [
            {"name": "E2B_API_KEY", "label": "E2B key (optional)", "help": "Get one at e2b.dev for a cloud sandbox. Without it, OpenClaw runs a local Docker sandbox.", "secret": True, "required": False},
        ],
    },
    {
        "id": "file_storage",
        "label": "File storage",
        "help": "Where OpenClaw stashes uploads, agent outputs, and cached data. Local disk by default; S3 for shared/cloud setups.",
        "env_vars": [
            {"name": "OPENCLAW_STORAGE_BACKEND", "label": "Backend", "help": "local (default) or s3.", "required": False, "default": "local"},
            {"name": "AWS_ACCESS_KEY_ID", "label": "AWS key (S3 only)", "help": "Only needed for the s3 backend.", "secret": True, "required": False},
            {"name": "AWS_SECRET_ACCESS_KEY", "label": "AWS secret (S3 only)", "help": "Only needed for the s3 backend.", "secret": True, "required": False},
            {"name": "OPENCLAW_S3_BUCKET", "label": "S3 bucket (S3 only)", "help": "Bucket name to write into. Only needed for the s3 backend.", "required": False},
        ],
        "default": True,
    },
    {
        "id": "email",
        "label": "Email (send + read)",
        "help": "Send email from agents and read replies. SMTP for send; IMAP or Gmail API for read.",
        "env_vars": [
            {"name": "SMTP_HOST", "label": "SMTP host", "help": "e.g. smtp.gmail.com. Leave blank to disable send.", "required": False},
            {"name": "SMTP_USER", "label": "SMTP user", "help": "Usually your email address.", "required": False},
            {"name": "SMTP_PASSWORD", "label": "SMTP password / app password", "help": "For Gmail, generate an app password — don't paste your account password.", "secret": True, "required": False},
        ],
    },
    {
        "id": "slack",
        "label": "Slack",
        "help": "Post agent output into a Slack channel or DM. Create a bot at api.slack.com/apps and paste the bot token.",
        "env_vars": [
            {"name": "SLACK_BOT_TOKEN", "label": "Slack bot token", "help": "Starts with xoxb-. Give the bot chat:write scope.", "secret": True, "required": False},
            {"name": "SLACK_DEFAULT_CHANNEL", "label": "Default channel", "help": "e.g. #ops. Agents fall back here if they don't name a channel.", "required": False},
        ],
    },
    {
        "id": "github",
        "label": "GitHub",
        "help": "Lets agents read/write issues, PRs, and code. Use a fine-scoped personal access token or a GitHub App token.",
        "env_vars": [
            {"name": "GITHUB_TOKEN", "label": "GitHub token", "help": "Create one at github.com/settings/tokens with the repo scopes you need.", "secret": True, "required": False},
        ],
    },
    {
        "id": "notion",
        "label": "Notion",
        "help": "Read and write Notion pages / databases. Create an integration at notion.so/my-integrations.",
        "env_vars": [
            {"name": "NOTION_TOKEN", "label": "Notion integration token", "help": "Starts with secret_. Share the pages you want the agent to see with the integration.", "secret": True, "required": False},
        ],
    },
    {
        "id": "observability",
        "label": "Observability (traces)",
        "help": "Record every agent step for later inspection. Langfuse works out of the box; leave blank to keep traces local only.",
        "env_vars": [
            {"name": "LANGFUSE_PUBLIC_KEY", "label": "Langfuse public key", "help": "Get one at langfuse.com. Both keys are needed together.", "secret": True, "required": False},
            {"name": "LANGFUSE_SECRET_KEY", "label": "Langfuse secret key", "help": "The paired secret key.", "secret": True, "required": False},
        ],
        "default": True,
    },
]


# ---------------------------------------------------------------------------
# Agent templates
# ---------------------------------------------------------------------------
# Ready-made agents users can enable in one click. Users can also create fully
# custom agents by writing a prompt — those get stored in the config's
# `agents.custom` list.

AGENT_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "research_assistant",
        "label": "Research Assistant",
        "help": "Takes a question, searches the web, reads the top sources, and returns a cited answer.",
        "default_model": "claude-sonnet-5",
        "prompt": (
            "You are a Research Assistant. Given a question, use web search to "
            "find the 5 most relevant sources, read them in full, and produce a "
            "concise, cited answer. Every claim must reference a source. If "
            "the sources disagree, say so and give both sides."
        ),
        "default": True,
    },
    {
        "id": "code_reviewer",
        "label": "Code Reviewer",
        "help": "Reviews a diff for correctness, security, and simplification opportunities. Ranks findings by severity.",
        "default_model": "claude-opus-4-8",
        "prompt": (
            "You are a Code Reviewer. Given a diff, produce a ranked list of "
            "findings covering correctness bugs, security issues, and cleanups. "
            "Each finding must include: file+line, severity (error/warning/nit), "
            "the problem in one sentence, and the concrete fix."
        ),
        "default": True,
    },
    {
        "id": "meeting_notetaker",
        "label": "Meeting Note-taker",
        "help": "Turns a transcript into decisions, action items, and open questions — no fluff.",
        "default_model": "claude-haiku-4-5",
        "prompt": (
            "You are the Meeting Note-taker. Given a transcript, produce three "
            "sections: (1) Decisions made, (2) Action items with owners and "
            "due dates, (3) Open questions. Skip pleasantries and side chatter."
        ),
    },
    {
        "id": "doc_qa",
        "label": "Document Q&A",
        "help": "Answers questions using your ingested documents (via the vector store). Cites the source chunk for every answer.",
        "default_model": "claude-sonnet-5",
        "prompt": (
            "You are Document Q&A. Given a question, retrieve the top 8 most "
            "relevant chunks from the vector store and answer using only those "
            "chunks. Cite chunk IDs inline. If the answer isn't in the corpus, "
            "say 'not in the documents' — do not guess."
        ),
        "default": True,
    },
    {
        "id": "web_scraper",
        "label": "Web Scraper",
        "help": "Given a target site and a schema, extracts structured data. Uses the browser integration for JS-heavy pages.",
        "default_model": "claude-sonnet-5",
        "prompt": (
            "You are the Web Scraper. Given a URL and a target JSON schema, "
            "navigate the site (using the browser integration for JS-rendered "
            "pages), extract the data, and validate it against the schema. "
            "If a required field is missing, mark it null and note where you "
            "looked. Never invent values."
        ),
    },
    {
        "id": "data_analyst",
        "label": "Data Analyst",
        "help": "Reads a CSV/dataset and answers questions with executed code — safer than eye-balling a spreadsheet.",
        "default_model": "claude-opus-4-8",
        "prompt": (
            "You are the Data Analyst. Given a dataset and a question, write "
            "and execute Python (via the code sandbox) to answer it. Return "
            "both the code and the result. Include a plot only if it makes the "
            "answer clearer."
        ),
    },
    {
        "id": "customer_support",
        "label": "Customer Support",
        "help": "Answers customer questions using your product docs. Escalates when it's not confident.",
        "default_model": "claude-haiku-4-5",
        "prompt": (
            "You are Customer Support. Answer using only the product docs in "
            "the vector store. If the docs don't cover the question, say 'I'll "
            "escalate this to a human' — do not improvise. Be friendly but "
            "concise."
        ),
    },
    {
        "id": "compliance_scrubber",
        "label": "Compliance Scrubber",
        "help": "Second-pass agent that reviews outputs before they leave the system. Rejects anything that leaks PII or violates policy.",
        "default_model": "claude-haiku-4-5",
        "prompt": (
            "You are the Compliance Scrubber. Review agent output against the "
            "provided policy (PII, confidentiality, tone, brand voice). Return "
            "APPROVED or REJECTED with reasons. When rejecting, name the "
            "specific rule broken."
        ),
        "default": True,
    },
]


# ---------------------------------------------------------------------------
# Deploy targets — where 'deploy' actually writes to.
# ---------------------------------------------------------------------------

DEPLOY_TARGETS: list[dict[str, Any]] = [
    {
        "id": "local_env",
        "label": "This machine (.env file)",
        "help": "Writes .env in the project root and hot-reloads the backend. Simplest option — no Docker involved.",
        "default": True,
    },
    {
        "id": "docker_compose",
        "label": "Local Docker Compose",
        "help": "Writes .env and expects you to run `docker compose up -d --build`. Good if you're already running the full stack in Docker.",
    },
]


CATALOG: dict[str, Any] = {
    "models": MODELS,
    "integrations": INTEGRATIONS,
    "agent_templates": AGENT_TEMPLATES,
    "deploy_targets": DEPLOY_TARGETS,
}
