const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('updater install creates database backup before download and install', () => {
  const source = read('src/services/updater.ts');
  const backupIndex = source.indexOf('backupDatabaseBeforeUpdate');
  const installIndex = source.indexOf('downloadAndInstall');

  assert.ok(backupIndex > -1, 'install flow must call backupDatabaseBeforeUpdate');
  assert.ok(installIndex > -1, 'install flow must still call downloadAndInstall');
  assert.ok(backupIndex < installIndex, 'backup must happen before downloadAndInstall');
  assert.match(source, /backup.*fileName|backupReport|backup/i);
});

test('updater install reports backup failure before installing', () => {
  const source = read('src/services/updater.ts');

  assert.match(source, /更新前数据库备份失败/);
  assert.match(source, /已取消安装/);
  assert.match(source, /backupDatabaseBeforeUpdate/);
});

test('api exposes backup_database_before_update command', () => {
  const api = read('src/services/api.ts');
  const types = read('src/types/archive.ts');

  assert.match(api, /backupDatabaseBeforeUpdate/);
  assert.match(api, /backup_database_before_update/);
  assert.match(types, /DatabaseUpdateProtectionBackupReport/);
});
