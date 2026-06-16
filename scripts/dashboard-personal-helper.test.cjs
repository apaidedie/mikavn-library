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
  assert.equal(items.find((item) => item.kind === 'path_health').count, 6);
  assert.equal(items.find((item) => item.kind === 'missing_artwork').count, 3);
  assert.equal(items.find((item) => item.kind === 'missing_external_ids').count, 4);
});
