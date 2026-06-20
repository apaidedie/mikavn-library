const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadStartupDatabaseBackup() {
  const sourcePath = path.join(__dirname, '..', 'src', 'app', 'startupDatabaseBackup.ts');
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

function diagnostics(overrides = {}) {
  return {
    databaseBackups: {
      rootPath: 'E:\\MikaVN Library\\app-data\\database-backups',
      fileCount: overrides.fileCount ?? 0,
      files: overrides.files ?? [],
    },
  };
}

test('startup database backup runs when no backup exists and writes into auto backup folder', () => {
  const { deriveStartupDatabaseBackupPlan } = loadStartupDatabaseBackup();
  const plan = deriveStartupDatabaseBackupPlan({
    settings: {},
    diagnostics: diagnostics({ fileCount: 0 }),
    now: '2026-06-21T08:09:10.000Z',
  });

  assert.equal(plan.kind, 'backup');
  assert.equal(plan.reason, 'missing');
  assert.equal(plan.path, 'E:\\MikaVN Library\\app-data\\database-backups\\auto\\mikavn.before-auto-20260621-080910.db');
});

test('startup database backup skips fresh backups and disabled setting', () => {
  const { deriveStartupDatabaseBackupPlan } = loadStartupDatabaseBackup();
  const fresh = deriveStartupDatabaseBackupPlan({
    settings: {},
    diagnostics: diagnostics({
      fileCount: 1,
      files: [{ modifiedAt: '2026-06-21T01:00:00.000Z' }],
    }),
    now: '2026-06-21T08:00:00.000Z',
  });
  const disabled = deriveStartupDatabaseBackupPlan({
    settings: { database_auto_backup_on_startup: 'false' },
    diagnostics: diagnostics({ fileCount: 0 }),
    now: '2026-06-21T08:00:00.000Z',
  });

  assert.deepEqual(fresh, { kind: 'skip', reason: 'fresh' });
  assert.deepEqual(disabled, { kind: 'skip', reason: 'disabled' });
});

test('startup database backup runs when latest backup is older than interval', () => {
  const { deriveStartupDatabaseBackupPlan } = loadStartupDatabaseBackup();
  const plan = deriveStartupDatabaseBackupPlan({
    settings: {},
    diagnostics: diagnostics({
      fileCount: 2,
      files: [
        { modifiedAt: '2026-06-18T00:00:00.000Z' },
        { modifiedAt: '2026-06-19T07:59:59.000Z' },
      ],
    }),
    now: '2026-06-21T08:00:00.000Z',
    intervalHours: 24,
  });

  assert.equal(plan.kind, 'backup');
  assert.equal(plan.reason, 'stale');
});
