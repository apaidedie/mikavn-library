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

test('maintenance data panel routes image cache cleanup to image health quarantine workflow', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceDataLocationPanel.tsx', 'utf8');
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');

  assert.match(panel, /图片健康/);
  assert.match(panel, /一键安全整理/);
  assert.match(panel, /隔离区/);
  assert.match(panel, /转到图片健康/);
  assert.match(panel, /onOpenImageHealth/);
  assert.match(content, /openImageHealth/);
  assert.match(content, /imageAuditRef\.current\?\.scrollIntoView/);
  assert.match(content, /inspectionActions\.loadImageHealth\(\)/);
  assert.doesNotMatch(panel, /onCleanupAssetCache/);
  assert.doesNotMatch(panel, /清理<\/Button>/);
  assert.doesNotMatch(panel, /variant="danger"/);
});

test('asset gallery ignores stale asset loads after switching games', () => {
  const source = fs.readFileSync('src/pages/Library/AssetGallery.tsx', 'utf8');

  assert.match(source, /let active = true/);
  assert.match(source, /if \(active\) setAssets\(nextAssets\)/);
  assert.match(source, /if \(active\) onMessage\(errorMessage\(reason\)\)/);
  assert.match(source, /return \(\) => \{\s*active = false;\s*\}/);
});
