const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { checkBuildChunks } = require('./check-build-chunks.cjs');

function createDist(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mikavn-chunk-check-'));
  const assets = path.join(root, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  for (const [fileName, size] of Object.entries(files)) {
    fs.writeFileSync(path.join(assets, fileName), 'x'.repeat(size), 'utf8');
  }
  return root;
}

test('checkBuildChunks passes when JavaScript chunks are within budget', () => {
  const dist = createDist({
    'index.js': 256,
    'LibraryPage.js': 128,
    'style.css': 10_000,
  });

  const result = checkBuildChunks({ distDir: dist, maxChunkBytes: 512 });

  assert.equal(result.maxChunkBytes, 512);
  assert.deepEqual(result.oversizedChunks, []);
  assert.equal(result.checkedChunks.length, 2);
});

test('checkBuildChunks rejects JavaScript chunks above budget', () => {
  const dist = createDist({
    'index.js': 700,
    'LibraryPage.js': 128,
  });

  assert.throws(
    () => checkBuildChunks({ distDir: dist, maxChunkBytes: 512 }),
    /oversized JavaScript chunks: index\.js 700 bytes > 512 bytes/,
  );
});
