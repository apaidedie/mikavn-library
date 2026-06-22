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
  assert.match(source, />恢复数据库<\/Button>/);
  assert.doesNotMatch(source, />安排恢复<\/Button>/);
  assert.match(source, /安排下次启动恢复/);
  assert.match(source, /下次启动/);
  assert.match(source, /保护备份/);
});

test('database backup cleanup policy is centralized and visible before cleanup', () => {
  const policy = read('src/pages/Settings/settingsBackupCleanupPolicy.ts');
  const section = read('src/pages/Settings/SettingsLocalDataSection.tsx');
  const actions = read('src/pages/Settings/useSettingsLocalDataActions.ts');

  assert.match(policy, /databaseBackupCleanupPolicy/);
  assert.match(policy, /retainCount:\s*10/);
  assert.match(policy, /retainDays:\s*30/);
  assert.match(policy, /formatDatabaseBackupCleanupPolicy/);
  assert.match(policy, /保留最新/);
  assert.match(section, /formatDatabaseBackupCleanupPolicy\(databaseBackupCleanupPolicy\)/);
  assert.match(section, /只清理应用管理的旧数据库备份/);
  assert.match(section, /不会删除当前 mikavn\.db/);
  assert.match(actions, /databaseBackupCleanupPolicy/);
  assert.match(actions, /formatDatabaseBackupCleanupPolicy\(databaseBackupCleanupPolicy\)/);
  assert.match(actions, /cleanupOldDatabaseBackups\(databaseBackupCleanupPolicy\)/);
});

test('settings top-level local tab advertises backup access', () => {
  const source = read('src/pages/Settings/SettingsPage.tsx');

  assert.match(source, /备份与本地/);
  assert.doesNotMatch(source, />本地与隐私</);
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

test('dashboard backup restore actions request the exact restore section', () => {
  const dashboard = read('src/pages/Dashboard/DashboardLocalPanels.tsx');
  const routes = read('src/app/AppRoutes.tsx');
  const controller = read('src/app/useAppController.ts');
  const settingsPage = read('src/pages/Settings/SettingsPage.tsx');
  const localTab = read('src/pages/Settings/SettingsLocalTabContent.tsx');
  const types = read('src/pages/Settings/settingsTypes.ts');

  assert.match(types, /SettingsSection = 'database-restore'/);
  assert.match(dashboard, /onOpenSettings\?\.\('local', 'database-restore'\)/);
  assert.match(routes, /onOpenSettings: \(tab\?: SettingsTab, section\?: SettingsSection \| null\) => void/);
  assert.match(controller, /section: section \?\? null/);
  assert.match(settingsPage, /section\?: SettingsSection \| null/);
  assert.match(localTab, /restoreFocusKey/);
  assert.match(localTab, /scrollToDatabaseRestore/);
});

test('browser mock database backup log mirrors verified backup report', () => {
  const source = read('src/services/mockStoreReports.ts');

  assert.match(source, /formatMockBytes\(131072\)/);
  assert.match(source, /数据库备份报告：目标 \$\{target\}，大小 \$\{backupSize\}，quick_check ok。/);
  assert.match(source, /浏览器预览已模拟安排下次启动恢复 \$\{pending\}（\$\{backupSize\}）/);
  assert.doesNotMatch(source, /131072 bytes/);
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

test('local data settings explains legacy update protection backups are included safely', () => {
  const source = read('src/pages/Settings/SettingsLocalDataSection.tsx');

  assert.match(source, /旧版更新保护备份/);
  assert.match(source, /database-update-protection/);
  assert.match(source, /也会计入数据库备份统计/);
  assert.match(source, /清理仍只作用于应用管理的备份文件/);
});

test('local data settings exposes a diagnostic package export action', () => {
  const section = read('src/pages/Settings/SettingsLocalDataSection.tsx');
  const actions = read('src/pages/Settings/useSettingsLocalDataActions.ts');
  const content = read('src/pages/Settings/SettingsLocalTabContent.tsx');

  assert.match(section, /导出诊断包/);
  assert.match(section, /diagnosticExportLoading/);
  assert.match(actions, /exportDiagnosticPackage/);
  assert.match(actions, /api\.exportDiagnosticPackage\(\)/);
  assert.match(content, /onExportDiagnosticPackage=\{localData\.exportDiagnosticPackage\}/);
});

test('tray settings explain how to fully exit when close hides to tray', () => {
  const section = read('src/pages/Settings/SettingsTraySection.tsx');
  const parts = read('src/pages/Settings/SettingsPageParts.tsx');

  assert.match(section, /真正退出应用/);
  assert.match(parts, /关闭主窗口只会隐藏到托盘/);
  assert.match(parts, /系统托盘菜单选择“退出”/);
  assert.match(parts, /关闭主窗口会直接退出应用/);
});

test('tag deletion confirmation explains affected games and record-only impact', () => {
  const source = read('src/pages/Settings/useSettingsPageActions.ts');

  assert.match(source, /删除标签“\$\{tag\.name\}”/);
  assert.match(source, /\$\{tag\.gameCount\} 个游戏/);
  assert.match(source, /只会修改 MikaVN 标签关系/);
  assert.match(source, /不会删除真实游戏文件/);
});
