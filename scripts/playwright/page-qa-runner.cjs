const {
  descriptionImageRepairFailedTask,
  descriptionRepairGame,
  fanzaDescriptionImageRepairTask,
  games,
  secondaryExternalIdCompleteGame,
  taskLogs,
  tasks,
} = require('./page-qa-fixtures.cjs');
const { dashboardPageQaCases } = require('./page-qa-dashboard-cases.cjs');
const { libraryPageQaCases } = require('./page-qa-library-cases.cjs');
const { metadataPageQaCases } = require('./page-qa-metadata-cases.cjs');
const { maintenancePageQaCases } = require('./page-qa-maintenance-cases.cjs');
const { reportsPageQaCases } = require('./page-qa-reports-cases.cjs');
const { savesPageQaCases } = require('./page-qa-saves-cases.cjs');
const { settingsPageQaCases } = require('./page-qa-settings-cases.cjs');
const { runScannerPageQaCases } = require('./page-qa-scanner-cases.cjs');
const {
  launchPageQaBrowser,
  readTaskRetryPayload,
  runCase,
} = require('./page-qa-runner-helpers.cjs');

async function main() {
  const browser = await launchPageQaBrowser();
  try {
    const cases = [
      ...dashboardPageQaCases,
      ...libraryPageQaCases,
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
      ...metadataPageQaCases,
      ...reportsPageQaCases,
      ...savesPageQaCases,
      ...maintenancePageQaCases,
      ...settingsPageQaCases,
    ];

    for (const [name, view, overrides, interact, options] of cases) {
      await runCase(browser, name, view, overrides || {}, interact, options);
    }

    await runCase(browser, 'advanced-search-results', 'advanced-search', { games: [...games, secondaryExternalIdCompleteGame] }, async (page) => {
      const searchInput = page.getByRole('textbox', { name: '关键词或条件' });
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

    await runScannerPageQaCases(browser);

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
      const cancelledPayload = await readTaskRetryPayload(page, cancelledTask);
      if (cancelledTask?.status !== 'cancelled' || cancelledPayload.gameIds?.join(',') !== 'qa-1,qa-2') throw new Error('task page cancel did not preserve the original retry payload');
      const cancelledMetadataRow = page.locator('.motion-soft-row').filter({ hasText: '批量元数据匹配' }).filter({ hasText: '任务已取消' }).first();
      await cancelledMetadataRow.getByRole('button', { name: /重试/ }).click();
      await page.getByText(/已重新创建任务：批量元数据匹配/).first().waitFor({ timeout: 5000 });
      await page.getByText(/批量匹配完成：2 个条目/).first().waitFor({ timeout: 5000 });
      const retriedBatchTasks = await page.evaluate(() => JSON.parse(localStorage.getItem('mikavn-library.mock.tasks') || '[]'));
      const retriedBatchTask = retriedBatchTasks.find((task) => task.taskType === 'metadata.batch_match' && /批量匹配完成：2 个条目/.test(task.message ?? ''));
      const retriedBatchPayload = await readTaskRetryPayload(page, retriedBatchTask);
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
