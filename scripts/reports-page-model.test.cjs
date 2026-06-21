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
