const {
  games,
  secondaryExternalIdCompleteGame,
} = require('./page-qa-fixtures.cjs');

const advancedSearchPageQaCases = [
  ['advanced-search-results', 'advanced-search', { games: [...games, secondaryExternalIdCompleteGame] }, async (page) => {
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
  }],
];

module.exports = { advancedSearchPageQaCases };
