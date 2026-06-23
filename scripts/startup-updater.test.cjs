const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('startup updater hook checks once and only exposes available updates', () => {
  const hook = read('src/app/useStartupUpdater.ts');

  assert.match(hook, /checkForAppUpdate/);
  assert.match(hook, /useEffect/);
  assert.match(hook, /result\.kind === 'available'/);
  assert.match(hook, /dismissStartupUpdate/);
  assert.match(hook, /installStartupUpdate/);
  assert.match(hook, /restartStartupUpdate/);
});

test('app renders non-blocking update notice before routes', () => {
  const app = read('src/app/App.tsx');
  const controller = read('src/app/useAppController.ts');
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(controller, /useStartupUpdater/);
  assert.match(controller, /startupUpdateNotice/);
  assert.match(app, /useAppController/);
  assert.match(app, /AppUpdateNotice/);
  assert.ok(app.indexOf('<AppUpdateNotice') < app.indexOf('<AppRoutes'), 'notice should render before routes');
  assert.match(notice, /发现新版本/);
  assert.match(notice, /下载并安装/);
  assert.match(notice, /重启应用/);
  assert.match(notice, /本次忽略/);
});

test('startup update notice exposes fallback download link after install errors', () => {
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(notice, /updaterFallbackDownloadUrl/);
  assert.match(notice, /备用下载页面/);
  assert.match(notice, /复制备用链接/);
  assert.match(notice, /target="_blank"/);
  assert.match(notice, /rel="noreferrer"/);
  assert.match(notice, /复制错误/);
  assert.match(notice, /navigator\.clipboard\.writeText\(text\)/);
  assert.doesNotMatch(notice, /copyUpdateRecoveryText\(error/);
  assert.match(notice, /formatUpdaterRecoveryText/);
  assert.match(notice, /copyUpdateRecoveryText\(formatUpdaterRecoveryText\(\{ errorText: error, backup: backupInfo \}\), '已复制更新错误。'\)/);
  assert.match(notice, /copyUpdateRecoveryText\(updaterFallbackDownloadUrl/);
  assert.match(notice, /copyUpdateRecoveryText/);
  assert.match(notice, /已复制更新错误。/);
  assert.match(notice, /已复制备用下载链接。/);
  assert.match(notice, /recoveryActionMessage/);
});

test('startup update notice switches banner tone after install errors', () => {
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(notice, /noticeToneClassName/);
  assert.match(notice, /noticeMutedTextClassName/);
  assert.match(notice, /noticeActionLinkClassName/);
  assert.match(notice, /error\s*\?/);
  assert.match(notice, /border-amber-300\/25 bg-amber-500\/10 text-amber-50/);
  assert.match(notice, /text-amber-100\/85/);
  assert.match(notice, /text-amber-50 underline underline-offset-2/);
  assert.match(notice, /border-emerald-300\/20 bg-emerald-500\/10 text-emerald-50/);
  assert.match(notice, /text-emerald-100\/80/);
  assert.match(notice, /text-emerald-50 underline underline-offset-2/);
  assert.match(notice, /className=\{`border-b \$\{noticeToneClassName\} px-4 py-2 text-sm`\}/);
  assert.match(notice, /className=\{`truncate text-xs \$\{noticeMutedTextClassName\}`\}/);
  assert.match(notice, /className=\{`inline-flex items-center gap-1 text-xs \$\{noticeActionLinkClassName\}`\}/);
});

test('startup update notice title reflects install state', () => {
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(notice, /noticeTitle/);
  assert.match(notice, /error\s*\?\s*'更新安装需要处理'/);
  assert.match(notice, /installed\s*\?\s*'更新已安装'/);
  assert.match(notice, /`发现新版本 \$\{notice\.version\}`/);
  assert.match(notice, /<p className="font-medium">\{noticeTitle\}<\/p>/);
});

test('startup update notice keeps a public manual download link visible before failures', () => {
  const notice = read('src/app/AppUpdateNotice.tsx');
  const manualDownloadIndex = notice.indexOf('手动下载最新版');
  const errorBlockIndex = notice.indexOf('{error &&');

  assert.ok(manualDownloadIndex > -1, 'startup update notice must expose a manual public download link');
  assert.ok(errorBlockIndex > -1, 'error-specific fallback block should still exist');
  assert.ok(manualDownloadIndex > errorBlockIndex, 'manual public download link should be rendered outside the error-only fallback block');
  assert.match(notice, /href=\{updaterFallbackDownloadUrl\}/);
});

test('startup update notice uses recovery hints and reports restart failures', () => {
  const hook = read('src/app/useStartupUpdater.ts');
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(hook, /formatUpdaterError/);
  assert.match(hook, /重启应用失败/);
  assert.match(notice, /createUpdaterRecoveryHint/);
  assert.match(notice, /recoveryHint\?\.title/);
  assert.match(notice, /recoveryHint\?\.guidance/);
  assert.match(notice, /showFallbackDownload/);
});

test('startup update notice shows pre-update backup after successful install', () => {
  const hook = read('src/app/useStartupUpdater.ts');
  const notice = read('src/app/AppUpdateNotice.tsx');
  const app = read('src/app/App.tsx');

  assert.match(hook, /backupInfo/);
  assert.match(hook, /result\.backup/);
  assert.match(notice, /backupInfo/);
  assert.match(notice, /更新前数据库备份/);
  assert.match(notice, /backupInfo\.fileName/);
  assert.match(app, /backupInfo=\{app\.startupUpdater\.backupInfo\}/);
});

test('startup update notice can reveal or copy pre-update backup path', () => {
  const hook = read('src/app/useStartupUpdater.ts');
  const notice = read('src/app/AppUpdateNotice.tsx');
  const app = read('src/app/App.tsx');

  assert.match(hook, /api\.revealPath\(backupInfo\.path\)/);
  assert.match(hook, /navigator\.clipboard\.writeText\(backupInfo\.path\)/);
  assert.match(hook, /revealStartupBackupPath/);
  assert.match(hook, /copyStartupBackupPath/);
  assert.match(hook, /backupActionMessage/);
  assert.match(notice, /打开备份位置/);
  assert.match(notice, /复制备份路径/);
  assert.match(notice, /backupActionMessage/);
  assert.match(app, /backupActionMessage=\{app\.startupUpdater\.backupActionMessage\}/);
  assert.match(app, /onRevealBackup=\{app\.startupUpdater\.revealStartupBackupPath\}/);
  assert.match(app, /onCopyBackupPath=\{app\.startupUpdater\.copyStartupBackupPath\}/);
});

test('startup update notice keeps backup actions visible after failed installs', () => {
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(notice, /\{backupInfo && \(/);
  assert.doesNotMatch(notice, /\{installed && backupInfo && \(/);
  const backupBlock = notice.slice(notice.indexOf('{backupInfo && ('), notice.indexOf('{backupActionMessage'));
  assert.match(backupBlock, /更新前数据库备份/);
  assert.match(backupBlock, /打开备份位置/);
  assert.match(backupBlock, /复制备份路径/);
});

test('startup update notice links failed update backups to database restore workflow', () => {
  const notice = read('src/app/AppUpdateNotice.tsx');
  const app = read('src/app/App.tsx');
  const appControllerSource = [
    read('src/app/useAppController.ts'),
    read('src/app/useAppNavigationController.ts'),
    read('src/app/useAppNavigationRequests.ts'),
  ].join('\n');

  assert.match(notice, /onOpenDatabaseRestore/);
  assert.match(notice, /去恢复数据库/);
  assert.match(notice, /backupInfo && error/);
  assert.match(app, /onOpenDatabaseRestore=\{app\.openDatabaseRestore\}/);
  assert.match(appControllerSource, /openDatabaseRestore/);
  assert.match(appControllerSource, /openSettings\('local', 'database-restore'\)/);
});

test('startup updater prevents duplicate install requests while an install is in flight', () => {
  const hook = read('src/app/useStartupUpdater.ts');

  assert.match(hook, /installInFlightRef/);
  assert.match(hook, /if \(\s*installInFlightRef\.current\s*\|\|\s*installed\s*\|\|\s*!update\s*\) return;/);
  assert.match(hook, /installInFlightRef\.current = true/);
  assert.match(hook, /finally \{[\s\S]*installInFlightRef\.current = false;[\s\S]*\}/);
});

test('startup update failures can export diagnostics and expose the exported package path', () => {
  const hook = read('src/app/useStartupUpdater.ts');
  const notice = read('src/app/AppUpdateNotice.tsx');
  const app = read('src/app/App.tsx');

  assert.match(hook, /startupUpdateDiagnosticExportLoading/);
  assert.match(hook, /startupUpdateDiagnosticExportPath/);
  assert.match(hook, /startupUpdateDiagnosticExportMessage/);
  assert.match(hook, /exportStartupUpdateDiagnosticPackage/);
  assert.match(hook, /api\.exportDiagnosticPackage\(\)/);
  assert.match(hook, /setStartupUpdateDiagnosticExportPath\(report\.path\)/);
  assert.match(hook, /api\.revealPath\(startupUpdateDiagnosticExportPath\)/);
  assert.match(hook, /navigator\.clipboard\.writeText\(startupUpdateDiagnosticExportPath\)/);
  assert.match(notice, /DiagnosticExportPathActions/);
  assert.match(notice, /导出诊断包/);
  assert.match(app, /diagnosticExportLoading=\{app\.startupUpdater\.startupUpdateDiagnosticExportLoading\}/);
  assert.match(app, /diagnosticExportPath=\{app\.startupUpdater\.startupUpdateDiagnosticExportPath\}/);
  assert.match(app, /diagnosticExportMessage=\{app\.startupUpdater\.startupUpdateDiagnosticExportMessage\}/);
  assert.match(app, /onExportDiagnosticPackage=\{app\.startupUpdater\.exportStartupUpdateDiagnosticPackage\}/);
  assert.match(app, /onRevealDiagnosticExportPath=\{app\.startupUpdater\.revealStartupUpdateDiagnosticExportPath\}/);
  assert.match(app, /onCopyDiagnosticExportPath=\{app\.startupUpdater\.copyStartupUpdateDiagnosticExportPath\}/);
});
