const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourcePath = path.join(__dirname, 'page-qa-runner.cjs');
const helperPath = path.join(__dirname, 'page-qa-runner-helpers.cjs');
const dashboardCasesPath = path.join(__dirname, 'page-qa-dashboard-cases.cjs');
const libraryCasesPath = path.join(__dirname, 'page-qa-library-cases.cjs');
const maintenanceCasesPath = path.join(__dirname, 'page-qa-maintenance-cases.cjs');
const reportsCasesPath = path.join(__dirname, 'page-qa-reports-cases.cjs');
const savesCasesPath = path.join(__dirname, 'page-qa-saves-cases.cjs');

test('page QA routes asset cache maintenance through image health', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const librarySource = fs.readFileSync(libraryCasesPath, 'utf8');

  assert.match(librarySource, /waitForImageHealthWorkflow/);
  assert.match(source, /page-qa-runner-helpers\.cjs/);
  assert.match(helper, /waitForImageHealthWorkflow/);
  assert.match(librarySource, /getByRole\('button', \{ name: \/图片健康\/ \}\)/);
  assert.match(helper, /一键安全整理/);
  assert.doesNotMatch(source, /getByRole\('button', \{ name: \/清理缓存\/ \}\)/);
  assert.doesNotMatch(source, /缓存清理\(\?:完成\|预览完成\)/);
});

test('advanced search QA uses the field label instead of broad placeholder matching', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /getByRole\('textbox', \{ name: '关键词或条件' \}\)/);
  assert.doesNotMatch(source, /getByPlaceholder\(\/输入标题\|关键词\|快捷搜索\/\)/);
});

test('library detail QA verifies copyable image diagnostics', () => {
  const librarySource = fs.readFileSync(libraryCasesPath, 'utf8');

  assert.match(librarySource, /复制图片诊断/);
  assert.match(librarySource, /copiedImageDiagnostic/);
  assert.match(librarySource, /MikaVN 图片诊断/);
  assert.match(librarySource, /简介图片：1 张引用/);
  assert.match(librarySource, /维护入口：维护中心 -> 图片健康 \/ 图片引用审计/);
  assert.match(librarySource, /已复制图片诊断信息/);
});

test('page QA returns from image health with a disambiguated library nav helper', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const librarySource = fs.readFileSync(libraryCasesPath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');

  assert.match(helper, /async function openLibrary\(page\)/);
  assert.match(librarySource, /openLibrary\(page\)/);
  assert.doesNotMatch(source, /getByLabel\('游戏库'/);
});

test('dashboard populated QA returns home before taking dashboard screenshot', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const dashboardSource = fs.readFileSync(dashboardCasesPath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');
  const caseStart = dashboardSource.indexOf("['dashboard-populated'");
  const nextCase = dashboardSource.indexOf("['dashboard-task-shortcuts'", caseStart);
  const dashboardCase = dashboardSource.slice(caseStart, nextCase);
  const afterRestoreClick = dashboardCase.slice(dashboardCase.indexOf("getByRole('button', { name: /恢复数据库/ }).click()"));

  assert.match(helper, /async function openHome\(page\)/);
  assert.doesNotMatch(source, /getByLabel\('首页'\)/);
  assert.match(dashboardCase, /getByRole\('button', \{ name: \/恢复数据库\/ \}\)\.click\(\)/);
  assert.match(afterRestoreClick, /openHome\(page\);[\s\S]*getByText\('今日状态'\)\.first\(\)\.waitFor/);
});

test('maintenance result QA verifies game shortcuts leave the library as the current page', () => {
  const maintenanceSource = fs.readFileSync(maintenanceCasesPath, 'utf8');
  const caseStart = maintenanceSource.indexOf("['maintenance-health-description-repair'");
  const nextCase = maintenanceSource.indexOf("['maintenance-health-metadata-match'", caseStart);
  const maintenanceCase = maintenanceSource.slice(caseStart, nextCase);
  const afterGameShortcut = maintenanceCase.slice(maintenanceCase.indexOf("getByRole('button', { name: /^游戏$/ }).click()"));

  assert.match(afterGameShortcut, /localStorage\.getItem\('mikavn\.currentView'\)[\s\S]*!== 'library'/);
  assert.match(afterGameShortcut, /getByRole\('button', \{ name: '游戏库' \}\)[\s\S]*getAttribute\('aria-current'\)/);
  assert.match(afterGameShortcut, /getByRole\('button', \{ name: '维护' \}\)[\s\S]*getAttribute\('aria-current'\)/);
});

test('settings local path QA lives in helper instead of the main runner', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const helper = fs.readFileSync(helperPath, 'utf8');

  assert.match(helper, /async function verifySettingsLocalDataPathActions\(page\)/);
  assert.match(helper, /目录位置速览/);
  assert.match(helper, /复制全部目录路径/);
  assert.match(helper, /打开诊断日志/);
  assert.match(source, /verifySettingsLocalDataPathActions\(page\)/);
  assert.doesNotMatch(source, /const copiedDirectorySummary = await page\.evaluate/);
  assert.doesNotMatch(source, /const copiedDiagnosticLogPath = await page\.evaluate/);
});

