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
