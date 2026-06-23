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
    '确认对当前筛选范围内已选的 1,234 个游戏执行批量操作：移出合集：Backlog？\n此操作只修改 MikaVN 数据库记录，不会删除真实游戏文件。',
  );
});

test('formatLibraryBulkSelectionConfirmation warns before selecting a large visible batch', () => {
  const { formatLibraryBulkSelectionConfirmation, libraryBulkSelectionConfirmThreshold } = loadLibraryPageModel();

  assert.equal(libraryBulkSelectionConfirmThreshold, 100);
  assert.equal(
    formatLibraryBulkSelectionConfirmation(4456),
    '确认选中当前筛选出的 4,456 个游戏？\n后续批量操作仍会再次确认。建议先缩小筛选范围，避免误操作。',
  );
});

test('library bulk actions require confirmation before database writes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'useLibraryBulkActions.ts'), 'utf8');

  assert.match(source, /formatLibraryBulkConfirmation/);
  assert.match(source, /window\.confirm\(formatLibraryBulkConfirmation\(ids\.length, label\)\)/);
  assert.match(source, /window\.confirm\(formatLibraryBulkConfirmation\(ids\.length, `\$\{action === 'add' \? '加入' : '移出'\}合集：\$\{selectedBulkCollection\.name\}`\)\)/);
  assert.match(source, /window\.confirm\(formatLibraryBulkConfirmation\(selectedBulkGames\.length, `\$\{action === 'add' \? '添加' : '移除'\}标签：\$\{tags\.join\('、'\)\}`\)\)/);
});

test('library bulk writes are batched for large libraries', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'useLibraryBulkActions.ts'), 'utf8');

  assert.match(source, /libraryBulkWriteBatchSize/);
  assert.match(source, /runLibraryBulkRequests/);
  assert.match(source, /for \(let index = 0; index < items\.length; index \+= batchSize\)/);
  assert.match(source, /items\.slice\(index, index \+ batchSize\)/);
  assert.doesNotMatch(source, /Promise\.all\(ids\.map/);
  assert.doesNotMatch(source, /Promise\.all\(selectedBulkGames\.map/);
});

test('library bulk writes report per-batch progress for long operations', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'useLibraryBulkActions.ts'), 'utf8');

  assert.match(source, /onProgress\?: \(completed: number, total: number\) => void/);
  assert.match(source, /onProgress\?\.\(Math\.min\(index \+ batch\.length, items\.length\), items\.length\)/);
  assert.match(source, /formatLibraryBulkProgress\(completed, total, label\)/);
  assert.match(source, /const label = `\$\{action === 'add' \? '加入' : '移出'\}合集：\$\{selectedBulkCollection\.name\}`/);
  assert.match(source, /const label = `\$\{action === 'add' \? '添加' : '移除'\}标签：\$\{tags\.join\('、'\)\}`/);
  assert.match(source, /function formatLibraryBulkProgress\(completed: number, total: number, label: string\)/);
  assert.match(source, /正在处理批量操作：\$\{label\} \(\$\{formatCount\(completed\)\} \/ \$\{formatCount\(total\)\}\)/);
});

test('library bulk select-all confirms before selecting a large visible batch', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'useLibraryBulkActions.ts'), 'utf8');

  assert.match(source, /libraryBulkSelectionConfirmThreshold/);
  assert.match(source, /formatLibraryBulkSelectionConfirmation\(visibleGames\.length\)/);
  assert.match(source, /visibleGames\.length >= libraryBulkSelectionConfirmThreshold/);
  assert.match(source, /window\.confirm\(formatLibraryBulkSelectionConfirmation\(visibleGames\.length\)\)/);
});

test('library bulk invert confirms when it would add a large visible batch', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'useLibraryBulkActions.ts'), 'utf8');

  assert.match(source, /const visibleUnselectedCount = visibleGames\.filter\(\(game\) => !bulkSelectedIds\.has\(game\.id\)\)\.length/);
  assert.match(source, /visibleUnselectedCount >= libraryBulkSelectionConfirmThreshold/);
  assert.match(source, /window\.confirm\(formatLibraryBulkSelectionConfirmation\(visibleUnselectedCount\)\)/);
});

test('library bulk panel labels select-current with the visible count', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibrarySidebarControls.tsx'), 'utf8');

  assert.match(source, /选中当前 \{formatLibraryCount\(gameCount\)\}/);
});

test('library bulk panel explains current-filter safety boundary', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibrarySidebarControls.tsx'), 'utf8');

  assert.match(source, /批量操作只作用于当前筛选结果/);
  assert.match(source, /切换筛选会清空不可见选择/);
  assert.match(source, /不会删除真实游戏文件/);
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

  const emptyIdentity = getLibraryRenderIdentity([]);
  const firstIdentity = getLibraryRenderIdentity([game({ id: 'a' }), game({ id: 'b' })]);
  const changedIdentity = getLibraryRenderIdentity([game({ id: 'a' }), game({ id: 'c' })]);

  assert.match(emptyIdentity, /^0:/);
  assert.match(firstIdentity, /^2:/);
  assert.match(changedIdentity, /^2:/);
  assert.notEqual(firstIdentity, changedIdentity);
});

test('getLibraryRenderIdentity changes when middle results change under the same boundaries', () => {
  const { getLibraryRenderIdentity } = loadLibraryPageModel();

  assert.notEqual(
    getLibraryRenderIdentity([game({ id: 'a' }), game({ id: 'b' }), game({ id: 'c' })]),
    getLibraryRenderIdentity([game({ id: 'a' }), game({ id: 'x' }), game({ id: 'c' })]),
  );
});

