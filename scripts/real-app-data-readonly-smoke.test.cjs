const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('real app-data readonly smoke is exposed and cannot mutate the live library', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const script = fs.readFileSync('scripts/desktop-smoke/run-real-app-data-readonly-smoke.ps1', 'utf8');

  assert.match(pkg.scripts['smoke:real-data:readonly'], /run-real-app-data-readonly-smoke\.ps1/);
  assert.match(script, /E:\\MikaVN Library/);
  assert.match(script, /mode=ro/);
  assert.match(script, /PRAGMA quick_check/);
  assert.match(script, /database-backups["'`]\s+["'`]update-protection/);
  assert.match(script, /legacyDatabaseUpdateProtection/);
  assert.match(script, /database-update-protection/);
  assert.match(script, /MaxMissingLocalAssetPaths/);
  assert.match(script, /MaxUnsupportedLocalAssetImages/);
  assert.match(script, /missingLocalWindowsPathCount/);
  assert.match(script, /missingLocalWindowsPathSamples/);
  assert.match(script, /unsupportedLocalImageCount/);
  assert.match(script, /localImageKindCounts/);
  assert.match(script, /os\.path\.isfile/);
  assert.match(script, /Assert-UnderRoot/);
  assert.doesNotMatch(script, /\bRemove-Item\b/);
  assert.doesNotMatch(script, /\bMove-Item\b/);
});
