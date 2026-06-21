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
