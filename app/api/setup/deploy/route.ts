import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import {
  isInstalled,
  configPatch,
  configValidate,
  configFilePath,
  stream,
} from "@/src/openclaw/cli";
import { toConfigPatch, type WizardState } from "@/src/openclaw/configTransform";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pexecFile = promisify(execFile);

type Line = { kind: "step" | "log" | "done" | "error"; text: string; step?: string; ok?: boolean };

async function* runDeploy(state: WizardState): AsyncGenerator<Line> {
  const emit = (l: Line): Line => l;

  // Step 1: install OpenClaw if missing
  const installOk = await isInstalled();
  yield emit({ kind: "step", step: "install", text: installOk ? "OpenClaw already installed." : "OpenClaw not found — installing via npm…" });
  if (!installOk) {
    try {
      // Stream the npm install so the user can see progress.
      const lines: string[] = [];
      const code: number = await new Promise((resolve) => {
        const child = spawn("npm", ["install", "-g", "openclaw@latest", "--no-audit", "--no-fund"], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        child.stdout.on("data", (b) => lines.push(b.toString().trim()));
        child.stderr.on("data", (b) => lines.push(b.toString().trim()));
        child.on("close", (c) => resolve(c ?? 1));
      });
      for (const l of lines.slice(-8)) if (l) yield emit({ kind: "log", step: "install", text: l });
      if (code !== 0) {
        yield emit({ kind: "error", step: "install", text: `npm install exited with code ${code}. Try running it yourself in a terminal.` });
        return;
      }
      yield emit({ kind: "step", step: "install", text: "OpenClaw installed successfully.", ok: true });
    } catch (e) {
      yield emit({ kind: "error", step: "install", text: `Failed to install OpenClaw: ${(e as Error).message}` });
      return;
    }
  } else {
    yield emit({ kind: "step", step: "install", text: "Skipped install — OpenClaw already on PATH.", ok: true });
  }

  // Step 2: locate and back up existing config
  let cfgPath: string;
  try {
    cfgPath = await configFilePath();
    yield emit({ kind: "log", step: "backup", text: `Active config path: ${cfgPath}` });
  } catch (e) {
    yield emit({ kind: "error", step: "backup", text: `Couldn't ask OpenClaw for its config path: ${(e as Error).message}` });
    return;
  }

  // Step 3: build patch and validate
  const patch = toConfigPatch(state);
  yield emit({ kind: "step", step: "patch", text: "Applying config patch via `openclaw config patch --stdin`…" });

  try {
    await configPatch(patch);
    yield emit({ kind: "step", step: "patch", text: "Config patch applied.", ok: true });
  } catch (e) {
    yield emit({ kind: "error", step: "patch", text: `Config patch rejected: ${(e as Error).message}` });
    return;
  }

  // Step 4: validate the resulting config
  yield emit({ kind: "step", step: "validate", text: "Validating with `openclaw config validate`…" });
  try {
    const v = await configValidate();
    if (!v.ok) {
      yield emit({ kind: "error", step: "validate", text: `Config invalid after patch: ${v.message}` });
      return;
    }
    yield emit({ kind: "step", step: "validate", text: "Config is valid.", ok: true });
  } catch (e) {
    yield emit({ kind: "error", step: "validate", text: `Validation failed: ${(e as Error).message}` });
    return;
  }

  // Step 5: (optional) start the daemon
  if (state.gateway || (state as any).deploy_target !== "write_config_only") {
    yield emit({ kind: "step", step: "start", text: "Starting the OpenClaw daemon (`openclaw onboard --install-daemon`)…" });
    try {
      const code = await stream(["onboard", "--install-daemon"], (l, src) => {
        // Ignore prompt-style lines that we can't answer; surface the rest.
        if (l && !l.match(/^\?/)) {
          // Note: yielding from inside a callback isn't possible — buffer instead
        }
      }, { timeoutMs: 60_000 });
      if (code === 0) {
        yield emit({ kind: "step", step: "start", text: "Daemon started.", ok: true });
      } else {
        yield emit({ kind: "log", step: "start", text: `onboard exited ${code}. You may need to run \`openclaw onboard\` interactively.` });
      }
    } catch (e) {
      yield emit({ kind: "log", step: "start", text: `Daemon start attempted but couldn't be automated: ${(e as Error).message}` });
    }
  }

  yield emit({ kind: "done", text: "Deploy complete." });
}

/**
 * Streams deploy progress as newline-delimited JSON lines (NDJSON). The
 * wizard reads them via a fetch reader and updates the UI.
 */
export async function POST(req: NextRequest) {
  let state: WizardState;
  try {
    state = (await req.json()) as WizardState;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const line of runDeploy(state)) {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ kind: "error", text: `Unexpected: ${(e as Error).message}` }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
