const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadSavesPageModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Saves', 'savesPageModel.ts');
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

function preview(overrides) {
  return {
    mode: overrides.mode,
    backupFileCount: 3,
    currentFileCount: 2,
    newFiles: overrides.newFiles ?? 1,
    overwrittenFiles: overrides.overwrittenFiles ?? 0,
    keptFiles: overrides.keptFiles ?? 0,
    removedFiles: overrides.removedFiles ?? 0,
    sampleNewFiles: [],
    sampleOverwrittenFiles: [],
    sampleKeptFiles: [],
    sampleRemovedFiles: [],
  };
}

function game(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    developer: overrides.developer ?? null,
    brand: overrides.brand ?? null,
  };
}

function backup(index) {
  return {
    id: `backup-${index}`,
    gameId: 'game-1',
    savePathId: 'save-path-1',
    label: `备份 ${index}`,
    sourcePath: `D:\\Saves\\${index}`,
    backupPath: `E:\\MikaVN Library\\app-data\\save-backups\\${index}`,
    protection: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

test('getSaveRestorePreviewPair returns merge and mirror keys with cached previews', () => {
  const { getSaveRestorePreviewPair } = loadSavesPageModel();
  const mergePreview = preview({ mode: 'merge', keptFiles: 2 });
  const mirrorPreview = preview({ mode: 'mirror', removedFiles: 1 });

  assert.deepEqual(getSaveRestorePreviewPair('backup-1', {
    'backup-1:merge': mergePreview,
    'backup-1:mirror': mirrorPreview,
  }), {
    mergeKey: 'backup-1:merge',
    mirrorKey: 'backup-1:mirror',
    mergePreview,
    mirrorPreview,
  });
});

test('savePathCandidateMessage reports empty and populated candidate searches', () => {
  const { savePathCandidateMessage } = loadSavesPageModel();

  assert.equal(savePathCandidateMessage(0), '没有发现已存在的常见存档目录。');
  assert.equal(savePathCandidateMessage(3), '发现 3 个候选存档目录。');
});

test('restoreTaskMessage labels merge and mirror restore tasks', () => {
  const { restoreTaskMessage } = loadSavesPageModel();

  assert.equal(restoreTaskMessage('merge', 'task-1'), '合并存档恢复任务已创建：task-1');
  assert.equal(restoreTaskMessage('mirror', 'task-2'), '镜像存档恢复任务已创建：task-2');
});

test('restorePreviewCompletionMessage summarizes merge and mirror previews', () => {
  const { restorePreviewCompletionMessage } = loadSavesPageModel();

  assert.equal(restorePreviewCompletionMessage('merge', preview({ mode: 'merge', newFiles: 2, overwrittenFiles: 1, keptFiles: 4 })), '合并恢复预览完成：新增 2，覆盖 1，保留 4。');
  assert.equal(restorePreviewCompletionMessage('mirror', preview({ mode: 'mirror', newFiles: 2, overwrittenFiles: 1, removedFiles: 3 })), '镜像恢复预览完成：新增 2，覆盖 1，清理 3。');
});

test('getSaveGamePickerOptions limits large game lists and filters by local query', () => {
  const { getSaveGamePickerOptions, saveGamePickerMaxOptions } = loadSavesPageModel();
  const games = [
    game({ id: 'selected', title: 'Selected Game' }),
    ...Array.from({ length: 120 }, (_, index) => game({ id: `game-${index}`, title: `Game ${index}` })),
    game({ id: 'target-1', title: 'White Album', developer: 'Leaf' }),
    game({ id: 'target-2', title: 'ToHeart', developer: 'Leaf' }),
  ];

  const initial = getSaveGamePickerOptions(games, 'selected', '');
  const filtered = getSaveGamePickerOptions(games, 'selected', 'leaf');

  assert.equal(saveGamePickerMaxOptions, 80);
  assert.equal(initial.length, 80);
  assert.equal(initial[0].id, 'selected');
  assert.deepEqual(filtered.map((item) => item.id), ['selected', 'target-1', 'target-2']);
});

test('getSaveGamePickerOptions keeps the selected game visible when it does not match the query', () => {
  const { getSaveGamePickerOptions } = loadSavesPageModel();
  const games = [
    game({ id: 'selected', title: 'Selected Game' }),
    game({ id: 'target', title: 'Summer Pockets', developer: 'Key' }),
  ];

  const options = getSaveGamePickerOptions(games, 'selected', 'key');

  assert.deepEqual(options.map((item) => item.id), ['selected', 'target']);
});

test('formatSaveGamePickerHint summarizes bounded and filtered picker results', () => {
  const { formatSaveGamePickerHint } = loadSavesPageModel();

  assert.equal(formatSaveGamePickerHint(80, 500, ''), '显示 80 / 500 个游戏，输入关键词缩小范围。');
  assert.equal(formatSaveGamePickerHint(2, 500, 'key'), '匹配 2 / 500 个游戏。');
});

test('save backup history render window keeps long backup histories bounded', () => {
  const {
    getSaveBackupHistoryRenderWindow,
    saveBackupHistoryInitialRenderCount,
    saveBackupHistoryRenderBatchSize,
  } = loadSavesPageModel();
  const backups = Array.from({ length: 250 }, (_, index) => backup(index));

  const initialWindow = getSaveBackupHistoryRenderWindow(backups, saveBackupHistoryInitialRenderCount);
  const expandedWindow = getSaveBackupHistoryRenderWindow(backups, saveBackupHistoryInitialRenderCount + saveBackupHistoryRenderBatchSize);
  const emptyWindow = getSaveBackupHistoryRenderWindow([], saveBackupHistoryInitialRenderCount);

  assert.equal(saveBackupHistoryInitialRenderCount, 80);
  assert.equal(saveBackupHistoryRenderBatchSize, 80);
  assert.equal(initialWindow.visibleBackups.length, 80);
  assert.equal(initialWindow.renderedCount, 80);
  assert.equal(initialWindow.totalCount, 250);
  assert.equal(initialWindow.hasMore, true);
  assert.equal(expandedWindow.visibleBackups.length, 160);
  assert.equal(emptyWindow.hasMore, false);
});

test('saves page loads a bounded game list and ignores stale initial loads', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Saves', 'useSavesPageActions.ts'), 'utf8');

  assert.match(source, /listGames\(\{ sortBy: 'updated_at', sortDirection: 'desc', limit: 500 \}\)/);
  assert.match(source, /let cancelled = false/);
  assert.match(source, /if \(cancelled\) return/);
  assert.match(source, /return \(\) => \{\s*cancelled = true;\s*\}/s);
});

test('save path panel filters game picker options before rendering the select', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Saves', 'SavePathPanel.tsx'), 'utf8');

  assert.match(source, /gamePickerQuery/);
  assert.match(source, /getSaveGamePickerOptions/);
  assert.match(source, /formatSaveGamePickerHint/);
  assert.match(source, /gamePickerOptions\.map/);
  assert.doesNotMatch(source, /games\.map\(\(game\) => <option/);
});

test('saves page ignores stale save path refreshes while selected game changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Saves', 'useSavesPageActions.ts'), 'utf8');

  assert.match(source, /useRef/);
  assert.match(source, /const refreshSavesRequestRef = useRef\(0\)/);
  assert.match(source, /const requestId = \+\+refreshSavesRequestRef\.current/);
  assert.match(source, /Promise\.all\(\[api\.listSavePaths\(gameId\), api\.listSaveBackups\(gameId\)\]\)/);
  assert.match(source, /if \(requestId !== refreshSavesRequestRef\.current\) return/);
});

test('save backup history panel renders through a bounded window helper', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Saves', 'SaveBackupHistoryPanel.tsx'), 'utf8');

  assert.match(source, /saveBackupHistoryInitialRenderCount/);
  assert.match(source, /saveBackupHistoryRenderBatchSize/);
  assert.match(source, /getSaveBackupHistoryRenderWindow/);
  assert.match(source, /visibleBackups\.map\(\(backup\)/);
  assert.doesNotMatch(source, /backups\.map\(\(backup\)/);
  assert.match(source, /加载更多/);
});
