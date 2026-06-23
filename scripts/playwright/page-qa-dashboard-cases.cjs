const {
  descriptionImageRepairFailedTask,
  descriptionRepairGame,
  fanzaDescriptionImageRepairTask,
  games,
  taskLogs,
  tasks,
} = require('./page-qa-fixtures.cjs');
const {
  expectNoHorizontalOverflow,
  openHome,
} = require('./page-qa-runner-helpers.cjs');

const dashboardPageQaCases = [
  ['dashboard-populated', 'dashboard', {}, async (page) => {
    for (const text of ['今日状态', '继续游玩', '需要关注', '本地安全', '添加游戏', '扫描入库', '想玩', '维护', '本地设置']) {
      await page.getByText(text, { exact: false }).first().waitFor({ timeout: 5000 });
    }
    await page.locator('section').filter({ hasText: '继续游玩' }).first().locator('button').filter({ hasText: '星之终途' }).first().click();
    await page.getByText('末世旅途题材的短篇视觉小说。这里用于成熟 V1 页面 QA。').first().waitFor({ timeout: 5000 });
    await openHome(page);
    await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
    await page.locator('section').filter({ hasText: '今日状态' }).first().getByRole('button', { name: /维护/ }).click();
    await page.getByText('维护中心').first().waitFor({ timeout: 5000 });
    await openHome(page);
    await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
    await page.locator('section').filter({ hasText: '今日状态' }).first().getByRole('button', { name: /本地设置/ }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent?.includes('备份与本地') && tab.getAttribute('data-state') === 'active'), null, { timeout: 5000 });
    await openHome(page);
    await page.getByText('本地安全').first().waitFor({ timeout: 5000 });
    await page.locator('section').filter({ hasText: '本地安全' }).first().getByRole('button', { name: /恢复数据库/ }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent?.includes('备份与本地') && tab.getAttribute('data-state') === 'active'), null, { timeout: 5000 });
    await page.getByText('数据目录自检').first().waitFor({ timeout: 5000 });
    await openHome(page);
    await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
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
    await openHome(page);
    await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /进行中\s+1/ }).click();
    await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
    if (await page.getByLabel('任务状态筛选').inputValue() !== 'active') throw new Error('dashboard running shortcut did not select active task filter');
    await page.getByText('正在匹配 2 个游戏').first().waitFor({ timeout: 5000 });
    if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden after dashboard running shortcut');
    await openHome(page);
    await page.getByText('近期任务').first().waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /已完成\s+1/ }).click();
    await page.getByText('任务队列').first().waitFor({ timeout: 5000 });
    if (await page.getByLabel('任务状态筛选').inputValue() !== 'completed') throw new Error('dashboard completed shortcut did not select completed task filter');
    await page.getByText('简介图片修复完成：更新 1 个条目，插入 1 张图片，跳过 0 个，失败 0 个。').first().waitFor({ timeout: 5000 });
    if (await page.getByText('扫描失败：路径不存在').count() > 0) throw new Error('failed task should be hidden after dashboard completed shortcut');
    await openHome(page);
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
    await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent?.includes('备份与本地') && tab.getAttribute('data-state') === 'active'), null, { timeout: 5000 });
    await expectNoHorizontalOverflow(page, 'dashboard mobile settings shortcut');
    await openHome(page);
    await page.getByText('今日状态').first().waitFor({ timeout: 5000 });
    await expectNoHorizontalOverflow(page, 'dashboard mobile after returning home');
  }, { viewport: { width: 390, height: 844 } }],
];

module.exports = { dashboardPageQaCases };
