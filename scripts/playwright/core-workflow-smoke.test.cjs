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

test('core workflow smoke routes asset cache maintenance through image health', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /waitForImageHealthWorkflow/);
  assert.match(source, /getByRole\('button', \{ name: \/图片健康\/ \}\)/);
  assert.match(source, /一键安全整理/);
  assert.doesNotMatch(source, /getByRole\('button', \{ name: \/清理缓存\/ \}\)/);
  assert.doesNotMatch(source, /缓存清理\(\?:完成\|预览完成\)/);
});
