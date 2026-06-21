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
  assert.match(notice, /navigator\.clipboard\.writeText\(error\)/);
  assert.match(notice, /navigator\.clipboard\.writeText\(updaterFallbackDownloadUrl\)/);
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

test('startup updater prevents duplicate install requests while an install is in flight', () => {
  const hook = read('src/app/useStartupUpdater.ts');

  assert.match(hook, /installInFlightRef/);
  assert.match(hook, /if \(\s*installInFlightRef\.current\s*\|\|\s*installed\s*\|\|\s*!update\s*\) return;/);
  assert.match(hook, /installInFlightRef\.current = true/);
  assert.match(hook, /finally \{[\s\S]*installInFlightRef\.current = false;[\s\S]*\}/);
});
