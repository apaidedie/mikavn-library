const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourcePath = path.join(__dirname, 'page-qa-runner.cjs');

test('page QA routes asset cache maintenance through image health', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /waitForImageHealthWorkflow/);
  assert.match(source, /getByRole\('button', \{ name: \/图片健康\/ \}\)/);
  assert.match(source, /一键安全整理/);
  assert.doesNotMatch(source, /getByRole\('button', \{ name: \/清理缓存\/ \}\)/);
  assert.doesNotMatch(source, /缓存清理\(\?:完成\|预览完成\)/);
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

test('page QA returns from image health with a disambiguated library nav helper', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /async function openLibrary\(page\)/);
  assert.match(source, /openLibrary\(page\)/);
  assert.doesNotMatch(source, /getByLabel\('游戏库'/);
});

test('dashboard populated QA returns home before taking dashboard screenshot', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const caseStart = source.indexOf("['dashboard-populated'");
  const nextCase = source.indexOf("['dashboard-task-shortcuts'", caseStart);
  const dashboardCase = source.slice(caseStart, nextCase);
  const afterRestoreClick = dashboardCase.slice(dashboardCase.indexOf("getByRole('button', { name: /恢复数据库/ }).click()"));

  assert.match(source, /async function openHome\(page\)/);
  assert.doesNotMatch(source, /getByLabel\('首页'\)/);
  assert.match(dashboardCase, /getByRole\('button', \{ name: \/恢复数据库\/ \}\)\.click\(\)/);
  assert.match(afterRestoreClick, /openHome\(page\);[\s\S]*getByText\('今日状态'\)\.first\(\)\.waitFor/);
});

test('maintenance result QA verifies game shortcuts leave the library as the current page', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const caseStart = source.indexOf("['maintenance-health-description-repair'");
  const nextCase = source.indexOf("['maintenance-health-metadata-match'", caseStart);
  const maintenanceCase = source.slice(caseStart, nextCase);
  const afterGameShortcut = maintenanceCase.slice(maintenanceCase.indexOf("getByRole('button', { name: /^游戏$/ }).click()"));

  assert.match(afterGameShortcut, /localStorage\.getItem\('mikavn\.currentView'\)[\s\S]*!== 'library'/);
  assert.match(afterGameShortcut, /getByRole\('button', \{ name: '游戏库' \}\)[\s\S]*getAttribute\('aria-current'\)/);
  assert.match(afterGameShortcut, /getByRole\('button', \{ name: '维护' \}\)[\s\S]*getAttribute\('aria-current'\)/);
});
