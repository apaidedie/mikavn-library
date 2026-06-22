const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadAdvancedSearchPageModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Search', 'advancedSearchPageModel.ts');
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

test('advanced search validation ignores stale async results', () => {
  const source = fs.readFileSync('src/pages/Search/AdvancedSearchPage.tsx', 'utf8');

  assert.match(source, /useRef/);
  assert.match(source, /const validationRequestRef = useRef\(0\)/);
  assert.match(source, /void validate\(nextQuery\)/);
  assert.match(source, /const requestId = \+\+validationRequestRef\.current/);
  assert.match(source, /api\.validateSearchQuery\(nextQuery\)/);
  assert.match(source, /if \(requestId !== validationRequestRef\.current\) return/);
});

test('advanced search results ignore stale async searches', () => {
  const source = fs.readFileSync('src/pages/Search/AdvancedSearchPage.tsx', 'utf8');

  assert.match(source, /const searchRequestRef = useRef\(0\)/);
  assert.match(source, /const nextSortBy = sortBy/);
  assert.match(source, /const nextSortDirection = sortDirection/);
  assert.match(source, /const requestId = \+\+searchRequestRef\.current/);
  assert.match(source, /api\.searchGamesAdvanced\(\{ query: nextQuery, sortBy: nextSortBy, sortDirection: nextSortDirection, limit: 200 \}\)/);
  assert.match(source, /if \(requestId !== searchRequestRef\.current\) return/);
  assert.match(source, /setLoading\(false\)/);
});

test('advanced search result description makes capped large-result searches explicit', () => {
  const { formatAdvancedSearchResultDescription } = loadAdvancedSearchPageModel();

  assert.equal(formatAdvancedSearchResultDescription(null), '尚未搜索');
  assert.equal(formatAdvancedSearchResultDescription({ total: 42, visible: 42 }), '42 个匹配条目');
  assert.equal(formatAdvancedSearchResultDescription({ total: 1200, visible: 200 }), '显示 200 / 1,200 个匹配条目，已限制结果以保持响应速度');
});

test('advanced search result rendering is staged for large result sets', () => {
  const {
    advancedSearchResultRenderBatchSize,
    formatAdvancedSearchRenderedResultSummary,
    nextAdvancedSearchVisibleResultLimit,
    visibleAdvancedSearchResults,
  } = loadAdvancedSearchPageModel();

  const results = Array.from({ length: 200 }, (_, index) => ({ id: String(index + 1) }));

  assert.equal(advancedSearchResultRenderBatchSize, 60);
  assert.deepEqual(visibleAdvancedSearchResults(results, advancedSearchResultRenderBatchSize).map((item) => item.id), results.slice(0, 60).map((item) => item.id));
  assert.equal(nextAdvancedSearchVisibleResultLimit(60, results.length), 120);
  assert.equal(nextAdvancedSearchVisibleResultLimit(180, results.length), 200);
  assert.equal(formatAdvancedSearchRenderedResultSummary({ visible: 60, loaded: 200 }), '已渲染 60 / 200 个结果卡片，继续显示会逐步加载更多图片');
  assert.equal(formatAdvancedSearchRenderedResultSummary({ visible: 42, loaded: 42 }), null);
});

test('advanced search page renders the bounded result description helper', () => {
  const source = fs.readFileSync('src/pages/Search/AdvancedSearchPage.tsx', 'utf8');

  assert.match(source, /formatAdvancedSearchResultDescription/);
  assert.match(source, /visible:\s*resultGames\.length/);
  assert.doesNotMatch(source, /\$\{result\.total\} 个匹配条目/);
});

test('advanced search page renders visible result batches instead of every loaded card', () => {
  const source = fs.readFileSync('src/pages/Search/AdvancedSearchPage.tsx', 'utf8');

  assert.match(source, /visibleResultGames/);
  assert.match(source, /visibleAdvancedSearchResults\(resultGames, visibleResultLimit\)/);
  assert.match(source, /setVisibleResultLimit\(advancedSearchResultRenderBatchSize\)/);
  assert.match(source, /nextAdvancedSearchVisibleResultLimit\(visibleResultLimit, resultGames\.length\)/);
  assert.match(source, /formatAdvancedSearchRenderedResultSummary/);
  assert.match(source, /显示更多/);
  assert.match(source, /visibleResultGames\.map\(\(game\) => <GameResultCard/);
  assert.doesNotMatch(source, /resultGames\.map\(\(game\) => <GameResultCard/);
});

test('advanced search page discloses grammar examples', () => {
  const source = fs.readFileSync('src/pages/Search/AdvancedSearchPage.tsx', 'utf8');

  assert.match(source, /<summary className="cursor-pointer text-slate-300">高级语法<\/summary>/);
  assert.match(source, /tag:纯爱/);
  assert.match(source, /meta:missing_artwork/);
  assert.match(source, /rating>=80/);
  assert.match(source, /普通词会搜索标题、别名、会社、标签和备注/);
});

test('advanced search page supports saved search create update apply and safe delete', () => {
  const source = fs.readFileSync('src/pages/Search/AdvancedSearchPage.tsx', 'utf8');

  assert.match(source, /api\.listSavedSearches\(\)/);
  assert.match(source, /api\.createSavedSearch\(\{ name: searchName, query: query\.trim\(\), description: null \}\)/);
  assert.match(source, /api\.updateSavedSearch\(activeSaved\.id, \{ name: searchName, query: query\.trim\(\), description: null \}\)/);
  assert.match(source, /function applySavedSearch\(item: SavedSearch\)/);
  assert.match(source, /void runSearch\(item\.query\)/);
  assert.match(source, /删除保存搜索「\$\{item\.name\}」/);
  assert.match(source, /只删除保存的搜索条件/);
  assert.match(source, /不会删除游戏记录/);
  assert.match(source, /不会删除真实游戏文件/);
  assert.match(source, /api\.deleteSavedSearch\(item\.id\)/);
});
