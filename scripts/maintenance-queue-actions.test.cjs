const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('maintenance metadata repair starts from backend-selected candidates', () => {
  const actions = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Maintenance', 'useMaintenanceQueueActions.ts'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'api.ts'), 'utf8');
  const commands = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'commands', 'metadata.rs'), 'utf8');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');

  assert.doesNotMatch(actions, /api\.listGames\(\{\s*metadataStatus: 'needs_metadata'/s);
  assert.match(actions, /api\.batchMatchMissingMetadata\(\)/);
  assert.match(api, /batchMatchMissingMetadata\(\)/);
  assert.match(api, /command<BatchMatchJob \| null>\('batch_match_missing_metadata'/);
  assert.match(commands, /pub fn batch_match_missing_metadata/);
  assert.match(lib, /commands::metadata::batch_match_missing_metadata/);
});
