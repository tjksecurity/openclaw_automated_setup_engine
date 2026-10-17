import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const inside = (parent, file) => {
  const relative = path.relative(parent, file);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
for (const name of await readdir('.next', { recursive: true })) {
  if (!name.endsWith('.nft.json')) continue;
  const manifest = path.resolve('.next', name);
  const { files } = JSON.parse(await readFile(manifest, 'utf8'));
  for (const file of files) {
    const asset = path.resolve(path.dirname(manifest), file);
    if (inside(os.homedir(), asset) && !inside(process.cwd(), asset)) {
      throw new Error('Standalone trace contains operator-home data outside the project.');
    }
  }
}
console.log('All tracing manifests exclude operator-home assets outside the project.');

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let diagnostic = '';
let spawnError;
child.on('error', error => { spawnError = error; });
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-12000); });
try {
  const deadline = Date.now() + 30000;
  let verified = false;
  while (Date.now() < deadline) {
    if (spawnError || child.exitCode !== null) throw spawnError || new Error(`Standalone exited ${child.exitCode}: ${diagnostic}`);
    let response;
    try { response = await fetch(`http://127.0.0.1:${port}/setup`, { signal: AbortSignal.timeout(2000) }); }
    catch { await delay(200); continue; }
    const body = await response.text();
    if (response.status !== 200 || !body.includes('OpenClaw')) throw new Error(`Unexpected setup route ${response.status}: ${diagnostic}`);
    verified = true;
    console.log('Actual standalone setup route returned 200 and OpenClaw content on loopback. No installation or configuration command was invoked.');
    break;
  }
  if (!verified) throw new Error(`Standalone startup deadline exceeded: ${diagnostic}`);
} finally {
  child.kill();
  if (child.exitCode === null) await Promise.race([once(child, 'exit'), delay(5000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}
