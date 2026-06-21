const fs = require('fs');
const path = require('path');
const { recordLargeLibrarySmokeHistory } = require('./large-library-report-history.cjs');
const { resolvePlaywright } = require('./playwright-resolution.cjs');

const baseUrl = process.env.MIKAVN_QA_URL || 'http://127.0.0.1:1420/';
const repoRoot = path.resolve(__dirname, '..', '..');
const { chromium } = require(resolvePlaywright(repoRoot));
const outDir = path.resolve(process.env.MIKAVN_QA_OUT_DIR || path.join(repoRoot, 'output', 'playwright', 'large-library-current'));
const historyPath = path.resolve(process.env.MIKAVN_LARGE_LIBRARY_HISTORY_PATH || path.join(repoRoot, 'output', 'playwright', 'large-library-history.jsonl'));
fs.mkdirSync(outDir, { recursive: true });

const now = new Date().toISOString();
const gameCount = Number.parseInt(process.env.MIKAVN_LARGE_LIBRARY_COUNT || '4500', 10);
const libraryLoadBudgetMs = Number.parseInt(process.env.MIKAVN_LARGE_LIBRARY_LOAD_BUDGET_MS || '12000', 10);
const detailSwitchBudgetMs = Number.parseInt(process.env.MIKAVN_LARGE_LIBRARY_DETAIL_BUDGET_MS || '3000', 10);
const searchBudgetMs = Number.parseInt(process.env.MIKAVN_LARGE_LIBRARY_SEARCH_BUDGET_MS || '8000', 10);

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

function makeLargeGames(count) {
  const statuses = ['planned', 'playing', 'completed', 'paused', 'archived'];
  const studios = ['Key', 'Yuzusoft', 'Palette', 'August', 'Nitroplus', 'Favorite'];
  return Array.from({ length: count }, (_, index) => {
    const id = `large-${String(index + 1).padStart(4, '0')}`;
    const studio = studios[index % studios.length];
    const status = statuses[index % statuses.length];
    const rating = 60 + (index % 40);
    const year = 2008 + (index % 18);
    const special = index % 25 === 0;
    return {
      id,
      title: special ? `大型库性能样本 ${index + 1} 终途` : `大型库性能样本 ${index + 1}`,
      originalTitle: special ? `Large Library Target ${index + 1}` : null,
      aliases: special ? [`target-${index + 1}`, 'large-smoke'] : [`sample-${index + 1}`],
      developer: studio,
      publisher: studio,
      brand: studio,
      releaseDate: `${year}-${String((index % 12) + 1).padStart(2, '0')}-15`,
      description: `大库性能烟测条目 ${index + 1}`,
      notes: special ? 'large smoke target searchable note' : '',
      tags: special ? ['全年龄', '性能目标'] : [index % 3 === 0 ? '全年龄' : 'R18', index % 4 === 0 ? '科幻' : '恋爱'],
      genres: ['Visual Novel'],
      rating,
      ageRating: index % 3 === 0 ? '全年龄' : 'R18',
      playStatus: status,
      favorite: index % 17 === 0,
      hidden: false,
      installPath: `D:\\Games\\LargeVN\\${id}`,
      executablePath: `D:\\Games\\LargeVN\\${id}\\game.exe`,
      workingDirectory: `D:\\Games\\LargeVN\\${id}`,
      launchArgs: null,
      pathStatus: index % 31 === 0 ? 'broken' : 'ok',
      lastPathCheckedAt: now,
      coverImage: null,
      bannerImage: null,
      backgroundImage: null,
      vndbId: index % 5 === 0 ? `v${10000 + index}` : null,
      bangumiId: null,
      dlsiteId: index % 7 === 0 ? `RJ${String(10000000 + index)}` : null,
      fanzaId: null,
      ymgalId: null,
      totalPlaySeconds: index * 180,
      lastPlayedAt: index < 120 ? new Date(Date.now() - index * 3600 * 1000).toISOString() : null,
      createdAt: new Date(Date.now() - index * 86400 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - index * 3600 * 1000).toISOString(),
    };
  });
}

function seedData(view, games) {
  return {
    view,
    data: {
      'mikavn-library.mock.games': games,
      'mikavn-library.mock.tasks': [],
      'mikavn-library.mock.taskLogs': {},
      'mikavn-library.mock.savePaths': [],
      'mikavn-library.mock.saveBackups': [],
      'mikavn-library.mock.collections': [],
      'mikavn-library.mock.collectionGames': [],
      'mikavn-library.mock.assets': [],
      'mikavn-library.mock.savedSearches': [],
      'mikavn-library.mock.libraryRoots': [],
      'mikavn-library.mock.settings': settings,
    },
  };
}

function hasPerformanceTargetTag(game) {
  return game.tags.includes('性能目标');
}

function isLargeSmokeSearchMatch(game) {
  return hasPerformanceTargetTag(game) && game.rating >= 80;
}

function countMatchingGames(games, predicate) {
  return games.reduce((count, game) => count + (predicate(game) ? 1 : 0), 0);
}

function findDetailSwitchTarget(games) {
  return [...games].reverse().find(hasPerformanceTargetTag);
}

function formatLargeSmokeCount(value) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatLargeSmokeGameTotal(value) {
  return `${formatLargeSmokeCount(value)} 个游戏`;
}

function formatLargeSmokeSearchTotal(value) {
  return `${formatLargeSmokeCount(value)} 个匹配条目`;
}

