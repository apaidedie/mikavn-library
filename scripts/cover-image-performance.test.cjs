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

test('CoverImage falls back to the placeholder after image load failures', () => {
  const source = fs.readFileSync('src/components/ui/cover.tsx', 'utf8');

  assert.match(source, /useEffect/);
  assert.match(source, /useState/);
  assert.match(source, /failedSrc/);
  assert.match(source, /setFailedSrc\(null\)/);
  assert.match(source, /onError=\{\(\) => setFailedSrc\(resolved\)\}/);
  assert.match(source, /resolved && failedSrc !== resolved/);
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
