const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadCollectionsPageModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Collections', 'collectionsPageModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', transpiled);
  fn(module, module.exports);
  return module.exports;
}

function game(id) {
  return {
    id,
    title: id,
    developer: null,
    brand: null,
    playStatus: 'planned',
    coverImage: null,
  };
}

test('collection game render budgets keep large collections bounded', () => {
  const {
    collectionGamesInitialRenderCount,
    collectionGamesRenderBatchSize,
  } = loadCollectionsPageModel();

  assert.equal(collectionGamesInitialRenderCount, 120);
  assert.equal(collectionGamesRenderBatchSize, 120);
});

test('getCollectionGameRenderWindow returns a bounded visible window', () => {
  const { getCollectionGameRenderWindow } = loadCollectionsPageModel();
  const games = Array.from({ length: 500 }, (_, index) => game(`game-${index}`));

  const window = getCollectionGameRenderWindow(games, 120);

  assert.equal(window.visibleGames.length, 120);
  assert.equal(window.visibleGames[0].id, 'game-0');
  assert.equal(window.visibleGames.at(-1).id, 'game-119');
  assert.equal(window.visibleCount, 120);
  assert.equal(window.totalCount, 500);
  assert.equal(window.hasMore, true);
});

test('getCollectionGameRenderWindow clamps invalid counts and reports complete windows', () => {
  const { getCollectionGameRenderWindow } = loadCollectionsPageModel();
  const games = Array.from({ length: 12 }, (_, index) => game(`game-${index}`));

  assert.deepEqual(getCollectionGameRenderWindow(games, -1), {
    visibleGames: [],
    visibleCount: 0,
    totalCount: 12,
    hasMore: true,
  });

  assert.deepEqual(getCollectionGameRenderWindow(games, 120), {
    visibleGames: games,
    visibleCount: 12,
    totalCount: 12,
    hasMore: false,
  });
});

test('formatCollectionGamesLoadMoreLabel summarizes the current collection render window', () => {
  const { formatCollectionGamesLoadMoreLabel } = loadCollectionsPageModel();

  assert.equal(formatCollectionGamesLoadMoreLabel(120, 500), '加载更多 120 / 500');
  assert.equal(formatCollectionGamesLoadMoreLabel(1200, 5000), '加载更多 1,200 / 5,000');
});

test('CollectionsPage renders selected collection games through the bounded helper', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Collections', 'CollectionsPage.tsx'), 'utf8');

  assert.match(source, /collectionGamesInitialRenderCount/);
  assert.match(source, /collectionGamesRenderBatchSize/);
  assert.match(source, /getCollectionGameRenderWindow/);
  assert.match(source, /formatCollectionGamesLoadMoreLabel/);
  assert.match(source, /visibleCollectionGames\.map/);
  assert.match(source, /setCollectionGamesRenderCount/);
  assert.doesNotMatch(source, /games\.map\(\(game\) => \(\s*<SoftRow/s);
});
