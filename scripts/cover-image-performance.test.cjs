const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('CoverImage defaults to native lazy loading and async decoding', () => {
  const source = fs.readFileSync('src/components/ui/cover.tsx', 'utf8');

  assert.match(source, /loading = 'lazy'/);
  assert.match(source, /decoding = 'async'/);
  assert.match(source, /loading=\{loading\}/);
  assert.match(source, /decoding=\{decoding\}/);
});

test('library detail hero decodes images asynchronously', () => {
  const source = fs.readFileSync('src/pages/Library/GameDetailHero.tsx', 'utf8');

  assert.match(source, /decoding="async"/);
  assert.match(source, /loading="eager"/);
});

test('library description images lazy load and decode asynchronously', () => {
  const source = fs.readFileSync('src/pages/Library/GameDetailMedia.tsx', 'utf8');

  assert.match(source, /loading="lazy"/);
  assert.match(source, /decoding="async"/);
});