test('library page QA cases live in a focused scenario module', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const librarySource = fs.readFileSync(libraryCasesPath, 'utf8');

  assert.match(source, /page-qa-library-cases\.cjs/);
  assert.match(source, /\.\.\.libraryPageQaCases/);
  assert.match(librarySource, /library-populated-detail-artwork/);
  assert.match(librarySource, /library bulk edit did not update selected games/);
  assert.match(librarySource, /library-detail-image-audit/);
  assert.match(librarySource, /library-empty/);
  assert.doesNotMatch(source, /\['library-populated-detail-artwork'/);
  assert.doesNotMatch(source, /\['library-bulk-edit-safety'/);
  assert.doesNotMatch(source, /\['library-detail-image-audit'/);
});

test('maintenance page QA cases live in a focused scenario module', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const maintenanceSource = fs.readFileSync(maintenanceCasesPath, 'utf8');

  assert.match(source, /page-qa-maintenance-cases\.cjs/);
  assert.match(source, /\.\.\.maintenancePageQaCases/);
  assert.match(maintenanceSource, /maintenance-health-description-repair/);
  assert.match(maintenanceSource, /maintenance-health-metadata-match/);
  assert.match(maintenanceSource, /maintenance-health-artwork-repair/);
  assert.match(maintenanceSource, /maintenance-health-duplicate-id-audit/);
  assert.match(maintenanceSource, /duplicate merge did not move assets to target/);
  assert.doesNotMatch(source, /\['maintenance-health-description-repair'/);
  assert.doesNotMatch(source, /\['maintenance-health-metadata-match'/);
  assert.doesNotMatch(source, /\['maintenance-health-artwork-repair'/);
  assert.doesNotMatch(source, /\['maintenance-health-duplicate-id-audit'/);
});

test('saves page QA cases live in a focused data-safety scenario module', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const savesSource = fs.readFileSync(savesCasesPath, 'utf8');

  assert.match(source, /page-qa-saves-cases\.cjs/);
  assert.match(source, /\.\.\.savesPageQaCases/);
  assert.match(savesSource, /saves-backup-restore/);
  assert.match(savesSource, /保护备份/);
  assert.match(savesSource, /page QA save restore flows did not create protection backup records/);
  assert.match(savesSource, /page QA mirror save restore task did not log the protection backup/);
  assert.doesNotMatch(source, /\['saves-backup-restore'/);
});

test('reports page QA cases live in a focused reporting scenario module', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const reportsSource = fs.readFileSync(reportsCasesPath, 'utf8');

  assert.match(source, /page-qa-reports-cases\.cjs/);
  assert.match(source, /\.\.\.reportsPageQaCases/);
  assert.match(reportsSource, /reports-populated/);
  assert.match(reportsSource, /reports-privacy-filter-disabled/);
  assert.match(reportsSource, /reports-actionable-gaps-open-library/);
  assert.match(reportsSource, /reports-export-gap-examples/);
  assert.match(reportsSource, /reports markdown export did not log missing description image examples/);
  assert.doesNotMatch(source, /\['reports-populated'/);
  assert.doesNotMatch(source, /\['reports-actionable-gaps-open-library'/);
  assert.doesNotMatch(source, /\['reports-export-gap-examples'/);
});
