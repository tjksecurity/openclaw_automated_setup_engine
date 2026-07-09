import { NextResponse } from "next/server";
import {
  CHANNELS,
  AGENT_TEMPLATES,
  DEPLOY_TARGETS,
  FALLBACK_MODELS,
  PROVIDER_META,
  type ModelFallback,
  type Tier,
} from "@/src/openclaw/catalog";
import { capabilityModels, isInstalled } from "@/src/openclaw/cli";

export const dynamic = "force-dynamic";

interface CliModel {
  id: string;
  name?: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

function tierFromCliModel(m: CliModel): Tier {
  const id = m.id.toLowerCase();
  if (id.includes("opus") || id.includes("gpt-5") || id.includes("flagship")) return "flagship";
  if (id.includes("haiku") || id.includes("mini") || id.includes("flash")) return "fast";
  if (m.provider === "ollama") return "local";
  return "balanced";
}

function labelFor(m: CliModel): string {
  return m.name || m.id;
}

export async function GET() {
  let liveModels: ModelFallback[] = [];
  let openclawInstalled = false;

  try {
    openclawInstalled = await isInstalled();
    if (openclawInstalled) {
      const cli = (await capabilityModels()) as CliModel[];
      liveModels = cli.map((m) => {
        const provMeta = PROVIDER_META[m.provider];
        return {
          id: `${m.provider}/${m.id}`,
          label: labelFor(m),
          provider: m.provider,
          envVar: provMeta?.envVar ?? null,
          tier: tierFromCliModel(m),
          recommended:
            provMeta?.recommended && (m.id.includes("sonnet") || m.id.includes("opus")),
          help: `${provMeta?.label ?? m.provider} · ${
            m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}k context` : "cloud model"
          }${m.reasoning ? " · reasoning" : ""}`,
        };
      });
    }
  } catch {
    /* fall through to fallback */
  }

  const models = liveModels.length ? liveModels : FALLBACK_MODELS;

  return NextResponse.json({
    openclaw_installed: openclawInstalled,
    models,
    channels: CHANNELS,
    agent_templates: AGENT_TEMPLATES,
    deploy_targets: DEPLOY_TARGETS,
  });
}
