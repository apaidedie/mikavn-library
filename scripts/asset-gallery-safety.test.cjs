const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('asset gallery cache cleanup previews removable files before deleting cache files', () => {
  const source = fs.readFileSync('src/pages/Library/AssetGallery.tsx', 'utf8');

  assert.match(source, /api\.previewAssetCacheCleanup\(\)/);
  assert.match(source, /if \(preview\.removedFiles === 0\)/);
  assert.match(source, /window\.confirm\(`清理 \$\{formatAssetCount\(preview\.removedFiles\)\} 个未引用图片缓存文件/);
  assert.match(source, /只会删除 app-data\/images 中未引用的缓存文件/);
  assert.match(source, /不会删除真实游戏文件或仍在图库、主图、简介中引用的图片/);
  assert.match(source, /api\.cleanupAssetCache\(\)/);
});
