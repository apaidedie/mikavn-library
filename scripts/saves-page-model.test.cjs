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

test('saves page loads a bounded game list and ignores stale initial loads', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Saves', 'useSavesPageActions.ts'), 'utf8');

  assert.match(source, /listGames\(\{ sortBy: 'updated_at', sortDirection: 'desc', limit: 500 \}\)/);
  assert.match(source, /let cancelled = false/);
  assert.match(source, /if \(cancelled\) return/);
  assert.match(source, /return \(\) => \{\s*cancelled = true;\s*\}/s);
});

test('saves page ignores stale save path refreshes while selected game changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Saves', 'useSavesPageActions.ts'), 'utf8');

  assert.match(source, /useRef/);
  assert.match(source, /const refreshSavesRequestRef = useRef\(0\)/);
  assert.match(source, /const requestId = \+\+refreshSavesRequestRef\.current/);
  assert.match(source, /Promise\.all\(\[api\.listSavePaths\(gameId\), api\.listSaveBackups\(gameId\)\]\)/);
  assert.match(source, /if \(requestId !== refreshSavesRequestRef\.current\) return/);
});
