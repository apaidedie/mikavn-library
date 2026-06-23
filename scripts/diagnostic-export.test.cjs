const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const path = require('node:path');
const ts = require('typescript');

function loadDiagnosticRedaction() {
  const sourcePath = path.join(__dirname, '..', 'src', 'utils', 'diagnosticRedaction.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', transpiled);
  fn(module, module.exports);
  return module.exports;
}

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
  const status = fs.readFileSync('src/pages/Maintenance/MaintenanceStatusNotices.tsx', 'utf8');

  assert.match(panel, /导出诊断包/);
  assert.match(panel, /onExportDiagnosticPackage/);
  assert.match(panel, /diagnosticExportLoading/);
  assert.match(actions, /exportDiagnosticPackage/);
  assert.match(actions, /diagnosticExportPath/);
  assert.match(actions, /setDiagnosticExportPath\(report\.path\)/);
  assert.match(actions, /不包含完整数据库、图片缓存或存档文件/);
  assert.match(content, /onExportDiagnosticPackage=\{dataActions\.exportDiagnosticPackage\}/);
  assert.match(status, /DiagnosticExportPathActions/);
  assert.match(status, /diagnosticExportPath/);
  assert.match(status, /onRevealDiagnosticExportPath/);
  assert.match(status, /onCopyDiagnosticExportPath/);
});

test('settings diagnostic export result can reveal or copy exported path', () => {
  const page = fs.readFileSync('src/pages/Settings/SettingsPage.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Settings/useSettingsLocalDataActions.ts', 'utf8');

  assert.match(actions, /diagnosticExportPath/);
  assert.match(actions, /setDiagnosticExportPath\(report\.path\)/);
  assert.match(page, /DiagnosticExportPathActions/);
  assert.match(page, /settings\.localData\.diagnosticExportPath/);
  assert.match(page, /settings\.localData\.revealDiagnosticExportPath/);
  assert.match(page, /settings\.localData\.copyDiagnosticExportPath/);
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
  assert.match(boundary, /redactDiagnosticText\(summary\)/);
});

test('global app error boundary can reveal or copy exported diagnostic path', () => {
  const boundary = fs.readFileSync('src/app/AppErrorBoundary.tsx', 'utf8');
  const actionsPath = 'src/components/diagnostics/DiagnosticExportPathActions.tsx';
  const actions = fs.existsSync(actionsPath) ? fs.readFileSync(actionsPath, 'utf8') : '';

  assert.match(boundary, /exportPath/);
  assert.match(boundary, /report\.path/);
  assert.match(boundary, /api\.revealPath\(this\.state\.exportPath\)/);
  assert.match(boundary, /DiagnosticExportPathActions/);
  assert.match(boundary, /onCopy=\{this\.copyDiagnosticPackagePath\}/);
  assert.match(actions, /export function DiagnosticExportPathActions/);
  assert.match(boundary, /打开诊断包位置/);
  assert.match(boundary, /复制诊断包路径/);
});

test('startup database backup failure notice can export diagnostics and expose the exported path', () => {
  const app = fs.readFileSync('src/app/App.tsx', 'utf8');
  const controller = fs.readFileSync('src/app/useAppController.ts', 'utf8');
  const exportHook = fs.readFileSync('src/app/useStartupDatabaseBackupDiagnosticExport.ts', 'utf8');
  const notice = fs.readFileSync('src/app/AppStartupDatabaseBackupNotice.tsx', 'utf8');
  const actions = fs.readFileSync('src/components/diagnostics/DiagnosticExportPathActions.tsx', 'utf8');

  assert.match(controller, /useStartupDatabaseBackupDiagnosticExport/);
  assert.match(controller, /\.\.\.startupDatabaseBackupDiagnosticExport/);
  assert.match(exportHook, /startupDatabaseBackupDiagnosticExportLoading/);
  assert.match(exportHook, /startupDatabaseBackupDiagnosticExportPath/);
  assert.match(exportHook, /startupDatabaseBackupDiagnosticExportMessage/);
  assert.match(exportHook, /exportStartupDatabaseBackupDiagnosticPackage/);
  assert.match(exportHook, /api\.exportDiagnosticPackage\(\)/);
  assert.match(exportHook, /setStartupDatabaseBackupDiagnosticExportPath\(report\.path\)/);
  assert.match(exportHook, /api\.revealPath\(startupDatabaseBackupDiagnosticExportPath\)/);
  assert.match(app, /diagnosticExportLoading=\{app\.startupDatabaseBackupDiagnosticExportLoading\}/);
  assert.match(app, /diagnosticExportPath=\{app\.startupDatabaseBackupDiagnosticExportPath\}/);
  assert.match(app, /diagnosticExportMessage=\{app\.startupDatabaseBackupDiagnosticExportMessage\}/);
  assert.match(app, /onExportDiagnosticPackage=\{app\.exportStartupDatabaseBackupDiagnosticPackage\}/);
  assert.match(app, /onRevealDiagnosticExportPath=\{app\.revealStartupDatabaseBackupDiagnosticExportPath\}/);
  assert.match(notice, /DiagnosticExportPathActions/);
  assert.match(notice, /导出诊断包/);
  assert.match(actions, /打开诊断包位置/);
  assert.match(actions, /复制诊断包路径/);
});

