const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('dashboard startup errors expose diagnostic package export', () => {
  const pageSource = read('src/pages/Dashboard/DashboardPage.tsx');
  const noticeSource = read('src/pages/Dashboard/DashboardErrorNotice.tsx');

  assert.match(pageSource, /exportDiagnosticPackage/);
  assert.match(pageSource, /diagnosticExportLoading/);
  assert.match(noticeSource, /导出诊断包/);
  assert.match(noticeSource, /启动或首页读取失败/);
  assert.match(pageSource, /不包含完整数据库、图片缓存或存档文件/);
});

test('dashboard diagnostic export action is available for hard and partial startup errors', () => {
  const source = read('src/pages/Dashboard/DashboardPage.tsx');

  assert.match(source, /DashboardErrorNotice/);
  assert.match(source, /sectionErrors\.map/);
  assert.match(source, /onExportDiagnosticPackage=\{exportDiagnosticPackage\}/);
  assert.match(source, /api\.exportDiagnosticPackage\(\)/);
});

test('dashboard diagnostic export notice can reveal or copy exported path', () => {
  const pageSource = read('src/pages/Dashboard/DashboardPage.tsx');
  const noticeSource = read('src/pages/Dashboard/DashboardErrorNotice.tsx');
  const actionsSource = fs.existsSync(path.join(repoRoot, 'src/components/diagnostics/DiagnosticExportPathActions.tsx'))
    ? read('src/components/diagnostics/DiagnosticExportPathActions.tsx')
    : '';

  assert.match(pageSource, /diagnosticExportPath/);
  assert.match(pageSource, /setDiagnosticExportPath\(report\.path\)/);
  assert.match(pageSource, /api\.revealPath\(diagnosticExportPath\)/);
  assert.match(noticeSource, /diagnosticExportPath/);
  assert.match(noticeSource, /DiagnosticExportPathActions/);
  assert.match(noticeSource, /onCopy=\{\(\) => void navigator\.clipboard\.writeText\(diagnosticExportPath\)\}/);
  assert.match(actionsSource, /export function DiagnosticExportPathActions/);
  assert.match(actionsSource, /打开诊断包位置/);
  assert.match(actionsSource, /复制诊断包路径/);
});
