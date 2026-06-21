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

test('game detail delete confirmation names the game and explains record-only impact', () => {
  const source = fs.readFileSync('src/pages/Library/useGameDetailActions.ts', 'utf8');

  assert.match(source, /删除游戏记录「\$\{game\.title\}」/);
  assert.match(source, /只会删除 MikaVN 数据库记录/);
  assert.match(source, /不会删除真实游戏文件/);
  assert.match(source, /启动记录、存档路径、图库引用/);
});
