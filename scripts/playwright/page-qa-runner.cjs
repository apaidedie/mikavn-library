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
const tasks = [
  { id: 'qa-task-failed', taskType: 'library.scan', status: 'failed', progress: 1, message: '扫描失败：路径不存在', error: 'PATH_NOT_FOUND: D:\\Missing', retryPayload: JSON.stringify({ path: 'D:\\Missing', recursive: true }), retryable: true, createdAt: now, updatedAt: now },
  { id: 'qa-task-running', taskType: 'metadata.batch_match', status: 'running', progress: 0.42, message: '正在匹配 2 个游戏', error: null, retryPayload: JSON.stringify({ gameIds: ['qa-1', 'qa-2'] }), retryable: true, createdAt: now, updatedAt: now },
];
const taskLogs = {
  'qa-task-failed': [
    { id: 'log-1', taskId: 'qa-task-failed', level: 'info', message: '开始扫描 D:\\Missing', createdAt: now },
    { id: 'log-2', taskId: 'qa-task-failed', level: 'error', message: '路径不存在，等待用户重试。', createdAt: now },
  ],
  'qa-task-running': [{ id: 'log-3', taskId: 'qa-task-running', level: 'info', message: 'VNDB 查询完成。', createdAt: now }],
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await seed(page, view, overrides);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForApp(page);
  return { context, page, consoleErrors };
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
      ['library-populated-detail-artwork', 'library', {}, async (page) => {
        await page.getByText('图片下方的正文也应该继续显示。').first().waitFor({ timeout: 5000 });
        const descriptionImages = page.locator('section').filter({ hasText: '简介' }).locator('figure img');
        if (await descriptionImages.count() < 1) throw new Error('library detail description image was not rendered');
        await page.getByRole('button', { name: '批量', exact: true }).click();
        await page.getByRole('button', { name: /选中当前/ }).click();
        await page.getByLabel('批量游玩状态').selectOption('completed');
        await page.getByRole('button', { name: /应用状态/ }).click();
        await page.getByText(/已更新 2 个游戏：游玩状态：已通关/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('批量加入合集').selectOption('qa-col-1');
        await page.getByRole('button', { name: /加入合集/ }).click();
        await page.getByText(/已将 2 个游戏加入合集：Key 短篇/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^隐藏$/ }).click();
        await page.getByText(/已更新 2 个游戏：隐藏条目/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /取消隐藏/ }).click();
        await page.getByText(/已更新 2 个游戏：取消隐藏/).first().waitFor({ timeout: 5000 });
        const updatedGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        if (!updatedGames.every((game) => game.playStatus === 'completed' && game.hidden === false)) throw new Error('library bulk edit did not update selected games');
        const collectionLinks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collectionGames') || '[]'));
        const linkedIds = new Set(collectionLinks.filter((link) => link.collectionId === 'qa-col-1').map((link) => link.gameId));
        if (!['qa-1', 'qa-2'].every((id) => linkedIds.has(id))) throw new Error('library bulk edit did not add selected games to collection');
      }],
      ['library-empty', 'library', { games: [] }],
      ['collections-populated', 'collections'],
      ['metadata-batch', 'metadata', {}, async (page) => {
        await page.getByLabel('匹配队列搜索').fill('天使');
        await page.getByRole('button', { name: /选择当前筛选/ }).click();
        await page.getByRole('button', { name: /开始匹配 1 个条目/ }).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /清空/ }).first().click();
        await page.getByLabel('匹配队列搜索').fill('');
        await page.getByLabel('缺失来源筛选').selectOption('dlsite');
        await page.getByRole('button', { name: /选择当前筛选/ }).click();
        await page.getByRole('button', { name: /开始匹配/ }).click();
        await page.getByText(/批量匹配任务已启动/).first().waitFor({ timeout: 5000 });
        await page.getByText('成功').first().waitFor({ timeout: 5000 });
        await page.getByText('待复核').first().waitFor({ timeout: 5000 });
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
      ['saves-backup-restore', 'saves'],
      ['maintenance-health-description-repair', 'maintenance', { games: [...games, descriptionRepairGame] }, async (page) => {
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
        await clickMaintenanceStart(page, '批量元数据匹配');
        await page.getByText(/批量匹配完成|已创建批量元数据匹配任务/).first().waitFor({ timeout: 5000 });
      }],
      ['maintenance-health-artwork-repair', 'maintenance', { games: [...games, artworkRepairGame] }, async (page) => {
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('维护队列').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体图片补全').first().waitFor({ timeout: 5000 });
        await clickMaintenanceStart(page, '媒体图片补全');
        await page.getByText(/浏览器预览已补全|已创建媒体图片补全任务/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /读取结果/ }).click();
        await page.getByText('媒体补全结果').first().waitFor({ timeout: 5000 });
        await page.getByText(/已读取 1 个媒体补全任务结果/).first().waitFor({ timeout: 5000 });
        await page.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await page.getByText('已补全目标媒体字段。').first().waitFor({ timeout: 5000 });
        await page.getByText('已补全').first().waitFor({ timeout: 5000 });
        await page.getByText(/封面|背景|横幅/).first().waitFor({ timeout: 5000 });
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
        await page.getByText('推荐保留').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /设为保留/ }).first().click();
        await page.getByRole('button', { name: /预览合并/ }).click();
        await page.getByText('共享外部 ID').first().waitFor({ timeout: 5000 });
        await page.getByText('搬迁资产').first().waitFor({ timeout: 5000 });
      }],
      ['settings-local-privacy-backup', 'settings'],
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
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
