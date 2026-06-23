const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { DEFAULT_SOURCE_BUDGETS, checkSourceSize } = require('./check-source-size.cjs');

function createSourceFile(contents) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-source-size-'));
  const filePath = path.join(root, 'mockStore.ts');
  fs.writeFileSync(filePath, contents, 'utf8');
  return { filePath, root };
}

test('checkSourceSize passes when watched files stay within byte and line budgets', () => {
  const { filePath, root } = createSourceFile('const ok = true;\n');

  const result = checkSourceSize({
    rootDir: root,
    budgets: [{ filePath, maxBytes: 128, maxLines: 4 }],
  });

  assert.equal(result.checkedFiles.length, 1);
  assert.deepEqual(result.oversizedFiles, []);
  assert.equal(result.checkedFiles[0].lineCount, 1);
});

test('checkSourceSize rejects files that exceed configured budgets', () => {
  const { filePath, root } = createSourceFile('a\nb\nc\n');

  assert.throws(
    () => checkSourceSize({
      rootDir: root,
      budgets: [{ filePath, maxBytes: 4, maxLines: 2 }],
    }),
    /source files exceed size budget: mockStore\.ts 6 bytes > 4 bytes, 3 lines > 2 lines/,
  );
});

test('default source budgets cover frontend, Rust service, and smoke runner hot spots', () => {
  const watchedPaths = DEFAULT_SOURCE_BUDGETS
    .map((budget) => budget.filePath.replace(/\\/g, '/'))
    .join('\n');

  for (const expectedPath of [
    'src/app/App.tsx',
    'src/app/AppChrome.tsx',
    'src/app/AppErrorBoundary.tsx',
    'src/app/AppRoutes.tsx',
    'src/app/appNavigation.ts',
    'src/app/useAppController.ts',
    'src/app/useAppNavigationController.ts',
    'src/app/useAppNavigationRequests.ts',
    'src/app/useAppKeyboardShortcuts.ts',
    'src/app/useAppThemeSettings.ts',
    'src/services/mockStore.ts',
    'src/pages/Dashboard/DashboardPage.tsx',
    'src/pages/Dashboard/useDashboardPageData.ts',
    'src/pages/Library/LibraryPage.tsx',
    'src/pages/Library/useLibraryPageController.ts',
    'src/pages/Library/LibrarySidebar.tsx',
    'src/pages/Library/LibraryResizeHandle.tsx',
    'src/pages/Library/GameForm.tsx',
    'src/pages/Library/GameDetailMedia.tsx',
    'src/pages/Tasks/TasksPage.tsx',
    'src/pages/Scanner/ScannerPage.tsx',
    'src/pages/Metadata/BatchMetadataPage.tsx',
    'src/pages/Saves/SavesPage.tsx',
    'src/pages/Maintenance/MaintenanceImageAuditPanel.tsx',
    'src/pages/Maintenance/ImageHealthSummaryPanel.tsx',
    'src/pages/Maintenance/ImageHealthSamplePanels.tsx',
    'src/pages/Maintenance/ImageAuditDetailPanel.tsx',
    'src/pages/Maintenance/imageAuditDetailModel.ts',
    'src-tauri/src/services/archives.rs',
    'src-tauri/src/services/backups.rs',
    'src-tauri/src/services/diagnostics.rs',
    'src-tauri/src/services/image_health.rs',
    'src-tauri/src/db/game_merge_ext.rs',
    'scripts/playwright/page-qa-runner.cjs',
    'scripts/playwright/page-qa-runner-helpers.cjs',
    'scripts/playwright/page-qa-dashboard-cases.cjs',
    'scripts/playwright/page-qa-scanner-cases.cjs',
    'scripts/playwright/page-qa-fixtures.cjs',
  ]) {
    assert.match(watchedPaths, new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('page QA runner budget keeps shared helpers outside the scenario file', () => {
  const runnerBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('scripts/playwright/page-qa-runner.cjs'));
  const helperBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('scripts/playwright/page-qa-runner-helpers.cjs'));
  const dashboardBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('scripts/playwright/page-qa-dashboard-cases.cjs'));
  const scannerBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('scripts/playwright/page-qa-scanner-cases.cjs'));

  assert.ok(runnerBudget);
  assert.ok(helperBudget);
  assert.ok(dashboardBudget);
  assert.ok(scannerBudget);
  assert.ok(runnerBudget.maxBytes <= 96 * 1024);
  assert.ok(helperBudget.maxLines <= 240);
  assert.ok(dashboardBudget.maxLines <= 140);
  assert.ok(scannerBudget.maxLines <= 180);
});

