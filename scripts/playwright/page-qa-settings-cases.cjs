const { settings } = require('./page-qa-fixtures.cjs');
const { verifySettingsLocalDataPathActions } = require('./page-qa-runner-helpers.cjs');

const settingsPageQaCases = [
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
    await page.getByRole('tab', { name: /备份与本地/ }).click();
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
    await page.getByText('应用更新').first().waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /检查更新/ }).first().click();
    await page.getByText(/浏览器预览不会下载或安装更新/).first().waitFor({ timeout: 5000 });
    await verifySettingsLocalDataPathActions(page);
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
    await page.getByRole('tab', { name: /备份与本地/ }).click();
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

module.exports = { settingsPageQaCases };
