const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTaskPageModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Tasks', 'taskPageModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '@/utils/taskLabels') {
      return {
        taskLabel: (taskType) => ({
          'metadata.batch_match': '批量元数据匹配',
          'save.backup': '存档备份',
        })[taskType] ?? taskType,
        taskStatusLabel: (status) => ({
          pending: '等待中',
          running: '运行中',
          completed: '已完成',
          failed: '失败',
          cancelled: '已取消',
        })[status] ?? status,
      };
    }
    throw new Error(`Unexpected require: ${specifier}`);
  };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(module, module.exports, localRequire);
  return module.exports;
}

function task(overrides) {
  return {
    id: overrides.id,
    taskType: overrides.taskType ?? 'metadata.batch_match',
    status: overrides.status,
    progress: overrides.progress ?? 0,
    message: overrides.message ?? null,
    error: overrides.error ?? null,
    retryable: overrides.retryable ?? false,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

test('deriveTaskPageSummary counts states and clamps queue progress', () => {
  const { deriveTaskPageSummary } = loadTaskPageModel();
  const summary = deriveTaskPageSummary([
    task({ id: 'running', status: 'running', progress: 0.5 }),
    task({ id: 'pending', status: 'pending', progress: -1 }),
    task({ id: 'failed', status: 'failed', progress: 1.2 }),
    task({ id: 'completed', status: 'completed', progress: 1 }),
  ]);

  assert.equal(summary.activeCount, 2);
  assert.equal(summary.attentionCount, 1);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.queueProgress, 63);
  assert.deepEqual(summary.statusShortcuts.map((item) => [item.id, item.count]), [
    ['all', 4],
    ['active', 2],
    ['attention', 1],
    ['completed', 1],
  ]);
});

test('deriveTaskTypeShortcuts sorts task types by localized label and counts each type', () => {
  const { deriveTaskTypeShortcuts } = loadTaskPageModel();
  const shortcuts = deriveTaskTypeShortcuts([
    task({ id: 'save-1', taskType: 'save.backup', status: 'completed' }),
    task({ id: 'metadata-1', taskType: 'metadata.batch_match', status: 'failed' }),
    task({ id: 'save-2', taskType: 'save.backup', status: 'running' }),
  ]);

  assert.deepEqual(shortcuts.map((item) => [item.id, item.label, item.count]), [
    ['all', '全部类型', 3],
    ['save.backup', '存档备份', 2],
    ['metadata.batch_match', '批量元数据匹配', 1],
  ]);
});

test('filterTasks applies status, type, and query filters together', () => {
  const { filterTasks } = loadTaskPageModel();
  const tasks = [
    task({ id: 'running-match', taskType: 'save.backup', status: 'running', message: '备份完成一半' }),
    task({ id: 'failed-match', taskType: 'save.backup', status: 'failed', error: '路径不存在' }),
    task({ id: 'metadata', taskType: 'metadata.batch_match', status: 'failed', error: '路径不存在' }),
  ];

  assert.deepEqual(filterTasks(tasks, { statusFilter: 'attention', typeFilter: 'save.backup', query: '路径' }).map((item) => item.id), ['failed-match']);
  assert.deepEqual(filterTasks(tasks, { statusFilter: 'active', typeFilter: 'all', query: '' }).map((item) => item.id), ['running-match']);
});

test('deriveRecentResultTasks returns latest completed, failed, and cancelled tasks', () => {
  const { deriveRecentResultTasks } = loadTaskPageModel();
  const tasks = [
    task({ id: 'old-completed', status: 'completed', updatedAt: '2026-06-01T00:00:00.000Z' }),
    task({ id: 'running', status: 'running', updatedAt: '2026-06-10T00:00:00.000Z' }),
    task({ id: 'failed-new', status: 'failed', updatedAt: '2026-06-09T00:00:00.000Z' }),
    task({ id: 'cancelled-middle', status: 'cancelled', updatedAt: '2026-06-08T00:00:00.000Z' }),
  ];

  assert.deepEqual(deriveRecentResultTasks(tasks, 2).map((item) => item.id), ['failed-new', 'cancelled-middle']);
});
