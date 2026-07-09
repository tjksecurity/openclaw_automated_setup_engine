#!/usr/bin/env node
/**
 * openclaw-setup-engine — local Node launcher.
 *
 * Starts the Next.js standalone server bundled in this package and opens
 * the user's default browser to the setup wizard. Everything runs on
 * localhost — no cloud, no telemetry, no third parties.
 *
 *   npx openclaw-setup-engine [--port 3178] [--no-open]
 */

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { platform } = require("node:os");

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.findIndex((a) => a === name);
  if (i === -1) return def;
  return args[i + 1];
}
function boolFlag(name) {
  return args.includes(name);
}

const noOpen = boolFlag("--no-open");
const requestedPort = parseInt(flag("--port", ""), 10);

async function pickPort(preferred) {
  const tryPort = (p) =>
    new Promise((res) => {
      const s = net.createServer();
      s.once("error", () => res(false));
      s.once("listening", () => s.close(() => res(true)));
      s.listen(p, "127.0.0.1");
    });
  const seq = Number.isFinite(preferred) ? [preferred] : [3178, 3179, 3180, 4178, 5178];
  for (const p of seq) if (await tryPort(p)) return p;
  // Fall back to any free port.
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => res(port));
    });
  });
}

function openBrowser(url) {
  const opener =
    platform() === "darwin" ? ["open", [url]] :
    platform() === "win32" ? ["cmd", ["/c", "start", "", url]] :
    ["xdg-open", [url]];
  const [cmd, cmdArgs] = opener;
  try {
    spawn(cmd, cmdArgs, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Best-effort — user can copy-paste the URL.
  }
}

async function main() {
  const port = await pickPort(requestedPort);
  const url = `http://127.0.0.1:${port}`;
  const wizardUrl = `${url}/setup`;

  // Prefer the Next.js standalone bundle we ship with the package.
  const standaloneServer = path.join(__dirname, "..", ".next", "standalone", "server.js");
  const hasStandalone = fs.existsSync(standaloneServer);

  console.log("\n  OpenClaw setup engine");
  console.log(`  → ${wizardUrl}\n`);

  let child;
  if (hasStandalone) {
    child = spawn(process.execPath, [standaloneServer], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
      stdio: "inherit",
    });
  } else {
    // Fallback: user cloned the repo and hasn't run `npm run build`. Try dev.
    console.log("  (Building on first run — this takes ~30s.)\n");
    const nextBin = path.join(__dirname, "..", "node_modules", ".bin", "next");
    if (!fs.existsSync(nextBin)) {
      console.error(
        "ERROR: Neither .next/standalone/server.js nor node_modules/.bin/next exists.\n" +
          "Run `npm install && npm run build` inside the package first, or\n" +
          "reinstall from npm: `npx openclaw-setup-engine@latest`.",
      );
      process.exit(1);
    }
    child = spawn(nextBin, ["start", "--port", String(port), "--hostname", "127.0.0.1"], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });
  }

  // Give the server ~1.5s to bind, then open the browser.
  if (!noOpen) setTimeout(() => openBrowser(wizardUrl), 1500);

  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
