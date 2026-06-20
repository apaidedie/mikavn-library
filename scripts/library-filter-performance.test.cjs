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
