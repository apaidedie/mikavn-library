const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTsModule(relativePath, extraRequire = {}) {
  const sourcePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in extraRequire) return extraRequire[specifier];
    throw new Error(`Unexpected require: ${specifier}`);
  };
  new Function('module', 'exports', 'require', transpiled)(module, module.exports, localRequire);
  return module.exports;
}

function loadErrorMessage() {
  const errorTypes = loadTsModule('src/types/error.ts');
  const diagnosticRedaction = loadTsModule('src/utils/diagnosticRedaction.ts');
  return loadTsModule('src/utils/errorMessage.ts', {
    '@/types/error': errorTypes,
    '@/utils/diagnosticRedaction': diagnosticRedaction,
    './diagnosticRedaction': diagnosticRedaction,
  });
}

test('global UI error messages redact secrets and Windows user names', () => {
  const { errorMessage } = loadErrorMessage();

  const message = errorMessage(new Error(String.raw`operation failed token:abc API_KEY=secret C:\Users\alice\AppData\Local\MikaVN\mikavn.db`));

  assert.match(message, /\[redacted\]/);
  assert.match(message, /C:\\Users\\\[user\]\\AppData/);
  assert.doesNotMatch(message, /abc|secret|alice/);
});

test('global UI error messages redact parsed Tauri JSON error shapes', () => {
  const { errorMessage } = loadErrorMessage();
  const message = errorMessage(JSON.stringify({
    code: 'IO_ERROR',
    message: String.raw`copy failed password=hunter2 C:\Users\bob\AppData\Local\MikaVN\latest.json`,
  }));

  assert.match(message, /\[redacted\]/);
  assert.match(message, /C:\\Users\\\[user\]\\AppData/);
  assert.doesNotMatch(message, /hunter2|bob/);
});
