const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadStartupDiagnostics(api) {
  const sourcePath = path.join(__dirname, '..', 'src', 'app', 'startupDiagnostics.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(module, module.exports, (specifier) => {
    if (specifier === '@/services/api') return { api };
    return require(specifier);
  });
  return module.exports;
}

test('startup diagnostics share one in-flight app-data diagnostics request', async () => {
  let calls = 0;
  let resolveDiagnostics;
  const diagnosticsPromise = new Promise((resolve) => {
    resolveDiagnostics = resolve;
  });
  const api = {
    getAppDataDiagnostics() {
      calls += 1;
      return diagnosticsPromise;
    },
  };
  const { getStartupAppDataDiagnostics } = loadStartupDiagnostics(api);

  const first = getStartupAppDataDiagnostics();
  const second = getStartupAppDataDiagnostics();
  resolveDiagnostics({ database: { quickCheckOk: true }, warnings: [] });

  assert.equal(await first, await second);
  assert.equal(calls, 1);
});

test('startup diagnostics cache resets after a failed diagnostics request', async () => {
  let calls = 0;
  const api = {
    getAppDataDiagnostics() {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error('diagnostics unavailable'))
        : Promise.resolve({ database: { quickCheckOk: true }, warnings: [] });
    },
  };
  const { getStartupAppDataDiagnostics } = loadStartupDiagnostics(api);

  await assert.rejects(() => getStartupAppDataDiagnostics(), /diagnostics unavailable/);
  const recovered = await getStartupAppDataDiagnostics();

  assert.equal(recovered.database.quickCheckOk, true);
  assert.equal(calls, 2);
});

test('startup self-check and startup database backup use the shared startup diagnostics helper', () => {
  const selfCheck = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'useStartupSelfCheck.ts'), 'utf8');
  const backup = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'useStartupDatabaseBackup.ts'), 'utf8');

  assert.match(selfCheck, /getStartupAppDataDiagnostics\(\)/);
  assert.match(backup, /getStartupAppDataDiagnostics\(\)/);
  assert.doesNotMatch(selfCheck, /api\s*\.\s*getAppDataDiagnostics\(\)/);
  assert.doesNotMatch(backup, /api\s*\.\s*getAppDataDiagnostics\(\)/);
});
