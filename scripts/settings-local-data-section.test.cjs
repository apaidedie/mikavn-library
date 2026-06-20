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

test('dashboard local safety links to backup and restore settings', () => {
  const source = read('src/pages/Dashboard/DashboardLocalPanels.tsx');

  assert.match(source, /备份与恢复/);
  assert.match(source, /onOpenSettings\?\.\('local'\)/);
});
