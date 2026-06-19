const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'services', 'updaterModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', transpiled)(module, module.exports);
  return module.exports;
}

test('browser fallback reports desktop updater unavailable', () => {
  const { createBrowserUpdaterUnavailableResult } = loadModel();
  assert.deepEqual(createBrowserUpdaterUnavailableResult(), {
    kind: 'unavailable',
    message: '桌面更新仅在 Windows 应用内可用，浏览器预览不会下载或安装更新。',
  });
});

test('release notes summary keeps concise non-empty lines', () => {
  const { summarizeReleaseNotes } = loadModel();
  assert.equal(summarizeReleaseNotes('\n# MikaVN 0.2.0\n\n- 新增内置更新\n- 保留本地数据\n- 第三条'), '新增内置更新 / 保留本地数据');
  assert.equal(summarizeReleaseNotes(''), '没有发布说明摘要。');
});

test('update result mapping normalizes available and up-to-date states', () => {
  const { mapTauriUpdateResult } = loadModel();

  assert.deepEqual(mapTauriUpdateResult(null), { kind: 'up_to_date', message: '当前已是最新版本。' });
  assert.deepEqual(mapTauriUpdateResult({ version: '0.2.0', currentVersion: '0.1.1', body: '- 新增内置更新\n- 保留本地数据' }), {
    kind: 'available',
    version: '0.2.0',
    currentVersion: '0.1.1',
    notes: '新增内置更新 / 保留本地数据',
    message: '发现新版本 0.2.0。',
  });
});

test('copyable failure message keeps useful error text', () => {
  const { formatUpdaterError } = loadModel();

  assert.equal(formatUpdaterError(new Error('signature verification failed')), '更新失败：signature verification failed');
  assert.equal(formatUpdaterError('network unavailable'), '更新失败：network unavailable');
  assert.equal(formatUpdaterError({ message: 'download failed' }), '更新失败：download failed');
});
