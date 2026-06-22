const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('library filters debounce text inputs before building api filters', () => {
  const source = fs.readFileSync('src/pages/Library/useLibraryFilters.ts', 'utf8');

  assert.match(source, /useDebouncedValue/);
  assert.match(source, /debouncedQuery/);
  assert.match(source, /debouncedTag/);
  assert.match(source, /debouncedDeveloper/);
  assert.match(source, /query: debouncedQuery/);
  assert.match(source, /tag: debouncedTag\.trim\(\) \|\| undefined/);
  assert.match(source, /developer: debouncedDeveloper\.trim\(\) \|\| undefined/);
});

test('library page data ignores stale async results while filters change quickly', () => {
  const source = fs.readFileSync('src/pages/Library/useLibraryPageData.ts', 'utf8');

  assert.match(source, /let cancelled = false/);
  assert.match(source, /if \(cancelled\) return/);
  assert.match(source, /return \(\) => \{\s*cancelled = true;\s*\}/s);
  assert.match(source, /setGames\(items\)/);
  assert.match(source, /setLoading\(false\)/);
});

test('library page keeps the current result list while refreshing filtered data', () => {
  const dataSource = fs.readFileSync('src/pages/Library/useLibraryPageData.ts', 'utf8');
  const pageSource = fs.readFileSync('src/pages/Library/LibraryPage.tsx', 'utf8');
  const sidebarSource = fs.readFileSync('src/pages/Library/LibrarySidebar.tsx', 'utf8');

  assert.match(dataSource, /refreshing/);
  assert.match(dataSource, /const hasLoadedGames = games\.length > 0/);
  assert.match(dataSource, /const shouldRefreshLibrary = hasLoadedGames \|\| !loading/);
  assert.match(dataSource, /if \(shouldRefreshLibrary\) setRefreshing\(true\)/);
  assert.match(dataSource, /else setLoading\(true\)/);
  assert.match(dataSource, /setRefreshing\(false\)/);
  assert.match(dataSource, /return \{ error, filters, loading, refreshing, setError, setGames, settings \}/);
  assert.match(pageSource, /const \{ error, filters, loading, refreshing, setError, setGames, settings \}/);
  assert.match(pageSource, /refreshing=\{refreshing\}/);
  assert.match(sidebarSource, /refreshing: boolean/);
  assert.match(sidebarSource, /refreshing && <Notice/);
  assert.match(sidebarSource, /正在更新筛选结果/);
  assert.match(sidebarSource, /loading \? \(/);
});

test('game list filters expose and apply a bounded result limit', () => {
  const frontendTypes = fs.readFileSync('src/types/game.ts', 'utf8');
  const rustModels = fs.readFileSync('src-tauri/src/db/models.rs', 'utf8');
  const repository = fs.readFileSync('src-tauri/src/repositories/games.rs', 'utf8');
  const mockStore = fs.readFileSync('src/services/mockStore.ts', 'utf8');

  assert.match(frontendTypes, /limit\?: number/);
  assert.match(rustModels, /pub limit: Option<i64>/);
  assert.match(repository, /filter\.limit/);
  assert.match(repository, /LIMIT \?/);
  assert.match(repository, /\.clamp\(1, 500\)/);
  assert.match(mockStore, /filter\.limit/);
  assert.match(mockStore, /games\.slice\(0, limit\)/);
});

test('collections add-game search uses a limited stale-safe query', () => {
  const source = fs.readFileSync('src/pages/Collections/CollectionsPage.tsx', 'utf8');

  assert.match(source, /limit: 40/);
  assert.match(source, /let cancelled = false/);
  assert.match(source, /if \(cancelled\) return/);
  assert.match(source, /return \(\) => \{\s*cancelled = true;\s*\}/s);
  assert.match(source, /slice\(0, 8\)/);
});

test('game repository pushes common library filters into sqlite before mapping rows', () => {
  const source = fs.readFileSync('src-tauri/src/repositories/games.rs', 'utf8');
  const listStart = source.indexOf('pub fn list(');
  const addStart = source.indexOf('pub fn add(');
  const listBody = source.slice(listStart, addStart);

  assert.ok(listStart > -1, 'GameRepository::list must exist');
  assert.doesNotMatch(listBody, /let mut games = self\.list_all\(\)\?/);
  assert.match(listBody, /query_clauses/);
  assert.match(listBody, /ORDER BY/);
  assert.match(listBody, /LOWER\(COALESCE\(title/);
  assert.match(listBody, /params_from_iter/);
});
