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

test('updater install forwards download progress events', () => {
  const source = read('src/services/updater.ts');

  assert.match(source, /UpdaterInstallProgress/);
  assert.match(source, /onProgress\?:/);
  assert.match(source, /phase: 'backing_up'/);
  assert.match(source, /downloadAndInstall\(\(event\)/);
  assert.match(source, /event\.event === 'Started'/);
  assert.match(source, /event\.event === 'Progress'/);
  assert.match(source, /event\.event === 'Finished'/);
  assert.match(source, /phase: 'installing'/);
});

test('settings and startup update surfaces show install progress text', () => {
  const settings = read('src/pages/Settings/SettingsUpdateSection.tsx');
  const hook = read('src/app/useStartupUpdater.ts');
  const notice = read('src/app/AppUpdateNotice.tsx');
  const app = read('src/app/App.tsx');
  const controller = read('src/app/useAppController.ts');

  assert.match(settings, /installProgress/);
  assert.match(settings, /formatUpdaterInstallProgress/);
  assert.match(settings, /progress/i);
  assert.match(hook, /installProgress/);
  assert.match(hook, /formatUpdaterInstallProgress/);
  assert.match(controller, /useStartupUpdater/);
  assert.match(controller, /startupUpdater/);
  assert.match(notice, /progressText/);
  assert.match(app, /progressText=\{app\.startupUpdater\.installProgress\}/);
});

test('updater install reports backup failure before installing', () => {
  const source = read('src/services/updater.ts');

  assert.match(source, /更新前数据库备份失败/);
  assert.match(source, /已取消安装/);
  assert.match(source, /backupDatabaseBeforeUpdate/);
});

test('updater install failure after backup preserves backup recovery information', () => {
  const updater = read('src/services/updater.ts');
  const model = read('src/services/updaterModel.ts');
  const settings = read('src/pages/Settings/SettingsUpdateSection.tsx');
  const startup = read('src/app/useStartupUpdater.ts');

  assert.match(model, /\{ kind: 'failed'; message: string; backup\?: UpdateProtectionBackupInfo \}/);
  assert.match(updater, /catch \(error\) \{\s*return \{\s*kind: 'failed',\s*message: formatUpdaterError\(error\),\s*backup:/s);
  assert.match(updater, /fileName: backupReport\.fileName/);
  assert.match(settings, /installResult\.kind === 'installed'/);
  assert.match(settings, /installResult\.backup \? \{ fileName: installResult\.backup\.fileName, path: installResult\.backup\.path \} : null/);
  assert.match(startup, /setBackupInfo\(result\.backup \?\? null\)/);
});

test('api exposes backup_database_before_update command', () => {
  const api = read('src/services/api.ts');
  const types = read('src/types/archive.ts');

  assert.match(api, /backupDatabaseBeforeUpdate/);
  assert.match(api, /backup_database_before_update/);
  assert.match(types, /DatabaseUpdateProtectionBackupReport/);
});

test('settings updater prevents duplicate install requests while an install is in flight', () => {
  const settings = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.match(settings, /installInFlightRef/);
  assert.match(settings, /if \(\s*installInFlightRef\.current\s*\|\|\s*state !== 'available'\s*\|\|\s*!update\s*\) return;/);
  assert.match(settings, /installInFlightRef\.current = true/);
  assert.match(settings, /finally \{[\s\S]*installInFlightRef\.current = false;[\s\S]*\}/);
});
