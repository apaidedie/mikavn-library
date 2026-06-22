const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('database restore confirmation explains only the database is replaced', () => {
  const source = fs.readFileSync('src/pages/Settings/useSettingsLocalDataActions.ts', 'utf8');

  assert.match(source, /restoreDatabase/);
  assert.match(source, /恢复会在下次启动前替换当前 mikavn\.db/);
  assert.match(source, /应用会先创建保护备份/);
  assert.match(source, /不会删除真实游戏文件/);
  assert.match(source, /不会删除图片缓存或存档备份/);
  assert.match(source, /selectedBackupName/);
  assert.match(source, /将恢复的备份/);
  assert.match(source, /完整路径/);
  assert.match(source, /已安排下次启动恢复：\$\{selectedBackupName\}/);
  assert.match(source, /api\.restoreDatabaseBackup/);
});
