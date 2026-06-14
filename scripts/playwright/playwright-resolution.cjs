const fs = require('fs');
const path = require('path');

function packageJsonExists(modulePath) {
  return fs.existsSync(path.join(modulePath, 'package.json'));
}

function resolvePlaywright(repoRoot, env = process.env) {
  if (env.PLAYWRIGHT_MODULE) return env.PLAYWRIGHT_MODULE;

  const localModule = path.join(repoRoot, 'node_modules', 'playwright');
  if (packageJsonExists(localModule)) return localModule;

  const npxRoot = path.join(env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  const candidates = [];
  if (fs.existsSync(npxRoot)) {
    for (const entry of fs.readdirSync(npxRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modulePath = path.join(npxRoot, entry.name, 'node_modules', 'playwright');
      const packageJson = path.join(modulePath, 'package.json');
      if (fs.existsSync(packageJson)) {
        candidates.push({ modulePath, mtimeMs: fs.statSync(packageJson).mtimeMs });
      }
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.modulePath || 'playwright';
}

module.exports = { resolvePlaywright };
