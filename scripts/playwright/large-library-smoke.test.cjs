const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');

const { formatLargeLibrarySmokeWarnings, recordLargeLibrarySmokeHistory } = require('./large-library-report-history.cjs');

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

test('large library smoke history flags substantial timing regressions without failing the run', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-large-history-warn-'));
  const historyPath = path.join(tempDir, 'large-library-history.jsonl');
  const baselineReport = {
    gameCount: 4500,
    timings: { libraryLoadMs: 1000, detailSwitchMs: 80, searchMs: 800 },
    renderedRows: { initial: 240, afterLoadMore: 480 },
  };
  const slowerReport = {
    gameCount: 4500,
    timings: { libraryLoadMs: 1700, detailSwitchMs: 90, searchMs: 1400 },
    renderedRows: { initial: 240, afterLoadMore: 480 },
  };

  recordLargeLibrarySmokeHistory(baselineReport, { historyPath, timestamp: '2026-06-21T12:00:00.000Z' });
  const result = recordLargeLibrarySmokeHistory(slowerReport, { historyPath, timestamp: '2026-06-21T12:10:00.000Z' });

  assert.deepEqual(result.warnings.map((warning) => warning.metric), ['libraryLoadMs', 'searchMs']);
  assert.equal(result.warnings[0].previousMs, 1000);
  assert.equal(result.warnings[0].currentMs, 1700);
  assert.equal(result.warnings[0].deltaMs, 700);
  assert.match(result.warnings[0].message, /libraryLoadMs regressed by 700ms/);
});

test('large library smoke history flags rendered row regressions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-large-history-rows-'));
  const historyPath = path.join(tempDir, 'large-library-history.jsonl');
  const baselineReport = {
    gameCount: 4500,
    timings: { libraryLoadMs: 1000, detailSwitchMs: 80, searchMs: 800 },
    renderedRows: { initial: 240, afterLoadMore: 480 },
  };
  const bloatedReport = {
    gameCount: 4500,
    timings: { libraryLoadMs: 1010, detailSwitchMs: 82, searchMs: 810 },
    renderedRows: { initial: 1200, afterLoadMore: 1680 },
  };

  recordLargeLibrarySmokeHistory(baselineReport, { historyPath, timestamp: '2026-06-21T12:00:00.000Z' });
  const result = recordLargeLibrarySmokeHistory(bloatedReport, { historyPath, timestamp: '2026-06-21T12:10:00.000Z' });

  assert.deepEqual(result.warnings.map((warning) => warning.metric), ['renderedRows.initial', 'renderedRows.afterLoadMore']);
  assert.equal(result.warnings[0].previousRows, 240);
  assert.equal(result.warnings[0].currentRows, 1200);
  assert.equal(result.warnings[0].deltaRows, 960);
  assert.match(result.warnings[0].message, /renderedRows\.initial regressed by 960 rows/);
});

test('large library smoke prints timing regression warnings for release logs', () => {
  const warnings = [
    { metric: 'libraryLoadMs', previousMs: 1000, currentMs: 1700, deltaMs: 700, ratio: 0.7 },
    { metric: 'searchMs', previousMs: 800, currentMs: 1400, deltaMs: 600, ratio: 0.75 },
  ];
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.deepEqual(formatLargeLibrarySmokeWarnings(warnings), [
    'WARN large library performance regression: libraryLoadMs 1000ms -> 1700ms (+700ms, +70%)',
    'WARN large library performance regression: searchMs 800ms -> 1400ms (+600ms, +75%)',
  ]);
  assert.match(source, /formatLargeLibrarySmokeWarnings/);
  assert.match(source, /console\.warn/);
});

test('large library smoke prints rendered row regression warnings for release logs', () => {
  const warnings = [
    { metric: 'renderedRows.initial', previousRows: 240, currentRows: 1200, deltaRows: 960, ratio: 4 },
    { metric: 'renderedRows.afterLoadMore', previousRows: 480, currentRows: 1680, deltaRows: 1200, ratio: 2.5 },
  ];

  assert.deepEqual(formatLargeLibrarySmokeWarnings(warnings), [
    'WARN large library render regression: renderedRows.initial 240 -> 1200 rows (+960, +400%)',
    'WARN large library render regression: renderedRows.afterLoadMore 480 -> 1680 rows (+1200, +250%)',
  ]);
});

test('large library smoke waits for advanced search content before searching', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');

  assert.match(source, /getByRole\('heading', \{ name: '高级搜索' \}\)\.waitFor/);
  assert.match(source, /getByRole\('textbox', \{ name: '关键词或条件' \}\)\.waitFor/);
  assert.match(source, /getByRole\('textbox', \{ name: '关键词或条件' \}\)\.fill/);
  assert.doesNotMatch(source, /getByText\('高级搜索'\)\.first\(\)\.waitFor/);
  assert.doesNotMatch(source, /getByPlaceholder\(\/输入标题\|关键词\|快捷搜索\/\)/);
});
