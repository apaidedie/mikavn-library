const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

test('elevated launch smoke script has explicit UAC success and cancellation evidence paths', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scriptPath = path.join(repoRoot, 'scripts', 'desktop-smoke', 'run-elevated-launch-smoke.ps1');
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.equal(packageJson.scripts['smoke:elevated-launch'], 'pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/desktop-smoke/run-elevated-launch-smoke.ps1');
  assert.match(source, /ValidateSet\("success", "cancel"\)/);
  assert.match(source, /Start-Process[\s\S]*-Verb RunAs/);
  assert.match(source, /elevated-launch-smoke-report\.json/);
  assert.match(source, /marker\.txt/);
  assert.match(source, /TcpTestSucceeded|UAC|cancelled|canceled/i);
  assert.match(source, /expectedAction/);
  assert.match(source, /succeeded/);
});