test('page QA runner delegates broad workflow cases to focused scenario modules', () => {
  const runner = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'playwright', 'page-qa-runner.cjs'), 'utf8');
  const dashboardCasesPath = path.join(__dirname, '..', '..', 'scripts', 'playwright', 'page-qa-dashboard-cases.cjs');
  const scannerCasesPath = path.join(__dirname, '..', '..', 'scripts', 'playwright', 'page-qa-scanner-cases.cjs');

  assert.match(runner, /const \{ dashboardPageQaCases \} = require\('\.\/page-qa-dashboard-cases\.cjs'\);/);
  assert.match(runner, /const \{ runScannerPageQaCases \} = require\('\.\/page-qa-scanner-cases\.cjs'\);/);
  assert.match(runner, /\.\.\.dashboardPageQaCases,/);
  assert.match(runner, /await runScannerPageQaCases\(browser\);/);
  assert.doesNotMatch(runner, /dashboard-task-shortcuts/);
  assert.doesNotMatch(runner, /dashboard-mobile/);
  assert.doesNotMatch(runner, /scanner-skip-import-audit/);
  assert.doesNotMatch(runner, /scanner-duplicate-import-audit/);
  assert.ok(fs.existsSync(dashboardCasesPath));
  assert.ok(fs.existsSync(scannerCasesPath));
});

test('maintenance page budget keeps page-level orchestration small', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Maintenance/MaintenancePage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 280);
});

test('maintenance image health budgets keep summary rendering outside the audit shell', () => {
  const panelBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx'));
  const summaryBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Maintenance/ImageHealthSummaryPanel.tsx'));
  const sampleBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Maintenance/ImageHealthSamplePanels.tsx'));

  assert.ok(panelBudget);
  assert.ok(summaryBudget);
  assert.ok(sampleBudget);
  assert.ok(panelBudget.maxLines <= 150);
  assert.ok(summaryBudget.maxLines <= 170);
  assert.ok(sampleBudget.maxLines <= 140);
});

test('app shell budget keeps entry routing outside the main shell', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/app/App.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 180);
});

test('app companion budgets keep entry chrome, routes, and hooks small', () => {
  for (const [fileName, maxLines] of [
    ['AppChrome.tsx', 160],
    ['AppErrorBoundary.tsx', 120],
    ['AppRoutes.tsx', 120],
    ['appNavigation.ts', 80],
    ['useAppController.ts', 90],
    ['useAppNavigationController.ts', 100],
    ['useAppNavigationRequests.ts', 120],
    ['useAppKeyboardShortcuts.ts', 80],
    ['useAppThemeSettings.ts', 120],
  ]) {
    const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith(`src/app/${fileName}`));

    assert.ok(budget, fileName);
    assert.ok(budget.maxLines <= maxLines, fileName);
  }
});

test('app controller delegates navigation state to a focused hook', () => {
  const controller = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'useAppController.ts'), 'utf8');
  const navigationController = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'useAppNavigationController.ts'), 'utf8');

  assert.match(controller, /import \{ useAppNavigationController \} from '\.\/useAppNavigationController';/);
  assert.match(controller, /const navigation = useAppNavigationController\(\);/);
  assert.doesNotMatch(controller, /useState</);
  assert.doesNotMatch(controller, /readInitialView/);
  assert.match(navigationController, /export function useAppNavigationController/);
  assert.match(navigationController, /readInitialView/);
  assert.match(navigationController, /mikavn\.currentView/);
  assert.match(navigationController, /useAppKeyboardShortcuts/);
});

