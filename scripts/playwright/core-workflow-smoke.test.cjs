const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourcePath = path.join(__dirname, 'core-workflow-smoke.cjs');

test('core workflow smoke targets advanced search by label instead of broad placeholders', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /getByRole\('textbox', \{ name: '关键词或条件' \}\)/);
  assert.doesNotMatch(source, /getByPlaceholder\(\/输入标题\|关键词\|快捷搜索\/\)/);
});

test('core workflow smoke accepts asset cache cleanup preview or completion messages', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /waitForAssetCacheCleanupResult/);
  assert.match(source, /缓存清理\(\?:完成\|预览完成\)/);
  assert.doesNotMatch(source, /expectText\(page, \/缓存清理完成\/\)/);
});
