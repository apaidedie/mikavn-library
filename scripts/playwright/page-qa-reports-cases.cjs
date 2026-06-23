const {
  descriptionRepairGame,
  games,
  settings,
} = require('./page-qa-fixtures.cjs');

const reportsPageQaCases = [
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
];

module.exports = { reportsPageQaCases };