async function openSeededPage(browser, view, games) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.addInitScript(({ nextView, data }) => {
    localStorage.clear();
    localStorage.setItem('mikavn.currentView', nextView);
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value));
  }, { nextView: view, data: seedData(view, games).data });
  return { context, page, consoleErrors };
}

async function measure(label, budgetMs, action) {
  const start = Date.now();
  await action();
  const durationMs = Date.now() - start;
  if (durationMs > budgetMs) {
    throw new Error(`${label} exceeded budget: ${durationMs}ms > ${budgetMs}ms`);
  }
  return durationMs;
}

async function main() {
  const games = makeLargeGames(gameCount);
  const expectedTargetCount = countMatchingGames(games, hasPerformanceTargetTag);
  const expectedSearchCount = countMatchingGames(games, isLargeSmokeSearchMatch);
  const detailSwitchTarget = findDetailSwitchTarget(games);
  if (!detailSwitchTarget) throw new Error('large smoke data did not include a detail switch target');
  const browser = await chromium.launch({ headless: true });
  const report = {
    gameCount,
    expected: {
      targetCount: expectedTargetCount,
      searchCount: expectedSearchCount,
      detailSwitchTargetId: detailSwitchTarget.id,
    },
    budgets: { libraryLoadBudgetMs, detailSwitchBudgetMs, searchBudgetMs },
    renderedRows: {},
    timings: {},
  };

  try {
    {
      const { context, page, consoleErrors } = await openSeededPage(browser, 'library', games);
      report.timings.libraryLoadMs = await measure('library load', libraryLoadBudgetMs, async () => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.getByText(formatLargeSmokeGameTotal(gameCount)).first().waitFor({ timeout: libraryLoadBudgetMs });
        await page.getByText('大型库性能样本 1 终途').first().waitFor({ timeout: 5000 });
      });
      const visibleRows = await page.locator('.game-nav-row').count();
      report.renderedRows.initial = visibleRows;
      if (visibleRows <= 0) throw new Error('expected initial list rows to render');
      if (visibleRows >= gameCount) throw new Error(`expected batched list rows below ${gameCount}, got ${visibleRows}`);
      const loadMoreButton = page.getByRole('button', { name: /加载更多/ }).first();
      await loadMoreButton.waitFor({ timeout: 5000 });
      await loadMoreButton.click();
      await page.waitForFunction((previousCount) => document.querySelectorAll('.game-nav-row').length > previousCount, visibleRows, { timeout: 5000 });
      const expandedRows = await page.locator('.game-nav-row').count();
      report.renderedRows.afterLoadMore = expandedRows;
      if (expandedRows <= visibleRows) throw new Error(`expected load more to increase row count, got ${visibleRows} -> ${expandedRows}`);
      await page.locator('aside').getByRole('button', { name: /筛选/ }).click();
      await page.getByPlaceholder('标签').fill('性能目标');
      await page.getByText(formatLargeSmokeGameTotal(expectedTargetCount)).first().waitFor({ timeout: 5000 });
      const detailTargetButton = page
        .locator('.game-nav-row')
        .filter({ hasText: detailSwitchTarget.title })
        .getByRole('button')
        .first();
      await detailTargetButton.waitFor({ timeout: 5000 });
      report.timings.detailSwitchMs = await measure('library detail switch', detailSwitchBudgetMs, async () => {
        await detailTargetButton.click();
        await page.locator('h2', { hasText: detailSwitchTarget.title }).first().waitFor({ timeout: detailSwitchBudgetMs });
      });
      await page.screenshot({ path: path.join(outDir, 'large-library-detail.png'), fullPage: true });
      await page.screenshot({ path: path.join(outDir, 'large-library-list.png'), fullPage: true });
      const importantConsoleErrors = consoleErrors.filter((item) => !/favicon|DevTools/.test(item));
      if (importantConsoleErrors.length) throw new Error(`library console errors: ${importantConsoleErrors.join(' | ')}`);
      await context.close();
      console.log(`OK large library list ${formatLargeSmokeCount(gameCount)} entries in ${report.timings.libraryLoadMs}ms`);
      console.log(`OK large library detail switch in ${report.timings.detailSwitchMs}ms`);
    }

    {
      const { context, page, consoleErrors } = await openSeededPage(browser, 'advanced-search', games);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.getByText('高级搜索').first().waitFor({ timeout: 10000 });
      report.timings.searchMs = await measure('advanced search', searchBudgetMs, async () => {
        await page.getByPlaceholder(/输入标题|关键词|快捷搜索/).fill('tag:性能目标 rating>=80');
        await page.getByRole('button', { name: /^搜索$/ }).click();
        await page.getByText(formatLargeSmokeSearchTotal(expectedSearchCount)).first().waitFor({ timeout: searchBudgetMs });
        await page.getByText('大型库性能样本 26 终途').first().waitFor({ timeout: 5000 });
      });
      await page.screenshot({ path: path.join(outDir, 'large-library-search.png'), fullPage: true });
      const importantConsoleErrors = consoleErrors.filter((item) => !/favicon|DevTools/.test(item));
      if (importantConsoleErrors.length) throw new Error(`search console errors: ${importantConsoleErrors.join(' | ')}`);
      await context.close();
      console.log(`OK large library advanced search in ${report.timings.searchMs}ms`);
    }
  } finally {
    await browser.close();
  }

  report.history = recordLargeLibrarySmokeHistory(report, { historyPath });
  fs.writeFileSync(path.join(outDir, 'large-library-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
