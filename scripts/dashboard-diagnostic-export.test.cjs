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
  const hookSource = read('src/pages/Dashboard/useDashboardDiagnosticExport.ts');

  assert.match(pageSource, /exportDiagnosticPackage/);
  assert.match(pageSource, /diagnosticExportLoading/);
  assert.match(noticeSource, /导出诊断包/);
  assert.match(noticeSource, /启动或首页读取失败/);
  assert.match(hookSource, /不包含完整数据库、图片缓存或存档文件/);
});

test('dashboard diagnostic export action is available for hard and partial startup errors', () => {
  const source = read('src/pages/Dashboard/DashboardPage.tsx');
  const hookSource = read('src/pages/Dashboard/useDashboardDiagnosticExport.ts');

  assert.match(source, /DashboardErrorNotice/);
  assert.match(source, /sectionErrors\.map/);
  assert.match(source, /onExportDiagnosticPackage=\{exportDiagnosticPackage\}/);
  assert.match(source, /useDashboardDiagnosticExport/);
  assert.match(hookSource, /api\.exportDiagnosticPackage\(\)/);
});

test('dashboard local safety panel exposes diagnostic export during normal use', () => {
  const pageSource = read('src/pages/Dashboard/DashboardPage.tsx');
  const localPanelSource = read('src/pages/Dashboard/DashboardLocalPanels.tsx');
  const hookSource = read('src/pages/Dashboard/useDashboardDiagnosticExport.ts');

  assert.match(localPanelSource, /导出诊断包/);
  assert.match(localPanelSource, /diagnosticExportLoading/);
  assert.match(localPanelSource, /diagnosticExportMessage/);
  assert.match(localPanelSource, /diagnosticExportPath/);
  assert.match(localPanelSource, /DiagnosticExportPathActions/);
  assert.match(localPanelSource, /onExportDiagnosticPackage/);
  assert.match(localPanelSource, /onRevealDiagnosticExportPath/);
  assert.match(localPanelSource, /onCopyDiagnosticExportPath/);
  assert.match(pageSource, /copyDashboardDiagnosticExportPath/);
  assert.match(pageSource, /useDashboardDiagnosticExport/);
  assert.match(hookSource, /navigator\.clipboard\.writeText\(diagnosticExportPath\)/);
  assert.match(pageSource, /onExportDiagnosticPackage=\{exportDiagnosticPackage\}/);
  assert.match(pageSource, /onRevealDiagnosticExportPath=\{revealDiagnosticExportPath\}/);
  assert.match(pageSource, /onCopyDiagnosticExportPath=\{\(\) => void copyDashboardDiagnosticExportPath\(\)\}/);
});

test('dashboard diagnostic export notice can reveal or copy exported path', () => {
  const pageSource = read('src/pages/Dashboard/DashboardPage.tsx');
  const noticeSource = read('src/pages/Dashboard/DashboardErrorNotice.tsx');
  const hookSource = read('src/pages/Dashboard/useDashboardDiagnosticExport.ts');
  const actionsSource = fs.existsSync(path.join(repoRoot, 'src/components/diagnostics/DiagnosticExportPathActions.tsx'))
    ? read('src/components/diagnostics/DiagnosticExportPathActions.tsx')
    : '';

  assert.match(pageSource, /diagnosticExportPath/);
  assert.match(hookSource, /setDiagnosticExportPath\(report\.path\)/);
  assert.match(hookSource, /api\.revealPath\(diagnosticExportPath\)/);
  assert.match(noticeSource, /diagnosticExportPath/);
  assert.match(noticeSource, /DiagnosticExportPathActions/);
  assert.match(noticeSource, /onCopy=\{\(\) => void copyDiagnosticExportPath\(\)\}/);
  assert.match(noticeSource, /navigator\.clipboard\.writeText\(diagnosticExportPath\)/);
  assert.match(actionsSource, /export function DiagnosticExportPathActions/);
  assert.match(actionsSource, /打开诊断包位置/);
  assert.match(actionsSource, /复制诊断包路径/);
});

test('dashboard diagnostic export notice reports diagnostic path copy result', () => {
  const noticeSource = read('src/pages/Dashboard/DashboardErrorNotice.tsx');

  assert.match(noticeSource, /useState/);
  assert.match(noticeSource, /diagnosticCopyMessage/);
  assert.match(noticeSource, /copyDiagnosticExportPath/);
  assert.match(noticeSource, /navigator\.clipboard\.writeText\(diagnosticExportPath\)/);
  assert.match(noticeSource, /诊断包路径已复制。/);
  assert.match(noticeSource, /复制诊断包路径失败/);
  assert.match(noticeSource, /role="status"/);
});
