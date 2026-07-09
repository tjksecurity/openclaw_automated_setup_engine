/**
 * Static metadata the wizard needs — mostly tooltip text and per-channel
 * field specs — that OpenClaw's CLI doesn't expose.
 *
 * The live model list is pulled at runtime from
 * `openclaw capability model list --json` (98 models across 17 providers as
 * of 2026.6). We only keep a tiny hardcoded fallback for the case where
 * OpenClaw isn't installed yet — the wizard needs SOMETHING to render.
 *
 * The channel field specs ARE hardcoded, because CLI doesn't tell us which
 * fields (bot token, phone number, service account JSON, ...) each channel
 * needs. Those come from OpenClaw's public docs at docs.openclaw.ai/channels.
 */

export type Tier = "flagship" | "balanced" | "fast" | "local";

export interface ModelFallback {
  id: string;               // "claude-sonnet-4-6" — matches the CLI's model.id
  label: string;
  provider: string;
  envVar: string | null;
  tier: Tier;
  recommended?: boolean;
  help: string;
}

// Minimal fallback if OpenClaw isn't installed yet. The live list from the
// CLI takes precedence. Keep this short and safe.
export const FALLBACK_MODELS: ModelFallback[] = [
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    tier: "balanced",
    recommended: true,
    help: "Balanced Claude model. Good default for OpenClaw. Install OpenClaw to see the full model list.",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    tier: "flagship",
    help: "Anthropic's flagship. Slower and pricier but strongest reasoning.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    tier: "fast",
    help: "Fast, cheap Claude. Good fallback model.",
  },
];

// Human-friendly labels and provider→env-var mapping, applied on top of the
// live CLI catalog. Every listed provider gets treated as "known" in the UI;
// providers not in this map still show up but with their raw slug.
export const PROVIDER_META: Record<string, { label: string; envVar: string | null; recommended?: boolean }> = {
  anthropic: { label: "Anthropic", envVar: "ANTHROPIC_API_KEY", recommended: true },
  openai: { label: "OpenAI", envVar: "OPENAI_API_KEY" },
  "claude-cli": { label: "Claude Code CLI (local)", envVar: null },
  cohere: { label: "Cohere", envVar: "COHERE_API_KEY" },
  mistral: { label: "Mistral", envVar: "MISTRAL_API_KEY" },
  "github-copilot": { label: "GitHub Copilot", envVar: "GITHUB_TOKEN" },
  together: { label: "Together AI", envVar: "TOGETHER_API_KEY" },
  novita: { label: "Novita AI", envVar: "NOVITA_API_KEY" },
  nvidia: { label: "NVIDIA NIM", envVar: "NVIDIA_API_KEY" },
  byteplus: { label: "BytePlus", envVar: "BYTEPLUS_API_KEY" },
  volcengine: { label: "Volcengine", envVar: "VOLCENGINE_API_KEY" },
  "ollama-cloud": { label: "Ollama Cloud", envVar: "OLLAMA_API_KEY" },
  "ollama": { label: "Ollama (local)", envVar: null },
  xiaomi: { label: "Xiaomi MI-LLM", envVar: "XIAOMI_API_KEY" },
};

// ---------------------------------------------------------------------------
// Channels — hand-curated because the CLI doesn't expose which fields each
// channel needs. IDs match `openclaw channels list --all` output exactly.
// ---------------------------------------------------------------------------

export interface FieldSpec {
  name: string;
  label: string;
  help: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
}

export interface ChannelSpec {
  id: string;                // must match OpenClaw's channel slug exactly
  label: string;
  help: string;
  fields: FieldSpec[];
  supportsGroups?: boolean;
  recommended?: boolean;
}

