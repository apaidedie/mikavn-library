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

test('startup database backup cleanup keeps a conservative local retention window', () => {
  const { startupDatabaseBackupCleanupPolicy } = loadStartupDatabaseBackup();

  assert.deepEqual(startupDatabaseBackupCleanupPolicy(), {
    retainCount: 30,
    retainDays: 90,
  });
});

test('startup database backup hook cleans old backups after a successful auto backup', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'useStartupDatabaseBackup.ts'), 'utf8');

  assert.match(source, /cleanupOldDatabaseBackups/);
  assert.match(source, /startupDatabaseBackupCleanupPolicy/);
  assert.ok(source.indexOf('api.backupDatabase(plan.path)') < source.indexOf('api.cleanupOldDatabaseBackups(startupDatabaseBackupCleanupPolicy())'));
});

test('startup database backup failures are surfaced in app chrome', () => {
  const hook = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'useStartupDatabaseBackup.ts'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'App.tsx'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'useAppController.ts'), 'utf8');
  const notice = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'AppStartupDatabaseBackupNotice.tsx'), 'utf8');

  assert.match(hook, /useState/);
  assert.match(hook, /errorMessage/);
  assert.match(hook, /startupDatabaseBackupError/);
  assert.match(hook, /setStartupDatabaseBackupError\(`启动自动数据库备份失败：\$\{errorMessage\(reason\)\}`\)/);
  assert.match(hook, /dismissStartupDatabaseBackupError/);
  assert.match(controller, /const startupDatabaseBackup = useStartupDatabaseBackup\(\)/);
  assert.match(controller, /startupDatabaseBackup/);
  assert.match(app, /AppStartupDatabaseBackupNotice/);
  assert.match(app, /startupDatabaseBackup\.startupDatabaseBackupError/);
  assert.match(app, /onOpenSettings=\{\(\) => app\.openSettings\('local'\)\}/);
  assert.match(notice, /启动自动备份失败/);
  assert.match(notice, /打开本地数据设置/);
  assert.match(notice, /onDismiss/);
});

test('desktop startup creates automatic backup through Rust while honoring disabled setting', () => {
  const lib = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');
  const backups = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'services', 'backups.rs'), 'utf8');

  assert.match(lib, /database_auto_backup_on_startup/);
  assert.match(lib, /create_startup_automatic_backup_if_needed/);
  assert.match(lib, /as_deref\(\) != Some\("false"\)/);
  assert.match(backups, /startup-auto-/);
  assert.match(backups, /STARTUP_AUTO_BACKUP_MIN_INTERVAL_HOURS/);
  assert.match(backups, /cleanup_old_database_backups_with_paths/);
  assert.match(backups, /retain_count: Some\(30\)/);
  assert.match(backups, /retain_days: Some\(90\)/);
});
