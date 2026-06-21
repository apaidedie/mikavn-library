const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');

const { recordLargeLibrarySmokeHistory } = require('./large-library-report-history.cjs');

const sourcePath = path.join(__dirname, 'large-library-smoke.cjs');

test('large library smoke measures detail switching under a dedicated budget', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /MIKAVN_LARGE_LIBRARY_DETAIL_BUDGET_MS/);
  assert.match(source, /detailSwitchBudgetMs/);
  assert.match(source, /report\.timings\.detailSwitchMs/);
  assert.match(source, /large-library-detail\.png/);
});

test('large library smoke report records rendered row counts', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /renderedRows: \{\}/);
  assert.match(source, /report\.renderedRows\.initial = visibleRows/);
  assert.match(source, /report\.renderedRows\.afterLoadMore = expandedRows/);
});

test('large library smoke history appends compact performance entries and reports deltas', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-large-history-'));
  const historyPath = path.join(tempDir, 'large-library-history.jsonl');
  const firstReport = {
    gameCount: 4500,
    timings: { libraryLoadMs: 900, detailSwitchMs: 70, searchMs: 800 },
    renderedRows: { initial: 240, afterLoadMore: 480 },
  };
  const secondReport = {
    gameCount: 4500,
    timings: { libraryLoadMs: 960, detailSwitchMs: 64, searchMs: 770 },
    renderedRows: { initial: 240, afterLoadMore: 480 },
  };

  const first = recordLargeLibrarySmokeHistory(firstReport, { historyPath, timestamp: '2026-06-21T12:00:00.000Z' });
  const second = recordLargeLibrarySmokeHistory(secondReport, { historyPath, timestamp: '2026-06-21T12:05:00.000Z' });

  assert.equal(first.previous, null);
  assert.deepEqual(second.delta.timings, { libraryLoadMs: 60, detailSwitchMs: -6, searchMs: -30 });
  assert.deepEqual(second.delta.renderedRows, { initial: 0, afterLoadMore: 0 });

  const entries = fs.readFileSync(historyPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[1], {
    timestamp: '2026-06-21T12:05:00.000Z',
    gameCount: 4500,
    timings: { libraryLoadMs: 960, detailSwitchMs: 64, searchMs: 770 },
    renderedRows: { initial: 240, afterLoadMore: 480 },
  });
});
