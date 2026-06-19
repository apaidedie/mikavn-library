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
