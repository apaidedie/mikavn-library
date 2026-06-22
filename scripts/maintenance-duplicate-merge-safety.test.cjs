const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('duplicate merge confirmation explains source record deletion is local-only', () => {
  const source = fs.readFileSync('src/pages/Maintenance/useMaintenanceDuplicateMergeActions.ts', 'utf8');

  assert.match(source, /previewDuplicateMerge/);
  assert.match(source, /if \(!mergePreview/);
  assert.match(source, /window\.confirm\(`把 \$\{mergeSourceIds\.length\} 条重复游戏并入/);
  assert.match(source, /只会删除 MikaVN 数据库中的源游戏记录/);
  assert.match(source, /不会删除真实游戏文件或游戏目录/);
  assert.match(source, /关联数据会先迁移到保留记录/);
  assert.match(source, /api\.mergeDuplicateGames/);
});
