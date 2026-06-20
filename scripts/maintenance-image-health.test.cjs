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
  assert.match(types, /invalidImageSamples/);
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
  assert.match(panel, /空文件或损坏/);
  assert.match(panel, /隔离区/);
  assert.match(panel, /不会永久删除/);
  assert.doesNotMatch(panel, /永久删除孤儿图片/);
});
