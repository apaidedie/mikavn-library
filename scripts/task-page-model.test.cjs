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

function loadTaskDiagnostics() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Tasks', 'taskDiagnostics.ts');
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
    if (specifier === '@/utils/diagnosticRedaction') return loadDiagnosticRedaction();
    if (specifier === '@/utils/taskLabels') {
      return {
        taskLabel: (taskType) => taskType,
        taskStatusLabel: (status) => status,
      };
    }
    if (specifier === '@/utils/time') {
      return { formatDateTime: (value) => value };
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

test('formatTaskProgressPercent clamps and rounds task progress', () => {
  const { formatTaskProgressPercent } = loadTaskPageModel();

  assert.equal(formatTaskProgressPercent(-0.2), '0%');
  assert.equal(formatTaskProgressPercent(0.456), '46%');
  assert.equal(formatTaskProgressPercent(1.25), '100%');
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

test('task page exposes searchable per-task logs and copy actions', () => {
  const queuePanel = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Tasks', 'TaskQueuePanel.tsx'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Tasks', 'TasksPage.tsx'), 'utf8');
  const actions = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Tasks', 'useTasksPageActions.ts'), 'utf8');

  assert.match(page, /logsByTask=\{tasksPage\.logsByTask\}/);
  assert.match(page, /onCopyTaskLog=\{\(log\) => void tasksPage\.copyTaskLog\(log\)\}/);
  assert.match(queuePanel, /任务日志/);
  assert.match(queuePanel, /placeholder="搜索日志"/);
  assert.match(queuePanel, /matchesLogQuery\(log, logQuery\)/);
  assert.match(queuePanel, /title="复制任务日志"/);
  assert.match(actions, /redactDiagnosticText/);
  assert.match(actions, /navigator\.clipboard\.writeText\(redactDiagnosticText\(`/);
});

test('task diagnostic markdown redacts copied secrets and Windows user names', () => {
  const { buildTaskDiagnosticMarkdown } = loadTaskDiagnostics();
  const markdown = buildTaskDiagnosticMarkdown(
    task({
      id: 'private-task',
      status: 'failed',
      message: String.raw`任务失败 token:abc C:\Users\alice\AppData\Local\MikaVN\mikavn.db`,
      error: 'password=hunter2 API_KEY=secret',
    }),
    [
      {
        id: 'log-secret',
        taskId: 'private-task',
        level: 'error',
        message: 'authorization:BearerXYZ C:/Users/bob/AppData/Roaming/MikaVN/log.txt',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  );

  assert.match(markdown, /\[redacted\]/);
  assert.match(markdown, /C:\\Users\\\[user\]\\AppData/);
  assert.match(markdown, /C:\/Users\/\[user\]\/AppData/);
  assert.doesNotMatch(markdown, /abc|hunter2|secret|BearerXYZ|alice|bob/);
});
