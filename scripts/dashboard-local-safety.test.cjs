const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('dashboard local safety panel exposes an obvious database restore entry', () => {
  const source = read('src/pages/Dashboard/DashboardLocalPanels.tsx');

  assert.match(source, /恢复数据库/);
  assert.match(source, /恢复前自动保护备份/);
  assert.match(source, /RotateCcw/);
  assert.match(source, /onOpenSettings\?\.\('local'\)/);
});

test('dashboard local safety panel routes large backup cleanup to the self-check section', () => {
  const source = read('src/pages/Dashboard/DashboardLocalPanels.tsx');
  const types = read('src/pages/Settings/settingsTypes.ts');
  const localTab = read('src/pages/Settings/SettingsLocalTabContent.tsx');
  const localData = read('src/pages/Settings/SettingsLocalDataSection.tsx');
  const settingsPage = read('src/pages/Settings/SettingsPage.tsx');

  assert.match(source, /backupStatus\.level === 'large'/);
  assert.match(source, />清理旧备份<\/Button>/);
  assert.match(source, /onOpenSettings\?\.\('local', 'local-data-check'\)/);
  assert.match(types, /'local-data-check'/);
  assert.match(settingsPage, /selfCheckFocusKey=\{tabRequest\?\.section === 'local-data-check' \? tabRequest\.key : 0\}/);
  assert.match(localTab, /scrollToLocalDataCheck/);
  assert.match(localTab, /local-data-check-section/);
  assert.match(localData, /id="local-data-check-section"/);
});
