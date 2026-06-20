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
});