test('startup database backup failure notice reports diagnostic path copy result', () => {
  const notice = fs.readFileSync('src/app/AppStartupDatabaseBackupNotice.tsx', 'utf8');

  assert.match(notice, /useState/);
  assert.match(notice, /diagnosticCopyMessage/);
  assert.match(notice, /copyDiagnosticExportPath/);
  assert.match(notice, /navigator\.clipboard\.writeText\(diagnosticExportPath\)/);
  assert.match(notice, /诊断包路径已复制。/);
  assert.match(notice, /复制诊断包路径失败/);
  assert.match(notice, /role="status"/);
});

test('startup self-check warning notice can open maintenance and export diagnostics', () => {
  const app = fs.readFileSync('src/app/App.tsx', 'utf8');
  const controller = fs.readFileSync('src/app/useAppController.ts', 'utf8');
  const hook = fs.readFileSync('src/app/useStartupSelfCheck.ts', 'utf8');
  const notice = fs.readFileSync('src/app/AppStartupSelfCheckNotice.tsx', 'utf8');

  assert.match(controller, /useStartupSelfCheck/);
  assert.match(controller, /\.\.\.startupSelfCheck/);
  assert.match(hook, /getStartupAppDataDiagnostics\(\)/);
  assert.match(hook, /diagnostics\.warnings/);
  assert.match(hook, /!diagnostics\.database\.quickCheckOk/);
  assert.match(hook, /startupSelfCheckWarnings/);
  assert.match(hook, /startupSelfCheckError/);
  assert.match(hook, /exportStartupSelfCheckDiagnosticPackage/);
  assert.match(hook, /api\.exportDiagnosticPackage\(\)/);
  assert.match(hook, /revealStartupSelfCheckDiagnosticExportPath/);
  assert.match(app, /AppStartupSelfCheckNotice/);
  assert.match(app, /startupSelfCheckWarnings=\{app\.startupSelfCheckWarnings\}/);
  assert.match(app, /onOpenMaintenance=\{\(\) => app\.openMaintenance\(\)\}/);
  assert.match(app, /onOpenLocalData=\{\(\) => app\.openSettings\('local', 'database-restore'\)\}/);
  assert.match(notice, /启动自检发现问题/);
  assert.match(notice, /打开维护中心/);
  assert.match(notice, /打开本地数据/);
  assert.match(notice, /onOpenLocalData/);
  assert.match(notice, /导出诊断包/);
  assert.match(notice, /DiagnosticExportPathActions/);
  assert.match(notice, /navigator\.clipboard\.writeText\(diagnosticExportPath\)/);
  assert.match(notice, /role="status"/);
});

test('startup self-check warning notice can copy a concise diagnostic summary', () => {
  const notice = fs.readFileSync('src/app/AppStartupSelfCheckNotice.tsx', 'utf8');

  assert.match(notice, /copyStartupSelfCheckSummary/);
  assert.match(notice, /MikaVN 启动自检摘要/);
  assert.match(notice, /startupSelfCheckWarnings\.join\('\\n'\)/);
  assert.match(notice, /navigator\.clipboard\.writeText\(redactDiagnosticText\(summary\)\)/);
  assert.match(notice, /复制自检摘要/);
  assert.match(notice, /自检摘要已复制。/);
  assert.match(notice, /复制自检摘要失败/);
});

test('frontend diagnostic redaction removes secrets and Windows user names before clipboard copy', () => {
  const { redactDiagnosticText } = loadDiagnosticRedaction();
  const text = [
    String.raw`Error: token:abc password=hunter2 API_KEY=apiSecretValue`,
    String.raw`OAuth: access_token=access123 refresh_token=refresh456 client_secret=client789`,
    String.raw`Header: Authorization: Bearer bearer-token-value`,
    String.raw`at run (C:\Users\alice\AppData\Local\MikaVN\main.js:12:3)`,
    String.raw`at query (C:/Users/bob/AppData/Roaming/MikaVN/token-cache.json:1:1)`,
  ].join('\n');
  const redacted = redactDiagnosticText(text);

  assert.match(redacted, /\[redacted\]/);
  assert.match(redacted, /C:\\Users\\\[user\]\\AppData/);
  assert.match(redacted, /C:\/Users\/\[user\]\/AppData/);
  assert.doesNotMatch(redacted, /abc|hunter2|apiSecretValue|access123|refresh456|client789|bearer-token-value|alice|bob/);
});