test('app navigation controller delegates page request state to a focused hook', () => {
  const navigationController = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'useAppNavigationController.ts'), 'utf8');
  const requestHook = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'useAppNavigationRequests.ts'), 'utf8');

  assert.match(navigationController, /import \{ useAppNavigationRequests \} from '\.\/useAppNavigationRequests';/);
  assert.match(navigationController, /const navigationRequests = useAppNavigationRequests\(/);
  assert.doesNotMatch(navigationController, /setTaskFocusRequest|setSettingsTabRequest|setMetadataQueuePresetRequest/);
  assert.match(requestHook, /export function useAppNavigationRequests/);
  assert.match(requestHook, /openDatabaseRestore/);
  assert.match(requestHook, /openSettings\('local', 'database-restore'\)/);
  assert.match(requestHook, /setTaskFocusRequest/);
});

test('library page budget keeps library orchestration small', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Library/LibraryPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 120);
});

test('library companion budgets keep controller and sidebar rendering outside the page shell', () => {
  for (const [fileName, maxLines] of [
    ['useLibraryPageController.ts', 130],
    ['LibrarySidebar.tsx', 120],
    ['LibraryResizeHandle.tsx', 80],
  ]) {
    const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith(`src/pages/Library/${fileName}`));

    assert.ok(budget, fileName);
    assert.ok(budget.maxLines <= maxLines, fileName);
  }
});

test('dashboard page budget keeps personal dashboard orchestration small', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Dashboard/DashboardPage.tsx'));
  const dataBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Dashboard/useDashboardPageData.ts'));

  assert.ok(budget);
  assert.ok(dataBudget);
  assert.ok(budget.maxLines <= 115);
  assert.ok(dataBudget.maxLines <= 95);
});

test('dashboard page delegates loading and derived state to a focused hook', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'Dashboard', 'DashboardPage.tsx'), 'utf8');
  const hook = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'Dashboard', 'useDashboardPageData.ts'), 'utf8');

  assert.match(page, /import \{ useDashboardPageData \} from '\.\/useDashboardPageData';/);
  assert.match(page, /useDashboardPageData\(refreshKey\)/);
  assert.doesNotMatch(page, /useState|useEffect|useMemo/);
  assert.doesNotMatch(page, /api\./);
  assert.doesNotMatch(page, /deriveDashboardAttentionItems|rankContinueGames|uniqueDashboardGames/);
  assert.match(hook, /export function useDashboardPageData/);
  assert.match(hook, /api\s*\.\s*getDashboard/);
  assert.match(hook, /deriveDashboardAttentionItems/);
  assert.match(hook, /rankContinueGames/);
});

test('game form budget keeps form mapping outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Library/GameForm.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 180);
});

test('game detail budget keeps detail actions and panels outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Library/GameDetail.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 220);
});

test('game detail media budget keeps media parsing outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Library/GameDetailMedia.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 220);
});

test('tasks page budget keeps task queue derivation outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Tasks/TasksPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 180);
});

test('scanner page budget keeps import scan derivation outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Scanner/ScannerPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 180);
});

test('batch metadata page budget keeps matching derivation outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Metadata/BatchMetadataPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 160);
});

test('saves page budget keeps restore preview outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Saves/SavesPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 240);
});

test('settings page budget keeps local data actions outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Settings/SettingsPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 180);
});

test('image audit detail budgets keep derivation outside the TSX component', () => {
  const panelBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Maintenance/ImageAuditDetailPanel.tsx'));
  const modelBudget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Maintenance/imageAuditDetailModel.ts'));

  assert.ok(panelBudget);
  assert.ok(modelBudget);
  assert.ok(panelBudget.maxLines <= 240);
  assert.ok(modelBudget.maxLines <= 180);
});

test('image health service budget keeps tests outside the production scanner module', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src-tauri/src/services/image_health.rs'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 1000);
});

test('image health service budget leaves room for repair workflows', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src-tauri/src/services/image_health.rs'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 900);
});

test('backup service budget keeps data-safety tests outside the production module', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src-tauri/src/services/backups.rs'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 900);
});
