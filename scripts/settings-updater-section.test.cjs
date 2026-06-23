const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('settings update section exposes manual updater actions and browser fallback text', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.match(source, /检查更新/);
  assert.match(source, /下载并安装/);
  assert.match(source, /重启应用/);
  assert.match(source, /浏览器预览不会下载或安装更新/);
  assert.match(source, /checkForAppUpdate/);
  assert.match(source, /installAppUpdate/);
  assert.match(source, /restartAfterUpdate/);
});

test('settings update section avoids promising signed Windows artifacts in local builds', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.doesNotMatch(source, /已签名的 Windows 更新/);
  assert.match(source, /公开 GitHub Releases/);
  assert.match(source, /失败时提供备用下载链接/);
});

test('local settings tab renders updater section before data maintenance', () => {
  const source = read('src/pages/Settings/SettingsLocalTabContent.tsx');
  const updateIndex = source.indexOf('<SettingsUpdateSection');
  const dataIndex = source.indexOf('<SettingsLocalDataSection');

  assert.match(source, /import \{ SettingsUpdateSection \}/);
  assert.ok(updateIndex > -1, 'SettingsUpdateSection must be rendered');
  assert.ok(dataIndex > -1, 'SettingsLocalDataSection must still be rendered');
  assert.ok(updateIndex < dataIndex, 'Updater section should be near the top of local maintenance settings');
});

test('settings update section explains update protection backup', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.match(source, /更新前.*数据库备份/);
  assert.match(source, /备份中|backing_up/);
  assert.match(source, /backup\?\.fileName|backupInfo|backupPath/);
});

test('settings update section links update backups to restore workflow', () => {
  const section = read('src/pages/Settings/SettingsUpdateSection.tsx');
  const localTab = read('src/pages/Settings/SettingsLocalTabContent.tsx');
  const localData = read('src/pages/Settings/SettingsLocalDataSection.tsx');

  assert.match(section, /打开备份位置/);
  assert.match(section, /复制备份路径/);
  assert.match(section, /navigator\.clipboard\.writeText\(backupInfo\.path\)/);
  assert.match(section, /backupActionMessage/);
  assert.match(section, /去恢复数据库/);
  assert.match(section, /onRevealBackup/);
  assert.match(section, /onOpenDatabaseRestore/);
  assert.match(localTab, /scrollToDatabaseRestore/);
  assert.match(localTab, /database-restore-section/);
  assert.match(localData, /id="database-restore-section"/);
});

test('settings update failure offers public fallback download link', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.match(source, /updaterFallbackDownloadUrl/);
  assert.match(source, /备用下载页面/);
  assert.match(source, /复制备用链接/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noreferrer"/);
  assert.match(source, /复制错误/);
  assert.match(source, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(source, /copyUpdateRecoveryText\(error/);
  assert.match(source, /copyUpdateRecoveryText\(updaterFallbackDownloadUrl/);
  assert.match(source, /copyUpdateRecoveryText/);
  assert.match(source, /已复制更新错误。/);
  assert.match(source, /已复制备用下载链接。/);
  assert.match(source, /recoveryActionMessage/);
});

test('settings update failure shows recovery guidance and handles restart errors', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.match(source, /createUpdaterRecoveryHint/);
  assert.match(source, /recoveryHint\?\.title/);
  assert.match(source, /recoveryHint\?\.guidance/);
  assert.match(source, /showFallbackDownload/);
  assert.match(source, /restartUpdate/);
  assert.match(source, /重启应用失败/);
  assert.match(source, /restartAfterUpdate\(\)/);
});

test('settings update section keeps a public manual download link visible before failures', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');
  const manualDownloadIndex = source.indexOf('手动下载最新版');
  const errorBlockIndex = source.indexOf('{error &&');

  assert.ok(manualDownloadIndex > -1, 'manual public download link must be visible in the updater section');
  assert.ok(errorBlockIndex > -1, 'error-specific fallback block should still exist');
  assert.ok(manualDownloadIndex > errorBlockIndex, 'manual public download link should be rendered outside the error-only fallback block');
  assert.match(source, /href=\{updaterFallbackDownloadUrl\}/);
});

test('settings update failures can export diagnostics and expose the exported package path', () => {
  const section = read('src/pages/Settings/SettingsUpdateSection.tsx');
  const localTab = read('src/pages/Settings/SettingsLocalTabContent.tsx');
  const diagnosticActions = read('src/components/diagnostics/DiagnosticExportPathActions.tsx');

  assert.match(section, /DiagnosticExportPathActions/);
  assert.match(section, /diagnosticExportLoading/);
  assert.match(section, /diagnosticExportPath/);
  assert.match(section, /diagnosticExportMessage/);
  assert.match(section, /onExportDiagnosticPackage/);
  assert.match(section, /onRevealDiagnosticExportPath/);
  assert.match(section, /onCopyDiagnosticExportPath/);
  assert.match(section, /导出诊断包/);
  assert.match(diagnosticActions, /打开诊断包位置/);
  assert.match(diagnosticActions, /复制诊断包路径/);
  assert.match(localTab, /diagnosticExportLoading=\{localData\.diagnosticExportLoading\}/);
  assert.match(localTab, /diagnosticExportPath=\{localData\.diagnosticExportPath\}/);
  assert.match(localTab, /diagnosticExportMessage=\{localData\.diagnosticExportMessage\}/);
  assert.match(localTab, /onExportDiagnosticPackage=\{localData\.exportDiagnosticPackage\}/);
  assert.match(localTab, /onRevealDiagnosticExportPath=\{localData\.revealDiagnosticExportPath\}/);
  assert.match(localTab, /onCopyDiagnosticExportPath=\{localData\.copyDiagnosticExportPath\}/);
});
