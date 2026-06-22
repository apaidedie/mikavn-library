const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'desktop-smoke', 'run-real-install-update-smoke.ps1');

test('real install update smoke protects database and verifies installed app data after overwrite', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const releaseMetadata = fs.readFileSync(path.join(repoRoot, 'scripts', 'release', 'check-release-metadata.ps1'), 'utf8');
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(packageJson.scripts['smoke:real-install:update'], /run-real-install-update-smoke\.ps1/);
  assert.match(packageJson.scripts['test:release-scripts'], /real-install-update-smoke\.test\.cjs/);
  assert.match(releaseMetadata, /smoke:real-install:update/);

  assert.match(source, /E:\\MikaVN Library/);
  assert.match(source, /Assert-NoRunningInstalledProcess/);
  assert.match(source, /backupDatabaseBeforeInstall/);
  assert.match(source, /quickCheck/);
  assert.match(source, /backupSha256/);
  assert.match(source, /sourceSha256/);
  assert.match(source, /Start-HiddenProcess[\s\S]*\/S[\s\S]*\/D=\$resolvedAppRoot/);
  assert.match(source, /gamesBefore/);
  assert.match(source, /gamesAfter/);
  assert.match(source, /gameAssetsBefore/);
  assert.match(source, /gameAssetsAfter/);
  assert.match(source, /real-install-update-smoke-report\.json/);
});
