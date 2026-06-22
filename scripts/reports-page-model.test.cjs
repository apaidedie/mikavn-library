const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('reports markdown export uses mature localized report title', () => {
  const source = fs.readFileSync('src/pages/Reports/ReportsPage.tsx', 'utf8');

  assert.match(source, /# MikaVN Library 游玩报告/);
  assert.doesNotMatch(source, /# MikaVN Library Report/);
});

test('reports page keeps visible export copy localized', () => {
  const source = fs.readFileSync('src/pages/Reports/ReportsPage.tsx', 'utf8');

  assert.match(source, /游玩报告/);
  assert.match(source, /导出 Markdown/);
  assert.match(source, /可处理缺口/);
});

test('reports page ignores stale async data loads', () => {
  const source = fs.readFileSync('src/pages/Reports/ReportsPage.tsx', 'utf8');

  assert.match(source, /useRef/);
  assert.match(source, /const reportLoadRequestRef = useRef\(0\)/);
  assert.match(source, /const requestId = \+\+reportLoadRequestRef\.current/);
  assert.match(source, /if \(requestId !== reportLoadRequestRef\.current\) return/);
  assert.doesNotMatch(source, /Promise\.all\([\s\S]*\)\.then\(\(\[gameList, nextSettings\]\)/);
});

test('reports page loads aggregated report summary instead of the full game list', () => {
  const source = fs.readFileSync('src/pages/Reports/ReportsPage.tsx', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const mock = fs.readFileSync('src/services/mockStoreReports.ts', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/reports.rs', 'utf8');
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');

  assert.match(source, /api\.getReportSummary\(\)/);
  assert.doesNotMatch(source, /api\.listGames\(\{ sortBy: 'updated_at', sortDirection: 'desc' \}\)/);
  assert.match(api, /getReportSummary\(\)/);
  assert.match(api, /command<ReportSummary>\('get_report_summary'/);
  assert.match(mock, /getReportSummary\(\): Promise<ReportSummary>/);
  assert.match(commands, /pub fn get_report_summary/);
  assert.match(lib, /commands::reports::get_report_summary/);
});

test('reports page shortcuts open focused library repair searches', () => {
  const source = fs.readFileSync('src/pages/Reports/ReportsPage.tsx', 'utf8');

  assert.match(source, /在游戏库查看缺封面/);
  assert.match(source, /onOpenLibrary\(\{ metadataStatus: 'missing_cover' \}\)/);
  assert.match(source, /onOpenLibrary\(\{ metadataStatus: 'missing_description_image' \}\)/);
  assert.match(source, /onOpenLibrary\(\{ metadataStatus: 'missing_external_id' \}\)/);
  assert.match(source, /onOpenLibrary\(\{ pathStatus: 'broken' \}\)/);
  assert.match(source, /onOpenExample=\{onOpenGame\}/);
});
