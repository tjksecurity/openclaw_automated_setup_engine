const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const picomatch = require('next/dist/compiled/picomatch');
const { tracingIgnores } = require('./tracing-ignores.cjs');

for (const [paths, project, home] of [
  [path.posix, '/home/runner/work/project/project', '/home/runner'],
  [path.posix, '/home/runner/work/my[app]/source', '/home/runner'],
  [path.win32, 'C:\\Users\\synthetic\\OneDrive\\Documents\\app', 'C:\\Users\\synthetic'],
  [path.win32, 'D:\\isolated\\app', 'C:\\Users\\synthetic'],
]) {
  test(`private home excluded while project remains traceable: ${project}`, () => {
    const match = picomatch(tracingIgnores(project, home, paths), { dot: true, contains: true });
    const relative = file => paths.relative(project, file).replace(/\\/g, '/');
    for (const file of ['.next/server/webpack-runtime.js', '.next/server/chunks/123.js', 'node_modules/next/package.json']) {
      assert.equal(match(relative(paths.join(project, file))), false, file);
    }
    for (const file of ['.openclaw/openclaw.json', '.codex/config.toml', 'AppData/Local/private.json', 'secret.txt']) {
      assert.equal(match(relative(paths.join(home, file))), true, file);
    }
    for (const file of ['.env', '.env.local', '.npmrc', '.git/config']) {
      assert.equal(match(file), true, file);
    }
  });
}
test('operator home cannot be the repository root', () => {
  assert.throws(() => tracingIgnores('/home/operator', '/home/operator', path.posix), /project directory/);
});
