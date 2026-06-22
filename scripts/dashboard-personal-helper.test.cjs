const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadDashboardPersonal() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Dashboard', 'dashboardPersonal.ts');
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

function game(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    aliases: [],
    tags: [],
    genres: [],
    playStatus: overrides.playStatus ?? 'planned',
    favorite: false,
    hidden: overrides.hidden ?? false,
    installPath: `D:\\Games\\${overrides.id}`,
    pathStatus: overrides.pathStatus ?? 'ok',
    coverImage: overrides.coverImage ?? null,
    bannerImage: overrides.bannerImage ?? null,
    backgroundImage: overrides.backgroundImage ?? null,
    vndbId: overrides.vndbId ?? null,
    bangumiId: overrides.bangumiId ?? null,
    dlsiteId: overrides.dlsiteId ?? null,
    fanzaId: overrides.fanzaId ?? null,
    ymgalId: overrides.ymgalId ?? null,
    totalPlaySeconds: overrides.totalPlaySeconds ?? 0,
    lastPlayedAt: overrides.lastPlayedAt ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

function task(overrides) {
  return {
    id: overrides.id,
    taskType: overrides.taskType ?? 'scan.directory',
    status: overrides.status,
    progress: overrides.progress ?? 0,
    message: overrides.message ?? null,
    error: overrides.error ?? null,
    retryable: overrides.retryable ?? false,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

test('rankContinueGames prefers playing, recent, and played games while hiding hidden entries', () => {
  const { rankContinueGames } = loadDashboardPersonal();
  const ranked = rankContinueGames([
    game({ id: 'completed-old', playStatus: 'completed', totalPlaySeconds: 100, lastPlayedAt: '2026-01-01T00:00:00.000Z' }),
    game({ id: 'hidden-playing', playStatus: 'playing', hidden: true, lastPlayedAt: '2026-06-01T00:00:00.000Z' }),
    game({ id: 'planned-new', playStatus: 'planned', createdAt: '2026-06-02T00:00:00.000Z' }),
    game({ id: 'playing-recent', playStatus: 'playing', totalPlaySeconds: 60, lastPlayedAt: '2026-06-10T00:00:00.000Z' }),
    game({ id: 'paused-played', playStatus: 'paused', totalPlaySeconds: 7200, lastPlayedAt: '2026-06-09T00:00:00.000Z' }),
  ], { hideHidden: true, limit: 3 });

  assert.deepEqual(ranked.map((item) => item.id), ['playing-recent', 'paused-played', 'completed-old']);
});

test('uniqueDashboardGames keeps the first copy of each game for continue ranking', () => {
  const { uniqueDashboardGames } = loadDashboardPersonal();
  const games = [
    game({ id: 'same-game', title: 'First copy', playStatus: 'playing' }),
    game({ id: 'other-game', title: 'Other game', playStatus: 'paused' }),
    game({ id: 'same-game', title: 'Duplicate copy', playStatus: 'completed' }),
  ];

  assert.deepEqual(uniqueDashboardGames(games).map((item) => item.title), ['First copy', 'Other game']);
});

test('deriveDashboardTaskSummary counts task states and returns latest finished results', () => {
  const { deriveDashboardTaskSummary } = loadDashboardPersonal();
  const summary = deriveDashboardTaskSummary([
    task({ id: 'old-completed', status: 'completed', updatedAt: '2026-06-01T00:00:00.000Z' }),
    task({ id: 'running-task', status: 'running', updatedAt: '2026-06-05T00:00:00.000Z' }),
    task({ id: 'pending-task', status: 'pending', updatedAt: '2026-06-04T00:00:00.000Z' }),
    task({ id: 'failed-newest', status: 'failed', updatedAt: '2026-06-07T00:00:00.000Z' }),
    task({ id: 'cancelled-middle', status: 'cancelled', updatedAt: '2026-06-06T00:00:00.000Z' }),
  ]);

  assert.equal(summary.runningCount, 2);
  assert.equal(summary.attentionCount, 2);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.activeCount, 4);
  assert.deepEqual(summary.recentResults.map((item) => item.id), ['failed-newest', 'cancelled-middle']);
});

test('canRetryDashboardTask only allows retryable failed or cancelled tasks', () => {
  const { canRetryDashboardTask } = loadDashboardPersonal();

  assert.equal(canRetryDashboardTask(task({ id: 'retry-failed', status: 'failed', retryable: true })), true);
  assert.equal(canRetryDashboardTask(task({ id: 'retry-cancelled', status: 'cancelled', retryable: true })), true);
  assert.equal(canRetryDashboardTask(task({ id: 'completed', status: 'completed', retryable: true })), false);
  assert.equal(canRetryDashboardTask(task({ id: 'not-retryable', status: 'failed', retryable: false })), false);
});

test('formatDashboardTaskProgress clamps and rounds task progress for the dashboard', () => {
  const { formatDashboardTaskProgress } = loadDashboardPersonal();

  assert.equal(formatDashboardTaskProgress(-0.1), '0%');
  assert.equal(formatDashboardTaskProgress(0.456), '46%');
  assert.equal(formatDashboardTaskProgress(1.2), '100%');
});

test('deriveDashboardAttentionItems creates deterministic local action items', () => {
  const { deriveDashboardAttentionItems } = loadDashboardPersonal();
  const items = deriveDashboardAttentionItems({
    diagnostics: {
      database: {
        metadataCoverage: {
          missingCoverCount: 2,
          missingBannerCount: 1,
          missingBackgroundCount: 0,
          missingExternalIdCount: 4,
        },
        pathStatus: {
          brokenCount: 1,
          incompleteCount: 2,
          uncheckedCount: 3,
        },
      },
      databaseBackups: {
        fileCount: 0,
      },
    },
    tasks: [
      task({ id: 'failed-task', status: 'failed', error: 'scan failed', retryable: true }),
      task({ id: 'running-task', status: 'running', progress: 0.4 }),
      task({ id: 'done-task', status: 'completed', progress: 1 }),
    ],
  });

  assert.deepEqual(items.map((item) => item.kind), [
    'failed_tasks',
    'running_tasks',
    'path_health',
    'missing_artwork',
    'missing_external_ids',
    'database_backup',
  ]);
  assert.deepEqual(items.map((item) => item.action), [
    'tasks_attention',
    'tasks_active',
    'library_paths',
    'maintenance_artwork',
    'metadata_missing_ids',
    'settings_local',
  ]);
  assert.equal(items.find((item) => item.kind === 'path_health').count, 6);
  assert.equal(items.find((item) => item.kind === 'missing_artwork').count, 3);
  assert.equal(items.find((item) => item.kind === 'missing_external_ids').count, 4);
});

test('deriveDatabaseBackupStatus reports missing, fresh, and stale local backups', () => {
  const { deriveDatabaseBackupStatus } = loadDashboardPersonal();

  assert.deepEqual(deriveDatabaseBackupStatus({ fileCount: 0, files: [] }, '2026-06-17T00:00:00.000Z'), {
    level: 'missing',
    actionNeeded: true,
    summary: '还没有数据库备份',
    detail: '建议先做一次本地数据库备份。',
    latestBackupAt: null,
  });

  assert.deepEqual(deriveDatabaseBackupStatus({
    fileCount: 2,
    files: [
      { modifiedAt: '2026-05-01T00:00:00.000Z' },
      { modifiedAt: '2026-06-10T00:00:00.000Z' },
    ],
  }, '2026-06-17T00:00:00.000Z'), {
    level: 'fresh',
    actionNeeded: false,
    summary: '最近 7 天内备份过',
    detail: '当前有 2 个数据库备份。',
    latestBackupAt: '2026-06-10T00:00:00.000Z',
  });

  assert.deepEqual(deriveDatabaseBackupStatus({
    fileCount: 1,
    files: [{ modifiedAt: '2026-05-20T00:00:00.000Z' }],
  }, '2026-06-17T00:00:00.000Z'), {
    level: 'stale',
    actionNeeded: true,
    summary: '最近备份已超过 14 天',
    detail: '当前有 1 个数据库备份，建议更新一次。',
    latestBackupAt: '2026-05-20T00:00:00.000Z',
  });
});

test('dashboard continue query keeps playing-game payload bounded', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Dashboard', 'DashboardPage.tsx'), 'utf8');

  assert.match(source, /api\.listGames\(\{ status: 'playing', sortBy: 'last_played_at', sortDirection: 'desc', limit: 24 \}\)/);
});
