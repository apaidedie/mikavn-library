const fs = require('fs');
const path = require('path');
const {
  artworkRepairGame,
  assets,
  brokenMediaReferenceAsset,
  brokenMediaReferenceGame,
  descriptionImageRepairFailedTask,
  descriptionRepairGame,
  duplicateAuditGames,
  fanzaDescriptionImageRepairTask,
  fanzaDescriptionRepairGame,
  games,
  hero,
  mockData,
  secondaryExternalIdCompleteGame,
  settings,
  taskLogs,
  tasks,
} = require('./page-qa-fixtures.cjs');
const { resolvePlaywright } = require('./playwright-resolution.cjs');

const baseUrl = process.env.MIKAVN_QA_URL || 'http://127.0.0.1:1420/';
const repoRoot = path.resolve(__dirname, '..', '..');
const { chromium } = require(resolvePlaywright(repoRoot));
const outDir = path.resolve(process.env.MIKAVN_QA_OUT_DIR || path.join(repoRoot, 'output', 'playwright', 'page-qa-current'));
fs.mkdirSync(outDir, { recursive: true });

function browserLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return executablePath ? { executablePath, headless: true } : { headless: true };
}

function descriptionRepairRows(panel) {
  return panel.locator('.rounded-md').filter({ hasText: /^(已修复|跳过|失败)/ });
}

function descriptionRepairRow(panel, providerId) {
  return descriptionRepairRows(panel).filter({ hasText: providerId });
}

async function expectDescriptionRepairRowVisible(panel, providerId) {
  await descriptionRepairRow(panel, providerId).first().waitFor({ timeout: 5000 });
}

async function expectDescriptionRepairRowHidden(panel, providerId) {
  if (await descriptionRepairRow(panel, providerId).count() > 0) throw new Error(`description repair provider filter did not hide ${providerId} results`);
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

async function openSeeded(browser, view, overrides = {}, options = {}) {
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
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

async function runCase(browser, name, view, overrides = {}, interact, options = {}) {
  const { context, page, consoleErrors } = await openSeeded(browser, view, overrides, options);
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

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow <= 2) return;

  const wideElements = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        className: typeof element.className === 'string' ? element.className : '',
        tagName: element.tagName,
        text: (element.textContent ?? '').trim().slice(0, 60),
        width: Math.round(rect.width),
      };
    })
    .filter((item) => item.width > document.documentElement.clientWidth)
    .sort((a, b) => b.width - a.width)
    .slice(0, 8));
  throw new Error(`${label} has horizontal overflow: ${overflow}px ${JSON.stringify(wideElements)}`);
}

