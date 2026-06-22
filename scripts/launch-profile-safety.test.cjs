const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('launch profile deletion confirmation explains only the profile record is removed', () => {
  const source = fs.readFileSync('src/pages/Library/LaunchProfilesPanel.tsx', 'utf8');

  assert.match(source, /const remove = async \(profile: LaunchProfile\)/);
  assert.match(source, /删除启动配置「\$\{profile\.name\}」/);
  assert.match(source, /只删除这个启动配置记录/);
  assert.match(source, /不会删除游戏记录/);
  assert.match(source, /不会删除真实游戏文件或启动程序/);
  assert.match(source, /api\.deleteLaunchProfile\(profile\.id\)/);
});
