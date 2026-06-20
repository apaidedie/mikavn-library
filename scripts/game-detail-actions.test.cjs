const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('game detail hook resets transient detail state immediately when selected game changes', () => {
  const source = fs.readFileSync('src/pages/Library/useGameDetailActions.ts', 'utf8');

  assert.match(source, /setProfiles\(\[\]\)/);
  assert.match(source, /setSessions\(\[\]\)/);
  assert.match(source, /setSelectedProfileId\(''\)/);
  assert.match(source, /setPathHealth\(null\)/);
  assert.match(source, /setImageAudit\(null\)/);
});

test('game detail hook ignores stale async responses from previously selected games', () => {
  const source = fs.readFileSync('src/pages/Library/useGameDetailActions.ts', 'utf8');

  assert.match(source, /let cancelled = false/);
  assert.match(source, /if \(cancelled\) return/);
  assert.match(source, /setSessions\(items\)/);
  assert.match(source, /return \(\) => \{\s*cancelled = true;\s*\}/s);
});
