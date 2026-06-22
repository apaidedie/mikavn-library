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

  assert.equal(pkg.scripts['test:updater-release'], 'node --test scripts/updater-release-config.test.cjs scripts/updater-service-model.test.cjs scripts/settings-updater-section.test.cjs scripts/startup-updater.test.cjs scripts/updater-install-flow.test.cjs scripts/settings-local-data-section.test.cjs');
  assert.match(pkg.scripts['test:diagnostic-export'], /scripts\/diagnostic-export\.test\.cjs/);
  assert.match(pkg.scripts['test:diagnostic-export'], /scripts\/dashboard-diagnostic-export\.test\.cjs/);
  assert.match(pkg.scripts['test:data-safety'], /scripts\/startup-database-backup\.test\.cjs/);
  assert.match(pkg.scripts['test:data-safety'], /scripts\/real-app-data-readonly-smoke\.test\.cjs/);
  assert.match(pkg.scripts['test:library-performance'], /scripts\/cover-image-performance\.test\.cjs/);
  assert.match(pkg.scripts['test:library-performance'], /scripts\/library-filter-performance\.test\.cjs/);
  assert.match(pkg.scripts['test:release-scripts'], /updater-release-config\.test\.cjs/);
  assert.match(pkg.scripts['release:handoff:require-public'], /check-release-handoff\.cjs --require-public-ready/);
  assert.match(pkg.scripts['smoke:real-data:readonly'], /run-real-app-data-readonly-smoke\.ps1/);
  assert.match(pkg.dependencies['@tauri-apps/plugin-updater'], /^\^2\./);
  assert.match(pkg.dependencies['@tauri-apps/plugin-process'], /^\^2\./);
});

test('tauri updater config points to public GitHub latest metadata and contains a real public key', () => {
  const config = readJson('src-tauri/tauri.conf.json');
  const updater = config.plugins?.updater;
  const assetScope = config.app?.security?.assetProtocol?.scope?.allow ?? [];

  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.ok(updater, 'plugins.updater must exist');
  assert.equal(updater.active, true);
  assert.equal(updater.pubkey, 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IENCREFEODkwOTFEMjc0ODgKUldTSWROS1JrTmpheTJXZ0JSSDNrRWFwaVkxaGRGajZjL3orYTY4NjBoYk00MVJMTG9Ca09GYnMK');
  assert.deepEqual(updater.endpoints, ['https://github.com/apaidedie/mikavn-library/releases/latest/download/latest.json']);
  assert.equal(updater.windows.installMode, 'passive');
  assert.ok(assetScope.includes('$EXE/../app-data/images/**'));
  assert.ok(assetScope.includes('$EXE/app-data/images/**'));
});

test('local image protocol is consistently wired for Windows WebView images', () => {
  const config = readJson('src-tauri/tauri.conf.json');
  const lib = read('src-tauri/src/lib.rs');
  const imageSrc = read('src/utils/imageSrc.ts');
  const releaseGate = read('scripts/release/check-release-metadata.ps1');
  const csp = config.app?.security?.csp ?? '';

  assert.match(lib, /register_uri_scheme_protocol\("mikavn-image"/);
  assert.match(imageSrc, /http:\/\/mikavn-image\.localhost/);
  assert.match(csp, /mikavn-image:/);
  assert.match(csp, /http:\/\/mikavn-image\.localhost/);
  assert.match(releaseGate, /mikavn-image:/);
  assert.match(releaseGate, /http:\/\/mikavn-image\.localhost/);
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

  assert.match(workflow, /npm run test:updater-release/);
  assert.match(workflow, /npm run test:diagnostic-export/);
  assert.match(workflow, /npm run test:data-safety/);
  assert.match(workflow, /npm run test:library-performance/);
  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(workflow, /Require updater signing secrets/);
  assert.match(workflow, /Create updater metadata/);
  assert.match(workflow, /latest\.json/);
  assert.match(workflow, /\*\.sig/);
  assert.match(workflow, /releases\/download\/v\$version/);
  assert.match(workflow, /src-tauri\/target\/release\/bundle\/nsis\/latest\.json/);
});

test('release workflow normalizes updater asset names before writing latest metadata', () => {
  const workflow = read('.github/workflows/release.yml');

  assert.match(workflow, /\$releaseInstallerName = \$installer\.Name -replace '\\s\+', '\.'/);
  assert.match(workflow, /Move-Item -LiteralPath \$installer\.FullName -Destination \$releaseInstallerPath/);
  assert.match(workflow, /Move-Item -LiteralPath \$signaturePath -Destination \$releaseSignaturePath/);
  assert.match(workflow, /url = "https:\/\/github\.com\/apaidedie\/mikavn-library\/releases\/download\/v\$version\/\$\(\$installer\.Name\)"/);
});

test('release metadata gate knows about updater release checks', () => {
  const gate = read('scripts/release/check-release-metadata.ps1');

  assert.match(gate, /test:updater-release/);
  assert.match(gate, /test:diagnostic-export/);
  assert.match(gate, /test:data-safety/);
  assert.match(gate, /test:library-performance/);
  assert.match(gate, /smoke:real-data:readonly/);
  assert.match(gate, /release:handoff:require-public/);
  assert.match(gate, /run-real-app-data-readonly-smoke\.ps1/);
  assert.match(gate, /updater-release-config\.test\.cjs/);
  assert.match(gate, /latest\.json/);
  assert.match(gate, /TAURI_SIGNING_PRIVATE_KEY/);
});

test('ci and local release validation run updater-specific tests', () => {
  const ciWorkflow = read('.github/workflows/ci.yml');
  const releaseValidation = read('scripts/release/run-release-validation.ps1');

  assert.match(ciWorkflow, /npm run test:updater-release/);
  assert.match(ciWorkflow, /npm run test:diagnostic-export/);
  assert.match(ciWorkflow, /npm run test:data-safety/);
  assert.match(ciWorkflow, /npm run test:library-performance/);
  assert.match(releaseValidation, /npm run test:updater-release/);
  assert.match(releaseValidation, /npm run test:diagnostic-export/);
  assert.match(releaseValidation, /npm run test:data-safety/);
  assert.match(releaseValidation, /npm run test:library-performance/);
  assert.match(releaseValidation, /SkipRealDataSmoke/);
  assert.match(releaseValidation, /npm run smoke:real-data:readonly/);
});
