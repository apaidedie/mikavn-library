const collectionsPageQaCases = [
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
];

module.exports = { collectionsPageQaCases };
