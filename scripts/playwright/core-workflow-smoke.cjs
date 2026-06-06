const fs = require('fs');
const path = require('path');

function resolvePlaywright() {
  const explicit = process.env.PLAYWRIGHT_MODULE;
  if (explicit) return explicit;
  const npxRoot = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  const candidates = [];
  if (fs.existsSync(npxRoot)) {
    for (const entry of fs.readdirSync(npxRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const modulePath = path.join(npxRoot, entry.name, 'node_modules', 'playwright');
      const packageJson = path.join(modulePath, 'package.json');
      if (fs.existsSync(packageJson)) candidates.push({ modulePath, mtimeMs: fs.statSync(packageJson).mtimeMs });
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.modulePath || 'playwright';
}

const { chromium } = require(resolvePlaywright());

const baseUrl = process.env.MIKAVN_QA_URL || 'http://127.0.0.1:1420/';
const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.resolve(process.env.MIKAVN_QA_OUT_DIR || path.join(repoRoot, 'output', 'playwright', 'workflow-smoke-current'));
fs.mkdirSync(outDir, { recursive: true });

const now = new Date().toISOString();
const hero = '/src/assets/hero.png';
const games = [
  {
    id: 'qa-1', title: '星之终途', originalTitle: '終のステラ', aliases: ['[汉化硬盘版] 星之终途 v1.02'], developer: 'Key', publisher: 'Visual Arts', brand: 'Key', releaseDate: '2022-09-30', description: '末世旅途题材的短篇视觉小说。这里用于成熟 V1 工作流烟测。', notes: '攻略进度：已通关第一章。', tags: ['全年龄', '科幻', '短篇'], genres: ['Visual Novel'], rating: 88, ageRating: '全年龄', playStatus: 'playing', favorite: true, hidden: false, installPath: 'D:\\Games\\VN\\星之终途', executablePath: 'D:\\Games\\VN\\星之终途\\stella.exe', workingDirectory: 'D:\\Games\\VN\\星之终途', launchArgs: null, pathStatus: 'unknown', lastPathCheckedAt: null, coverImage: hero, bannerImage: hero, backgroundImage: hero, vndbId: 'v29443', bangumiId: null, dlsiteId: 'RJ01000000', fanzaId: null, ymgalId: null, totalPlaySeconds: 12600, lastPlayedAt: now, createdAt: now, updatedAt: now,
  },
  {
    id: 'qa-2', title: '天使☆騒々 RE-BOOT!', originalTitle: null, aliases: ['天使騒々'], developer: 'Yuzusoft', publisher: null, brand: 'ゆずソフト', releaseDate: '2023-04-28', description: '路径异常样例。', notes: '', tags: ['恋爱', '校园'], genres: ['Visual Novel'], rating: 82, ageRating: 'R18', playStatus: 'planned', favorite: false, hidden: false, installPath: 'D:\\Games\\VN\\天使騒々', executablePath: 'D:\\Games\\VN\\天使騒々\\game.exe', workingDirectory: 'D:\\Games\\VN\\天使騒々', launchArgs: null, pathStatus: 'broken', lastPathCheckedAt: now, coverImage: null, bannerImage: null, backgroundImage: null, vndbId: null, bangumiId: null, dlsiteId: null, fanzaId: null, ymgalId: null, totalPlaySeconds: 0, lastPlayedAt: null, createdAt: now, updatedAt: now,
  },
];
const savePaths = [{ id: 'qa-save-path', gameId: 'qa-1', label: '默认存档', path: 'D:\\Games\\VN\\星之终途\\save', createdAt: now }];
const saveBackups = [{ id: 'qa-save-backup', gameId: 'qa-1', savePathId: 'qa-save-path', label: '手动备份', sourcePath: savePaths[0].path, backupPath: 'mock://save-backups/qa-1/manual', protection: false, createdAt: now }];
const collections = [{ id: 'qa-col-1', name: 'Key 短篇', description: 'Key short VNs', color: 'sky', gameCount: 1, createdAt: now, updatedAt: now }];
const collectionGames = [{ collectionId: 'qa-col-1', gameId: 'qa-1', addedAt: now }];
const assets = [
  { id: 'qa-asset-cover', gameId: 'qa-1', assetType: 'cover', uri: hero, source: 'mock', isPrimary: true, createdAt: now, updatedAt: now },
  { id: 'qa-asset-shot', gameId: 'qa-1', assetType: 'screenshot', uri: hero, source: 'mock', isPrimary: false, createdAt: now, updatedAt: now },
];
const tasks = [
  { id: 'qa-task-failed', taskType: 'library.scan', status: 'failed', progress: 1, message: '扫描失败：路径不存在', error: 'PATH_NOT_FOUND: D:\\Missing', retryPayload: JSON.stringify({ path: 'D:\\Missing', recursive: true }), retryable: true, createdAt: now, updatedAt: now },
];
const taskLogs = {
  'qa-task-failed': [
    { id: 'log-1', taskId: 'qa-task-failed', level: 'info', message: '开始扫描 D:\\Missing', createdAt: now },
    { id: 'log-2', taskId: 'qa-task-failed', level: 'error', message: '路径不存在，等待用户重试。', createdAt: now },
  ],
};
const settings = {
  provider_vndb_enabled: 'true',
  provider_dlsite_enabled: 'true',
  provider_fanza_enabled: 'true',
  ui_accent_color: 'vnite',
  ui_theme_mode: 'dark',
  privacy_hide_hidden: 'false',
  privacy_blur_covers: 'false',
  privacy_filter_reports: 'true',
};

const initialData = {
  'mikavn-library.mock.games': games,
  'mikavn-library.mock.tasks': tasks,
  'mikavn-library.mock.taskLogs': taskLogs,
  'mikavn-library.mock.savePaths': savePaths,
  'mikavn-library.mock.saveBackups': saveBackups,
  'mikavn-library.mock.collections': collections,
  'mikavn-library.mock.collectionGames': collectionGames,
  'mikavn-library.mock.assets': assets,
  'mikavn-library.mock.savedSearches': [],
  'mikavn-library.mock.libraryRoots': [{ id: 'qa-root-1', path: 'D:\\Games\\VN', label: 'VN Library', recursive: true, enabled: true, createdAt: now, updatedAt: now }],
  'mikavn-library.mock.settings': settings,
};

function normalizeMockPath(value) {
  return String(value || '').trim().replace(/[/]+/g, '\\').replace(/[\\/]+$/g, '').toLowerCase();
}

async function expectText(page, pattern, timeout = 7000) {
  await page.getByText(pattern).first().waitFor({ timeout });
}

async function navigate(page, view) {
  const labels = {
    dashboard: '首页',
    library: '游戏库',
    collections: '合集',
    'advanced-search': '高级搜索',
    scanner: '扫描入库',
    metadata: '批量匹配',
    tasks: '任务',
    reports: '报告',
    saves: '存档',
    settings: '设置',
  };
  await page.locator(`button[title="${labels[view]}"]`).first().click();
  await page.waitForFunction(() => document.body.innerText.length > 20, null, { timeout: 10000 });
  await page.waitForTimeout(400);
}

async function getStorage(page, key) {
  return page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey) || 'null'), key);
}

