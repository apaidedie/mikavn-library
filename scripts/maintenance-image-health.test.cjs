const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('image health commands are registered and exposed through api', () => {
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/diagnostics.rs', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const types = fs.readFileSync('src/types/archive.ts', 'utf8');

  assert.match(lib, /commands::diagnostics::get_image_health_report/);
  assert.match(lib, /commands::diagnostics::quarantine_orphan_images/);
  assert.match(commands, /pub fn get_image_health_report/);
  assert.match(commands, /pub fn quarantine_orphan_images/);
  assert.match(api, /getImageHealthReport/);
  assert.match(api, /quarantineOrphanImages/);
  assert.match(types, /export type ImageHealthReport/);
  assert.match(types, /export type ImageQuarantineReport/);
  assert.match(types, /invalidImageFiles/);
  assert.match(types, /invalidImageRefs/);
  assert.match(types, /invalidImageSamples/);
  assert.match(types, /referenceSamples/);
  assert.match(types, /ImageCacheReferenceSample/);
});

test('maintenance image health ui explains safe quarantine workflow', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');

  assert.match(actions, /imageHealth/);
  assert.match(actions, /getImageHealthReport/);
  assert.match(panel, /图片健康/);
  assert.match(panel, /孤儿图片/);
  assert.match(panel, /重复文件名/);
  assert.match(panel, /过大图片/);
  assert.match(panel, /无效图片/);
  assert.match(panel, /失效引用/);
  assert.match(panel, /空文件或损坏/);
  assert.match(panel, /隔离区/);
  assert.match(panel, /不会永久删除/);
  assert.doesNotMatch(panel, /永久删除孤儿图片/);
});

test('maintenance image health ui exposes cache issue samples and reveal actions', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

  assert.match(panel, /invalidImageSamples/);
  assert.match(panel, /referenceSamples/);
  assert.match(panel, /orphanSamples/);
  assert.match(panel, /oversizedSamples/);
  assert.match(panel, /duplicateNameSamples/);
  assert.match(panel, /图片样本/);
  assert.match(panel, /引用/);
  assert.match(panel, /定位/);
  assert.match(panel, /打开游戏/);
  assert.match(panel, /onOpenGame/);
  assert.match(panel, /onRevealPath/);
});

test('maintenance image health ui can reveal duplicate cache samples', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

  assert.match(panel, /joinImageCachePath/);
  assert.match(panel, /rootPath=\{cache\.rootPath\}/);
  assert.match(panel, /onRevealPath=\{onRevealPath\}/);
  assert.match(panel, /定位重复/);
  assert.match(panel, /重复文件名需要人工确认内容是否相同/);
});

test('maintenance image health ui links missing artwork findings to repair actions', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');

  assert.match(panel, /missingCoverGames/);
  assert.match(panel, /missingArtworkGames/);
  assert.match(panel, /缺封面/);
  assert.match(panel, /媒体图不完整/);
  assert.match(panel, /诊断缺图/);
  assert.match(panel, /开始补图/);
  assert.match(panel, /onDiagnoseArtwork/);
  assert.match(panel, /onStartArtworkRepair/);
  assert.match(content, /onDiagnoseArtwork=\{inspectionActions\.loadArtworkDiagnosis\}/);
  assert.match(content, /onStartArtworkRepair=\{queueActions\.startArtworkRepair\}/);
});

test('maintenance image health ui links broken image references to audit details', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');

  assert.match(panel, /canInspectBrokenRefs/);
  assert.match(panel, /查看失效引用/);
  assert.match(panel, /缺失引用、失效引用和旧导入路径需要进入明细审计逐条确认/);
  assert.match(panel, /onLoadAudit/);
});

test('maintenance image health ui exposes one-click safe cleanup wording', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');

  assert.match(panel, /一键安全整理/);
  assert.match(panel, /只处理未被数据库引用的孤儿缓存/);
  assert.match(panel, /缺封面和失效引用会保留给补图或明细审计/);
  assert.match(panel, /canSafeCleanup/);
  assert.match(panel, /onQuarantineOrphans/);
  assert.match(actions, /安全整理完成/);
  assert.doesNotMatch(panel, /一键永久删除/);
});
