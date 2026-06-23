const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadDiagnosticRedaction() {
  const sourcePath = path.join(__dirname, '..', 'src', 'utils', 'diagnosticRedaction.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', transpiled)(module, module.exports);
  return module.exports;
}

function loadModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'services', 'updaterModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '@/utils/diagnosticRedaction') return loadDiagnosticRedaction();
    throw new Error(`Unexpected require: ${specifier}`);
  };
  new Function('module', 'exports', 'require', transpiled)(module, module.exports, localRequire);
  return module.exports;
}

test('browser fallback reports desktop updater unavailable', () => {
  const { createBrowserUpdaterUnavailableResult } = loadModel();
  assert.deepEqual(createBrowserUpdaterUnavailableResult(), {
    kind: 'unavailable',
    message: '桌面更新仅在 Windows 应用内可用，浏览器预览不会下载或安装更新。',
  });
});

test('updater model exposes public fallback download page', () => {
  const { updaterFallbackDownloadUrl } = loadModel();

  assert.equal(updaterFallbackDownloadUrl, 'https://github.com/apaidedie/mikavn-library/releases/latest');
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

test('updater recovery hints explain backup, signature, download, and restart failures', () => {
  const { createUpdaterRecoveryHint } = loadModel();

  assert.deepEqual(createUpdaterRecoveryHint('更新前数据库备份失败，已取消安装。'), {
    kind: 'backup_failed',
    title: '更新已取消，数据库没有被替换。',
    guidance: '先到本地数据页确认数据库备份目录可写，再重新检查并安装更新。',
    showFallbackDownload: false,
  });
  assert.deepEqual(createUpdaterRecoveryHint('更新失败：signature verification failed'), {
    kind: 'signature_failed',
    title: '签名验证失败，已阻止安装。',
    guidance: '不要继续安装这个更新包；只从官方 GitHub Release 页面重新下载。',
    showFallbackDownload: true,
  });
  assert.deepEqual(createUpdaterRecoveryHint('更新失败：download failed'), {
    kind: 'download_or_install_failed',
    title: '下载或安装没有完成。',
    guidance: '已创建的更新前备份会保留；可以重试，或打开备用下载页面手动安装。',
    showFallbackDownload: true,
  });
  assert.deepEqual(createUpdaterRecoveryHint('重启应用失败：permission denied'), {
    kind: 'restart_failed',
    title: '更新已安装，但自动重启失败。',
    guidance: '请手动关闭 MikaVN Library 后重新打开，更新会在下次启动后生效。',
    showFallbackDownload: false,
  });
});

test('updater recovery text bundles error guidance fallback link and backup evidence', () => {
  const { formatUpdaterRecoveryText, updaterFallbackDownloadUrl } = loadModel();
  const text = formatUpdaterRecoveryText({
    errorText: '更新失败：download failed',
    backup: {
      fileName: 'before-update.db',
      path: 'E:\\MikaVN Library\\app-data\\database-backups\\update-protection\\before-update.db',
    },
  });

  assert.match(text, /MikaVN 更新故障摘要/);
  assert.match(text, /错误：更新失败：download failed/);
  assert.match(text, /故障类型：下载或安装没有完成。/);
  assert.match(text, /处理建议：已创建的更新前备份会保留；可以重试，或打开备用下载页面手动安装。/);
  assert.match(text, new RegExp(`备用下载：${updaterFallbackDownloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(text, /更新前数据库备份：before-update\.db/);
  assert.match(text, /备份路径：E:\\MikaVN Library\\app-data\\database-backups\\update-protection\\before-update\.db/);
});

test('updater recovery text does not suggest manual installer after backup failure', () => {
  const { formatUpdaterRecoveryText, updaterFallbackDownloadUrl } = loadModel();
  const text = formatUpdaterRecoveryText({ errorText: '更新前数据库备份失败，已取消安装。' });

  assert.match(text, /更新已取消，数据库没有被替换。/);
  assert.doesNotMatch(text, new RegExp(updaterFallbackDownloadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('updater recovery text redacts copied secrets and Windows user names', () => {
  const { formatUpdaterRecoveryText } = loadModel();
  const text = formatUpdaterRecoveryText({
    errorText: String.raw`更新失败：download token:abc password=hunter2 API_KEY=secret C:\Users\alice\AppData\Local\MikaVN\latest.json`,
    backup: {
      fileName: 'before-update-token.db',
      path: String.raw`C:\Users\bob\AppData\Local\MikaVN\database-backups\before-update.db`,
    },
  });

  assert.match(text, /\[redacted\]/);
  assert.match(text, /C:\\Users\\\[user\]\\AppData/);
  assert.doesNotMatch(text, /abc|hunter2|secret|alice|bob/);
});

test('install progress formatter reports backup, download percent, and install phases', () => {
  const { formatUpdaterInstallProgress } = loadModel();

  assert.equal(formatUpdaterInstallProgress({ phase: 'backing_up' }), '正在创建更新前数据库备份...');
  assert.equal(formatUpdaterInstallProgress({ phase: 'downloading', downloadedBytes: 512, totalBytes: 1024, percent: 50 }), '正在下载更新：50%（512 B / 1.0 KB）');
  assert.equal(formatUpdaterInstallProgress({ phase: 'downloading', downloadedBytes: 1536, totalBytes: 4096 }), '正在下载更新：已下载 1.5 KB / 4.0 KB');
  assert.equal(formatUpdaterInstallProgress({ phase: 'downloading', downloadedBytes: 512 }), '正在下载更新：已下载 512 B');
  assert.equal(formatUpdaterInstallProgress({ phase: 'downloading', downloadedBytes: 1536 * 1024 }), '正在下载更新：已下载 1.5 MB');
  assert.equal(formatUpdaterInstallProgress({ phase: 'installing' }), '正在安装更新...');
});