function importAuditFilter(page) {
  return page.locator('select.h-8.w-36').first();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('dialog', async (dialog) => {
    await dialog.accept(dialog.type() === 'prompt' ? dialog.defaultValue() : undefined);
  });

  await page.addInitScript(({ data }) => {
    localStorage.clear();
    localStorage.setItem('mikavn.currentView', 'advanced-search');
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value));
  }, { data: initialData });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await expectText(page, /高级搜索/);

    await page.getByPlaceholder(/输入标题|关键词|快捷搜索/).fill('rating>=80');
    await page.getByRole('button', { name: /^搜索$/ }).click();
    await expectText(page, '星之终途');
    await page.getByPlaceholder('搜索名称').fill('Smoke 高分全年龄');
    await page.getByRole('button', { name: /^保存$/ }).click();
    await expectText(page, 'Smoke 高分全年龄');
    const savedSearches = await getStorage(page, 'mikavn-library.mock.savedSearches');
    if (!Array.isArray(savedSearches) || !savedSearches.some((item) => item.name === 'Smoke 高分全年龄')) throw new Error('saved search was not persisted');
    await page.getByRole('button', { name: '删除保存搜索' }).first().click();
    const afterSavedSearchDelete = await getStorage(page, 'mikavn-library.mock.savedSearches');
    if (!Array.isArray(afterSavedSearchDelete) || afterSavedSearchDelete.some((item) => item.name === 'Smoke 高分全年龄')) throw new Error('saved search delete did not remove only the saved query record');
    console.log('OK advanced search query/save');

    await navigate(page, 'library');
    await expectText(page, /媒体图库/);
    await page.getByPlaceholder('https://example.com/cover.jpg').fill(`${baseUrl.replace(/\/$/, '')}${hero}`);
    await page.getByRole('button', { name: /下载/ }).first().click();
    await expectText(page, /图片已下载到本地缓存并设为主图/);
    await page.getByRole('button', { name: /清理缓存/ }).click();
    await expectText(page, /缓存清理完成/);
    const afterAssetGames = await getStorage(page, 'mikavn-library.mock.games');
    const afterAssetRecords = await getStorage(page, 'mikavn-library.mock.assets');
    const assetGame = afterAssetGames.find((item) => item.id === 'qa-1');
    if (assetGame?.coverImage !== `${baseUrl.replace(/\/$/, '')}${hero}`) throw new Error('asset download did not update primary cover field');
    if (!Array.isArray(afterAssetRecords) || !afterAssetRecords.some((item) => item.source === 'download' && item.uri.includes(hero))) throw new Error('asset download record was not persisted');
    console.log('OK asset gallery download/cache cleanup');

    await navigate(page, 'scanner');
    await page.getByPlaceholder(/例如/).fill('D:\\Games\\VN');
    await page.getByRole('button', { name: /开始扫描/ }).click();
    await expectText(page, /冲突/);
    const replaceRow = page.locator('label').filter({ hasText: '天使☆騒々 RE-BOOT!' }).first();
    await replaceRow.getByRole('checkbox').check();
    await replaceRow.locator('select').selectOption('replace');
    await page.getByRole('button', { name: /导入选中/ }).click();
    await expectText(page, /导入处理完成：新增 0、合并 0、替换 1、副本 0、跳过 0/);
    await expectText(page, /导入审计/);
    await expectText(page, /请求 1 个，写入 1 个，记录 1 条处理明细/);
    await expectText(page, /冲突原因：标题相同|冲突原因：安装目录已存在/);
    await expectText(page, /记录 ID：qa-2/);
    await importAuditFilter(page).selectOption('replace');
    await expectText(page, /已替换现有数据库记录/);
    const afterReplaceGames = await getStorage(page, 'mikavn-library.mock.games');
    const replacedGame = afterReplaceGames.find((item) => item.id === 'qa-2');
    if (!replacedGame || !normalizeMockPath(replacedGame.installPath).includes('ゆずソフト\\天使騒々'.toLowerCase())) throw new Error('scanner replace did not update the existing database record path');
    console.log('OK scanner replace database-record only and import audit');

    await page.getByPlaceholder(/例如/).fill('D:\\Games\\VN');
    await page.getByRole('button', { name: /开始扫描/ }).click();
    await expectText(page, /冲突/);
    const conflictRow = page.locator('label').filter({ hasText: '星之终途' }).first();
    await conflictRow.getByRole('checkbox').check();
    await conflictRow.locator('select').selectOption('duplicate');
    await page.getByRole('button', { name: /导入选中/ }).click();
    await expectText(page, /导入处理完成：新增 0、合并 0、替换 0、副本 1、跳过 0/);
    await expectText(page, /导入审计/);
    await importAuditFilter(page).selectOption('duplicate');
    await expectText(page, /已作为副本导入/);
    await expectText(page, /冲突原因：安装目录已存在|冲突原因：标题相同/);
    await expectText(page, /D:\\Games\\VN\\星之终途/);
    const afterImportGames = await getStorage(page, 'mikavn-library.mock.games');
    if (!Array.isArray(afterImportGames) || afterImportGames.length < 3) throw new Error('scanner duplicate import did not add a game');
    console.log('OK scanner conflict review/duplicate import audit');

    await navigate(page, 'saves');
    await expectText(page, /存档管理/);
    await page.locator('select').first().selectOption('qa-1');
    await expectText(page, '默认存档');
    await page.getByRole('button', { name: /备份/ }).first().click();
    await expectText(page, /存档备份任务已创建/);
    await page.getByRole('button', { name: /^恢复$/ }).first().click();
    await expectText(page, /合并存档恢复任务已创建/);
    await page.getByRole('button', { name: /镜像恢复/ }).first().click();
    await expectText(page, /镜像存档恢复任务已创建/);
    const backups = await getStorage(page, 'mikavn-library.mock.saveBackups');
    if (!Array.isArray(backups) || backups.filter((item) => item.protection).length < 2) throw new Error('restore flows did not create protection backup records');
    await page.getByRole('button', { name: '删除备份记录' }).first().click();
    await expectText(page, /备份记录已删除，备份文件夹未被删除/);
    const afterBackupDelete = await getStorage(page, 'mikavn-library.mock.saveBackups');
    if (!Array.isArray(afterBackupDelete) || afterBackupDelete.length !== backups.length - 1) throw new Error('backup record delete should remove one database record only');
    const savePathsBeforeRemove = await getStorage(page, 'mikavn-library.mock.savePaths');
    await page.getByRole('button', { name: '移除存档路径记录' }).first().click();
    await expectText(page, /存档路径记录已移除，真实存档目录未被删除/);
    const savePathsAfterRemove = await getStorage(page, 'mikavn-library.mock.savePaths');
    if (!Array.isArray(savePathsBeforeRemove) || !Array.isArray(savePathsAfterRemove) || savePathsAfterRemove.length !== savePathsBeforeRemove.length - 1) throw new Error('save path remove should remove one database record only');
    console.log('OK saves backup/merge/mirror restore protection and record-only deletes');

    await navigate(page, 'settings');
    await expectText(page, /设置/);
    await page.getByRole('tab', { name: /本地与隐私/ }).click();
    await expectText(page, /标签维护/);
    await page.locator('select').filter({ has: page.locator('option', { hasText: '标签 · 全年龄' }) }).selectOption('tag:%E5%85%A8%E5%B9%B4%E9%BE%84');
    await page.getByPlaceholder('新标签名').fill('全年龄QA');
    await page.getByRole('button', { name: /^重命名$/ }).click();
    await expectText(page, /标签已重命名为：全年龄QA/);
    await page.locator('select').filter({ has: page.locator('option', { hasText: '标签 · 全年龄QA' }) }).selectOption('tag:%E5%85%A8%E5%B9%B4%E9%BE%84QA');
    await page.locator('label').filter({ hasText: /标签 · 科幻/ }).getByRole('checkbox').check();
    await page.getByRole('button', { name: /^合并所选$/ }).click();
    await expectText(page, /已合并 1 个标签到：全年龄QA/);
    await page.locator('select').filter({ has: page.locator('option', { hasText: '标签 · 恋爱' }) }).selectOption('tag:%E6%81%8B%E7%88%B1');
    await page.getByRole('button', { name: /^删除标签$/ }).click();
    await expectText(page, /标签已删除：恋爱/);
    const afterTagsGames = await getStorage(page, 'mikavn-library.mock.games');
    const tagGame = afterTagsGames.find((item) => item.id === 'qa-1');
    const deletedTagGame = afterTagsGames.find((item) => item.id === 'qa-2');
    if (!tagGame?.tags.includes('全年龄QA') || tagGame.tags.includes('科幻')) throw new Error('tag rename/merge did not update game tags');
    if (deletedTagGame?.tags.includes('恋爱')) throw new Error('tag delete did not remove tag from games');
    console.log('OK tag maintenance rename/merge/delete');

    await expectText(page, /诊断日志/);
    await page.getByRole('button', { name: /^备份$/ }).click();
    await expectText(page, /数据库备份任务已创建/);
    await page.getByRole('button', { name: /安排恢复/ }).click();
    await expectText(page, /数据库恢复任务已创建/);
    await page.getByRole('button', { name: /刷新/ }).first().click();
    await expectText(page, /mock-1\.log|localStorage:\/\/task|最近日志|还没有诊断日志/);
    await page.locator('input[placeholder*="MikaVN-Archives"]').fill('D:\\MikaVN-Smoke-Archive');
    await page.getByRole('button', { name: /^预览$/ }).click();
    await expectText(page, /归档预览已读取/);
    await page.getByRole('button', { name: /安全导入/ }).click();
    await expectText(page, /库归档安全导入任务已创建/);
    await page.getByRole('button', { name: /导出 ZIP/ }).click();
    await expectText(page, /ZIP 库归档导出任务已创建/);
    console.log('OK settings logs/archive import zip task');

    await navigate(page, 'tasks');
    const databaseRestoreRow = page.locator('.motion-soft-row').filter({ hasText: /数据库恢复/ }).first();
    await databaseRestoreRow.getByRole('button', { name: /日志/ }).click();
    await expectText(page, /数据库恢复来源/);
    await expectText(page, /数据库恢复待应用/);
    console.log('OK database restore audit logs');
    const saveRestoreRow = page.locator('.motion-soft-row').filter({ hasText: /存档恢复/ }).first();
    await saveRestoreRow.getByRole('button', { name: /日志/ }).click();
    await expectText(page, /存档恢复保护备份/);
    await expectText(page, /存档恢复报告：模式/);
    console.log('OK save restore audit logs');
    const archiveImportRow = page.locator('.motion-soft-row').filter({ hasText: /库归档导入/ }).first();
    await archiveImportRow.getByRole('button', { name: /日志/ }).click();
    await expectText(page, /归档导入保护备份/);
    await expectText(page, /归档导入新增/);
    await expectText(page, /归档导入跳过/);
    console.log('OK archive import audit logs');
    await page.getByRole('button', { name: /日志/ }).first().click();
    await expectText(page, /任务日志|浏览器预览|路径不存在/);
    const allTasks = await getStorage(page, 'mikavn-library.mock.tasks');
    if (!Array.isArray(allTasks) || allTasks.length < 4) throw new Error('expected smoke tasks to be recorded');
    await page.screenshot({ path: path.join(outDir, 'core-workflows-final.png'), fullPage: true });
    console.log('OK task log expansion and recorded tasks');

    const importantConsoleErrors = consoleErrors.filter((item) => !/favicon|DevTools/.test(item));
    if (importantConsoleErrors.length > 0) throw new Error(`console errors: ${importantConsoleErrors.join(' | ')}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