test('getLibraryRenderIdentity changes when early large-list results change', () => {
  const { getLibraryRenderIdentity } = loadLibraryPageModel();
  const base = Array.from({ length: 1000 }, (_, index) => game({ id: `game-${index}` }));
  const changed = base.map((item, index) => index === 10 ? game({ id: 'game-replaced-10' }) : item);

  assert.notEqual(getLibraryRenderIdentity(base), getLibraryRenderIdentity(changed));
});

test('getLibraryRenderIdentity changes when any unsampled large-list result changes', () => {
  const { getLibraryRenderIdentity } = loadLibraryPageModel();
  const base = Array.from({ length: 1000 }, (_, index) => game({ id: `game-${index}` }));
  const changed = base.map((item, index) => index === 11 ? game({ id: 'game-replaced-11' }) : item);

  assert.notEqual(getLibraryRenderIdentity(base), getLibraryRenderIdentity(changed));
});

test('getLibraryRenderIdentity stays compact for large libraries', () => {
  const { getLibraryRenderIdentity } = loadLibraryPageModel();
  const games = Array.from({ length: 5000 }, (_, index) => game({ id: `very-long-library-game-${index}` }));

  const identity = getLibraryRenderIdentity(games);

  assert.match(identity, /^5000:/);
  assert.ok(identity.length <= 48, `identity should stay compact, got ${identity.length} chars`);
  assert.doesNotMatch(identity, /very-long-library-game-4999/);
});

test('buildLibraryGameLookup supports constant-time selected game lookups for large libraries', () => {
  const { buildLibraryGameLookup } = loadLibraryPageModel();
  const games = Array.from({ length: 5000 }, (_, index) => game({ id: `game-${index}` }));

  const lookup = buildLibraryGameLookup(games);

  assert.equal(lookup.size, 5000);
  assert.equal(lookup.get('game-4000')?.title, 'game-4000');
  assert.equal(lookup.has('missing-game'), false);
});

test('buildLibraryGameIndexLookup supports constant-time selected index lookups for large libraries', () => {
  const { buildLibraryGameIndexLookup } = loadLibraryPageModel();
  const games = Array.from({ length: 5000 }, (_, index) => game({ id: `game-${index}` }));

  const lookup = buildLibraryGameIndexLookup(games);

  assert.equal(lookup.size, 5000);
  assert.equal(lookup.get('game-4000'), 4000);
  assert.equal(lookup.has('missing-game'), false);
});

test('getLibraryRenderWindow can use a precomputed selected index lookup', () => {
  const { buildLibraryGameIndexLookup, getLibraryRenderWindow } = loadLibraryPageModel();
  const games = Array.from({ length: 5000 }, (_, index) => game({ id: `game-${index}` }));
  const lookup = buildLibraryGameIndexLookup(games);

  const window = getLibraryRenderWindow(games, 240, 'game-4000', lookup);

  assert.equal(window.primaryGames.length, 240);
  assert.equal(window.selectedGame?.id, 'game-4000');
  assert.equal(window.selectedIndex, 4000);
  assert.equal(window.renderedCount, 241);
  assert.equal(window.selectedPinned, true);
});

test('LibraryPage delegates selection and dialog orchestration to a controller hook', () => {
  const pageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibraryPage.tsx'), 'utf8');
  const hookSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'useLibraryPageController.ts'), 'utf8');

  assert.match(pageSource, /useLibraryPageController/);
  assert.doesNotMatch(pageSource, /from '@\/services\/api'/);
  assert.doesNotMatch(pageSource, /useEffect|useMemo|useState/);
  assert.match(hookSource, /useMemo\(\(\) => buildLibraryGameLookup\(visibleGames\), \[visibleGames\]\)/);
  assert.match(hookSource, /changedLibraryMetadataFields/);
  assert.doesNotMatch(hookSource, /visibleGames\.find\(\(game\) => game\.id === selectedGameId\)/);
  assert.doesNotMatch(hookSource, /visibleGames\.some\(\(game\) => game\.id === selectedGameId\)/);
});

test('library nav renders through the bounded render window helper', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibraryGameNav.tsx'), 'utf8');

  assert.match(source, /buildLibraryGameIndexLookup/);
  assert.match(source, /useMemo\(\(\) => buildLibraryGameIndexLookup\(games\), \[games\]\)/);
  assert.match(source, /getLibraryRenderWindow/);
  assert.match(source, /getLibraryRenderWindow\(games, renderCount, selectedId, gameIndexLookup\)/);
  assert.doesNotMatch(source, /games\.findIndex/);
  assert.doesNotMatch(source, /games\.slice\(0, visibleCount\)/);
});

test('library nav resets render budgets synchronously when result identity changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Library', 'LibraryGameNav.tsx'), 'utf8');

  assert.match(source, /getLibraryRenderIdentity/);
  assert.match(source, /useMemo\(\(\) => getLibraryRenderIdentity\(games\), \[games\]\)/);
  assert.match(source, /renderState\.identity === renderIdentity \? renderState\.count : libraryListInitialRenderCount/);
  assert.match(source, /renderState\.identity === renderIdentity \? renderState\.count : libraryGridInitialRenderCount/);
  assert.match(source, /setRenderState\(\(\) => \(\{ identity: renderIdentity, count: Math\.min\(games\.length, renderWindow\.primaryGames\.length \+ libraryListRenderBatchSize\) \}\)\)/);
  assert.match(source, /setRenderState\(\(\) => \(\{ identity: renderIdentity, count: Math\.min\(games\.length, renderWindow\.primaryGames\.length \+ libraryGridRenderBatchSize\) \}\)\)/);
  assert.doesNotMatch(source, /setRenderCount\(libraryListInitialRenderCount\)/);
  assert.doesNotMatch(source, /setRenderCount\(libraryGridInitialRenderCount\)/);
});
