const path = require('node:path');

function tracingIgnores(project, home, paths = path) {
  const relative = paths.relative(home, project);
  const fromProject = value => paths.relative(project, value).replace(/\\/g, '/');
  const privateFiles = ['**/.env', '**/.env.*', '**/.npmrc', '**/.git/**'];
  if (relative === '') throw new Error('Use a project directory below the user home, not the user home itself.');
  if (relative.startsWith('..' + paths.sep) || relative === '..' || paths.isAbsolute(relative)) {
    return [...privateFiles, fromProject(home) + '/**/*'];
  }
  // Exclude siblings at each ancestor, retaining the complete project subtree.
  // Ignoring the whole home also strips required standalone files for home checkouts.
  const ignores = [...privateFiles];
  let ancestor = home;
  for (const segment of relative.split(paths.sep)) {
    const escaped = segment.replace(/[\\*?{}()[\]!+@|]/g, '\\$&');
    ignores.push(fromProject(ancestor) + `/!(${escaped}){,/**}`);
    ancestor = paths.join(ancestor, segment);
  }
  return ignores;
}
module.exports = { tracingIgnores };