export const CHANNELS: ChannelSpec[] = [
  {
    id: "discord",
    label: "Discord",
    help: "OpenClaw joins as a bot. Create it at discord.com/developers/applications; copy the token from the Bot page; invite it to your server.",
    fields: [
      { name: "botToken", label: "Bot token", secret: true, required: true, help: "From your Discord app's Bot page (~60 chars, no prefix).", placeholder: "MTM4Njg..." },
      { name: "allowFrom", label: "Allowed Discord user IDs (comma-separated)", help: "Only these users can DM the bot. Leave blank for pairing mode.", placeholder: "123456789012345678" },
    ],
    supportsGroups: true,
    recommended: true,
  },
  {
    id: "telegram",
    label: "Telegram",
    help: "Message @BotFather in Telegram, create a bot, copy the token it gives you.",
    fields: [
      { name: "botToken", label: "Bot token", secret: true, required: true, help: "From @BotFather. Format: 123456789:AAE... (~46 chars).", placeholder: "123456789:AAE..." },
      { name: "allowFrom", label: "Allowed Telegram usernames or IDs", help: "Comma-separated. Blank = pairing mode.", placeholder: "@yourhandle" },
    ],
    supportsGroups: true,
    recommended: true,
  },
  {
    id: "signal",
    label: "Signal",
    help: "Uses your Signal number via signal-cli. First run prints a linking QR code — scan it from your primary Signal app.",
    fields: [
      { name: "number", label: "Phone number (E.164)", required: true, help: "Your Signal-registered number in international format.", placeholder: "+14155550123" },
      { name: "allowFrom", label: "Allowed contacts (E.164, comma-separated)", help: "Numbers allowed to DM. Blank = pairing mode.", placeholder: "+15555550111" },
    ],
    supportsGroups: true,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    help: "Uses WhatsApp Business Cloud API. Set up a Meta developer app + a phone-number ID.",
    fields: [
      { name: "botToken", label: "System-user access token", secret: true, required: true, help: "From your Meta app's WhatsApp settings." },
      { name: "phoneNumberId", label: "Phone number ID", required: true, help: "The 15-digit ID Meta assigns to your business number.", placeholder: "1023456789012345" },
      { name: "verifyToken", label: "Webhook verify token", secret: true, help: "A string you choose. Meta uses it to verify your webhook." },
    ],
  },
  {
    id: "slack",
    label: "Slack",
    help: "Install as a Slack app. Give the bot chat:write + im:read scopes.",
    fields: [
      { name: "botToken", label: "Bot user OAuth token", secret: true, required: true, help: "Starts with xoxb-. From OAuth & Permissions.", placeholder: "xoxb-..." },
      { name: "appToken", label: "App-level token (Socket Mode)", secret: true, help: "Starts with xapp-. Only needed for Socket Mode.", placeholder: "xapp-..." },
    ],
    supportsGroups: true,
  },
  {
    id: "imessage",
    label: "iMessage",
    help: "macOS only. Uses the local Messages database. No network setup, but only runs on the Mac you install on.",
    fields: [
      { name: "allowFrom", label: "Allowed contacts", help: "iMessage handles (phone or email) allowed to DM." },
    ],
  },
  {
    id: "msteams",
    label: "Microsoft Teams",
    help: "Register an Azure Bot + Teams channel. Needs a Bot Framework app ID and client secret.",
    fields: [
      { name: "appId", label: "Bot app ID (GUID)", required: true, help: "From Azure Portal → Bot Registration." },
      { name: "appPassword", label: "Bot app password", secret: true, required: true, help: "The client secret you generated in Azure." },
    ],
    supportsGroups: true,
  },
  {
    id: "matrix",
    label: "Matrix",
    help: "Federate with any Matrix homeserver (matrix.org, your own Synapse, etc.).",
    fields: [
      { name: "homeserver", label: "Homeserver URL", required: true, help: "e.g. https://matrix.org.", placeholder: "https://matrix.org" },
      { name: "userId", label: "Bot user ID", required: true, help: "@openclaw:matrix.org format." },
      { name: "accessToken", label: "Access token", secret: true, required: true, help: "Long-lived token from an interactive login." },
    ],
    supportsGroups: true,
  },
  {
    id: "googlechat",
    label: "Google Chat",
    help: "Google Workspace app + service account. You'll paste the service-account JSON.",
    fields: [
      { name: "serviceAccountJson", label: "Service account JSON", secret: true, required: true, help: "Paste the entire JSON key file contents." },
    ],
    supportsGroups: true,
  },
  {
    id: "webchat",
    label: "Web chat widget",
    help: "Embed a chat widget on any site via a short JS snippet. No third-party service.",
    fields: [
      { name: "publicOrigin", label: "Allowed origin(s)", help: "Comma-separated origins that may embed the widget.", placeholder: "https://example.com" },
    ],
    recommended: true,
  },
];

// ---------------------------------------------------------------------------
// Agent templates
// ---------------------------------------------------------------------------

export interface AgentTemplate {
  id: string;
  label: string;
  help: string;
  skills: string[];
  mentionPatterns?: string[];
  prompt: string;
  default?: boolean;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "personal",
    label: "Personal assistant",
    help: "General-purpose. Reads/writes files, runs shell, browses. The default OpenClaw experience.",
    skills: ["files", "shell", "web"],
    mentionPatterns: ["@openclaw", "openclaw"],
    prompt:
      "You are the user's personal assistant. Be terse and useful. Prefer running the tool over describing it.",
    default: true,
  },
  {
    id: "research",
    label: "Research assistant",
    help: "Answers questions with cited web sources. Doesn't touch local files unless asked.",
    skills: ["web"],
    prompt:
      "You are a research assistant. Answer questions using web search, and cite every claim with a URL.",
  },
  {
    id: "coder",
    label: "Coding assistant",
    help: "Reads the repo, runs tests, opens PRs. Wire it up with your GitHub token.",
    skills: ["files", "shell", "github"],
    prompt:
      "You are a coding assistant. Read the repo first, then make small, verified changes. Run tests after any change.",
  },
  {
    id: "triage",
    label: "Message triage",
    help: "Reads incoming DMs and either handles them or escalates to you. Good first-line filter.",
    skills: ["files"],
    prompt:
      "You triage incoming messages. Answer trivial requests directly. For anything else, summarize and page the user.",
  },
];

// ---------------------------------------------------------------------------

export interface DeployTarget {
  id: string;
  label: string;
  help: string;
  default?: boolean;
}

export const DEPLOY_TARGETS: DeployTarget[] = [
  {
    id: "install_and_start",
    label: "Install OpenClaw + start the daemon",
    help: "Runs `npm install -g openclaw@latest` if needed, writes ~/.openclaw/openclaw.json via `openclaw config patch`, then `openclaw onboard --install-daemon`.",
    default: true,
  },
  {
    id: "write_config_only",
    label: "Write config only",
    help: "Just writes ~/.openclaw/openclaw.json. Doesn't install or start — you run OpenClaw yourself.",
  },
];
