const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('cargo release profile keeps Windows packaging within desktop memory budgets', () => {
  const cargo = read('src-tauri/Cargo.toml');

  assert.match(cargo, /\[profile\.release\]/);
  assert.match(cargo, /opt-level\s*=\s*2/);
  assert.match(cargo, /strip\s*=\s*"debuginfo"/);
});

test('local Tauri build script can create unsigned smoke installers without updater secrets', () => {
  const pkg = JSON.parse(read('package.json'));
  const localConfig = JSON.parse(read('scripts/release/tauri.local-build.conf.json'));

  assert.equal(pkg.scripts['tauri:build:local'], 'tauri build --config scripts/release/tauri.local-build.conf.json');
  assert.equal(localConfig.bundle.createUpdaterArtifacts, false);
});
