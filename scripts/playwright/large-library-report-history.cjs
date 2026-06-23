const fs = require('fs');
const path = require('path');

function compactLargeLibraryReport(report, timestamp = new Date().toISOString()) {
  return {
    timestamp,
    gameCount: Number(report.gameCount || 0),
    timings: {
      libraryLoadMs: Number(report.timings?.libraryLoadMs || 0),
      detailSwitchMs: Number(report.timings?.detailSwitchMs || 0),
      quickSearchMs: Number(report.timings?.quickSearchMs || 0),
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
      timings: { libraryLoadMs: 0, detailSwitchMs: 0, quickSearchMs: 0, searchMs: 0 },
      renderedRows: { initial: 0, afterLoadMore: 0 },
    };
  }
  return {
    timings: {
      libraryLoadMs: numberDelta(current.timings.libraryLoadMs, previous.timings?.libraryLoadMs),
      detailSwitchMs: numberDelta(current.timings.detailSwitchMs, previous.timings?.detailSwitchMs),
      quickSearchMs: numberDelta(current.timings.quickSearchMs, previous.timings?.quickSearchMs),
      searchMs: numberDelta(current.timings.searchMs, previous.timings?.searchMs),
    },
    renderedRows: {
      initial: numberDelta(current.renderedRows.initial, previous.renderedRows?.initial),
      afterLoadMore: numberDelta(current.renderedRows.afterLoadMore, previous.renderedRows?.afterLoadMore),
    },
  };
}

function buildLargeLibrarySmokeWarnings(current, previous, options = {}) {
  const minDeltaMs = Number(options.minDeltaMs ?? 500);
  const minRatio = Number(options.minRatio ?? 0.25);
  const minRowDelta = Number(options.minRowDelta ?? 240);
  const minRowRatio = Number(options.minRowRatio ?? 0.5);
  const maxTimingMs = options.maxTimingMs ?? {};
  const maxRenderedRows = options.maxRenderedRows ?? {};
  const timingMetrics = ['libraryLoadMs', 'detailSwitchMs', 'quickSearchMs', 'searchMs'];
  const rowMetrics = ['initial', 'afterLoadMore'];
  const warnings = [];

  for (const metric of timingMetrics) {
    const currentMs = Number(current.timings?.[metric] || 0);
    const targetMs = Number(maxTimingMs[metric] || 0);
    if (targetMs > 0 && currentMs > targetMs) {
      warnings.push({
        metric,
        warningType: 'timing-target',
        targetMs,
        currentMs,
        deltaMs: currentMs - targetMs,
        message: `${metric} exceeded soft target by ${currentMs - targetMs}ms (${currentMs}ms > ${targetMs}ms).`,
      });
    }

    if (!previous) continue;
    const previousMs = Number(previous.timings?.[metric] || 0);
    if (previousMs <= 0 || currentMs <= 0) continue;

    const deltaMs = currentMs - previousMs;
    const ratio = deltaMs / previousMs;
    if (deltaMs >= minDeltaMs && ratio >= minRatio) {
      warnings.push({
        metric,
        previousMs,
        currentMs,
        deltaMs,
        ratio,
        message: `${metric} regressed by ${deltaMs}ms (${Math.round(ratio * 100)}%) compared with the previous large-library smoke run.`,
      });
    }
  }

  for (const metric of rowMetrics) {
    const currentRows = Number(current.renderedRows?.[metric] || 0);
    const targetRows = Number(maxRenderedRows[metric] || 0);
    if (targetRows > 0 && currentRows > targetRows) {
      warnings.push({
        metric: `renderedRows.${metric}`,
        warningType: 'row-target',
        targetRows,
        currentRows,
        deltaRows: currentRows - targetRows,
        message: `renderedRows.${metric} exceeded soft target by ${currentRows - targetRows} rows (${currentRows} > ${targetRows}).`,
      });
    }

    if (!previous) continue;
    const previousRows = Number(previous.renderedRows?.[metric] || 0);
    if (previousRows <= 0 || currentRows <= 0) continue;

    const deltaRows = currentRows - previousRows;
    const ratio = deltaRows / previousRows;
    if (deltaRows >= minRowDelta && ratio >= minRowRatio) {
      warnings.push({
        metric: `renderedRows.${metric}`,
        previousRows,
        currentRows,
        deltaRows,
        ratio,
        message: `renderedRows.${metric} regressed by ${deltaRows} rows (${Math.round(ratio * 100)}%) compared with the previous large-library smoke run.`,
      });
    }
  }

  return warnings;
}

function formatLargeLibrarySmokeWarnings(warnings = []) {
  return warnings.map((warning) => {
    const ratioPercent = Math.round(Number(warning.ratio || 0) * 100);
    if (warning.warningType === 'timing-target') {
      return `WARN large library performance target: ${warning.metric} ${warning.currentMs}ms > ${warning.targetMs}ms (+${warning.deltaMs}ms)`;
    }
    if (warning.warningType === 'row-target') {
      return `WARN large library render target: ${warning.metric} ${warning.currentRows} > ${warning.targetRows} rows (+${warning.deltaRows})`;
    }
    if (warning.metric && String(warning.metric).startsWith('renderedRows.')) {
      return `WARN large library render regression: ${warning.metric} ${warning.previousRows} -> ${warning.currentRows} rows (+${warning.deltaRows}, +${ratioPercent}%)`;
    }
    return `WARN large library performance regression: ${warning.metric} ${warning.previousMs}ms -> ${warning.currentMs}ms (+${warning.deltaMs}ms, +${ratioPercent}%)`;
  });
}

function recordLargeLibrarySmokeHistory(report, options = {}) {
  const historyPath = options.historyPath;
  if (!historyPath) throw new Error('historyPath is required');
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });

  const previous = readLastHistoryEntry(historyPath);
  const current = compactLargeLibraryReport(report, options.timestamp);
  const delta = buildLargeLibrarySmokeDelta(current, previous);
  const warnings = buildLargeLibrarySmokeWarnings(current, previous, options.warningThresholds);

  fs.appendFileSync(historyPath, `${JSON.stringify(current)}\n`);
  return { historyPath, current, previous, delta, warnings };
}

module.exports = {
  buildLargeLibrarySmokeDelta,
  buildLargeLibrarySmokeWarnings,
  compactLargeLibraryReport,
  formatLargeLibrarySmokeWarnings,
  readLastHistoryEntry,
  recordLargeLibrarySmokeHistory,
};
