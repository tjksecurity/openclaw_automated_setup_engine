import { NextResponse } from "next/server";
import {
  isInstalled,
  version,
  configFilePath,
  configGet,
  channelsList,
  agentsList,
  health,
} from "@/src/openclaw/cli";

export const dynamic = "force-dynamic";

/**
 * Snapshot of the live OpenClaw state. The dashboard polls this after
 * deploy to prove the config actually landed.
 */
export async function GET() {
  const installed = await isInstalled().catch(() => false);
  if (!installed) {
    return NextResponse.json({
      installed: false,
      message: "OpenClaw is not installed on this machine yet.",
    });
  }

  const [ver, cfgPath, current, channels, agents, healthCheck] = await Promise.all([
    version().catch(() => "unknown"),
    configFilePath().catch(() => null),
    configGet().catch(() => null),
    channelsList().catch(() => []),
    agentsList().catch(() => []),
    health().catch(() => ({ ok: false, detail: "unavailable" })),
  ]);

  return NextResponse.json({
    installed: true,
    version: ver,
    config_path: cfgPath,
    current_config: current,
    channels,
    agents,
    gateway: healthCheck,
  });
}
