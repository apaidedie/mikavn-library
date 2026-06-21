const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('local data settings exposes clear backup and restore entry', () => {
  const source = read('src/pages/Settings/SettingsLocalDataSection.tsx');

  assert.match(source, /数据库备份与恢复/);
  assert.match(source, /打开备份目录/);
  assert.match(source, /最近备份/);
  assert.match(source, /下次启动/);
  assert.match(source, /保护备份/);
});

test('local preferences expose startup database auto backup setting', () => {
  const preferences = read('src/pages/Settings/SettingsLocalPreferencesSection.tsx');
  const mapping = read('src/pages/Settings/settingsFormMapping.ts');
  const types = read('src/pages/Settings/settingsTypes.ts');

  assert.match(preferences, /数据库自动备份/);
  assert.match(preferences, /启动时自动备份/);
  assert.match(preferences, /超过 24 小时/);
  assert.match(preferences, /database_auto_backup_on_startup/);
  assert.match(types, /database_auto_backup_on_startup: boolean/);
  assert.match(mapping, /database_auto_backup_on_startup: true/);
  assert.match(mapping, /settings\.database_auto_backup_on_startup !== 'false'/);
  assert.match(mapping, /database_auto_backup_on_startup: String\(form\.database_auto_backup_on_startup\)/);
});

test('dashboard local safety links to backup and restore settings', () => {
  const source = read('src/pages/Dashboard/DashboardLocalPanels.tsx');

  assert.match(source, /备份与恢复/);
  assert.match(source, /onOpenSettings\?\.\('local'\)/);
});

test('browser mock database backup log mirrors verified backup report', () => {
  const source = read('src/services/mockStoreReports.ts');

  assert.match(source, /数据库备份报告：目标 \$\{target\}，大小 131072 bytes，quick_check ok。/);
});

test('local data settings distinguishes external Playnite image refs from migrated cache', () => {
  const source = read('src/pages/Settings/SettingsLocalDataSection.tsx');

  assert.match(source, /外部 Playnite 引用/);
  assert.match(source, /不含已迁入 app-data\/images 的旧导入缓存/);
  assert.doesNotMatch(source, /label="Playnite 图片引用"/);
});

test('local data settings labels the backup total as all database backups', () => {
  const source = read('src/pages/Settings/SettingsLocalDataSection.tsx');

  assert.match(source, /label="数据库备份"/);
  assert.doesNotMatch(source, /label="旧数据库备份"/);
});
