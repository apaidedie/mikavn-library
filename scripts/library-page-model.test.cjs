const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadLibraryPageModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Library', 'libraryPageModel.ts');
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

function game(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    originalTitle: overrides.originalTitle ?? null,
    aliases: [],
    developer: overrides.developer ?? null,
    publisher: overrides.publisher ?? null,
    releaseDate: overrides.releaseDate ?? null,
    description: overrides.description ?? null,
    notes: overrides.notes ?? null,
    tags: overrides.tags ?? [],
    genres: overrides.genres ?? [],
    ageRating: overrides.ageRating ?? null,
    playStatus: overrides.playStatus ?? 'planned',
    favorite: false,
    hidden: false,
    installPath: `D:\\Games\\${overrides.id}`,
    pathStatus: 'ok',
    coverImage: overrides.coverImage ?? null,
    vndbId: overrides.vndbId ?? null,
    bangumiId: overrides.bangumiId ?? null,
    dlsiteId: overrides.dlsiteId ?? null,
    fanzaId: overrides.fanzaId ?? null,
    ymgalId: overrides.ymgalId ?? null,
    totalPlaySeconds: 0,
    lastPlayedAt: overrides.lastPlayedAt ?? null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const labels = {
  planned: 'planned',
  playing: 'playing',
  completed: 'completed',
  paused: 'paused',
  archived: 'archived',
};

test('groupLibraryGames keeps the first seven played games as recent and buckets the rest by status', () => {
  const { groupLibraryGames } = loadLibraryPageModel();
  const games = [
    ...Array.from({ length: 8 }, (_, index) => game({ id: `played-${index + 1}`, playStatus: 'playing', lastPlayedAt: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` })),
    game({ id: 'planned-game', playStatus: 'planned' }),
    game({ id: 'completed-game', playStatus: 'completed' }),
  ];

  const groups = groupLibraryGames(games, labels);

  assert.deepEqual(groups.map((group) => group.id), ['recent', 'planned', 'playing', 'completed']);
  assert.deepEqual(groups[0].games.map((item) => item.id), ['played-1', 'played-2', 'played-3', 'played-4', 'played-5', 'played-6', 'played-7']);
  assert.deepEqual(groups.find((group) => group.id === 'playing').games.map((item) => item.id), ['played-8']);
});

test('library game groups use localized labels for mature Chinese UI', () => {
  const { groupLibraryGames } = loadLibraryPageModel();
  const recentGroups = groupLibraryGames([game({ id: 'played', lastPlayedAt: '2026-06-01T00:00:00.000Z' })], labels);
  const emptyStatusGroups = groupLibraryGames([game({ id: 'only-game', playStatus: 'custom' })], labels);

  assert.equal(recentGroups[0].label, '最近游玩');
  assert.equal(emptyStatusGroups[0].label, '全部游戏');
});

test('library sidebar chrome uses localized product copy', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibrarySidebarControls.tsx'), 'utf8');

  assert.match(source, /游戏库/);
  assert.match(source, /个游戏/);
  assert.doesNotMatch(source, />Library</);
  assert.doesNotMatch(source, /\{gameCount\} games/);
});

test('getLibraryVisibleCount includes selected items beyond the current render window', () => {
  const { getLibraryVisibleCount } = loadLibraryPageModel();

  assert.equal(getLibraryVisibleCount(1000, 160, 300), 301);
  assert.equal(getLibraryVisibleCount(100, 160, -1), 100);
  assert.equal(getLibraryVisibleCount(1000, 160, -1), 160);
});

test('changedLibraryMetadataFields normalizes text and reports locked metadata fields', () => {
  const { changedLibraryMetadataFields } = loadLibraryPageModel();
  const current = game({
    id: 'game-1',
    title: 'Title',
    description: 'Same description',
    tags: ['Drama', 'ADV'],
    genres: ['Visual Novel'],
    coverImage: 'cover.jpg',
    vndbId: 'v1',
  });

  assert.deepEqual(changedLibraryMetadataFields(current, {
    title: ' Title ',
    description: 'Same description',
    tags: ['Drama ', 'ADV'],
    genres: ['Visual Novel'],
    coverImage: 'cover.jpg',
    vndbId: 'v1',
  }), []);

  assert.deepEqual(changedLibraryMetadataFields(current, {
    title: 'Title',
    description: 'Changed',
    tags: ['ADV'],
    genres: ['Visual Novel'],
    coverImage: 'new-cover.jpg',
    vndbId: 'v2',
  }), ['description', 'coverImage', 'tags', 'externalIds']);
});

test('formatLibraryCount uses the Chinese locale grouping used by the library sidebar', () => {
  const { formatLibraryCount } = loadLibraryPageModel();

  assert.equal(formatLibraryCount(12345), '12,345');
});

test('formatLibraryLoadMoreLabel summarizes the current render window', () => {
  const { formatLibraryLoadMoreLabel } = loadLibraryPageModel();

  assert.equal(formatLibraryLoadMoreLabel(160, 1000), '加载更多 160 / 1,000');
});

test('formatLibraryBulkConfirmation summarizes the selected batch before writing', () => {
  const { formatLibraryBulkConfirmation } = loadLibraryPageModel();

  assert.equal(
    formatLibraryBulkConfirmation(1234, '移出合集：Backlog'),
    '确认对 1,234 个游戏执行批量操作：移出合集：Backlog？\n此操作只修改 MikaVN 数据库记录，不会删除真实游戏文件。',
  );
});

test('library bulk actions require confirmation before database writes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'useLibraryBulkActions.ts'), 'utf8');

  assert.match(source, /formatLibraryBulkConfirmation/);
  assert.match(source, /window\.confirm\(formatLibraryBulkConfirmation\(ids\.length, label\)\)/);
  assert.match(source, /window\.confirm\(formatLibraryBulkConfirmation\(ids\.length, `\$\{action === 'add' \? '加入' : '移出'\}合集：\$\{selectedBulkCollection\.name\}`\)\)/);
  assert.match(source, /window\.confirm\(formatLibraryBulkConfirmation\(selectedBulkGames\.length, `\$\{action === 'add' \? '添加' : '移除'\}标签：\$\{tags\.join\('、'\)\}`\)\)/);
});

test('library render budgets keep large sidebars bounded', () => {
  const {
    libraryListInitialRenderCount,
    libraryListRenderBatchSize,
    libraryGridInitialRenderCount,
    libraryGridRenderBatchSize,
    librarySelectedRenderExpansionCap,
  } = loadLibraryPageModel();

  assert.equal(libraryListInitialRenderCount, 240);
  assert.equal(libraryListRenderBatchSize, 240);
  assert.equal(libraryGridInitialRenderCount, 160);
  assert.equal(libraryGridRenderBatchSize, 160);
  assert.equal(librarySelectedRenderExpansionCap, 960);
});

test('getLibraryVisibleCount caps far selected items instead of rendering thousands', () => {
  const { getLibraryVisibleCount } = loadLibraryPageModel();

  assert.equal(getLibraryVisibleCount(5000, 240, 300), 301);
  assert.equal(getLibraryVisibleCount(5000, 240, 4000), 960);
  assert.equal(getLibraryVisibleCount(5000, 1200, 4000), 1200);
});

test('getLibraryRenderWindow keeps large lists bounded and pins far selected games', () => {
  const { getLibraryRenderWindow } = loadLibraryPageModel();
  const games = Array.from({ length: 5000 }, (_, index) => game({ id: `game-${index}` }));

  const window = getLibraryRenderWindow(games, 240, 'game-4000');

  assert.equal(window.primaryGames.length, 240);
  assert.equal(window.selectedGame?.id, 'game-4000');
  assert.equal(window.selectedIndex, 4000);
  assert.equal(window.renderedCount, 241);
  assert.equal(window.hasMore, true);
  assert.equal(window.selectedPinned, true);
});

test('getLibraryRenderIdentity changes when the current result window changes', () => {
  const { getLibraryRenderIdentity } = loadLibraryPageModel();

  assert.equal(getLibraryRenderIdentity([]), '0::');
  assert.equal(getLibraryRenderIdentity([game({ id: 'a' }), game({ id: 'b' })]), '2:a:b');
  assert.equal(getLibraryRenderIdentity([game({ id: 'a' }), game({ id: 'c' })]), '2:a:c');
});

test('buildLibraryGameLookup supports constant-time selected game lookups for large libraries', () => {
  const { buildLibraryGameLookup } = loadLibraryPageModel();
  const games = Array.from({ length: 5000 }, (_, index) => game({ id: `game-${index}` }));

  const lookup = buildLibraryGameLookup(games);

  assert.equal(lookup.size, 5000);
  assert.equal(lookup.get('game-4000')?.title, 'game-4000');
  assert.equal(lookup.has('missing-game'), false);
});

test('LibraryPage uses a memoized game lookup for selected state', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibraryPage.tsx'), 'utf8');

  assert.match(source, /useMemo\(\(\) => buildLibraryGameLookup\(visibleGames\), \[visibleGames\]\)/);
  assert.doesNotMatch(source, /visibleGames\.find\(\(game\) => game\.id === selectedGameId\)/);
  assert.doesNotMatch(source, /visibleGames\.some\(\(game\) => game\.id === selectedGameId\)/);
});

test('library nav renders through the bounded render window helper', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibraryGameNav.tsx'), 'utf8');

  assert.match(source, /getLibraryRenderWindow/);
  assert.doesNotMatch(source, /games\.slice\(0, visibleCount\)/);
});

test('library nav resets render budgets synchronously when result identity changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibraryGameNav.tsx'), 'utf8');

  assert.match(source, /getLibraryRenderIdentity/);
  assert.match(source, /renderState\.identity === renderIdentity \? renderState\.count : libraryListInitialRenderCount/);
  assert.match(source, /renderState\.identity === renderIdentity \? renderState\.count : libraryGridInitialRenderCount/);
  assert.match(source, /setRenderState\(\(\) => \(\{ identity: renderIdentity, count: Math\.min\(games\.length, renderWindow\.primaryGames\.length \+ libraryListRenderBatchSize\) \}\)\)/);
  assert.match(source, /setRenderState\(\(\) => \(\{ identity: renderIdentity, count: Math\.min\(games\.length, renderWindow\.primaryGames\.length \+ libraryGridRenderBatchSize\) \}\)\)/);
  assert.doesNotMatch(source, /setRenderCount\(libraryListInitialRenderCount\)/);
  assert.doesNotMatch(source, /setRenderCount\(libraryGridInitialRenderCount\)/);
});