async function main() {
  const browser = await chromium.launch(browserLaunchOptions());
  try {
    const cases = [
      ['dashboard-populated', 'dashboard', {}, async (page) => {
        for (const text of ['今日状态', '继续游玩', '需要关注', '本地安全', '添加游戏', '扫描入库', '想玩', '维护', '本地设置']) {
          await page.getByText(text, { exact: false }).first().waitFor({ timeout: 5000 });
        }
        await page.locator('section').filter({ hasText: '继续游玩' }).first().locator('button').filter({ hasText: '星之终途' }).first().click();
        await page.getByText('末世旅途题材的短篇视觉小说。这里用于成熟 V1 页面 QA。').first().waitFor({ timeout: 5000 });
        await page.getByLabel('首页').click();
        await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
        await page.locator('section').filter({ hasText: '今日状态' }).first().getByRole('button', { name: /维护/ }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByLabel('首页').click();
        await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
        await page.locator('section').filter({ hasText: '今日状态' }).first().getByRole('button', { name: /本地设置/ }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent?.includes('本地与隐私') && tab.getAttribute('data-state') === 'active'), null, { timeout: 5000 });
        await page.getByLabel('首页').click();
        await page.getByText('本地安全').first().waitFor({ timeout: 5000 });
        await page.locator('section').filter({ hasText: '本地安全' }).first().getByRole('button', { name: /打开设置/ }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent?.includes('本地与隐私') && tab.getAttribute('data-state') === 'active'), null, { timeout: 5000 });
        await page.getByText('数据目录自检').first().waitFor({ timeout: 5000 });
      }],
      ['dashboard-task-shortcuts', 'dashboard', { games: [...games, descriptionRepairGame], tasks: [descriptionImageRepairFailedTask, fanzaDescriptionImageRepairTask, ...tasks], taskLogs }, async (page) => {
        await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
        await page.getByText('最近结果').first().waitFor({ timeout: 5000 });
        await page.getByText('简介图片修复失败：DLsite 暂不可用').first().waitFor({ timeout: 5000 });
        await page.getByText('简介图片修复完成：更新 1 个条目，插入 1 张图片，跳过 0 个，失败 0 个。').first().waitFor({ timeout: 5000 });
        const dashboardResultsPanel = page.locator('[aria-label="首页最近任务结果"]');
        await dashboardResultsPanel.locator('[data-task-result-id="qa-task-description-image-failed"]').getByRole('button', { name: /重试/ }).waitFor({ timeout: 5000 });
        if (await dashboardResultsPanel.locator('[data-task-result-id="qa-task-description-image-fanza"]').getByRole('button', { name: /重试/ }).count() > 0) throw new Error('dashboard completed result should not show retry action');
        await page.getByRole('button', { name: /需处理\s+3/ }).click();
        await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('任务状态筛选').inputValue() !== 'attention') throw new Error('dashboard attention shortcut did not select attention task filter');
        await page.getByText('简介图片修复失败：DLsite 暂不可用').first().waitFor({ timeout: 5000 });
        if (await page.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running task should be hidden after dashboard attention shortcut');
        await page.getByLabel('首页').click();
        await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /进行中\s+1/ }).click();
        await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('任务状态筛选').inputValue() !== 'active') throw new Error('dashboard running shortcut did not select active task filter');
        await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
        if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden after dashboard running shortcut');
        await page.getByLabel('首页').click();
        await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /已完成\s+1/ }).click();
        await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('任务状态筛选').inputValue() !== 'completed') throw new Error('dashboard completed shortcut did not select completed task filter');
        await page.getByText('简介图片修复完成：更新 1 个条目，插入 1 张图片，跳过 0 个，失败 0 个。').first().waitFor({ timeout: 5000 });
        if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden after dashboard completed shortcut');
        await page.getByLabel('首页').click();
        await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
        await dashboardResultsPanel.locator('[data-task-result-id="qa-task-description-image-failed"]').getByRole('button', { name: /重试/ }).click();
        await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
        await page.getByText(/浏览器预览已修复 1 个条目的简介图片/).first().waitFor({ timeout: 5000 });
      }],
      ['dashboard-mobile', 'dashboard', {}, async (page) => {
        await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
        await page.locator('section').filter({ hasText: '今日状态' }).first().getByRole('button', { name: /添加游戏/ }).waitFor({ timeout: 5000 });
        await expectNoHorizontalOverflow(page, 'dashboard mobile');
        await page.locator('section').filter({ hasText: '今日状态' }).first().getByRole('button', { name: /本地设置/ }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent?.includes('本地与隐私') && tab.getAttribute('data-state') === 'active'), null, { timeout: 5000 });
        await expectNoHorizontalOverflow(page, 'dashboard mobile settings shortcut');
        await page.getByLabel('首页').click();
        await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
        await expectNoHorizontalOverflow(page, 'dashboard mobile after returning home');
      }, { viewport: { width: 390, height: 844 } }],
      ['library-populated-detail-artwork', 'library', {}, async (page) => {
        await page.getByText('图片下方的正文也应该继续显示。').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体完整').first().waitFor({ timeout: 5000 });
        await page.getByText('1 张引用').first().waitFor({ timeout: 5000 });
        const descriptionImages = page.locator('section').filter({ hasText: '简介' }).locator('figure img');
        if (await descriptionImages.count() < 1) throw new Error('library detail description image was not rendered');
        await page.getByText('媒体图库').first().waitFor({ timeout: 5000 });
        const downloadedCoverUrl = `${baseUrl.replace(/\/$/, '')}${hero}?qa=downloaded-cover`;
        await page.getByPlaceholder('https://example.com/cover.jpg').fill(downloadedCoverUrl);
        await page.getByRole('button', { name: /下载/ }).first().click();
        await page.getByText(/图片已下载到本地缓存并设为主图/).first().waitFor({ timeout: 5000 });
        const assetGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const assetRecords = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.assets') || '[]'));
        const assetGame = assetGames.find((game) => game.id === 'qa-1');
        if (assetGame?.coverImage !== downloadedCoverUrl) throw new Error('page QA asset download did not update primary cover field');
        if (!Array.isArray(assetRecords) || !assetRecords.some((asset) => asset.gameId === 'qa-1' && asset.source === 'download' && asset.uri === downloadedCoverUrl)) throw new Error('page QA asset download record was not persisted');
        await page.getByRole('button', { name: /复制 DLsite ID/ }).first().click();
        const copiedDlsiteId = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedDlsiteId !== 'RJ01000000') throw new Error('game detail DLsite ID copy did not write the expected ID');
        await page.getByText('已复制DLsite ID。').first().waitFor({ timeout: 5000 });
        await page.getByRole('tab', { name: /路径/ }).click();
        await page.getByText('启动配置').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /复制默认启动路径/ }).first().click();
        const copiedLaunchProfilePath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedLaunchProfilePath !== 'D:\\Games\\VN\\星之终途\\stella.exe') throw new Error('launch profile path copy did not write the expected executable path');
        await page.getByText('已复制默认启动路径。').first().waitFor({ timeout: 5000 });
        const launchConfigPanel = page.locator('section').filter({ hasText: '启动配置' }).first();
        await launchConfigPanel.getByRole('button', { name: /新增启动配置/ }).click();
        const launchProfileForm = launchConfigPanel.locator('.rounded-lg').filter({ hasText: '保存配置' }).first();
        await launchProfileForm.getByRole('button', { name: /复制启动程序/ }).click();
        const copiedLaunchFormPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedLaunchFormPath !== 'D:\\Games\\VN\\星之终途\\stella.exe') throw new Error('launch profile form path copy did not write the expected executable path');
        await page.getByText('已复制启动程序路径。').first().waitFor({ timeout: 5000 });
        await page.getByText('本地路径').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^检查路径$/ }).click();
        await page.getByText('路径检查完成，所有关键路径可用。').first().waitFor({ timeout: 5000 });
        const pathHealthExecutableRow = page.locator('.motion-soft-row').filter({ hasText: '启动程序' }).filter({ hasText: 'D:\\Games\\VN\\星之终途\\stella.exe' }).first();
        await pathHealthExecutableRow.getByRole('button', { name: /复制路径检查启动程序/ }).click();
        const copiedPathHealthExecutablePath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedPathHealthExecutablePath !== 'D:\\Games\\VN\\星之终途\\stella.exe') throw new Error('path health executable copy did not write the expected path');
        await page.getByText('已复制路径检查启动程序路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /复制安装目录/ }).first().click();
        const copiedInstallPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedInstallPath !== 'D:\\Games\\VN\\星之终途') throw new Error('game detail install path copy did not write the expected path');
        await page.getByText('已复制安装目录路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^编辑$/ }).click();
        const editGameDialog = page.getByRole('dialog').filter({ hasText: '编辑游戏' }).first();
        await editGameDialog.getByRole('button', { name: /复制安装目录/ }).click();
        const copiedEditInstallPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedEditInstallPath !== 'D:\\Games\\VN\\星之终途') throw new Error('game form install path copy did not write the expected path');
        await editGameDialog.getByText('已复制安装目录路径。').first().waitFor({ timeout: 5000 });
        await editGameDialog.getByRole('button', { name: /复制封面路径/ }).click();
        const copiedEditCoverPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedEditCoverPath !== downloadedCoverUrl) throw new Error('game form cover path copy did not write the expected path');
        await editGameDialog.getByText('已复制封面路径。').first().waitFor({ timeout: 5000 });
        await editGameDialog.getByRole('button', { name: /复制 DLsite ID/ }).click();
        const copiedEditDlsiteId = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedEditDlsiteId !== 'RJ01000000') throw new Error('game form DLsite ID copy did not write the expected ID');
        await editGameDialog.getByText('已复制DLsite ID。').first().waitFor({ timeout: 5000 });
        await editGameDialog.getByRole('textbox', { name: /Bangumi ID/ }).fill('12345');
        await editGameDialog.getByRole('textbox', { name: /YMGal ID/ }).fill('ym123');
        await editGameDialog.getByRole('button', { name: /^保存$/ }).click();
        await editGameDialog.waitFor({ state: 'hidden', timeout: 5000 });
        const externalIdGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const externalIdGame = externalIdGames.find((item) => item.id === 'qa-1');
        if (externalIdGame?.bangumiId !== '12345' || externalIdGame?.ymgalId !== 'ym123') throw new Error('game form did not persist Bangumi and YMGal IDs');
        await page.getByRole('tab', { name: /元数据/ }).click();
        await page.getByPlaceholder('本地图片路径，用于 AI 识别标题').fill('D:\\Games\\VN\\星之终途\\cover.png');
        await page.getByRole('button', { name: /复制识图图片路径/ }).click();
        const copiedMetadataImagePath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedMetadataImagePath !== 'D:\\Games\\VN\\星之终途\\cover.png') throw new Error('metadata image path copy did not write the expected path');
        await page.getByText('已复制识图图片路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('tab', { name: /概览/ }).click();
        await page.getByText('媒体图库').first().waitFor({ timeout: 5000 });
        await page.locator('button[aria-label="设为主图"]:not([disabled])').first().click();
        await page.getByText(/封面主图已更新/).first().waitFor({ timeout: 5000 });
        const primaryCoverGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const primaryCoverAssets = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.assets') || '[]'));
        const primaryCoverGame = primaryCoverGames.find((game) => game.id === 'qa-1');
        if (primaryCoverGame?.coverImage !== hero) throw new Error('asset gallery set-primary action did not restore the original cover field');
        const qaCoverAssets = primaryCoverAssets.filter((asset) => asset.gameId === 'qa-1' && asset.assetType === 'cover');
        if (!qaCoverAssets.some((asset) => asset.uri === hero && asset.isPrimary) || qaCoverAssets.some((asset) => asset.uri === downloadedCoverUrl && asset.isPrimary)) throw new Error('asset gallery set-primary action did not update cover primary flags');
        await page.getByLabel('移除资产').last().click();
        await page.getByText(/资产记录已移除/).first().waitFor({ timeout: 5000 });
        const removedAssetRecords = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.assets') || '[]'));
        if (removedAssetRecords.some((asset) => asset.id === 'qa-asset-shot')) throw new Error('asset gallery remove action did not delete the screenshot asset record');
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
        const imageAuditSourceSummary = imageAuditPanel.locator('[aria-label="图片引用来源分布"]');
        await imageAuditSourceSummary.getByText('问题来源分布').first().waitFor({ timeout: 5000 });
        const descriptionImageSourceSummary = imageAuditSourceSummary.locator('[data-image-audit-source="简介图片"]').first();
        await descriptionImageSourceSummary.locator('[data-image-audit-source-count="true"]').first().getByText('1').waitFor({ timeout: 5000 });
        await imageAuditSourceSummary.locator('[data-image-audit-source="媒体图库"] [data-image-audit-source-count="true"]').first().getByText('1').waitFor({ timeout: 5000 });
        await descriptionImageSourceSummary.getByRole('button', { name: /定位/ }).click();
        if (await imageAuditPanel.getByLabel('图片引用搜索').inputValue() !== '简介图片') throw new Error('image audit source shortcut did not fill the detail search query');
        await imageAuditPanel.getByText(/当前显示 1 \/ 2 条引用/).first().waitFor({ timeout: 5000 });
        const imageAuditGameSummary = imageAuditPanel.locator('[aria-label="图片引用游戏分布"]');
        await imageAuditGameSummary.getByText('问题游戏分布').first().waitFor({ timeout: 5000 });
        const brokenMediaGameSummary = imageAuditGameSummary.locator('[data-image-audit-game="qa-broken-media-ref"]').first();
        await brokenMediaGameSummary.locator('[data-image-audit-game-count="true"]').first().getByText('2').waitFor({ timeout: 5000 });
        await brokenMediaGameSummary.getByRole('button', { name: /定位/ }).click();
        if (await imageAuditPanel.getByLabel('图片引用搜索').inputValue() !== 'qa-broken-media-ref') throw new Error('image audit game shortcut did not fill the detail search query');
        await imageAuditPanel.getByText(/当前显示 2 \/ 2 条引用/).first().waitFor({ timeout: 5000 });
        await imageAuditPanel.getByRole('button', { name: /重置筛选/ }).click();
        await imageAuditPanel.getByRole('button', { name: /按 Playnite 残留筛选/ }).click();
        if (await imageAuditPanel.getByLabel('图片引用问题筛选').inputValue() !== 'playnite') throw new Error('image audit metric shortcut did not select playnite issue filter');
        await imageAuditPanel.getByText(/当前显示 1 \/ 2 条引用/).first().waitFor({ timeout: 5000 });
        const playniteAuditRow = imageAuditPanel.locator('[data-image-audit-row="true"]').filter({ hasText: 'D:\\Playnite\\library\\files\\missing-banner.jpg' }).first();
        await playniteAuditRow.getByText('处理建议').waitFor({ timeout: 5000 });
        await playniteAuditRow.getByText(/将 Playnite 图片导入 MikaVN 图片缓存/).waitFor({ timeout: 5000 });
        await playniteAuditRow.getByRole('button', { name: /复制原始路径/ }).click();
        const copiedImageAuditPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedImageAuditPath !== 'D:\\Playnite\\library\\files\\missing-banner.jpg') throw new Error('image audit copy original path did not write the expected path');
        await playniteAuditRow.getByRole('button', { name: /打开原始路径/ }).click();
        await imageAuditPanel.getByRole('button', { name: /重置筛选/ }).click();
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
      ['collections-create-add-remove-delete', 'collections', {}, async (page) => {
        await page.getByText('Key 短篇').first().waitFor({ timeout: 5000 });
        await page.getByText('星之终途').first().waitFor({ timeout: 5000 });
        await page.getByPlaceholder('合集名称').fill('本月补票');
        await page.getByPlaceholder('描述，可选').fill('本月想整理和补完的作品');
        await page.locator('select').first().selectOption('teal');
        await page.getByRole('button', { name: /创建/ }).click();
        await page.getByText('合集已创建。可以在游戏库详情或此页把条目加入合集。').first().waitFor({ timeout: 5000 });
        await page.getByText('这个合集还没有游戏。').first().waitFor({ timeout: 5000 });
        await page.getByPlaceholder('搜索标题 / 标签 / 会社').fill('天使');
        await page.locator('button').filter({ hasText: '天使☆騒々 RE-BOOT!' }).first().click();
        await page.getByText('想玩').first().waitFor({ timeout: 5000 });
        let collectionLinks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collectionGames') || '[]'));
        let collectionsState = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collections') || '[]'));
        const createdCollection = collectionsState.find((collection) => collection.name === '本月补票');
        if (!createdCollection) throw new Error('collections page QA did not persist the created collection');
        if (!collectionLinks.some((link) => link.collectionId === createdCollection.id && link.gameId === 'qa-2')) throw new Error('collections page QA did not add the searched game to the new collection');
        await page.getByRole('button', { name: /^移除$/ }).click();
        await page.getByText('这个合集还没有游戏。').first().waitFor({ timeout: 5000 });
        collectionLinks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collectionGames') || '[]'));
        if (collectionLinks.some((link) => link.collectionId === createdCollection.id && link.gameId === 'qa-2')) throw new Error('collections page QA did not remove the game link');
        await page.getByRole('button', { name: /删除合集/ }).click();
        await page.getByText('合集已删除，游戏记录未受影响。').first().waitFor({ timeout: 5000 });
        collectionsState = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collections') || '[]'));
        collectionLinks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collectionGames') || '[]'));
        if (collectionsState.some((collection) => collection.id === createdCollection.id)) throw new Error('collections page QA did not delete the created collection');
        if (collectionLinks.some((link) => link.collectionId === createdCollection.id)) throw new Error('collections page QA did not remove links for the deleted collection');
        const gamesState = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        if (!gamesState.some((game) => game.id === 'qa-2')) throw new Error('collections page QA deleted a game record while deleting a collection');
      }],
      ['metadata-batch', 'metadata', {}, async (page) => {
        const queueGapShortcuts = page.locator('[aria-label="缺口快捷筛选"]');
        await queueGapShortcuts.getByRole('button', { name: /缺全部 ID\s+1/ }).click();
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'external_id') throw new Error('metadata quick gap filter did not select missing external ID filter');
        await page.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await queueGapShortcuts.getByRole('button', { name: /FANZA\s+2/ }).click();
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'fanza') throw new Error('metadata quick gap filter did not select FANZA filter');
        await queueGapShortcuts.getByRole('button', { name: /Bangumi\s+2/ }).click();
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'bangumi') throw new Error('metadata quick gap filter did not select Bangumi filter');
        await queueGapShortcuts.getByRole('button', { name: /YMGal\s+2/ }).click();
        if (await page.getByLabel('缺失来源筛选').inputValue() !== 'ymgal') throw new Error('metadata quick gap filter did not select YMGal filter');
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
        const appliedMetadataGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const appliedMetadataGame = appliedMetadataGames.find((game) => game.id === 'qa-2');
        if (appliedMetadataGame?.bangumiId !== 'bgm-29443' || appliedMetadataGame?.ymgalId !== 'ymgal-29443') throw new Error('metadata apply did not preserve secondary external IDs');
        await page.getByLabel('匹配写入状态筛选').selectOption('applied');
        await page.getByText(/已写入/).first().waitFor({ timeout: 5000 });
        await page.getByLabel('匹配写入状态筛选').selectOption('writable');
        await page.getByLabel('匹配结果状态筛选').selectOption('error');
        await page.getByText('当前筛选没有匹配结果。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /重置筛选/ }).first().click();
        await page.getByText(/推荐：/).first().waitFor({ timeout: 5000 });
      }],
      ['reports-populated', 'reports', {}, async (page) => {
        await page.getByText('游玩报告').first().waitFor({ timeout: 5000 });
        await page.locator('.motion-soft-row').filter({ hasText: '报告条目' }).first().getByText('1').waitFor({ timeout: 5000 });
        await page.getByText('Key').first().waitFor({ timeout: 5000 });
        if (await page.getByText('Yuzusoft').count() > 0) throw new Error('reports page QA did not apply privacy filtering to R18 entries');
        await page.getByRole('button', { name: /导出 Markdown/ }).click();
        await page.getByText(/报告导出任务已创建/).first().waitFor({ timeout: 5000 });
        const reportTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
        const exportTask = reportTasks.find((task) => task.taskType === 'report.export_markdown');
        if (!exportTask || exportTask.status !== 'completed') throw new Error('reports page QA did not create a completed report export task');
        if (!/mikavn-report-\d{4}-\d{2}-\d{2}\.md/.test(exportTask.message ?? '')) throw new Error('reports page QA export task did not keep the markdown target path in its message');
        const reportLogs = await page.evaluate((taskId) => JSON.parse(localStorage.getItem('mikavn-library.mock.taskLogs') || '{}')[taskId] || [], exportTask.id);
        if (!reportLogs.some((log) => /报告缺口摘要：缺封面 0，缺简介图片 0，缺外部 ID 0，路径异常 0/.test(log.message))) throw new Error('reports markdown export did not log actionable gap summary');
      }],
      ['reports-privacy-filter-disabled', 'reports', { settings: { ...settings, privacy_filter_reports: 'false' } }, async (page) => {
        await page.getByText('游玩报告').first().waitFor({ timeout: 5000 });
        await page.locator('.motion-soft-row').filter({ hasText: '报告条目' }).first().getByText('2').waitFor({ timeout: 5000 });
        await page.getByText('Yuzusoft').first().waitFor({ timeout: 5000 });
      }],
      ['reports-actionable-gaps-open-library', 'reports', { games: [...games, descriptionRepairGame], settings: { ...settings, privacy_filter_reports: 'false' } }, async (page) => {
        await page.getByText('游玩报告').first().waitFor({ timeout: 5000 });
        await page.getByText('可处理缺口').first().waitFor({ timeout: 5000 });
        const gapsPanel = page.locator('section').filter({ hasText: '可处理缺口' }).first();
        const descriptionImageGap = gapsPanel.locator('.motion-soft-row').filter({ hasText: '缺简介图片' }).first();
        await descriptionImageGap.getByText('简介图片修复候选').first().waitFor({ timeout: 5000 });
        await descriptionImageGap.getByRole('button', { name: '简介图片修复候选' }).click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('DLsite 来源条目，当前简介里没有图片，用于维护中心修复入口 QA。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '报告' }).click();
        await page.getByText('可处理缺口').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /在游戏库查看缺简介图片/ }).click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('元数据筛选').inputValue() !== 'missing_description_image') throw new Error('reports description-image gap shortcut did not select library metadata filter');
        await page.getByText('简介图片修复候选').first().waitFor({ timeout: 5000 });
        if (await page.getByText('星之终途').count() > 0) throw new Error('reports description-image gap shortcut did not filter complete games out');
        await page.getByRole('button', { name: '报告' }).click();
        await page.getByText('可处理缺口').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /在游戏库查看路径异常/ }).click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('路径筛选').inputValue() !== 'broken') throw new Error('reports broken-path gap shortcut did not select library path filter');
        await page.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
      }],
      ['reports-export-gap-examples', 'reports', { games: [...games, descriptionRepairGame], settings: { ...settings, privacy_filter_reports: 'false' } }, async (page) => {
        await page.getByText('游玩报告').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /导出 Markdown/ }).click();
        await page.getByText(/报告导出任务已创建/).first().waitFor({ timeout: 5000 });
        const reportTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
        const exportTask = reportTasks.find((task) => task.taskType === 'report.export_markdown');
        const reportLogs = await page.evaluate((taskId) => JSON.parse(localStorage.getItem('mikavn-library.mock.taskLogs') || '{}')[taskId] || [], exportTask?.id);
        const exampleLog = reportLogs.find((log) => /报告缺口样例/.test(log.message ?? ''))?.message ?? '';
        if (!/缺封面 .*天使☆騒々 RE-BOOT!/.test(exampleLog)) throw new Error('reports markdown export did not log missing-cover examples');
        if (!/缺简介图片 .*简介图片修复候选/.test(exampleLog)) throw new Error('reports markdown export did not log missing description image examples');
        if (!/缺外部 ID .*天使☆騒々 RE-BOOT!/.test(exampleLog)) throw new Error('reports markdown export did not log missing external ID examples');
        if (!/路径异常 .*天使☆騒々 RE-BOOT!/.test(exampleLog)) throw new Error('reports markdown export did not log broken path examples');
      }],
      ['saves-backup-restore', 'saves', {}, async (page) => {
        await page.getByText('存档管理').first().waitFor({ timeout: 5000 });
        await page.locator('select').first().selectOption('qa-1');
        await page.getByText('默认存档').first().waitFor({ timeout: 5000 });
        await page.getByRole('textbox', { name: '存档目录' }).fill('D:\\Games\\VN\\星之终途\\manual-save');
        await page.getByRole('button', { name: /复制待添加存档目录/ }).click();
        const copiedPendingSavePath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedPendingSavePath !== 'D:\\Games\\VN\\星之终途\\manual-save') throw new Error('pending save path copy did not write the expected path');
        await page.getByText('已复制待添加存档目录路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /查找候选/ }).click();
        await page.getByText(/发现 3 个候选存档目录/).first().waitFor({ timeout: 5000 });
        const saveCandidateRow = page.locator('.rounded-md').filter({ hasText: 'D:\\Games\\VN\\星之终途\\save' }).first();
        await saveCandidateRow.getByRole('button', { name: /复制候选存档目录/ }).click();
        const copiedCandidateSavePath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedCandidateSavePath !== 'D:\\Games\\VN\\星之终途\\save') throw new Error('save candidate path copy did not write the expected path');
        await page.getByText('已复制候选存档目录路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /复制默认存档路径/ }).first().click();
        const copiedSavePath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedSavePath !== 'D:\\Games\\VN\\星之终途\\save') throw new Error('save path copy did not write the expected path');
        await page.getByText('已复制默认存档路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /复制手动备份路径/ }).first().click();
        const copiedSaveBackupPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedSaveBackupPath !== 'mock://save-backups/qa-1/manual') throw new Error('save backup path copy did not write the expected path');
        await page.getByText('已复制手动备份路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /备份/ }).first().click();
        await page.getByText(/存档备份任务已创建/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^预览$/ }).first().click();
        await page.getByText(/合并恢复预览完成：新增 1，覆盖 2，保留 2/).first().waitFor({ timeout: 5000 });
        await page.getByText('合并预览').first().waitFor({ timeout: 5000 });
        await page.getByText('将保留').first().waitFor({ timeout: 5000 });
        await page.getByText('新增样例').first().waitFor({ timeout: 5000 });
        await page.getByText('new-slot.dat').first().waitFor({ timeout: 5000 });
        await page.getByText('覆盖样例').first().waitFor({ timeout: 5000 });
        await page.getByText('nested/slot2.dat').first().waitFor({ timeout: 5000 });
        await page.getByText('保留样例').first().waitFor({ timeout: 5000 });
        await page.getByText('config/user.ini').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /^恢复$/ }).first().click();
        await page.getByText(/合并存档恢复任务已创建/).first().waitFor({ timeout: 5000 });
        await page.getByText('保护备份').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /镜像预览/ }).first().click();
        await page.getByText(/镜像恢复预览完成：新增 1，覆盖 2，清理 4/).first().waitFor({ timeout: 5000 });
        await page.getByText('镜像预览').first().waitFor({ timeout: 5000 });
        await page.getByText('将清理').first().waitFor({ timeout: 5000 });
        await page.getByText('清理样例').first().waitFor({ timeout: 5000 });
        await page.getByText('local-only.dat').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /镜像恢复/ }).first().click();
        await page.getByText(/镜像存档恢复任务已创建/).first().waitFor({ timeout: 5000 });
        const backupRecords = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.saveBackups') || '[]'));
        if (!Array.isArray(backupRecords) || backupRecords.filter((item) => item.protection).length < 2) throw new Error('page QA save restore flows did not create protection backup records');
        const restoreTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
        const mirrorRestoreTask = restoreTasks.find((task) => task.taskType === 'save.restore' && /镜像/.test(task.message ?? ''));
        if (!mirrorRestoreTask?.retryable) throw new Error('page QA mirror save restore did not create a retryable restore task');
        const restoreLogs = await page.evaluate((taskId) => JSON.parse(localStorage.getItem('mikavn-library.mock.taskLogs') || '{}')[taskId] || [], mirrorRestoreTask.id);
        if (!restoreLogs.some((log) => /存档恢复保护备份/.test(log.message))) throw new Error('page QA mirror save restore task did not log the protection backup');
        if (!restoreLogs.some((log) => /存档恢复报告：模式 镜像，复制 2 个文件，清理 2 个文件/.test(log.message))) throw new Error('page QA mirror save restore task did not log the mirror cleanup report');
      }],
      ['maintenance-health-description-repair', 'maintenance', { games: [...games, descriptionRepairGame, fanzaDescriptionRepairGame], tasks: [descriptionImageRepairFailedTask, fanzaDescriptionImageRepairTask, ...tasks], taskLogs }, async (page) => {
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('最近维护任务').first().waitFor({ timeout: 5000 });
        await page.getByText('数据位置').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /复制数据目录/ }).first().click();
        const copiedMaintenanceDataDir = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedMaintenanceDataDir !== 'E:\\MikaVN Library\\app-data') throw new Error('maintenance data directory copy did not write the expected path');
        await page.getByText('已复制数据目录路径。').first().waitFor({ timeout: 5000 });
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
        await maintenanceTaskShortcuts.getByRole('button', { name: /需处理\s+2/ }).click();
        await maintenanceTaskPanel.getByText('媒体补图失败：来源无响应').first().waitFor({ timeout: 5000 });
        if (await maintenanceTaskPanel.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running maintenance task should be hidden by attention filter');
        await maintenanceTaskShortcuts.getByRole('button', { name: /进行中\s+1/ }).click();
        await maintenanceTaskPanel.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
        if (await maintenanceTaskPanel.getByText('媒体补图失败：来源无响应').count() > 0) throw new Error('failed maintenance task should be hidden by active filter');
        await maintenanceTaskShortcuts.getByRole('button', { name: /全部\s+4/ }).click();
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
        const secondMediaSummaryPanel = page.locator('section').filter({ hasText: '媒体与简介' }).first();
        await secondMediaSummaryPanel.getByRole('button', { name: /在游戏库查看缺封面/ }).click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        if (await page.getByLabel('元数据筛选').inputValue() !== 'missing_cover') throw new Error('maintenance missing-cover shortcut did not leave library in a filtered state');
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('维护队列').first().waitFor({ timeout: 5000 });
        const descriptionResultPanel = page.locator('section').filter({ hasText: '简介图片修复结果' }).first();
        await descriptionResultPanel.getByRole('button', { name: /读取结果/ }).click();
        await descriptionResultPanel.getByText('FANZA 简介图修复候选').first().waitFor({ timeout: 5000 });
        await expectDescriptionRepairRowVisible(descriptionResultPanel, 'RJ01000001');
        await expectDescriptionRepairRowVisible(descriptionResultPanel, 'd_123456');
        await descriptionResultPanel.locator('.motion-soft-row').filter({ hasText: '简介图片修复失败：DLsite 暂不可用' }).first().getByRole('button', { name: /^重试$/ }).click();
        await page.getByText(/已重新创建维护任务：简介图片修复/).first().waitFor({ timeout: 5000 });
        await page.getByText(/浏览器预览已修复 1 个条目的简介图片/).first().waitFor({ timeout: 5000 });
        await descriptionRepairRow(descriptionResultPanel, 'RJ01000001').first().locator('span').filter({ hasText: '已修复' }).first().waitFor({ timeout: 5000 });
        await page.evaluate((originalDescription) => {
          const stored = JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]');
          localStorage.setItem('mikavn-library.mock.games', JSON.stringify(stored.map((game) => game.id === 'qa-description-repair' ? { ...game, description: originalDescription } : game)));
        }, descriptionRepairGame.description);
        await clickMaintenanceStart(page, '简介图片修复');
        await page.getByText(/浏览器预览已修复|已创建简介图片修复任务/).first().waitFor({ timeout: 5000 });
        const repairedGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const repairedGame = repairedGames.find((game) => game.id === 'qa-description-repair');
        if (!repairedGame?.description.includes('![简介图片](')) throw new Error('description image repair did not persist an image reference into the game description');
        const repairTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
        const repairTask = repairTasks.find((task) => task.taskType === 'metadata.description_image_repair');
        if (!repairTask || repairTask.status !== 'completed' || !repairTask.retryable) throw new Error('description image repair did not create a retryable completed task');
        const repairPayload = JSON.parse(repairTask.retryPayload || '{}');
        if (repairPayload.provider !== 'all' || repairPayload.maxImages !== 3) throw new Error('description image repair task did not persist retry options');
        const repairLogs = await page.evaluate((taskId) => JSON.parse(localStorage.getItem('mikavn-library.mock.taskLogs') || '{}')[taskId] || [], repairTask.id);
        if (!repairLogs.some((log) => /dlsite:RJ01000001/.test(log.message))) throw new Error('description image repair task log did not record the provider candidate');
        await page.getByRole('button', { name: '维护' }).click();
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await descriptionResultPanel.getByRole('button', { name: /读取结果/ }).click();
        await descriptionResultPanel.getByText('简介图片修复候选').first().waitFor({ timeout: 5000 });
        await descriptionResultPanel.getByText('FANZA 简介图修复候选').first().waitFor({ timeout: 5000 });
        await expectDescriptionRepairRowVisible(descriptionResultPanel, 'RJ01000001');
        await expectDescriptionRepairRowVisible(descriptionResultPanel, 'd_123456');
        await descriptionRepairRow(descriptionResultPanel, 'RJ01000001').first().locator('span').filter({ hasText: '已修复' }).first().waitFor({ timeout: 5000 });
        await descriptionResultPanel.getByText('可重试').first().waitFor({ timeout: 5000 });
        await descriptionResultPanel.getByLabel('简介图片修复结果来源筛选').selectOption('fanza');
        await expectDescriptionRepairRowVisible(descriptionResultPanel, 'd_123456');
        await expectDescriptionRepairRowHidden(descriptionResultPanel, 'RJ01000001');
        await descriptionResultPanel.getByLabel('简介图片修复结果来源筛选').selectOption('dlsite');
        await expectDescriptionRepairRowVisible(descriptionResultPanel, 'RJ01000001');
        await expectDescriptionRepairRowHidden(descriptionResultPanel, 'd_123456');
        await descriptionResultPanel.getByLabel('简介图片修复结果来源筛选').selectOption('all');
        await expectDescriptionRepairRowVisible(descriptionResultPanel, 'd_123456');
        await descriptionResultPanel.getByLabel('简介图片修复结果搜索').fill('RJ01000001');
        await descriptionResultPanel.getByText('简介图片修复候选').first().waitFor({ timeout: 5000 });
        await descriptionResultPanel.getByLabel('简介图片修复结果状态筛选').selectOption('failed');
        const failedDescriptionRepairRow = descriptionRepairRow(descriptionResultPanel, 'RJ01000001').filter({ hasText: '失败' }).first();
        await failedDescriptionRepairRow.waitFor({ timeout: 5000 });
        await descriptionResultPanel.locator('.motion-soft-row').filter({ hasText: '简介图片修复失败：DLsite 暂不可用' }).first().getByRole('button', { name: /^重试$/ }).waitFor({ timeout: 5000 });
        await descriptionResultPanel.getByRole('button', { name: /重置筛选/ }).click();
        await descriptionResultPanel.getByText('简介图片修复候选').first().waitFor({ timeout: 5000 });
        const descriptionRepairResultRow = descriptionResultPanel.locator('.rounded-md').filter({ hasText: '简介图片修复候选' }).first();
        await descriptionRepairResultRow.getByRole('button', { name: /^游戏$/ }).click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('简介图片修复候选').first().waitFor({ timeout: 5000 });
        const detailDescriptionImages = page.locator('section').filter({ hasText: '简介' }).locator('figure img');
        if (await detailDescriptionImages.count() < 1) throw new Error('description repair result game shortcut did not show rendered description image');
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
        const batchMatchResultPanel = page.locator('section').filter({ hasText: '批量匹配结果' }).first();
        await batchMatchResultPanel.getByRole('button', { name: /读取结果/ }).click();
        await clickMaintenanceStart(page, '批量元数据匹配');
        await page.getByText(/批量匹配完成|已创建批量元数据匹配任务/).first().waitFor({ timeout: 5000 });
        await batchMatchResultPanel.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await batchMatchResultPanel.getByText(/DLsite|VNDB|FANZA/).first().waitFor({ timeout: 5000 });
        await batchMatchResultPanel.getByLabel('批量匹配结果搜索').fill('天使');
        await batchMatchResultPanel.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
        await batchMatchResultPanel.getByLabel('批量匹配结果状态筛选').selectOption('error');
        await batchMatchResultPanel.getByText('当前筛选没有匹配的批量匹配结果。').first().waitFor({ timeout: 5000 });
        await batchMatchResultPanel.getByRole('button', { name: /重置筛选/ }).click();
        await batchMatchResultPanel.getByText('天使☆騒々 RE-BOOT!').first().waitFor({ timeout: 5000 });
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
        const artworkResultPanel = page.locator('section').filter({ hasText: '媒体补全结果' }).first();
        await artworkResultPanel.getByRole('button', { name: /读取结果/ }).click();
        await page.getByText(/已读取 \d+ 个媒体补全任务结果/).first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByText('已补全目标媒体字段。').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByText(/封面|背景|横幅/).first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByLabel('媒体补全结果搜索').fill('媒体图片补全候选');
        await artworkResultPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByLabel('媒体补全结果搜索').fill('');
        await artworkResultPanel.getByLabel('媒体补全结果状态筛选').selectOption('failed');
        await artworkResultPanel.getByText('媒体补图失败：来源无响应').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByRole('button', { name: /^重试$/ }).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /重置筛选/ }).first().click();
        await artworkResultPanel.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
        await artworkResultPanel.getByRole('button', { name: /^游戏$/ }).first().click();
        await page.getByText('媒体健康').first().waitFor({ timeout: 5000 });
        await page.getByText('媒体图片补全候选').first().waitFor({ timeout: 5000 });
      }],
      ['maintenance-health-duplicate-id-audit', 'maintenance', { games: duplicateAuditGames }, async (page) => {
        await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
        await page.getByText('维护队列').first().waitFor({ timeout: 5000 });
        await page.getByText('重复 ID 审查').first().waitFor({ timeout: 5000 });
        await clickMaintenanceStart(page, '重复 ID 审查');
        await page.getByText(/重复外部 ID 审查完成|已创建重复 ID 审查任务/).first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: '维护' }).click();
        const duplicateAuditResultPanel = page.locator('section').filter({ hasText: '重复 ID 审查结果' }).first();
        await duplicateAuditResultPanel.getByRole('button', { name: /读取结果/ }).click();
        await page.getByText(/已读取 \d+ 个重复 ID 审查任务结果/).first().waitFor({ timeout: 5000 });
        await duplicateAuditResultPanel.getByText('VNDB v29443').first().waitFor({ timeout: 5000 });
        await duplicateAuditResultPanel.getByText('Bangumi bgm-29443').first().waitFor({ timeout: 5000 });
        await duplicateAuditResultPanel.getByText('星之终途 重复记录').first().waitFor({ timeout: 5000 });
        await duplicateAuditResultPanel.getByLabel('重复 ID 审查结果搜索').fill('v29443');
        await duplicateAuditResultPanel.getByText('VNDB v29443').first().waitFor({ timeout: 5000 });
        await duplicateAuditResultPanel.getByLabel('重复 ID 审查结果来源筛选').selectOption('dlsite');
        await duplicateAuditResultPanel.getByText('当前筛选没有匹配的重复 ID 审查结果。').first().waitFor({ timeout: 5000 });
        await duplicateAuditResultPanel.getByLabel('重复 ID 审查结果搜索').fill('');
        await duplicateAuditResultPanel.getByLabel('重复 ID 审查结果来源筛选').selectOption('bangumi');
        await duplicateAuditResultPanel.getByText('Bangumi bgm-29443').first().waitFor({ timeout: 5000 });
        if (await duplicateAuditResultPanel.getByText('VNDB v29443').count() > 0) throw new Error('duplicate audit Bangumi filter did not hide VNDB results');
        await duplicateAuditResultPanel.getByRole('button', { name: /重置筛选/ }).click();
        await duplicateAuditResultPanel.getByText('VNDB v29443').first().waitFor({ timeout: 5000 });
        const duplicateMergePanel = page.locator('section').filter({ hasText: '重复游戏安全合并' }).first();
        await duplicateMergePanel.waitFor({ timeout: 5000 });
        await duplicateMergePanel.getByRole('button', { name: /读取重复组/ }).click();
        await page.getByLabel('重复组搜索').fill('星之终途');
        await page.getByLabel('重复组来源筛选').selectOption('vndb');
        await page.getByText('推荐保留').first().waitFor({ timeout: 5000 });
        const duplicateGameRow = duplicateMergePanel.locator('.motion-soft-row').filter({ hasText: '星之终途' }).filter({ hasText: 'D:\\Games\\VN\\星之终途' }).first();
        await duplicateGameRow.getByRole('button', { name: /复制重复游戏安装目录/ }).click();
        const copiedDuplicateInstallPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedDuplicateInstallPath !== 'D:\\Games\\VN\\星之终途') throw new Error('duplicate merge install path copy did not write the expected path');
        await page.getByText('已复制重复游戏安装目录路径。').first().waitFor({ timeout: 5000 });
        await duplicateMergePanel.getByRole('button', { name: /重置筛选/ }).click();
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
        await page.getByRole('button', { name: /确认合并/ }).click();
        await page.getByText(/已合并重复游戏：删除 1 条源记录，保留「星之终途 重复记录」/).first().waitFor({ timeout: 5000 });
        const mergedGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
        const mergedGame = mergedGames.find((game) => game.id === 'qa-duplicate-id');
        if (mergedGames.some((game) => game.id === 'qa-1')) throw new Error('duplicate merge did not delete the source game');
        if (!mergedGame?.aliases.includes('星之终途') || !mergedGame.aliases.includes('[汉化硬盘版] 星之终途 v1.02')) throw new Error('duplicate merge did not preserve source aliases');
        if (!['全年龄', '科幻', '短篇'].every((tag) => mergedGame.tags.includes(tag))) throw new Error('duplicate merge did not preserve source tags');
        if (mergedGame.totalPlaySeconds < 12600) throw new Error('duplicate merge did not preserve source play time');
        const mergedCollectionLinks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.collectionGames') || '[]'));
        if (mergedCollectionLinks.some((link) => link.gameId === 'qa-1') || !mergedCollectionLinks.some((link) => link.gameId === 'qa-duplicate-id')) throw new Error('duplicate merge did not move collection links to target');
        const mergedAssets = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.assets') || '[]'));
        if (mergedAssets.some((asset) => asset.gameId === 'qa-1') || !mergedAssets.some((asset) => asset.gameId === 'qa-duplicate-id')) throw new Error('duplicate merge did not move assets to target');
      }],
      ['settings-local-privacy-backup', 'settings', {}, async (page) => {
        await page.getByText('设置').first().waitFor({ timeout: 5000 });
        await page.getByRole('tab', { name: /数据源与 AI/ }).click();
        await page.getByText('Bangumi · 40').first().waitFor({ timeout: 5000 });
        await page.getByText('YMGal · 50').first().waitFor({ timeout: 5000 });
        const bangumiFlag = page.locator('section').filter({ hasText: '启用 Bangumi' }).first().getByRole('checkbox', { name: /Bangumi/ });
        const ymgalFlag = page.locator('section').filter({ hasText: '启用 YMGal' }).first().getByRole('checkbox', { name: /YMGal/ });
        await bangumiFlag.uncheck();
        await ymgalFlag.uncheck();
        await page.getByRole('button', { name: /保存设置/ }).click();
        const savedMetadataProviderSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.settings') || '{}'));
        if (savedMetadataProviderSettings.provider_bangumi_enabled !== 'false' || savedMetadataProviderSettings.provider_ymgal_enabled !== 'false') throw new Error('secondary metadata provider toggles did not persist');
        await page.getByRole('tab', { name: /本地与隐私/ }).click();
        await page.getByPlaceholder(/VisualNovel/).fill('D:\\Games\\VisualNovel');
        await page.getByRole('button', { name: /复制待添加库目录/ }).click();
        const copiedPendingLibraryRoot = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedPendingLibraryRoot !== 'D:\\Games\\VisualNovel') throw new Error('pending library root copy did not write the expected path');
        await page.getByText('已复制待添加库目录路径。').first().waitFor({ timeout: 5000 });
        await page.getByPlaceholder(/MikaVN-Archives/).fill('D:\\MikaVN-Archives');
        await page.getByRole('button', { name: /复制库归档位置/ }).click();
        const copiedArchiveDir = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedArchiveDir !== 'D:\\MikaVN-Archives') throw new Error('archive location copy did not write the expected path');
        await page.getByText('已复制库归档位置路径。').first().waitFor({ timeout: 5000 });
        const registeredLibraryRoot = page.locator('.rounded-lg').filter({ hasText: 'D:\\Games\\VN' }).first();
        await registeredLibraryRoot.getByRole('button', { name: /复制已登记库目录/ }).click();
        const copiedRegisteredLibraryRoot = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedRegisteredLibraryRoot !== 'D:\\Games\\VN') throw new Error('registered library root copy did not write the expected path');
        await page.getByText('已复制已登记库目录路径。').first().waitFor({ timeout: 5000 });
        await page.getByText('目录位置速览').first().waitFor({ timeout: 5000 });
        const dataDirLocation = page.locator('section').filter({ hasText: '目录位置速览' }).first().locator('text=数据根目录').first().locator('..');
        await page.getByText('E:\\MikaVN Library\\app-data\\images').first().waitFor({ timeout: 5000 });
        await page.getByText('E:\\MikaVN Library\\app-data\\cache').first().waitFor({ timeout: 5000 });
        await page.getByText('E:\\MikaVN Library\\app-data\\save-backups').first().waitFor({ timeout: 5000 });
        await page.getByText('E:\\MikaVN Library\\app-data\\logs').first().waitFor({ timeout: 5000 });
        await page.getByText('E:\\MikaVN Library\\app-data').first().waitFor({ timeout: 5000 });
        const databaseLocationRow = page.locator('.motion-soft-row').filter({ hasText: '数据库位置' }).filter({ hasText: 'E:\\MikaVN Library\\app-data\\mikavn.db' }).first();
        await databaseLocationRow.getByRole('button', { name: /复制数据库位置/ }).click();
        const copiedDatabaseLocation = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedDatabaseLocation !== 'E:\\MikaVN Library\\app-data\\mikavn.db') throw new Error('database location copy did not write the expected path');
        await page.getByText('已复制数据库位置路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /复制数据根目录/ }).first().click();
        const copiedDataDir = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedDataDir !== 'E:\\MikaVN Library\\app-data') throw new Error('directory copy did not write the expected app data path');
        await page.getByText('已复制数据根目录路径。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /打开数据根目录/ }).first().click();
        await page.getByText('已打开数据根目录。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /复制全部目录路径/ }).first().click();
        const copiedDirectorySummary = await page.evaluate(() => navigator.clipboard.readText());
        if (!copiedDirectorySummary.includes('数据根目录\tE:\\MikaVN Library\\app-data')) throw new Error('directory summary copy is missing the app data path');
        if (!copiedDirectorySummary.includes('图片目录\tE:\\MikaVN Library\\app-data\\images')) throw new Error('directory summary copy is missing the image directory path');
        if (!copiedDirectorySummary.includes('数据库备份\tE:\\MikaVN Library\\app-data')) throw new Error('directory summary copy is missing the database backup directory path');
        await page.getByText('已复制 7 个目录路径。').first().waitFor({ timeout: 5000 });
        const diagnosticLogRow = page.locator('.rounded-lg').filter({ hasText: 'mock-1.log' }).filter({ hasText: 'localStorage://task/qa-task-failed' }).first();
        await diagnosticLogRow.getByRole('button', { name: /复制诊断日志 mock-1\.log/ }).click();
        const copiedDiagnosticLogPath = await page.evaluate(() => navigator.clipboard.readText());
        if (copiedDiagnosticLogPath !== 'localStorage://task/qa-task-failed') throw new Error('diagnostic log copy did not write the expected path');
        await page.getByText('已复制诊断日志路径。').first().waitFor({ timeout: 5000 });
        await diagnosticLogRow.getByRole('button', { name: /打开诊断日志 mock-1\.log/ }).click();
        await page.getByText('已打开诊断日志。').first().waitFor({ timeout: 5000 });
        await page.getByText('后台与托盘').first().waitFor({ timeout: 5000 });
        await page.getByText('托盘图标已启用').first().waitFor({ timeout: 5000 });
        await page.getByText('关闭主窗口时隐藏到托盘').first().waitFor({ timeout: 5000 });
        await page.getByText('打开 MikaVN / 隐藏到托盘 / 退出').first().waitFor({ timeout: 5000 });
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
      ['settings-tray-disabled-toggle', 'settings', { settings: { ...settings, tray_enabled: 'false' } }, async (page) => {
        await page.getByRole('tab', { name: /本地与隐私/ }).click();
        await page.getByText('后台与托盘').first().waitFor({ timeout: 5000 });
        await page.getByText('托盘图标未启用').first().waitFor({ timeout: 5000 });
        await page.getByText('关闭主窗口时直接退出').first().waitFor({ timeout: 5000 });
        const trayFlag = page.locator('section').filter({ hasText: '后台与托盘' }).first().locator('label').filter({ hasText: '启用' }).first().getByRole('checkbox');
        if (await trayFlag.isChecked()) throw new Error('tray toggle should reflect disabled settings');
        await trayFlag.check();
        await page.getByText('托盘设置有未保存改动，保存后立即应用。').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /保存设置/ }).click();
        await page.getByText('托盘图标已启用').first().waitFor({ timeout: 5000 });
        await page.getByText('关闭主窗口时隐藏到托盘').first().waitFor({ timeout: 5000 });
        if (await page.getByText('托盘设置有未保存改动，保存后立即应用。').count() > 0) throw new Error('tray pending hint should clear after saving settings');
        const savedSettings = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.settings') || '{}'));
        if (savedSettings.tray_enabled !== 'true') throw new Error('tray toggle did not persist enabled state');
      }],
    ];

    for (const [name, view, overrides, interact, options] of cases) {
      await runCase(browser, name, view, overrides || {}, interact, options);
    }

    await runCase(browser, 'advanced-search-results', 'advanced-search', { games: [...games, secondaryExternalIdCompleteGame] }, async (page) => {
      const searchInput = page.getByPlaceholder(/输入标题|关键词|快捷搜索/);
      await searchInput.fill('meta:complete');
      await page.getByRole('button', { name: /^搜索$/ }).click();
      await page.getByText('二级 ID 完整条目').first().waitFor({ timeout: 5000 });
      await page.getByText('星之终途').first().waitFor({ timeout: 5000 });
      await page.locator('button').filter({ hasText: '高分全年龄' }).first().click();
      await page.waitForFunction(() => document.body.innerText.includes('星之终途'), null, { timeout: 5000 });
      if (await searchInput.inputValue() !== 'tag:全年龄 rating>=80') throw new Error('advanced search page QA did not apply the saved search query');
      await searchInput.fill('dev:Yuzusoft');
      await page.getByPlaceholder('搜索名称').fill('QA Yuzusoft 搜索');
      await page.getByText('条件可用。').first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /^保存$/ }).click();
      await page.getByText('QA Yuzusoft 搜索').first().waitFor({ timeout: 5000 });
      let savedState = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.savedSearches') || '[]'));
      const createdSaved = savedState.find((item) => item.name === 'QA Yuzusoft 搜索');
      if (!createdSaved || createdSaved.query !== 'dev:Yuzusoft') throw new Error('advanced search page QA did not persist the created saved search');
      await page.locator('.motion-soft-row').filter({ hasText: 'QA Yuzusoft 搜索' }).getByRole('button', { name: '删除保存搜索' }).click();
      savedState = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.savedSearches') || '[]'));
      if (savedState.some((item) => item.name === 'QA Yuzusoft 搜索')) throw new Error('advanced search page QA did not delete the created saved search');
      if (!savedState.some((item) => item.name === '高分全年龄')) throw new Error('advanced search page QA deleted an unrelated saved search');
    });

    await runCase(browser, 'scanner-conflict-review', 'scanner', {}, async (page) => {
      await page.getByPlaceholder(/例如/).fill('D:\\Games\\VN');
      await page.getByRole('button', { name: /复制扫描目录/ }).click();
      const copiedScannerPath = await page.evaluate(() => navigator.clipboard.readText());
      if (copiedScannerPath !== 'D:\\Games\\VN') throw new Error('scanner path copy did not write the expected path');
      await page.getByText('已复制扫描目录路径。').first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /开始扫描/ }).click();
      await page.getByText(/冲突/).first().waitFor({ timeout: 5000 });
      const mergeRow = page.locator('label').filter({ hasText: '星之终途' }).first();
      await mergeRow.getByRole('button', { name: /复制候选安装目录/ }).click();
      const copiedCandidateInstallPath = await page.evaluate(() => navigator.clipboard.readText());
      if (copiedCandidateInstallPath !== 'D:\\Games\\VN\\星之终途') throw new Error('scanner candidate install path copy did not write the expected path');
      await page.getByText('已复制候选安装目录路径。').first().waitFor({ timeout: 5000 });
      await mergeRow.getByRole('button', { name: /复制候选启动程序/ }).click();
      const copiedCandidateExecutablePath = await page.evaluate(() => navigator.clipboard.readText());
      if (copiedCandidateExecutablePath !== 'D:\\Games\\VN\\星之终途\\stella.exe') throw new Error('scanner candidate executable path copy did not write the expected path');
      await page.getByText('已复制候选启动程序路径。').first().waitFor({ timeout: 5000 });
      await mergeRow.getByRole('checkbox').check();
      await mergeRow.locator('select').selectOption('merge');
      await page.getByText(/将更新 星之终途/).first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /导入选中/ }).click();
      await page.getByText(/导入处理完成：新增 0、合并 1、替换 0、副本 0、跳过 0/).first().waitFor({ timeout: 5000 });
      await page.getByText('导入审计').first().waitFor({ timeout: 5000 });
      await page.getByLabel('导入审计动作筛选').selectOption('merge');
      await page.getByText(/已合并到现有记录/).first().waitFor({ timeout: 5000 });
      const mergeAuditRow = page.locator('.rounded-md').filter({ hasText: '已合并到现有记录' }).first();
      await mergeAuditRow.getByRole('button', { name: /复制审计安装目录/ }).click();
      const copiedAuditInstallPath = await page.evaluate(() => navigator.clipboard.readText());
      if (copiedAuditInstallPath !== 'D:\\Games\\VN\\星之终途') throw new Error('scanner audit install path copy did not write the expected path');
      await page.getByText('已复制审计安装目录路径。').first().waitFor({ timeout: 5000 });
      await page.getByText(/记录 ID：qa-1/).first().waitFor({ timeout: 5000 });
      await page.getByLabel('导入审计搜索').fill('星之终途');
      await page.getByText(/当前显示 1 \/ 1 条处理明细/).first().waitFor({ timeout: 5000 });
      const mergedGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
      const mergedGame = mergedGames.find((game) => game.id === 'qa-1');
      if (!mergedGame?.installPath.includes('D:\\Games\\VN\\星之终途')) throw new Error('page QA scanner merge did not keep the expected merged install path');
      if (!mergedGame?.aliases.includes('[汉化硬盘版] 星之终途 v1.02')) throw new Error('page QA scanner merge did not retain candidate aliases');
      if (!mergedGame?.aliases.includes('星之终途')) throw new Error('page QA scanner merge did not retain existing title as alias');
    });

    await runCase(browser, 'scanner-skip-import-audit', 'scanner', {}, async (page) => {
      await page.getByPlaceholder(/例如/).fill('D:\\Games\\VN');
      await page.getByRole('button', { name: /开始扫描/ }).click();
      await page.getByText(/冲突/).first().waitFor({ timeout: 5000 });
      const beforeSkipGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
      const skipRow = page.locator('label').filter({ hasText: '星之终途' }).first();
      await skipRow.getByRole('checkbox').check();
      if (await skipRow.locator('select').inputValue() !== 'skip') throw new Error('scanner conflict candidate should default to skip');
      await page.getByRole('button', { name: /导入选中/ }).click();
      await page.getByText(/导入处理完成：新增 0、合并 0、替换 0、副本 0、跳过 1/).first().waitFor({ timeout: 5000 });
      await page.getByText('导入审计').first().waitFor({ timeout: 5000 });
      await page.getByLabel('导入审计动作筛选').selectOption('skip');
      await page.getByText(/已跳过与现有记录冲突的候选/).first().waitFor({ timeout: 5000 });
      const skipAuditRow = page.locator('.rounded-md').filter({ hasText: '已跳过与现有记录冲突的候选' }).first();
      if (await skipAuditRow.getByText(/记录 ID：/).count() > 0) throw new Error('scanner skip audit row should not show a written game record ID');
      await page.getByText(/冲突原因：安装目录已存在|冲突原因：标题相同/).first().waitFor({ timeout: 5000 });
      const afterSkipGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
      if (afterSkipGames.length !== beforeSkipGames.length) throw new Error('scanner skip should not add or delete game records');
      const skippedOriginal = afterSkipGames.find((game) => game.id === 'qa-1');
      if (!skippedOriginal?.aliases.includes('[汉化硬盘版] 星之终途 v1.02') || skippedOriginal.aliases.includes('星之终途')) throw new Error('scanner skip should not merge candidate aliases into the existing record');
    });

    await runCase(browser, 'scanner-replace-import-audit', 'scanner', {}, async (page) => {
      await page.getByPlaceholder(/例如/).fill('D:\\Games\\VN');
      await page.getByRole('button', { name: /开始扫描/ }).click();
      await page.getByText(/冲突/).first().waitFor({ timeout: 5000 });
      const replaceRow = page.locator('label').filter({ hasText: '天使☆騒々 RE-BOOT!' }).first();
      await replaceRow.getByRole('checkbox').check();
      await replaceRow.locator('select').selectOption('replace');
      await page.getByText(/高风险：覆盖已有记录/).first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /导入选中/ }).click();
      await page.getByText(/导入处理完成：新增 0、合并 0、替换 1、副本 0、跳过 0/).first().waitFor({ timeout: 5000 });
      await page.getByText('导入审计').first().waitFor({ timeout: 5000 });
      await page.getByLabel('导入审计动作筛选').selectOption('replace');
      await page.getByText(/已替换现有数据库记录/).first().waitFor({ timeout: 5000 });
      await page.getByText(/冲突原因：标题相同|冲突原因：安装目录已存在/).first().waitFor({ timeout: 5000 });
      await page.getByText(/记录 ID：qa-2/).first().waitFor({ timeout: 5000 });
      await page.getByLabel('导入审计搜索').fill('qa-2');
      await page.getByText(/当前显示 1 \/ 1 条处理明细/).first().waitFor({ timeout: 5000 });
      await page.getByLabel('导入审计搜索').fill('不存在的审计项');
      await page.getByText('当前筛选没有明细。').first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /重置审计/ }).click();
      const replacedGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
      const replacedGame = replacedGames.find((game) => game.id === 'qa-2');
      if (!replacedGame?.installPath.includes('D:\\Games\\VN\\ゆずソフト\\天使騒々')) throw new Error('page QA scanner replace did not update the expected install path');
      if (replacedGame?.title !== '天使☆騒々 RE-BOOT!') throw new Error('page QA scanner replace did not update the existing record title');
      if (!replacedGame?.aliases.includes('[230428][ゆずソフト] 天使☆騒々 RE-BOOT!')) throw new Error('page QA scanner replace did not update aliases from the candidate');
    });

    await runCase(browser, 'scanner-duplicate-import-audit', 'scanner', {}, async (page) => {
      await page.getByPlaceholder(/例如/).fill('D:\\Games\\VN');
      await page.getByRole('button', { name: /开始扫描/ }).click();
      await page.getByText(/冲突/).first().waitFor({ timeout: 5000 });
      const duplicateRow = page.locator('label').filter({ hasText: '星之终途' }).first();
      await duplicateRow.getByRole('checkbox').check();
      await duplicateRow.locator('select').selectOption('duplicate');
      await page.getByText(/会新建一条独立记录/).first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /导入选中/ }).click();
      await page.getByText(/导入处理完成：新增 0、合并 0、替换 0、副本 1、跳过 0/).first().waitFor({ timeout: 5000 });
      await page.getByText('导入审计').first().waitFor({ timeout: 5000 });
      await page.getByLabel('导入审计搜索').fill('星之终途');
      await page.getByText(/当前显示 1 \/ 1 条处理明细/).first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /重置审计/ }).click();
      await page.getByLabel('导入审计动作筛选').selectOption('duplicate');
      await page.getByText(/已作为副本导入/).first().waitFor({ timeout: 5000 });
      await page.getByText(/冲突原因：安装目录已存在|冲突原因：标题相同/).first().waitFor({ timeout: 5000 });
      await page.getByText(/D:\\Games\\VN\\星之终途/).first().waitFor({ timeout: 5000 });
      const duplicateGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
      const starGames = duplicateGames.filter((game) => game.title === '星之终途');
      if (duplicateGames.length !== games.length + 1) throw new Error('page QA scanner duplicate did not add exactly one game');
      if (starGames.length !== 2) throw new Error('page QA scanner duplicate did not keep both original and duplicate records');
      if (!starGames.some((game) => game.aliases.includes('[汉化硬盘版] 星之终途 v1.02'))) throw new Error('page QA scanner duplicate did not persist candidate aliases');
    });

    await runCase(browser, 'tasks-retry-shows-result-under-filters', 'tasks', { games: [...games, descriptionRepairGame], tasks: [descriptionImageRepairFailedTask, fanzaDescriptionImageRepairTask, ...tasks], taskLogs }, async (page) => {
      await page.getByText('任务概览').first().waitFor({ timeout: 5000 });
      const recentResultsPanel = page.locator('[aria-label="最近任务结果"]');
      await recentResultsPanel.locator('[data-task-result-id="qa-task-description-image-failed"]').getByRole('button', { name: /重试/ }).waitFor({ timeout: 5000 });
      if (await recentResultsPanel.locator('[data-task-result-id="qa-task-description-image-fanza"]').getByRole('button', { name: /重试/ }).count() > 0) throw new Error('task page completed result should not show retry action');
      const taskStatusShortcuts = page.locator('[aria-label="任务状态快捷筛选"]');
      const taskTypeShortcuts = page.locator('[aria-label="任务类型快捷筛选"]');
      await taskStatusShortcuts.getByRole('button', { name: /需处理\s+3/ }).click();
      await taskTypeShortcuts.getByRole('button', { name: /简介图片修复\s+2/ }).click();
      if (await page.getByLabel('任务状态筛选').inputValue() !== 'attention') throw new Error('task retry filter QA did not start from attention status filter');
      if (await page.getByLabel('任务类型筛选').inputValue() !== 'metadata.description_image_repair') throw new Error('task retry filter QA did not start from description repair type filter');
      await page.getByLabel('任务搜索').fill('DLsite');
      await page.getByText('简介图片修复失败：DLsite 暂不可用').first().waitFor({ timeout: 5000 });
      await page.locator('[aria-label="最近任务结果"]').locator('[data-task-result-id="qa-task-description-image-failed"]').getByRole('button', { name: /重试/ }).click();
      await page.getByText(/已重新创建任务：简介图片修复/).first().waitFor({ timeout: 5000 });
      if (await page.getByLabel('任务状态筛选').inputValue() !== 'all') throw new Error('task retry did not clear the status filter to reveal the retried task');
      if (await page.getByLabel('任务类型筛选').inputValue() !== 'metadata.description_image_repair') throw new Error('task retry should keep the retried task type filter selected');
      if ((await page.getByLabel('任务搜索').inputValue()).trim() !== '') throw new Error('task retry did not clear the task search to reveal the retried task');
      await page.getByText(/浏览器预览已修复 1 个条目的简介图片/).first().waitFor({ timeout: 5000 });
      await page.getByText('简介图片修复候选：dlsite:RJ01000001').first().waitFor({ timeout: 5000 });
    });

    await runCase(browser, 'tasks-running-failed-expanded', 'tasks', { games: [...games, descriptionRepairGame], tasks: [descriptionImageRepairFailedTask, ...tasks], taskLogs }, async (page) => {
      await page.getByText('任务概览').first().waitFor({ timeout: 5000 });
      await page.getByText('任务总数').first().waitFor({ timeout: 5000 });
      await page.getByText('进行中').first().waitFor({ timeout: 5000 });
      await page.getByText('需处理').first().waitFor({ timeout: 5000 });
      const recentResultsPanel = page.locator('[aria-label="最近任务结果"]');
      await recentResultsPanel.getByText('最近结果').first().waitFor({ timeout: 5000 });
      await recentResultsPanel.getByText('简介图片修复失败：DLsite 暂不可用').first().waitFor({ timeout: 5000 });
      await recentResultsPanel.getByText('媒体补图失败：来源无响应').first().waitFor({ timeout: 5000 });
      await recentResultsPanel.locator('[data-task-result-id="qa-task-description-image-failed"]').getByRole('button', { name: /日志/ }).click();
      await page.getByText('DLsite 暂不可用，等待重试。').first().waitFor({ timeout: 5000 });
      await page.locator('.motion-soft-row').filter({ hasText: '简介图片修复失败：DLsite 暂不可用' }).first().getByRole('button', { name: /日志/ }).click();
      await page.getByText('队列总体进度').first().waitFor({ timeout: 5000 });
      await page.getByText(/已运行/).first().waitFor({ timeout: 5000 });
      await page.getByText(/预计剩余/).first().waitFor({ timeout: 5000 });
      await page.getByText(/耗时/).first().waitFor({ timeout: 5000 });
      const taskStatusShortcuts = page.locator('[aria-label="任务状态快捷筛选"]');
      await taskStatusShortcuts.getByRole('button', { name: /需处理\s+3/ }).click();
      if (await page.getByLabel('任务状态筛选').inputValue() !== 'attention') throw new Error('task status shortcut did not select attention filter');
      await page.getByText('扫描失败：路径不存在').first().waitFor({ timeout: 5000 });
      if (await page.getByText('正在匹配 2 个游戏').count() > 0) throw new Error('running task should be hidden by attention shortcut');
      await taskStatusShortcuts.getByRole('button', { name: /进行中\s+1/ }).click();
      if (await page.getByLabel('任务状态筛选').inputValue() !== 'active') throw new Error('task status shortcut did not select active filter');
      await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
      if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden by active shortcut');
      await taskStatusShortcuts.getByRole('button', { name: /全部\s+4/ }).click();
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
      await taskTypeShortcuts.getByRole('button', { name: /简介图片修复\s+1/ }).click();
      if (await page.getByLabel('任务类型筛选').inputValue() !== 'metadata.description_image_repair') throw new Error('task type shortcut did not select description image repair filter');
      await page.getByText('简介图片修复失败：DLsite 暂不可用').first().waitFor({ timeout: 5000 });
      if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('scan task should be hidden by description image repair type shortcut');
      const descriptionRepairRow = page.locator('.motion-soft-row').filter({ hasText: '简介图片修复失败：DLsite 暂不可用' }).first();
      await descriptionRepairRow.getByRole('button', { name: /日志/ }).click();
      await page.getByText('DLsite 暂不可用，等待重试。').first().waitFor({ timeout: 5000 });
      await page.getByLabel(/日志搜索 简介图片修复/).fill('RJ01000001');
      await page.getByText('准备处理 dlsite:RJ01000001').first().waitFor({ timeout: 5000 });
      if (await page.getByText('DLsite 暂不可用，等待重试。').count() > 0) throw new Error('description image task log search did not filter log rows');
      await descriptionRepairRow.getByRole('button', { name: /重试/ }).click();
      await page.getByText(/已重新创建任务：简介图片修复/).first().waitFor({ timeout: 5000 });
      await page.getByText(/浏览器预览已修复 1 个条目的简介图片/).first().waitFor({ timeout: 5000 });
      await page.getByText('简介图片修复候选：dlsite:RJ01000001').first().waitFor({ timeout: 5000 });
      const retriedTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
      if (!retriedTasks.some((task) => task.taskType === 'metadata.description_image_repair' && task.status === 'completed' && task.retryable)) throw new Error('description image repair retry did not create a completed retryable task');
      const retriedGames = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.games') || '[]'));
      if (!retriedGames.find((game) => game.id === 'qa-description-repair')?.description.includes('![简介图片](')) throw new Error('description image repair retry did not update the game description');
      await taskTypeShortcuts.getByRole('button', { name: /全部类型\s+5/ }).click();
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
      const scanFailedRow = page.locator('.motion-soft-row').filter({ hasText: '扫描失败：路径不存在' }).first();
      await scanFailedRow.getByRole('button', { name: /日志/ }).click();
      await page.getByText(/任务日志|路径不存在/).first().waitFor({ timeout: 5000 });
      await page.getByLabel(/日志搜索/).fill('开始扫描');
      await page.getByText('开始扫描 D:\\Missing').first().waitFor({ timeout: 5000 });
      if (await page.getByText('路径不存在，等待用户重试。').count() > 0) throw new Error('task log search did not filter log rows');
      await page.getByLabel(/日志搜索/).fill('没有这种日志文本');
      await page.getByText('当前日志筛选无结果。').first().waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /清空/ }).last().click();
      await page.getByText('路径不存在，等待用户重试。').first().waitFor({ timeout: 5000 });
      const failedTaskLogLine = page.locator('[data-task-log-id="log-2"]').first();
      await failedTaskLogLine.getByRole('button', { name: /复制记录/ }).click();
      const copiedTaskLogLine = await page.evaluate(() => navigator.clipboard.readText());
      if (!copiedTaskLogLine.includes('错误') || !copiedTaskLogLine.includes('路径不存在，等待用户重试。')) throw new Error('task log copy did not include the expected level and message');
      await page.getByText('已复制任务日志。').first().waitFor({ timeout: 5000 });
      const runningMetadataRow = page.locator('.motion-soft-row').filter({ hasText: '正在匹配 2 个游戏' }).first();
      await runningMetadataRow.getByRole('button', { name: /取消/ }).click();
      await page.getByText(/已取消任务：批量元数据匹配/).first().waitFor({ timeout: 5000 });
      await page.getByLabel(/日志搜索 批量元数据匹配/).first().waitFor({ timeout: 5000 });
      await page.getByText('警告').first().waitFor({ timeout: 5000 });
      const cancelledTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
      const cancelledTask = cancelledTasks.find((task) => task.id === 'qa-task-running');
      const cancelledPayload = JSON.parse(cancelledTask?.retryPayload || '{}');
      if (cancelledTask?.status !== 'cancelled' || cancelledPayload.gameIds?.join(',') !== 'qa-1,qa-2') throw new Error('task page cancel did not preserve the original retry payload');
      const cancelledMetadataRow = page.locator('.motion-soft-row').filter({ hasText: '批量元数据匹配' }).filter({ hasText: '任务已取消' }).first();
      await cancelledMetadataRow.getByRole('button', { name: /重试/ }).click();
      await page.getByText(/已重新创建任务：批量元数据匹配/).first().waitFor({ timeout: 5000 });
      await page.getByText(/批量匹配完成：2 个条目/).first().waitFor({ timeout: 5000 });
      const retriedBatchTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
      const retriedBatchTask = retriedBatchTasks.find((task) => task.taskType === 'metadata.batch_match' && /批量匹配完成：2 个条目/.test(task.message ?? ''));
      const retriedBatchPayload = JSON.parse(retriedBatchTask?.retryPayload || '{}');
      if (!retriedBatchTask?.retryable || retriedBatchPayload.gameIds?.join(',') !== 'qa-1,qa-2') throw new Error('task page retry did not recreate the batch match task with the original game IDs');
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
