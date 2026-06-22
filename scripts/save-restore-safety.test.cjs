const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('save restore confirmation distinguishes merge from mirror cleanup risk', () => {
  const source = fs.readFileSync('src/pages/Saves/SaveRestorePreviewBlock.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Saves/useSavesPageActions.ts', 'utf8');

  assert.match(source, /restoreConfirmationMessage/);
  assert.match(source, /合并恢复会先创建保护备份/);
  assert.match(source, /覆盖同名存档文件/);
  assert.match(source, /当前目录里的其它文件会保留/);
  assert.match(source, /镜像恢复会先创建保护备份/);
  assert.match(source, /清理当前存档目录中不在备份内的文件/);
  assert.match(source, /只作用于已登记存档目录/);
  assert.match(actions, /window\.confirm\(restoreConfirmationMessage\(mode, preview\)\)/);
});
