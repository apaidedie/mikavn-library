const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('saved search deletion confirmation explains only the saved query is removed', () => {
  const source = fs.readFileSync('src/pages/Search/AdvancedSearchPage.tsx', 'utf8');

  assert.match(source, /deleteSavedSearch/);
  assert.match(source, /删除保存搜索「\$\{item\.name\}」/);
  assert.match(source, /只删除保存的搜索条件/);
  assert.match(source, /不会删除游戏记录/);
  assert.match(source, /不会删除真实游戏文件/);
  assert.match(source, /api\.deleteSavedSearch\(item\.id\)/);
});
