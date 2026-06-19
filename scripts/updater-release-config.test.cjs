const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('package scripts and dependencies include updater gates and frontend plugins', () => {
  const pkg = readJson('package.json');

  assert.equal(pkg.scripts['test:updater-release'], 'node --test scripts/updater-release-config.test.cjs scripts/updater-service-model.test.cjs scripts/settings-updater-section.test.cjs scripts/startup-updater.test.cjs');
  assert.match(pkg.scripts['test:release-scripts'], /updater-release-config\.test\.cjs/);
  assert.match(pkg.dependencies['@tauri-apps/plugin-updater'], /^\^2\./);
  assert.match(pkg.dependencies['@tauri-apps/plugin-process'], /^\^2\./);
});

test('tauri updater config points to public GitHub latest metadata and contains a real public key', () => {
  const config = readJson('src-tauri/tauri.conf.json');
  const updater = config.plugins?.updater;

  assert.ok(updater, 'plugins.updater must exist');
  assert.equal(updater.active, true);
  assert.equal(updater.pubkey, 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEY0MTU3QUZBMzZENEJFMzUKUldRMXZ0UTIrbm9WOU95VXJwbEp0VmYzakl6bjE5QlFKN1FGU0VnQTVrRnh5eHJVSE9qL0NhWEUK');
  assert.deepEqual(updater.endpoints, ['https://github.com/apaidedie/mikavn-library/releases/latest/download/latest.json']);
  assert.equal(updater.windows.installMode, 'passive');
});

test('rust updater plugin is registered and desktop capability allows update and restart', () => {
  const cargo = read('src-tauri/Cargo.toml');
  const lib = read('src-tauri/src/lib.rs');
  const capability = readJson('src-tauri/capabilities/default.json');

  assert.match(cargo, /tauri-plugin-updater\s*=\s*"2"/);
  assert.match(cargo, /tauri-plugin-process\s*=\s*"2"/);
  assert.match(lib, /\.plugin\(tauri_plugin_updater::Builder::new\(\)\.build\(\)\)/);
  assert.match(lib, /\.plugin\(tauri_plugin_process::init\(\)\)/);
  assert.ok(capability.permissions.includes('updater:default'));
  assert.ok(capability.permissions.includes('process:allow-restart'));
});

test('release workflow requires signing secrets and publishes updater assets', () => {
  const workflow = read('.github/workflows/release.yml');

  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(workflow, /Require updater signing secrets/);
  assert.match(workflow, /Create updater metadata/);
  assert.match(workflow, /latest\.json/);
  assert.match(workflow, /\*\.sig/);
  assert.match(workflow, /releases\/download\/v\$version/);
  assert.match(workflow, /src-tauri\/target\/release\/bundle\/nsis\/latest\.json/);
});

test('release metadata gate knows about updater release checks', () => {
  const gate = read('scripts/release/check-release-metadata.ps1');

  assert.match(gate, /test:updater-release/);
  assert.match(gate, /updater-release-config\.test\.cjs/);
  assert.match(gate, /latest\.json/);
  assert.match(gate, /TAURI_SIGNING_PRIVATE_KEY/);
});
