const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('ui task records do not expose raw retry payloads', () => {
  const taskTypes = read('src/types/task.ts');
  const artworkPanel = read('src/pages/Maintenance/ArtworkRepairResultPanel.tsx');
  const descriptionPanel = read('src/pages/Maintenance/DescriptionImageRepairResultPanel.tsx');
  const mockStore = read('src/services/mockStore.ts');

  assert.doesNotMatch(taskTypes, /\bretryPayload\b/);
  assert.doesNotMatch(artworkPanel, /task\.retryPayload/);
  assert.doesNotMatch(descriptionPanel, /task\.retryPayload/);
  assert.doesNotMatch(mockStore, /task\.retryPayload/);
});

test('rust task records keep retry payload internal during serialization', () => {
  const models = read('src-tauri/src/db/models.rs');
  assert.match(models, /#\[serde\(skip_serializing\)\]\s+pub retry_payload: Option<String>/);
});
