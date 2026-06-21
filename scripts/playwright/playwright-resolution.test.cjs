const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { resolvePlaywright } = require('./playwright-resolution.cjs');

function writePackageJson(dir, version) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }), 'utf8');
}

test('resolvePlaywright prefers the repository dependency over stale npx cache entries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-playwright-resolution-'));
  const repoRoot = path.join(root, 'repo');
  const localModule = path.join(repoRoot, 'node_modules', 'playwright');
  const npxModule = path.join(root, 'npm-cache', '_npx', 'newer-cache', 'node_modules', 'playwright');

  writePackageJson(localModule, '1.60.0');
  writePackageJson(npxModule, '1.61.0');

  const resolved = resolvePlaywright(repoRoot, {
    LOCALAPPDATA: root,
  });

  assert.equal(resolved, localModule);
});

test('resolvePlaywright honors PLAYWRIGHT_MODULE overrides first', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-playwright-resolution-'));
  const override = path.join(repoRoot, 'custom-playwright');

  assert.equal(
    resolvePlaywright(repoRoot, {
      PLAYWRIGHT_MODULE: override,
    }),
    override,
  );
});

test('smoke scripts use the shared Playwright resolver instead of inline npx lookup', () => {
  const scriptsDir = __dirname;
  for (const scriptName of [
    'run-smoke-with-vite.cjs',
    'page-qa-runner.cjs',
    'core-workflow-smoke.cjs',
    'large-library-smoke.cjs',
  ]) {
    const source = fs.readFileSync(path.join(scriptsDir, scriptName), 'utf8');
    assert.match(source, /playwright-resolution\.cjs/);
    assert.doesNotMatch(source, /npm-cache['"], ['"]_npx|npm-cache\\['"]\s*,\s*['"]_npx/);
  }
});

test('large smoke warmup timeout is configurable and long enough for cold Vite transforms', () => {
  const source = fs.readFileSync(path.join(__dirname, 'run-smoke-with-vite.cjs'), 'utf8');
  assert.match(source, /MIKAVN_VITE_WARM_TIMEOUT_MS/);

  const defaultMatch = source.match(/const warmupTimeoutMs = .*?parseInt\([^)]*'(\d+)'/s);
  assert.ok(defaultMatch, 'expected a default warmup timeout');
  assert.ok(Number.parseInt(defaultMatch[1], 10) >= 120000);
  assert.match(source, /page\.goto\(baseUrl,\s*\{\s*waitUntil: 'domcontentloaded',\s*timeout: warmupTimeoutMs\s*\}\)/s);
});

test('large smoke defaults to a real-library-scale sample size', () => {
  const source = fs.readFileSync(path.join(__dirname, 'large-library-smoke.cjs'), 'utf8');
  const defaultMatch = source.match(/MIKAVN_LARGE_LIBRARY_COUNT \|\| '(\d+)'/);

  assert.ok(defaultMatch, 'expected a default large library count');
  assert.ok(Number.parseInt(defaultMatch[1], 10) >= 4500);
});

test('large smoke derives expected filtered counts from generated data', () => {
  const source = fs.readFileSync(path.join(__dirname, 'large-library-smoke.cjs'), 'utf8');

  assert.match(source, /expectedTargetCount/);
  assert.match(source, /expectedSearchCount/);
  assert.doesNotMatch(source, /\/60 games\//);
  assert.doesNotMatch(source, /\/30 个匹配条目\//);
});

test('large smoke waits for localized formatted library counts', () => {
  const source = fs.readFileSync(path.join(__dirname, 'large-library-smoke.cjs'), 'utf8');

  assert.match(source, /formatLargeSmokeCount/);
  assert.match(source, /个游戏/);
  assert.match(source, /个匹配条目/);
  assert.doesNotMatch(source, /\$\{gameCount\} games/);
  assert.doesNotMatch(source, /\$\{expectedTargetCount\} games/);
});
