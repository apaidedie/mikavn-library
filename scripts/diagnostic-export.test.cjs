const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('diagnostic export command is registered and exposed through api', () => {
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/diagnostics.rs', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const types = fs.readFileSync('src/types/archive.ts', 'utf8');
  const mock = fs.readFileSync('src/services/mockStoreDiagnostics.ts', 'utf8');

  assert.match(lib, /commands::diagnostics::export_diagnostic_package/);
  assert.match(commands, /pub fn export_diagnostic_package/);
  assert.match(api, /exportDiagnosticPackage\(\)/);
  assert.match(api, /command<DiagnosticExportReport>\('export_diagnostic_package'/);
  assert.match(types, /export type DiagnosticExportReport/);
  assert.match(mock, /exportDiagnosticPackage\(\): Promise<DiagnosticExportReport>/);
});

test('maintenance data panel exposes safe diagnostic export action', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceDataLocationPanel.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceDataActions.ts', 'utf8');
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');

  assert.match(panel, /导出诊断包/);
  assert.match(panel, /onExportDiagnosticPackage/);
  assert.match(panel, /diagnosticExportLoading/);
  assert.match(actions, /exportDiagnosticPackage/);
  assert.match(actions, /不包含完整数据库、图片缓存或存档文件/);
  assert.match(content, /onExportDiagnosticPackage=\{dataActions\.exportDiagnosticPackage\}/);
});

test('global app error boundary exposes diagnostic package export after render crashes', () => {
  const main = fs.readFileSync('src/main.tsx', 'utf8');
  const boundary = fs.readFileSync('src/app/AppErrorBoundary.tsx', 'utf8');

  assert.match(main, /AppErrorBoundary/);
  assert.match(main, /<AppErrorBoundary>\s*<App \/>/s);
  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /启动或界面渲染失败/);
  assert.match(boundary, /导出诊断包/);
  assert.match(boundary, /api\.exportDiagnosticPackage\(\)/);
  assert.match(boundary, /不包含完整数据库、图片缓存或存档文件/);
  assert.match(boundary, /componentStack/);
  assert.match(boundary, /copyErrorSummary/);
  assert.match(boundary, /复制错误摘要/);
  assert.match(boundary, /navigator\.clipboard\.writeText/);
});

test('global app error boundary can reveal or copy exported diagnostic path', () => {
  const boundary = fs.readFileSync('src/app/AppErrorBoundary.tsx', 'utf8');

  assert.match(boundary, /exportPath/);
  assert.match(boundary, /report\.path/);
  assert.match(boundary, /api\.revealPath\(this\.state\.exportPath\)/);
  assert.match(boundary, /navigator\.clipboard\.writeText\(this\.state\.exportPath\)/);
  assert.match(boundary, /打开诊断包位置/);
  assert.match(boundary, /复制诊断包路径/);
});
