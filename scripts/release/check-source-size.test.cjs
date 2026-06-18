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
    'src/services/mockStore.ts',
    'src/pages/Dashboard/DashboardPage.tsx',
    'src/pages/Library/LibraryPage.tsx',
    'src/pages/Library/GameForm.tsx',
    'src/pages/Library/GameDetailMedia.tsx',
    'src/pages/Tasks/TasksPage.tsx',
    'src/pages/Scanner/ScannerPage.tsx',
    'src/pages/Metadata/BatchMetadataPage.tsx',
    'src/pages/Saves/SavesPage.tsx',
    'src-tauri/src/services/archives.rs',
    'src-tauri/src/services/diagnostics.rs',
    'src-tauri/src/db/game_merge_ext.rs',
    'scripts/playwright/page-qa-runner.cjs',
    'scripts/playwright/page-qa-fixtures.cjs',
  ]) {
    assert.match(watchedPaths, new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('maintenance page budget keeps page-level orchestration small', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Maintenance/MaintenancePage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 430);
});

test('library page budget keeps library orchestration small', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Library/LibraryPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 330);
});

test('dashboard page budget keeps personal dashboard orchestration small', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Dashboard/DashboardPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 300);
});

test('game form budget keeps form mapping outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Library/GameForm.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 430);
});

test('game detail media budget keeps media parsing outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Library/GameDetailMedia.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 310);
});

test('tasks page budget keeps task queue derivation outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Tasks/TasksPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 320);
});

test('scanner page budget keeps import scan derivation outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Scanner/ScannerPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 420);
});

test('batch metadata page budget keeps matching derivation outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Metadata/BatchMetadataPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 400);
});

test('saves page budget keeps restore preview outside page component', () => {
  const budget = DEFAULT_SOURCE_BUDGETS.find((item) => item.filePath.replace(/\\/g, '/').endsWith('src/pages/Saves/SavesPage.tsx'));

  assert.ok(budget);
  assert.ok(budget.maxLines <= 320);
});
