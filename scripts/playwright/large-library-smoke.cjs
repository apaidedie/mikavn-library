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
const outDir = path.resolve(process.env.MIKAVN_QA_OUT_DIR || path.join(repoRoot, 'output', 'playwright', 'large-library-current'));
fs.mkdirSync(outDir, { recursive: true });

const now = new Date().toISOString();
const gameCount = Number.parseInt(process.env.MIKAVN_LARGE_LIBRARY_COUNT || '1500', 10);
const libraryLoadBudgetMs = Number.parseInt(process.env.MIKAVN_LARGE_LIBRARY_LOAD_BUDGET_MS || '9000', 10);
const searchBudgetMs = Number.parseInt(process.env.MIKAVN_LARGE_LIBRARY_SEARCH_BUDGET_MS || '6000', 10);

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
  const browser = await chromium.launch({ headless: true });
  const report = { gameCount, budgets: { libraryLoadBudgetMs, searchBudgetMs }, timings: {} };

  try {
    {
      const { context, page, consoleErrors } = await openSeededPage(browser, 'library', games);
      report.timings.libraryLoadMs = await measure('library load', libraryLoadBudgetMs, async () => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.getByText(`${gameCount} games`).first().waitFor({ timeout: libraryLoadBudgetMs });
        await page.getByText('大型库性能样本 1 终途').first().waitFor({ timeout: 5000 });
      });
      const visibleRows = await page.locator('.game-nav-row').count();
      if (visibleRows < gameCount) throw new Error(`expected ${gameCount} list rows, got ${visibleRows}`);
      await page.locator('aside').getByRole('button', { name: /筛选/ }).click();
      await page.getByPlaceholder('标签').fill('性能目标');
      await page.getByText(/60 games/).first().waitFor({ timeout: 5000 });
      await page.screenshot({ path: path.join(outDir, 'large-library-list.png'), fullPage: true });
      const importantConsoleErrors = consoleErrors.filter((item) => !/favicon|DevTools/.test(item));
      if (importantConsoleErrors.length) throw new Error(`library console errors: ${importantConsoleErrors.join(' | ')}`);
      await context.close();
      console.log(`OK large library list ${gameCount} games in ${report.timings.libraryLoadMs}ms`);
    }

    {
      const { context, page, consoleErrors } = await openSeededPage(browser, 'advanced-search', games);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.getByText('高级搜索').first().waitFor({ timeout: 10000 });
      report.timings.searchMs = await measure('advanced search', searchBudgetMs, async () => {
        await page.getByPlaceholder(/输入标题|关键词|快捷搜索/).fill('tag:性能目标 rating>=80');
        await page.getByRole('button', { name: /^搜索$/ }).click();
        await page.getByText(/30 个匹配条目/).first().waitFor({ timeout: searchBudgetMs });
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

  fs.writeFileSync(path.join(outDir, 'large-library-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
