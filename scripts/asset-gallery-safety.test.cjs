const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('asset gallery routes cache maintenance to image health quarantine workflow', () => {
  const gallery = fs.readFileSync('src/pages/Library/AssetGallery.tsx', 'utf8');
  const overview = fs.readFileSync('src/pages/Library/GameDetailOverview.tsx', 'utf8');
  const maintenance = fs.readFileSync('src/pages/Maintenance/MaintenancePage.tsx', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/assets.rs', 'utf8');
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');

  assert.match(gallery, /图片健康/);
  assert.match(gallery, /隔离区/);
  assert.match(gallery, /onOpenMaintenance\?\.\('image-health'\)/);
  assert.match(overview, /onOpenMaintenance=\{onOpenMaintenance\}/);
  assert.match(maintenance, /focusSection !== 'image-health'/);
  assert.match(maintenance, /inspectionActions\.loadImageHealth\(\)/);
  assert.doesNotMatch(gallery, /api\.previewAssetCacheCleanup\(\)/);
  assert.doesNotMatch(gallery, /api\.cleanupAssetCache\(\)/);
  assert.doesNotMatch(gallery, /window\.confirm\(`清理/);
  assert.doesNotMatch(api, /cleanupAssetCache/);
  assert.doesNotMatch(api, /previewAssetCacheCleanup/);
  assert.doesNotMatch(commands, /pub fn cleanup_asset_cache/);
  assert.doesNotMatch(commands, /pub fn preview_asset_cache_cleanup/);
  assert.doesNotMatch(lib, /commands::assets::cleanup_asset_cache/);
  assert.doesNotMatch(lib, /commands::assets::preview_asset_cache_cleanup/);
});

test('maintenance data panel routes image cache cleanup to image health quarantine workflow', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceDataLocationPanel.tsx', 'utf8');
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceDataActions.ts', 'utf8');

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
  assert.doesNotMatch(actions, /api\.previewAssetCacheCleanup\(\)/);
  assert.doesNotMatch(actions, /api\.cleanupAssetCache\(\)/);
  assert.doesNotMatch(actions, /assetCleanupPreview/);
});

test('asset gallery ignores stale asset loads after switching games', () => {
  const source = fs.readFileSync('src/pages/Library/AssetGallery.tsx', 'utf8');

  assert.match(source, /let active = true/);
  assert.match(source, /if \(active\) setAssets\(nextAssets\)/);
  assert.match(source, /if \(active\) onMessage\(errorMessage\(reason\)\)/);
  assert.match(source, /return \(\) => \{\s*active = false;\s*\}/);
});
