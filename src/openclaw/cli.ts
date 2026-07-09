/**
 * Thin wrappers around the real `openclaw` CLI.
 *
 * Every function here shells out to the user's globally-installed OpenClaw
 * (`npm install -g openclaw@latest`). We stay non-interactive by:
 *   - using `config get / set / patch / validate` subcommands
 *   - piping JSON via stdin for atomic patches
 *   - passing --yes / --json where the CLI supports them
 *
 * The wizard never edits ~/.openclaw/openclaw.json by hand — every write
 * goes through `openclaw config patch --stdin`, which validates against the
 * live JSON schema and refuses to write invalid state.
 */

import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { platform, homedir } from "node:os";
import { resolve as resolvePath } from "node:path";

const pexecFile = promisify(execFile);

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class OpenClawNotInstalledError extends Error {
  constructor() {
    super(
      "OpenClaw CLI not found on PATH. Install with `npm install -g openclaw@latest`.",
    );
    this.name = "OpenClawNotInstalledError";
  }
}

const OPENCLAW_BIN = process.env.OPENCLAW_BIN || "openclaw";

async function which(bin: string): Promise<string | null> {
  const cmd = platform() === "win32" ? "where" : "which";
  try {
    const { stdout } = await pexecFile(cmd, [bin]);
    return stdout.trim().split("\n")[0] || null;
  } catch {
    return null;
  }
}

export async function isInstalled(): Promise<boolean> {
  if (OPENCLAW_BIN.includes("/") && existsSync(OPENCLAW_BIN)) return true;
  return (await which(OPENCLAW_BIN)) !== null;
}

/**
 * Run any openclaw command with a short timeout. Throws on non-zero exit
 * unless `allowFail` is true.
 */
export async function run(
  args: string[],
  opts: { input?: string; timeoutMs?: number; allowFail?: boolean } = {},
): Promise<RunResult> {
  if (!(await isInstalled())) throw new OpenClawNotInstalledError();
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs ?? 30_000);
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const result: RunResult = { stdout, stderr, code: code ?? -1 };
      if (code !== 0 && !opts.allowFail) {
        const err: Error & { result?: RunResult } = new Error(
          `openclaw ${args.join(" ")} exited ${code}: ${stderr.trim() || stdout.trim()}`,
        );
        err.result = result;
        reject(err);
      } else {
        resolve(result);
      }
    });
    if (opts.input) child.stdin.write(opts.input);
    child.stdin.end();
  });
}

/** Stream a long-running command's stdout/stderr line-by-line. */
export function stream(
  args: string[],
  onLine: (line: string, source: "stdout" | "stderr") => void,
  opts: { input?: string; timeoutMs?: number } = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs ?? 120_000);
    let buf: Record<"stdout" | "stderr", string> = { stdout: "", stderr: "" };
    for (const src of ["stdout", "stderr"] as const) {
      child[src].on("data", (b: Buffer) => {
        buf[src] += b.toString();
        const lines = buf[src].split("\n");
        buf[src] = lines.pop() ?? "";
        lines.forEach((l) => onLine(l, src));
      });
    }
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      for (const src of ["stdout", "stderr"] as const) if (buf[src]) onLine(buf[src], src);
      resolve(code ?? -1);
    });
    if (opts.input) child.stdin.write(opts.input);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export async function configFilePath(): Promise<string> {
  const { stdout } = await run(["config", "file"]);
  return stdout.trim();
}

export async function configSchema(): Promise<any> {
  const { stdout } = await run(["config", "schema"]);
  return JSON.parse(stdout);
}

export async function configGet(dotPath?: string): Promise<any> {
  if (dotPath) {
    const { stdout } = await run(["config", "get", dotPath, "--json"], { allowFail: true });
    if (!stdout.trim()) return null;
    try {
      return JSON.parse(stdout);
    } catch {
      return stdout.trim();
    }
  }
  // No path — read the full config file directly. `openclaw config get`
  // requires a specific dot path, and `openclaw config schema` returns the
  // schema, not the values. The file is small; parsing it is cheap.
  const raw = await configFilePath();
  const abs = raw.startsWith("~/")
    ? resolvePath(homedir(), raw.slice(2))
    : raw.startsWith("~")
      ? resolvePath(homedir(), raw.slice(1))
      : raw;
  try {
    return JSON.parse(readFileSync(abs, "utf-8"));
  } catch {
    return null;
  }
}

/** Apply a JSON5 merge-patch atomically. Rejects if the patch is invalid. */
export async function configPatch(patch: unknown): Promise<void> {
  await run(["config", "patch", "--stdin"], { input: JSON.stringify(patch) });
}

export async function configValidate(): Promise<{ ok: boolean; message: string }> {
  const r = await run(["config", "validate"], { allowFail: true });
  return {
    ok: r.code === 0,
    message: (r.stderr || r.stdout).trim(),
  };
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export interface ChannelListEntry {
  id: string;
  label?: string;
  installed?: boolean;
  configured?: boolean;
  status?: string;
}

export async function channelsList(all = false): Promise<ChannelListEntry[]> {
  const args = ["channels", "list", "--json"];
  if (all) args.push("--all");
  const { stdout } = await run(args, { allowFail: true });
  try {
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.channels) return parsed.channels;
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export interface AgentListEntry {
  id: string;
  workspace?: string;
  default?: boolean;
  skills?: string[];
}

export async function agentsList(): Promise<AgentListEntry[]> {
  const { stdout } = await run(["agents", "list", "--json"], { allowFail: true });
  try {
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.agents) return parsed.agents;
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Provider capabilities (model catalog)
// ---------------------------------------------------------------------------

export async function capabilityModels(): Promise<any[]> {
  const { stdout } = await run(["capability", "model", "list", "--json"], {
    allowFail: true,
  });
  try {
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.models) return parsed.models;
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Gateway / health
// ---------------------------------------------------------------------------

export async function health(): Promise<{ ok: boolean; detail: string }> {
  const r = await run(["health"], { allowFail: true, timeoutMs: 10_000 });
  return { ok: r.code === 0, detail: (r.stdout || r.stderr).trim() };
}

export async function doctor(fix = false): Promise<RunResult> {
  const args = ["doctor"];
  if (fix) args.push("--fix", "--yes");
  return run(args, { allowFail: true, timeoutMs: 60_000 });
}

export async function version(): Promise<string> {
  const r = await run(["--version"], { allowFail: true });
  return r.stdout.trim();
}
