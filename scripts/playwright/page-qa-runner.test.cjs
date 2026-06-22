const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourcePath = path.join(__dirname, 'page-qa-runner.cjs');

test('page QA accepts asset cache cleanup preview or cleanup completion messages', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /waitForAssetCacheCleanupResult/);
  assert.match(source, /缓存清理\(\?:完成\|预览完成\)/);
  assert.doesNotMatch(source, /getByText\(\/缓存清理完成\/\)\.first\(\)\.waitFor/);
});

test('advanced search QA uses the field label instead of broad placeholder matching', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /getByRole\('textbox', \{ name: '关键词或条件' \}\)/);
  assert.doesNotMatch(source, /getByPlaceholder\(\/输入标题\|关键词\|快捷搜索\/\)/);
});

test('library detail QA verifies copyable image diagnostics', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /复制图片诊断/);
  assert.match(source, /copiedImageDiagnostic/);
  assert.match(source, /MikaVN 图片诊断/);
  assert.match(source, /简介图片：1 张引用/);
  assert.match(source, /维护入口：维护中心 -> 图片健康 \/ 图片引用审计/);
  assert.match(source, /已复制图片诊断信息/);
});
