const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('collection deletion confirmation explains real game files are untouched', () => {
  const source = fs.readFileSync('src/pages/Collections/CollectionsPage.tsx', 'utf8');

  assert.match(source, /removeCollection/);
  assert.match(source, /删除合集「\$\{collection\.name\}」/);
  assert.match(source, /只删除合集关系/);
  assert.match(source, /不会删除游戏记录/);
  assert.match(source, /不会删除真实游戏文件/);
  assert.match(source, /api\.deleteCollection\(collection\.id\)/);
});
