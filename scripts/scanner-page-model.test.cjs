const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadScannerPageModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Scanner', 'scannerPageModel.ts');
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

function candidate(overrides) {
  return {
    id: overrides.id,
    rootPath: 'D:\\Games',
    installPath: overrides.installPath ?? `D:\\Games\\${overrides.id}`,
    folderName: overrides.id,
    suggestedTitle: overrides.suggestedTitle ?? overrides.id,
    aliases: overrides.aliases ?? [],
    executables: overrides.executables ?? [{ name: 'game.exe', path: `D:\\Games\\${overrides.id}\\game.exe` }],
    selectedExecutable: overrides.selectedExecutable ?? null,
    conflict: overrides.conflict ?? null,
  };
}

function reportItem(overrides) {
  return {
    candidateTitle: overrides.candidateTitle,
    installPath: overrides.installPath ?? `D:\\Games\\${overrides.candidateTitle}`,
    action: overrides.action,
    gameId: overrides.gameId ?? null,
    targetTitle: overrides.targetTitle ?? null,
    conflictReason: overrides.conflictReason ?? null,
    message: overrides.message ?? '',
  };
}

test('deriveScannerCandidateSummary counts candidates, selected items, and conflicts', () => {
  const { deriveScannerCandidateSummary } = loadScannerPageModel();
  const summary = deriveScannerCandidateSummary([
    candidate({ id: 'fresh' }),
    candidate({ id: 'conflict', conflict: { gameId: 'game-1', title: 'Existing', reason: 'same path' } }),
  ], ['fresh']);

  assert.deepEqual(summary, {
    candidateCount: 2,
    selectedCount: 1,
    conflictCount: 1,
  });
});

test('scanner candidate render window keeps large scan results bounded', () => {
  const {
    getScannerCandidateRenderWindow,
    scannerCandidateInitialRenderCount,
    scannerCandidateRenderBatchSize,
  } = loadScannerPageModel();
  const candidates = Array.from({ length: 260 }, (_, index) => candidate({ id: `candidate-${index}` }));

  const initialWindow = getScannerCandidateRenderWindow(candidates, scannerCandidateInitialRenderCount);
  const expandedWindow = getScannerCandidateRenderWindow(candidates, scannerCandidateInitialRenderCount + scannerCandidateRenderBatchSize);
  const emptyWindow = getScannerCandidateRenderWindow([], scannerCandidateInitialRenderCount);

  assert.equal(scannerCandidateInitialRenderCount, 80);
  assert.equal(scannerCandidateRenderBatchSize, 80);
  assert.equal(initialWindow.visibleCandidates.length, 80);
  assert.equal(initialWindow.renderedCount, 80);
  assert.equal(initialWindow.totalCount, 260);
  assert.equal(initialWindow.hasMore, true);
  assert.equal(expandedWindow.visibleCandidates.length, 160);
  assert.equal(emptyWindow.hasMore, false);
});

test('isScanningTaskStatus treats pending and running scan tasks as active', () => {
  const { isScanningTaskStatus } = loadScannerPageModel();

  assert.equal(isScanningTaskStatus(null), false);
  assert.equal(isScanningTaskStatus({ task: { status: 'pending' } }), true);
  assert.equal(isScanningTaskStatus({ task: { status: 'running' } }), true);
  assert.equal(isScanningTaskStatus({ task: { status: 'completed' } }), false);
});

test('selectIdsForConflictAction adds non-skip conflicts to the selected list without duplicates', () => {
  const { selectIdsForConflictAction } = loadScannerPageModel();

  assert.deepEqual(selectIdsForConflictAction(['fresh'], 'conflict', 'merge'), ['fresh', 'conflict']);
  assert.deepEqual(selectIdsForConflictAction(['fresh', 'conflict'], 'conflict', 'replace'), ['fresh', 'conflict']);
  assert.deepEqual(selectIdsForConflictAction(['fresh'], 'conflict', 'skip'), ['fresh']);
});

test('filterImportReportItems applies action and text filters together', () => {
  const { filterImportReportItems } = loadScannerPageModel();
  const report = {
    items: [
      reportItem({ candidateTitle: 'Fresh Game', action: 'add', message: '写入成功' }),
      reportItem({ candidateTitle: 'Existing Game', action: 'skip', conflictReason: '路径冲突' }),
      reportItem({ candidateTitle: 'Duplicate Game', action: 'duplicate', message: '作为副本导入' }),
    ],
  };

  assert.deepEqual(filterImportReportItems(report, { actionFilter: 'skip', query: '路径' }).map((item) => item.candidateTitle), ['Existing Game']);
  assert.deepEqual(filterImportReportItems(report, { actionFilter: 'all', query: '副本' }).map((item) => item.candidateTitle), ['Duplicate Game']);
});

test('shouldResetImportReportFilters only enables reset when filters are active', () => {
  const { shouldResetImportReportFilters } = loadScannerPageModel();

  assert.equal(shouldResetImportReportFilters('all', ''), false);
  assert.equal(shouldResetImportReportFilters('skip', ''), true);
  assert.equal(shouldResetImportReportFilters('all', '路径'), true);
});

test('scanner actions ignore stale scan and metadata match status polls', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Scanner', 'useScannerPageActions.ts'), 'utf8');

  assert.match(source, /useRef/);
  assert.match(source, /const matchStatusRequestRef = useRef\(0\)/);
  assert.match(source, /const scanStatusRequestRef = useRef\(0\)/);
  assert.match(source, /const requestId = \+\+matchStatusRequestRef\.current/);
  assert.match(source, /if \(requestId !== matchStatusRequestRef\.current\) return/);
  assert.match(source, /const requestId = \+\+scanStatusRequestRef\.current/);
  assert.match(source, /if \(requestId !== scanStatusRequestRef\.current\) return/);
  assert.doesNotMatch(source, /\.then\(setMatchStatus\)/);
});

test('scanner backend uses lightweight conflict rows instead of loading full games', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'services', 'scanner.rs'), 'utf8');
  const scannerDb = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'db', 'scanner_ext.rs'), 'utf8');

  assert.doesNotMatch(source, /db\.list_games\(GameFilter::default\(\)\)/);
  assert.match(source, /ScanConflictRow/);
  assert.match(source, /list_scan_conflict_rows/);
  assert.match(scannerDb, /pub fn list_scan_conflict_rows/);
  assert.match(scannerDb, /SELECT id, title, install_path, executable_path FROM games/);
});

test('scanner candidate panel renders through a bounded window helper', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Scanner', 'ScannerCandidatePanel.tsx'), 'utf8');

  assert.match(source, /scannerCandidateInitialRenderCount/);
  assert.match(source, /scannerCandidateRenderBatchSize/);
  assert.match(source, /getScannerCandidateRenderWindow/);
  assert.match(source, /visibleCandidates\.map\(\(candidate\)/);
  assert.doesNotMatch(source, /candidates\.map\(\(candidate\)/);
  assert.match(source, /selectedIdSet/);
  assert.doesNotMatch(source, /selectedIds\.includes\(candidate\.id\)/);
  assert.match(source, /加载更多/);
});
