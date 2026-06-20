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
