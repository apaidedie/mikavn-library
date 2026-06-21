const fs = require('fs');
const path = require('path');

function compactLargeLibraryReport(report, timestamp = new Date().toISOString()) {
  return {
    timestamp,
    gameCount: Number(report.gameCount || 0),
    timings: {
      libraryLoadMs: Number(report.timings?.libraryLoadMs || 0),
      detailSwitchMs: Number(report.timings?.detailSwitchMs || 0),
      searchMs: Number(report.timings?.searchMs || 0),
    },
    renderedRows: {
      initial: Number(report.renderedRows?.initial || 0),
      afterLoadMore: Number(report.renderedRows?.afterLoadMore || 0),
    },
  };
}

function readLastHistoryEntry(historyPath) {
  if (!fs.existsSync(historyPath)) return null;
  const lines = fs.readFileSync(historyPath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      continue;
    }
  }
  return null;
}

function numberDelta(current, previous) {
  return Number(current || 0) - Number(previous || 0);
}

function buildLargeLibrarySmokeDelta(current, previous) {
  if (!previous) {
    return {
      timings: { libraryLoadMs: 0, detailSwitchMs: 0, searchMs: 0 },
      renderedRows: { initial: 0, afterLoadMore: 0 },
    };
  }
  return {
    timings: {
      libraryLoadMs: numberDelta(current.timings.libraryLoadMs, previous.timings?.libraryLoadMs),
      detailSwitchMs: numberDelta(current.timings.detailSwitchMs, previous.timings?.detailSwitchMs),
      searchMs: numberDelta(current.timings.searchMs, previous.timings?.searchMs),
    },
    renderedRows: {
      initial: numberDelta(current.renderedRows.initial, previous.renderedRows?.initial),
      afterLoadMore: numberDelta(current.renderedRows.afterLoadMore, previous.renderedRows?.afterLoadMore),
    },
  };
}

function recordLargeLibrarySmokeHistory(report, options = {}) {
  const historyPath = options.historyPath;
  if (!historyPath) throw new Error('historyPath is required');
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });

  const previous = readLastHistoryEntry(historyPath);
  const current = compactLargeLibraryReport(report, options.timestamp);
  const delta = buildLargeLibrarySmokeDelta(current, previous);

  fs.appendFileSync(historyPath, `${JSON.stringify(current)}\n`);
  return { historyPath, current, previous, delta };
}

module.exports = {
  buildLargeLibrarySmokeDelta,
  compactLargeLibraryReport,
  readLastHistoryEntry,
  recordLargeLibrarySmokeHistory,
};
