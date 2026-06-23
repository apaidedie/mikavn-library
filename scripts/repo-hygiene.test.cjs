const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('ripgrep ignores generated and build output during code audits', () => {
  const rgignorePath = path.join(repoRoot, '.rgignore');
  assert.ok(fs.existsSync(rgignorePath), '.rgignore should keep local code searches focused');

  const ignoreRules = readRepoFile('.rgignore');
  for (const rule of [
    'src-tauri/target/',
    'src-tauri/gen/schemas/',
    'dist/',
    'output/',
    'node_modules/',
  ]) {
    assert.match(ignoreRules, new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});
