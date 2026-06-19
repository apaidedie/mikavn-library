const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadBatchMetadataPageModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Metadata', 'batchMetadataPageModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '@/types/metadata') {
      return { PROVIDER_LABEL: { vndb: 'VNDB', dlsite: 'DLsite', fanza: 'FANZA' } };
    }
    throw new Error(`Unexpected require: ${specifier}`);
  };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(module, module.exports, localRequire);
  return module.exports;
}

function game(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    originalTitle: overrides.originalTitle ?? null,
    developer: overrides.developer ?? null,
    brand: overrides.brand ?? null,
    publisher: overrides.publisher ?? null,
    installPath: overrides.installPath ?? `D:\\Games\\${overrides.id}`,
    vndbId: overrides.vndbId ?? null,
    bangumiId: overrides.bangumiId ?? null,
    dlsiteId: overrides.dlsiteId ?? null,
    fanzaId: overrides.fanzaId ?? null,
    ymgalId: overrides.ymgalId ?? null,
  };
}

function candidate(overrides) {
  return {
    provider: overrides.provider ?? 'vndb',
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? null,
    releaseDate: overrides.releaseDate ?? null,
    developers: overrides.developers ?? [],
    tags: overrides.tags ?? [],
    imageUrl: overrides.imageUrl ?? null,
    externalIds: overrides.externalIds ?? {},
    relevanceScore: overrides.relevanceScore ?? 0.9,
    fromVndbSniff: overrides.fromVndbSniff ?? false,
  };
}

function result(overrides) {
  return {
    id: overrides.id,
    gameId: overrides.gameId ?? overrides.id,
    originalTitle: overrides.originalTitle ?? overrides.id,
    cleanedTitle: overrides.cleanedTitle ?? overrides.originalTitle ?? overrides.id,
    status: overrides.status,
    candidates: overrides.candidates ?? [],
    selectedProvider: overrides.selectedProvider ?? null,
    selectedId: overrides.selectedId ?? null,
    selectedScore: overrides.selectedScore ?? null,
    reason: overrides.reason ?? null,
  };
}

test('deriveBatchMetadataQueueState filters incomplete games and counts each missing provider', () => {
  const { deriveBatchMetadataQueueState } = loadBatchMetadataPageModel();
  const games = [
    game({ id: 'full', title: 'Complete', vndbId: 'v1', bangumiId: 'b1', dlsiteId: 'd1', fanzaId: 'f1', ymgalId: 'y1' }),
    game({ id: 'no-ids', title: 'Missing All' }),
    game({ id: 'missing-dlsite', title: 'Drama Garden', developer: 'Studio A', vndbId: 'v2', bangumiId: 'b2', fanzaId: 'f2', ymgalId: 'y2' }),
    game({ id: 'missing-fanza', title: 'Other', vndbId: 'v3', bangumiId: 'b3', dlsiteId: 'd3', ymgalId: 'y3' }),
  ];

  const state = deriveBatchMetadataQueueState(games, { query: 'studio', missingProviderFilter: 'dlsite' });

  assert.deepEqual(state.filteredGames.map((item) => item.id), ['missing-dlsite']);
  assert.equal(state.incompleteGames.length, 3);
  assert.deepEqual(state.gapCounts, {
    all: 3,
    external_id: 1,
    vndb: 1,
    bangumi: 1,
    dlsite: 2,
    fanza: 2,
    ymgal: 1,
  });
});

test('deriveBatchMetadataResultState applies query, status, and write filters', () => {
  const { deriveBatchMetadataResultState } = loadBatchMetadataPageModel();
  const selected = candidate({ provider: 'dlsite', id: 'RJ010', title: 'Selected Garden', tags: ['drama'] });
  const results = [
    result({ id: 'writeable', status: 'success', candidates: [candidate({ id: 'v1', title: 'Other' })] }),
    result({ id: 'applied', status: 'success', candidates: [candidate({ id: 'v2', title: 'Applied' })] }),
    result({ id: 'review', status: 'review', candidates: [], reason: 'low_score' }),
    result({ id: 'error', status: 'error', candidates: [], reason: 'network' }),
  ];

  const state = deriveBatchMetadataResultState(results, {
    appliedIds: ['applied'],
    query: 'garden',
    resultStatusFilter: 'success',
    selectedCandidates: { writeable: selected },
    writeFilter: 'writable',
  });

  assert.deepEqual(state.filteredResults.map((item) => item.id), ['writeable']);
  assert.deepEqual(state.applicableResults.map((item) => item.id), ['writeable']);
  assert.deepEqual(state.resultCounts, {
    success: 2,
    review: 1,
    noResult: 0,
    error: 1,
  });
});

test('getBatchMetadataCandidate prefers manual selections before default candidates', () => {
  const { getBatchMetadataCandidate } = loadBatchMetadataPageModel();
  const fallback = candidate({ provider: 'vndb', id: 'v1', title: 'Fallback' });
  const selected = candidate({ provider: 'dlsite', id: 'RJ001', title: 'Manual' });
  const item = result({ id: 'result-1', status: 'review', candidates: [fallback], selectedProvider: 'vndb', selectedId: 'v1' });

  assert.equal(getBatchMetadataCandidate(item, { 'result-1': selected }), selected);
  assert.equal(getBatchMetadataCandidate(item, {}), fallback);
  assert.equal(getBatchMetadataCandidate(result({ id: 'empty', status: 'no_result', candidates: [] }), {}), null);
});
