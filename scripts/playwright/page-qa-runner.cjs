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
      if (fs.existsSync(packageJson)) {
        candidates.push({ modulePath, mtimeMs: fs.statSync(packageJson).mtimeMs });
      }
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (candidates[0]) return candidates[0].modulePath;
  return 'playwright';
}

const { chromium } = require(resolvePlaywright());

const baseUrl = process.env.MIKAVN_QA_URL || 'http://127.0.0.1:1420/';
const repoRoot = path.resolve(__dirname, '..', '..');
const outDir = path.resolve(process.env.MIKAVN_QA_OUT_DIR || path.join(repoRoot, 'output', 'playwright', 'page-qa-current'));
fs.mkdirSync(outDir, { recursive: true });

const now = new Date().toISOString();
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const hero = '/src/assets/hero.png';
const richDescription = `末世旅途题材的短篇视觉小说。这里用于成熟 V1 页面 QA。\n\n![作品介绍图](${hero})\n\n图片下方的正文也应该继续显示。`;
const games = [
  {
    id: 'qa-1', title: '星之终途', originalTitle: '終のステラ', aliases: ['[汉化硬盘版] 星之终途 v1.02'], developer: 'Key', publisher: 'Visual Arts', brand: 'Key', releaseDate: '2022-09-30', description: richDescription, notes: '攻略进度：已通关第一章。', tags: ['全年龄', '科幻', '短篇'], genres: ['Visual Novel'], rating: 88, ageRating: '全年龄', playStatus: 'playing', favorite: true, hidden: false, installPath: 'D:\\Games\\VN\\星之终途', executablePath: 'D:\\Games\\VN\\星之终途\\stella.exe', workingDirectory: 'D:\\Games\\VN\\星之终途', launchArgs: null, pathStatus: 'unknown', lastPathCheckedAt: null, coverImage: hero, bannerImage: hero, backgroundImage: hero, vndbId: 'v29443', bangumiId: null, dlsiteId: 'RJ01000000', fanzaId: null, ymgalId: null, totalPlaySeconds: 12600, lastPlayedAt: now, createdAt: now, updatedAt: now,
  },
  {
    id: 'qa-2', title: '天使☆騒々 RE-BOOT!', originalTitle: null, aliases: ['天使騒々'], developer: 'Yuzusoft', publisher: null, brand: 'ゆずソフト', releaseDate: '2023-04-28', description: '路径异常样例，用于检查 warning 和修复入口。', notes: '', tags: ['恋爱', '校园'], genres: ['Visual Novel'], rating: 82, ageRating: 'R18', playStatus: 'planned', favorite: false, hidden: false, installPath: 'D:\\Games\\VN\\天使騒々', executablePath: 'D:\\Games\\VN\\天使騒々\\game.exe', workingDirectory: 'D:\\Games\\VN\\天使騒々', launchArgs: null, pathStatus: 'broken', lastPathCheckedAt: now, coverImage: null, bannerImage: null, backgroundImage: null, vndbId: null, bangumiId: null, dlsiteId: null, fanzaId: null, ymgalId: null, totalPlaySeconds: 0, lastPlayedAt: null, createdAt: now, updatedAt: now,
  },
];
const descriptionRepairGame = {
  ...games[1],
  id: 'qa-description-repair',
  title: '简介图片修复候选',
  originalTitle: '紹介画像修復候補',
  aliases: [],
  description: 'DLsite 来源条目，当前简介里没有图片，用于维护中心修复入口 QA。',
  dlsiteId: 'RJ01000001',
  fanzaId: null,
  installPath: 'D:\\Games\\VN\\简介图片修复候选',
  executablePath: 'D:\\Games\\VN\\简介图片修复候选\\game.exe',
  workingDirectory: 'D:\\Games\\VN\\简介图片修复候选',
};
const duplicateExternalIdGame = {
  ...games[1],
  id: 'qa-duplicate-id',
  title: '星之终途 重复记录',
  originalTitle: '終のステラ duplicate',
  aliases: [],
  description: '重复外部 ID 审查候选。',
  vndbId: 'v29443',
  dlsiteId: null,
  fanzaId: null,
  installPath: 'D:\\Games\\VN\\星之终途-重复记录',
  executablePath: 'D:\\Games\\VN\\星之终途-重复记录\\stella.exe',
  workingDirectory: 'D:\\Games\\VN\\星之终途-重复记录',
};
const artworkRepairGame = {
  ...games[1],
  id: 'qa-artwork-repair',
  title: '媒体图片补全候选',
  originalTitle: 'Artwork Repair Candidate',
  aliases: [],
  description: '已有 VNDB ID，但缺封面和背景，用于维护中心补图入口 QA。',
  vndbId: 'v29443',
  dlsiteId: null,
  fanzaId: null,
  coverImage: null,
  backgroundImage: null,
  installPath: 'D:\\Games\\VN\\媒体图片补全候选',
  executablePath: 'D:\\Games\\VN\\媒体图片补全候选\\game.exe',
  workingDirectory: 'D:\\Games\\VN\\媒体图片补全候选',
};
const brokenMediaReferenceGame = {
  ...games[0],
  id: 'qa-broken-media-ref',
  title: '图片引用异常候选',
  originalTitle: 'Image Reference Audit Candidate',
  description: '用于详情页图片引用审计 QA。',
  bannerImage: hero,
  installPath: 'D:\\Games\\VN\\图片引用异常候选',
  executablePath: 'D:\\Games\\VN\\图片引用异常候选\\game.exe',
  workingDirectory: 'D:\\Games\\VN\\图片引用异常候选',
};
const brokenMediaReferenceAsset = { id: 'qa-broken-media-asset', gameId: 'qa-broken-media-ref', assetType: 'audit_only', uri: 'D:\\Playnite\\library\\files\\missing-banner.jpg', source: 'mock', isPrimary: false, createdAt: now, updatedAt: now };
const tasks = [
  { id: 'qa-task-failed', taskType: 'library.scan', status: 'failed', progress: 1, message: '扫描失败：路径不存在', error: 'PATH_NOT_FOUND: D:\\Missing', retryPayload: JSON.stringify({ path: 'D:\\Missing', recursive: true }), retryable: true, createdAt: now, updatedAt: now },
  { id: 'qa-task-running', taskType: 'metadata.batch_match', status: 'running', progress: 0.42, message: '正在匹配 2 个游戏', error: null, retryPayload: JSON.stringify({ gameIds: ['qa-1', 'qa-2'] }), retryable: true, createdAt: tenMinutesAgo, updatedAt: now },
  { id: 'qa-task-maintenance-failed', taskType: 'metadata.artwork_repair', status: 'failed', progress: 1, message: '媒体补图失败：来源无响应', error: 'PROVIDER_TIMEOUT: VNDB', retryPayload: JSON.stringify({ providers: ['all'], fields: ['cover', 'banner', 'background'], limit: 20 }), retryable: true, createdAt: tenMinutesAgo, updatedAt: now },
];
const taskLogs = {
  'qa-task-failed': [
    { id: 'log-1', taskId: 'qa-task-failed', level: 'info', message: '开始扫描 D:\\Missing', createdAt: now },
    { id: 'log-2', taskId: 'qa-task-failed', level: 'error', message: '路径不存在，等待用户重试。', createdAt: now },
  ],
  'qa-task-running': [{ id: 'log-3', taskId: 'qa-task-running', level: 'info', message: 'VNDB 查询完成。', createdAt: now }],
  'qa-task-maintenance-failed': [{ id: 'log-4', taskId: 'qa-task-maintenance-failed', level: 'error', message: '媒体补图失败：来源无响应。', createdAt: now }],
};
const savePaths = [{ id: 'qa-save-path', gameId: 'qa-1', label: '默认存档', path: 'D:\\Games\\VN\\星之终途\\save', createdAt: now }];
const saveBackups = [{ id: 'qa-save-backup', gameId: 'qa-1', savePathId: 'qa-save-path', label: '手动备份', sourcePath: savePaths[0].path, backupPath: 'mock://save-backups/qa-1/manual', protection: false, createdAt: now }];
const collections = [{ id: 'qa-col-1', name: 'Key 短篇', description: 'Key short VNs', color: 'sky', gameCount: 1, createdAt: now, updatedAt: now }];
const collectionGames = [{ collectionId: 'qa-col-1', gameId: 'qa-1', addedAt: now }];
const assets = [
  { id: 'qa-asset-cover', gameId: 'qa-1', assetType: 'cover', uri: hero, source: 'mock', isPrimary: true, createdAt: now, updatedAt: now },
  { id: 'qa-asset-shot', gameId: 'qa-1', assetType: 'screenshot', uri: hero, source: 'mock', isPrimary: false, createdAt: now, updatedAt: now },
];
const savedSearches = [{ id: 'qa-search-1', name: '高分全年龄', query: 'tag:全年龄 rating>=80', description: null, createdAt: now, updatedAt: now }];
const libraryRoots = [{ id: 'qa-root-1', path: 'D:\\Games\\VN', label: 'VN Library', recursive: true, enabled: true, createdAt: now, updatedAt: now }];
const settings = {
  provider_vndb_enabled: 'true',
  provider_dlsite_enabled: 'true',
  provider_fanza_enabled: 'true',
  ui_accent_color: 'vnite',
  ui_theme_mode: 'dark',
  privacy_hide_hidden: 'false',
  privacy_blur_covers: 'false',
  privacy_filter_reports: 'true',
  save_auto_backup_before_launch: 'false',
  save_auto_backup_after_exit: 'false',
};

