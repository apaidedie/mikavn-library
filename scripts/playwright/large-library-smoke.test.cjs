const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourcePath = path.join(__dirname, 'large-library-smoke.cjs');

test('large library smoke measures detail switching under a dedicated budget', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /MIKAVN_LARGE_LIBRARY_DETAIL_BUDGET_MS/);
  assert.match(source, /detailSwitchBudgetMs/);
  assert.match(source, /report\.timings\.detailSwitchMs/);
  assert.match(source, /large-library-detail\.png/);
});
