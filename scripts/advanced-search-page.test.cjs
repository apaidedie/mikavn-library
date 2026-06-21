const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

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
