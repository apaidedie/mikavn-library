const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.join(repoRoot, 'scripts', 'desktop-smoke', 'run-portable-app-data-smoke.ps1');

test('portable app-data smoke reports default app-data migration evidence', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(packageJson.scripts['test:release-scripts'], /portable-app-data-smoke\.test\.cjs/);
  assert.match(source, /defaultAppDataMigration/);
  assert.match(source, /sourceRoot/);
  assert.match(source, /sourceDatabaseExists/);
  assert.match(source, /sourceDatabaseBytes/);
  assert.match(source, /sourceDatabaseSha256/);
  assert.match(source, /targetDatabaseSha256/);
  assert.match(source, /databaseCopiedFromDefault/);
  assert.match(source, /tauri\.conf\.json/);
});