function mockData(overrides = {}) {
  return {
    'mikavn-library.mock.games': overrides.games ?? games,
    'mikavn-library.mock.tasks': overrides.tasks ?? tasks,
    'mikavn-library.mock.taskLogs': overrides.taskLogs ?? taskLogs,
    'mikavn-library.mock.savePaths': overrides.savePaths ?? savePaths,
    'mikavn-library.mock.saveBackups': overrides.saveBackups ?? saveBackups,
    'mikavn-library.mock.collections': overrides.collections ?? collections,
    'mikavn-library.mock.collectionGames': overrides.collectionGames ?? collectionGames,
    'mikavn-library.mock.assets': overrides.assets ?? assets,
    'mikavn-library.mock.savedSearches': overrides.savedSearches ?? savedSearches,
    'mikavn-library.mock.libraryRoots': overrides.libraryRoots ?? libraryRoots,
    'mikavn-library.mock.settings': overrides.settings ?? settings,
  };
}

async function seed(page, view, overrides = {}) {
  await page.addInitScript(({ nextView, data }) => {
    localStorage.clear();
    localStorage.setItem('mikavn.currentView', nextView);
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, { nextView: view, data: mockData(overrides) });
}

async function waitForApp(page) {
  await page.waitForSelector('body', { timeout: 10000 });
  await page.waitForFunction(() => /MikaVN|游戏|任务|搜索|设置|存档|扫描|报告|合集|维护|Library/i.test(document.body.innerText), null, { timeout: 10000 });
  await page.waitForTimeout(650);
}

async function openSeeded(browser, view, overrides = {}) {
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));
      page.on('dialog', async (dialog) => {
        await dialog.accept(dialog.type() === 'prompt' ? dialog.defaultValue() : undefined);
      });
      await seed(page, view, overrides);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForApp(page);
      return { context, page, consoleErrors };
    } catch (error) {
      lastError = error;
      await context.close().catch(() => undefined);
      if (!isRetryableOpenError(error) || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

function isRetryableOpenError(error) {
  const message = String(error?.message ?? error);
  return /page\.goto: Timeout|Timeout \d+ms exceeded|Navigation timeout|net::ERR_CONNECTION|Target closed/i.test(message);
}

async function capture(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function runCase(browser, name, view, overrides = {}, interact) {
  const { context, page, consoleErrors } = await openSeeded(browser, view, overrides);
  try {
    if (interact) await interact(page);
    const file = await capture(page, name);
    const text = await page.locator('body').innerText({ timeout: 5000 });
    if (!text.trim()) throw new Error(`${name}: blank body`);
    if (consoleErrors.length > 0) {
      const important = consoleErrors.filter((item) => !/favicon|DevTools/.test(item));
      if (important.length > 0) throw new Error(`${name}: console errors: ${important.join(' | ')}`);
    }
    console.log(`OK ${name} -> ${file}`);
  } finally {
    await context.close();
  }
}

async function clickMaintenanceStart(page, label) {
  const row = page.locator('.items-center.justify-between').filter({ has: page.getByText(label, { exact: true }) }).filter({ has: page.getByRole('button', { name: /开始/ }) }).first();
  await row.getByRole('button', { name: /开始/ }).click();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const cases = [
      ['dashboard-populated', 'dashboard'],
      ['dashboard-task-shortcuts', 'dashboard', {}, async (page) => {
        await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /需处理\s+2/ }).click();
        await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('任务状态筛选').inputValue() !== 'attention') throw new Error('dashboard attention shortcut did not select attention task filter');
        await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
        if (await page.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running task should be hidden after dashboard attention shortcut');
        await page.getByLabel('首页').click();
        await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /进行中\s+1/ }).click();
        await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('任务状态筛选').inputValue() !== 'active') throw new Error('dashboard running shortcut did not select active task filter');
        await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
        if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden after dashboard running shortcut');
      }],
      ['library-populated-detail-artwork', 'library', {}, async (page) => {
        await page.getByText('图片下方的正文也应该继续显示。').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体完整').first().waitFor({ timeout: 5000 });
        await page.getByText('1 张引用').first().waitFor({ timeout: 5000 });
        const descriptionImages = page.locator('section').filter({ hasText: '简介' }).locator('figure img');
        if (await descriptionImages.count() < 1) throw new Error('library detail description image was not rendered');
        await page.getByText('媒体图库').first().waitFor({ timeout: 5000 });
        const downloadedCoverUrl = `${baseUrl.replace(/\/$/, '')}${hero}`;
        await page.getByPlaceholder('https://example.com/cover.jpg').fill(downloadedCoverUrl);
        await page.getByRole('button', { name: /下载/ }).first().click();
        await page.getByText(/图片已下载到本地缓存并设为主图/).first().waitFor({ timeout: 5000 });
        const assetGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const assetRecords = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.assets') || '[]'));
        const assetGame = assetGames.find((game) => game.id === 'qa-1');
        if (assetGame?.coverImage !== downloadedCoverUrl) throw new Error('page QA asset download did not update primary cover field');
        if (!Array.isArray(assetRecords) || !assetRecords.some((asset) => asset.gameId === 'qa-1' && asset.source === 'download' && asset.uri === downloadedCoverUrl)) throw new Error('page QA asset download record was not persisted');
        await page.getByRole('button', { name: /清理缓存/ }).click();
        await page.getByText(/缓存清理完成/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '批量', exact: true }).click();
        await page.getByRole('button', { name: /选中当前/ }).click();
        await page.getByText(/已选 2/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /反选当前/ }).click();
        await page.getByText(/已选 0/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /反选当前/ }).click();
        await page.getByText(/已选 2/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('批量游玩状态').selectOption('completed');
        await page.getByRole('button', { name: /应用状态/ }).click();
        await page.getByText(/已更新 2 个游戏：游玩状态：已通关/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('批量加入合集').selectOption('qa-col-1');
        await page.getByRole('button', { name: /加入合集/ }).click();
        await page.getByText(/已将 2 个游戏加入合集：Key 短篇/).first().waitFor({ timeout: 5000 });
        let collectionLinks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collectionGames') || '[]'));
        let linkedIds = new Set(collectionLinks.filter((link) => link.collectionId === 'qa-col-1').map((link) => link.gameId));
        if (!['qa-1', 'qa-2'].every((id) => linkedIds.has(id))) throw new Error('library bulk edit did not add selected games to collection');
        await page.getByRole('button', { name: /移出合集/ }).click();
        await page.getByText(/已将 2 个游戏移出合集：Key 短篇/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('批量标签').fill('测试标签，短篇');
        await page.getByRole('button', { name: /批量添加标签/ }).click();
        await page.getByText(/已为 2 个游戏添加标签：测试标签、短篇/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('批量标签').fill('测试标签');
        await page.getByRole('button', { name: /批量移除标签/ }).click();
        await page.getByText(/已为 2 个游戏移除标签：测试标签/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^隐藏$/ }).click();
        await page.getByText(/已更新 2 个游戏：隐藏条目/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /取消隐藏/ }).click();
        await page.getByText(/已更新 2 个游戏：取消隐藏/).first().waitFor({ timeout: 5000 });
        const updatedGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        if (!updatedGames.every((game) => game.playStatus === 'completed' && game.hidden === false)) throw new Error('library bulk edit did not update selected games');
        if (!updatedGames.every((game) => !game.tags.includes('测试标签'))) throw new Error('library bulk tag remove did not update selected games');
        const starTags = updatedGames.find((game) => game.id === 'qa-1')?.tags.filter((tag) => tag === '短篇') ?? [];
        if (starTags.length !== 1) throw new Error('library bulk tag add duplicated an existing tag');
        if (!updatedGames.find((game) => game.id === 'qa-2')?.tags.includes('短篇')) throw new Error('library bulk tag add did not update selected games');
        collectionLinks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collectionGames') || '[]'));
        linkedIds = new Set(collectionLinks.filter((link) => link.collectionId === 'qa-col-1').map((link) => link.gameId));
        if (['qa-1', 'qa-2'].some((id) => linkedIds.has(id))) throw new Error('library bulk edit did not remove selected games from collection');
      }],
      ['library-detail-image-audit', 'library', { games: [...games, brokenMediaReferenceGame], assets: [...assets, brokenMediaReferenceAsset] }, async (page) => {
        await page.getByText('图片引用异常候选').first().click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /检查引用/ }).click();
        await page.getByText(/图片引用检查完成：发现/).first().waitFor({ timeout: 5000 });
        await page.getByText(/问题引用/).first().waitFor({ timeout: 5000 });
        await page.getByText('Playnite').first().waitFor({ timeout: 5000 });
        await page.getByText('D:\\Playnite\\library\\files\\missing-banner.jpg').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /到维护中心处理/ }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('图片引用问题').first().waitFor({ timeout: 5000 });
        await page.getByText(/图片引用审计完成：发现/).first().waitFor({ timeout: 5000 });
        await page.getByText('D:\\Playnite\\library\\files\\missing-banner.jpg').first().waitFor({ timeout: 5000 });
        const imageAuditPanel = page.locator('section').filter({ hasText: '图片引用问题' }).first();
        await imageAuditPanel.getByLabel('图片引用搜索').fill('Playnite');
        await imageAuditPanel.getByText('D:\\Playnite\\library\\files\\missing-banner.jpg').first().waitFor({ timeout: 5000 });
        await imageAuditPanel.getByLabel('图片引用问题筛选').selectOption('c_drive');
        await imageAuditPanel.getByText('当前筛选没有匹配的图片引用。').first().waitFor({ timeout: 5000 });
        await imageAuditPanel.getByRole('button', { name: /重置筛选/ }).click();
        await imageAuditPanel.getByText('D:\\Playnite\\library\\files\\missing-banner.jpg').first().waitFor({ timeout: 5000 });
        await imageAuditPanel.getByRole('button', { name: /^游戏$/ }).first().click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('图片引用异常候选').first().waitFor({ timeout: 5000 });
      }],
      ['library-empty', 'library', { games: [] }],
      ['collections-populated', 'collections'],
      ['metadata-batch', 'metadata', {}, async (page) => {
        const queueGapShortcuts = page.locator('[aria-label="缺口快捷筛选"]');
        await queueGapShortcuts.getByRole('button', { name: /缺全部 ID\s+1/ }).click();
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'external_id') throw new Error('metadata quick gap filter did not select missing external ID filter');
        await page.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await queueGapShortcuts.getByRole('button', { name: /FANZA\s+2/ }).click();
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'fanza') throw new Error('metadata quick gap filter did not select FANZA filter');
        await queueGapShortcuts.getByRole('button', { name: /全部\s+2/ }).click();
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'all') throw new Error('metadata quick gap filter did not reset to all missing providers');
        await page.getByLabel('匹配队列搜索').fill('天使');
        await page.getByRole('button', { name: /选择当前筛选/ }).click();
        await page.getByRole('button', { name: /开始匹配 1 个条目/ }).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /重置队列/ }).click();
        await page.getByRole('button', { name: /清空/ }).first().click();
        await page.getByRole('button', { name: /开始匹配 0 个条目/ }).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /只补媒体/ }).click();
        if (await page.getByLabel('简介').isChecked()) throw new Error('metadata media preset should not include description');
        if (!(await page.getByLabel('封面').isChecked()) || !(await page.getByLabel('外部 ID').isChecked())) throw new Error('metadata media preset should include cover and external IDs');
        await page.getByRole('button', { name: /只补文本/ }).click();
        if (!(await page.getByLabel('简介').isChecked()) || await page.getByLabel('封面').isChecked()) throw new Error('metadata text preset did not toggle fields');
        await page.getByRole('button', { name: /安全补全/ }).click();
        await page.getByLabel('缺失来源筛选').selectOption('dlsite');
        await page.getByRole('button', { name: /选择当前筛选/ }).click();
        await page.getByRole('button', { name: /开始匹配/ }).click();
        await page.getByText(/批量匹配任务已启动/).first().waitFor({ timeout: 5000 });
        await page.getByText('成功').first().waitFor({ timeout: 5000 });
        await page.getByText('待复核').first().waitFor({ timeout: 5000 });
        await page.getByLabel('匹配结果搜索').fill('RJ01000000');
        await page.getByText(/推荐：DLsite RJ01000000/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('匹配结果搜索').fill('没有这种匹配结果');
        await page.getByText('当前筛选没有匹配结果。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /重置筛选/ }).first().click();
        await page.getByText(/推荐：/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('匹配写入状态筛选').selectOption('writable');
        await page.getByText(/推荐：/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /应用当前推荐/ }).click();
        await page.getByText(/已写入/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('匹配写入状态筛选').selectOption('applied');
        await page.getByText(/已写入/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('匹配写入状态筛选').selectOption('writable');
        await page.getByLabel('匹配结果状态筛选').selectOption('error');
        await page.getByText('当前筛选没有匹配结果。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /重置筛选/ }).first().click();
        await page.getByText(/推荐：/).first().waitFor({ timeout: 5000 });
      }],
      ['reports-populated', 'reports'],
      ['saves-backup-restore', 'saves', {}, async (page) => {
        await page.getByText('存档管理').first().waitFor({ timeout: 5000 });
        await page.locator('select').first().selectOption('qa-1');
        await page.getByText('默认存档').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /备份/ }).first().click();
        await page.getByText(/存档备份任务已创建/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^预览$/ }).first().click();
        await page.getByText(/合并恢复预览完成：新增 1，覆盖 2，保留 2/).first().waitFor({ timeout: 5000 });
        await page.getByText('合并预览').first().waitFor({ timeout: 5000 });
        await page.getByText('将保留').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^恢复$/ }).first().click();
        await page.getByText(/合并存档恢复任务已创建/).first().waitFor({ timeout: 5000 });
        await page.getByText('保护备份').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /镜像预览/ }).first().click();
        await page.getByText(/镜像恢复预览完成：新增 1，覆盖 2，清理 4/).first().waitFor({ timeout: 5000 });
        await page.getByText('镜像预览').first().waitFor({ timeout: 5000 });
        await page.getByText('将清理').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /镜像恢复/ }).first().click();
        await page.getByText(/镜像存档恢复任务已创建/).first().waitFor({ timeout: 5000 });
        const backupRecords = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.saveBackups') || '[]'));
        if (!Array.isArray(backupRecords) || backupRecords.filter((item) => item.protection).length < 2) throw new Error('page QA save restore flows did not create protection backup records');
      }],
      ['maintenance-health-description-repair', 'maintenance', { games: [...games, descriptionRepairGame] }, async (page) => {
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('最近维护任务').first().waitFor({ timeout: 5000 });
        const mediaSummaryPanel = page.locator('section').filter({ hasText: '媒体与简介' }).first();
        await mediaSummaryPanel.getByRole('button', { name: /在游戏库查看缺封面/ }).click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('元数据筛选').inputValue() !== 'missing_cover') throw new Error('maintenance missing-cover shortcut did not select library metadata filter');
        await page.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('最近维护任务').first().waitFor({ timeout: 5000 });
        const completenessPanel = page.locator('section').filter({ hasText: '重复与完整度' }).first();
        await completenessPanel.getByRole('button', { name: /在游戏库查看路径异常/ }).click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('路径筛选').inputValue() !== 'broken') throw new Error('maintenance broken-path shortcut did not select library path filter');
        await page.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('最近维护任务').first().waitFor({ timeout: 5000 });


        await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体补图失败：来源无响应').first().waitFor({ timeout: 5000 });
        if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('maintenance task panel should not show scan tasks');
        const maintenanceTaskPanel = page.locator('section').filter({ hasText: '最近维护任务' }).first();
        const maintenanceTaskShortcuts = maintenanceTaskPanel.locator('[aria-label="维护任务状态快捷筛选"]');
        await maintenanceTaskShortcuts.getByRole('button', { name: /需处理\s+1/ }).click();
        await maintenanceTaskPanel.getByText('媒体补图失败：来源无响应').first().waitFor({ timeout: 5000 });
        if (await maintenanceTaskPanel.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running maintenance task should be hidden by attention filter');
        await maintenanceTaskShortcuts.getByRole('button', { name: /进行中\s+1/ }).click();
        await maintenanceTaskPanel.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
        if (await maintenanceTaskPanel.getByText('媒体补图失败：来源无响应').count() > 0) throw new Error('failed maintenance task should be hidden by active filter');
        await maintenanceTaskShortcuts.getByRole('button', { name: /全部\s+2/ }).click();
        await maintenanceTaskPanel.getByText('媒体补图失败：来源无响应').first().waitFor({ timeout: 5000 });
        await maintenanceTaskPanel.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
        await maintenanceTaskPanel.locator('.motion-soft-row').filter({ hasText: '媒体补图失败：来源无响应' }).first().getByRole('button', { name: /^重试$/ }).click();
        await page.getByText(/已重新创建维护任务：媒体图片补全/).first().waitFor({ timeout: 5000 });
        await maintenanceTaskPanel.getByText(/浏览器预览已补全/).first().waitFor({ timeout: 5000 });
        await maintenanceTaskPanel.locator('.motion-soft-row').filter({ hasText: '正在匹配 2 个游戏' }).first().getByRole('button', { name: /^取消$/ }).click();
        await page.getByText(/已取消维护任务：批量元数据匹配/).first().waitFor({ timeout: 5000 });
        await maintenanceTaskPanel.locator('.motion-soft-row').filter({ hasText: '任务已取消' }).first().waitFor({ timeout: 5000 });
        await page.locator('section').filter({ hasText: '最近维护任务' }).first().getByRole('button', { name: /日志/ }).first().click();
        await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
        await page.getByText(/浏览器预览已补全|任务已取消|正在匹配 2 个游戏/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('简介图片覆盖').first().waitFor({ timeout: 5000 });
        await page.getByText('维护队列').first().waitFor({ timeout: 5000 });
        await page.getByText('简介图片修复').first().waitFor({ timeout: 5000 });
        await clickMaintenanceStart(page, '简介图片修复');
        await page.getByText(/浏览器预览已修复|已创建简介图片修复任务/).first().waitFor({ timeout: 5000 });
      }],
      ['maintenance-health-metadata-match', 'maintenance', {}, async (page) => {
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('维护队列').first().waitFor({ timeout: 5000 });
        await page.getByText('批量元数据匹配').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /处理缺 ID/ }).click();
        await page.getByText('批量匹配').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'external_id') throw new Error('metadata missing external ID preset did not select external_id filter');
        await page.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await clickMaintenanceStart(page, '批量元数据匹配');
        await page.getByText(/批量匹配完成|已创建批量元数据匹配任务/).first().waitFor({ timeout: 5000 });
      }],
      ['maintenance-health-artwork-repair', 'maintenance', { games: [...games, artworkRepairGame] }, async (page) => {
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /读取诊断/ }).click();
        const artworkDiagnosisPanel = page.locator('section').filter({ hasText: '媒体补全诊断' }).first();
        await artworkDiagnosisPanel.getByLabel('媒体补全诊断状态筛选').selectOption('missing_external_id');
        await artworkDiagnosisPanel.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await artworkDiagnosisPanel.locator('.motion-soft-row').filter({ hasText: '天使☆騒々 RE-BOOT!' }).first().getByRole('button', { name: /^匹配$/ }).click();
        await page.getByText('批量匹配').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'external_id') throw new Error('diagnosis metadata shortcut did not select external_id filter');
        if (await page.getByLabel('匹配队列搜索').inputValue() !== '天使☆騒々 RE-BOOT!') throw new Error('diagnosis metadata shortcut did not prefill queue search');
        await page.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /读取诊断/ }).click();
        await artworkDiagnosisPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkDiagnosisPanel.getByLabel('媒体补全诊断搜索').fill('媒体图片补全候选');
        await artworkDiagnosisPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkDiagnosisPanel.getByLabel('媒体补全诊断状态筛选').selectOption('missing_external_id');
        await artworkDiagnosisPanel.getByText('当前筛选没有匹配的媒体补全诊断。').first().waitFor({ timeout: 5000 });
        await artworkDiagnosisPanel.getByRole('button', { name: /重置筛选/ }).click();
        await artworkDiagnosisPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkDiagnosisPanel.getByRole('button', { name: /^游戏$/ }).first().click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护队列').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体图片补全').first().waitFor({ timeout: 5000 });
        await clickMaintenanceStart(page, '媒体图片补全');
        await page.getByText(/浏览器预览已补全|已创建媒体图片补全任务/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /读取结果/ }).click();
        await page.getByText('媒体补全结果').first().waitFor({ timeout: 5000 });
        const artworkResultPanel = page.locator('section').filter({ hasText: '媒体补全结果' }).first();
        await page.getByText(/已读取 \d+ 个媒体补全任务结果/).first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByText('已补全目标媒体字段。').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByText(/封面|背景|横幅/).first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByLabel('媒体补全结果搜索').fill('媒体图片补全候选');
        await artworkResultPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByLabel('媒体补全结果状态筛选').selectOption('failed');
        await artworkResultPanel.getByText('当前筛选没有匹配的媒体补全结果。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /重置筛选/ }).first().click();
        await artworkResultPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByRole('button', { name: /^游戏$/ }).first().click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
      }],
      ['maintenance-health-duplicate-id-audit', 'maintenance', { games: [...games, duplicateExternalIdGame] }, async (page) => {
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('维护队列').first().waitFor({ timeout: 5000 });
        await page.getByText('重复 ID 审查').first().waitFor({ timeout: 5000 });
        await clickMaintenanceStart(page, '重复 ID 审查');
        await page.getByText(/重复外部 ID 审查完成|已创建重复 ID 审查任务/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('重复游戏安全合并').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /读取重复组/ }).click();
        await page.getByLabel('重复组搜索').fill('星之终途');
        await page.getByLabel('重复组来源筛选').selectOption('vndb');
        await page.getByText('推荐保留').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /重置筛选/ }).first().click();
        if (await page.getByLabel('重复组搜索').inputValue() !== '') throw new Error('duplicate group filter reset did not clear query');
        await page.getByText('推荐保留').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /设为保留/ }).first().click();
        await page.getByRole('button', { name: /预览合并/ }).click();
        await page.getByText('共享外部 ID').first().waitFor({ timeout: 5000 });
        await page.getByText('搬迁资产').first().waitFor({ timeout: 5000 });
        await page.getByText('存档备份').first().waitFor({ timeout: 5000 });
        await page.getByText('外部 ID').first().waitFor({ timeout: 5000 });
        await page.getByText('字段锁').first().waitFor({ timeout: 5000 });
        await page.getByText('匹配结果').first().waitFor({ timeout: 5000 });
      }],
      ['settings-local-privacy-backup', 'settings', {}, async (page) => {
        await page.getByText('设置').first().waitFor({ timeout: 5000 });
        await page.getByRole('tab', { name: /本地与隐私/ }).click();
        await page.getByText('标签维护').first().waitFor({ timeout: 5000 });
        await page.locator('select').filter({ has: page.locator('option', { hasText: '标签 · 全年龄' }) }).selectOption('tag:%E5%85%A8%E5%B9%B4%E9%BE%84');
        await page.getByPlaceholder('新标签名').fill('全年龄QA');
        await page.getByRole('button', { name: /^重命名$/ }).click();
        await page.getByText(/标签已重命名为：全年龄QA/).first().waitFor({ timeout: 5000 });
        await page.locator('select').filter({ has: page.locator('option', { hasText: '标签 · 全年龄QA' }) }).selectOption('tag:%E5%85%A8%E5%B9%B4%E9%BE%84QA');
        await page.locator('label').filter({ hasText: /标签 · 科幻/ }).getByRole('checkbox').check();
        await page.getByRole('button', { name: /^合并所选$/ }).click();
        await page.getByText(/已合并 1 个标签到：全年龄QA/).first().waitFor({ timeout: 5000 });
        await page.locator('select').filter({ has: page.locator('option', { hasText: '标签 · 恋爱' }) }).selectOption('tag:%E6%81%8B%E7%88%B1');
        await page.getByRole('button', { name: /^删除标签$/ }).click();
        await page.getByText(/标签已删除：恋爱/).first().waitFor({ timeout: 5000 });
        const tagGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const renamedTagGame = tagGames.find((game) => game.id === 'qa-1');
        const deletedTagGame = tagGames.find((game) => game.id === 'qa-2');
        if (!renamedTagGame?.tags.includes('全年龄QA') || renamedTagGame.tags.includes('科幻')) throw new Error('page QA tag rename/merge did not update game tags');
        if (deletedTagGame?.tags.includes('恋爱')) throw new Error('page QA tag delete did not remove tag from games');
      }],
    ];

    for (const [name, view, overrides, interact] of cases) {
      await runCase(browser, name, view, overrides || {}, interact);
    }

    await runCase(browser, 'advanced-search-results', 'advanced-search', {}, async (page) => {
      await page.getByRole('button', { name: /^搜索$/ }).click();
      await page.getByText('星之终途').first().waitFor({ timeout: 5000 });
    });

    await runCase(browser, 'scanner-conflict-review', 'scanner', {}, async (page) => {
      await page.getByPlaceholder(/例如/).fill('D:\\Games\\VN');
      await page.getByRole('button', { name: /开始扫描/ }).click();
      await page.getByText(/冲突/).first().waitFor({ timeout: 5000 });
      await page.waitForTimeout(500);
    });

    await runCase(browser, 'tasks-running-failed-expanded', 'tasks', {}, async (page) => {
      await page.getByText('任务概览').first().waitFor({ timeout: 5000 });
      await page.getByText('任务总数').first().waitFor({ timeout: 5000 });
      await page.getByText('进行中').first().waitFor({ timeout: 5000 });
      await page.getByText('需处理').first().waitFor({ timeout: 5000 });
      await page.getByText('队列总体进度').first().waitFor({ timeout: 5000 });
      await page.getByText(/已运行/).first().waitFor({ timeout: 5000 });
      await page.getByText(/预计剩余/).first().waitFor({ timeout: 5000 });
      await page.getByText(/耗时/).first().waitFor({ timeout: 5000 });
      const taskStatusShortcuts = page.locator('[aria-label="任务状态快捷筛选"]');
      await taskStatusShortcuts.getByRole('button', { name: /需处理\s+2/ }).click();
      if (await page.getByLabel('任务状态筛选').inputValue() !== 'attention') throw new Error('task status shortcut did not select attention filter');
      await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
      if (await page.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running task should be hidden by attention shortcut');
      await taskStatusShortcuts.getByRole('button', { name: /进行中\s+1/ }).click();
      if (await page.getByLabel('任务状态筛选').inputValue() !== 'active') throw new Error('task status shortcut did not select active filter');
      await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
      if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden by active shortcut');
      await taskStatusShortcuts.getByRole('button', { name: /全部\s+3/ }).click();
      if (await page.getByLabel('任务状态筛选').inputValue() !== 'all') throw new Error('task status shortcut did not reset to all');
      await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
      const taskTypeShortcuts = page.locator('[aria-label="任务类型快捷筛选"]');
      await taskTypeShortcuts.getByRole('button', { name: /目录扫描\s+1/ }).click();
      if (await page.getByLabel('任务类型筛选').inputValue() !== 'library.scan') throw new Error('task type shortcut did not select scan filter');
      await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
      if (await page.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('metadata task should be hidden by scan type shortcut');
      await taskTypeShortcuts.getByRole('button', { name: /批量元数据匹配\s+1/ }).click();
      if (await page.getByLabel('任务类型筛选').inputValue() !== 'metadata.batch_match') throw new Error('task type shortcut did not select metadata filter');
      await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
      if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('scan task should be hidden by metadata type shortcut');
      await taskTypeShortcuts.getByRole('button', { name: /全部类型\s+3/ }).click();
      if (await page.getByLabel('任务类型筛选').inputValue() !== 'all') throw new Error('task type shortcut did not reset to all');
      await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
      await page.getByLabel('任务搜索').fill('路径不存在');
      await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
      if (await page.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running task should be hidden by task search');
      await page.getByLabel('任务搜索').fill('没有这种任务文本');
      await page.getByText('当前筛选没有匹配任务。').first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /重置筛选/ }).first().click();
      await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
      await page.getByLabel('任务状态筛选').selectOption('attention');
      await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
      if (await page.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running task should be hidden by attention filter');
      await page.getByLabel('任务状态筛选').selectOption('active');
      await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
      if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden by active filter');
      await page.getByLabel('任务类型筛选').selectOption('library.scan');
      await page.getByText('当前筛选没有匹配任务。').first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /重置筛选/ }).first().click();
      await page.getByRole('button', { name: /日志/ }).first().click();
      await page.getByText(/任务日志|路径不存在/).first().waitFor({ timeout: 5000 });
      await page.getByLabel(/日志搜索/).fill('开始扫描');
      await page.getByText('开始扫描 D:\\Missing').first().waitFor({ timeout: 5000 });
      if (await page.getByText('路径不存在，等待用户重试。').count() > 0) throw new Error('task log search did not filter log rows');
      await page.getByLabel(/日志搜索/).fill('没有这种日志文本');
      await page.getByText('当前日志筛选无结果。').first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /清空/ }).last().click();
      await page.getByText('路径不存在，等待用户重试。').first().waitFor({ timeout: 5000 });
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
