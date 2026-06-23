const {
  artworkRepairGame,
  descriptionImageRepairFailedTask,
  descriptionRepairGame,
  duplicateAuditGames,
  fanzaDescriptionImageRepairTask,
  fanzaDescriptionRepairGame,
  games,
  taskLogs,
  tasks,
} = require('./page-qa-fixtures.cjs');
const { assertImagesLoaded } = require('./image-render-assertions.cjs');
const {
  clickMaintenanceStart,
  descriptionRepairRow,
  expectDescriptionRepairRowHidden,
  expectDescriptionRepairRowVisible,
  readTaskRetryPayload,
} = require('./page-qa-runner-helpers.cjs');

const maintenancePageQaCases = [
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
    const repairPayload = await readTaskRetryPayload(page, repairTask);
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
    const currentViewAfterGameShortcut = await page.evaluate(() => localStorage.getItem('mikavn.currentView'));
    if (currentViewAfterGameShortcut !== 'library') throw new Error('maintenance game shortcut did not leave the library as the current view');
    const libraryCurrent = await page.getByRole('button', { name: '游戏库' }).first().getAttribute('aria-current');
    if (libraryCurrent !== 'page') throw new Error('maintenance game shortcut did not mark the library navigation as current');
    const maintenanceCurrent = await page.getByRole('button', { name: '维护' }).first().getAttribute('aria-current');
    if (maintenanceCurrent === 'page') throw new Error('maintenance navigation stayed current after opening a game from maintenance results');
    const detailDescriptionImages = page.locator('section').filter({ hasText: '简介' }).locator('figure img');
    await assertImagesLoaded(detailDescriptionImages, 'description repair result detail image');
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
];

module.exports = { maintenancePageQaCases };
