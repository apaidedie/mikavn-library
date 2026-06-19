const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const styleSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'style.css'), 'utf8');

test('global app shell does not force a desktop-only minimum width', () => {
  assert.equal(styleSource.includes('min-width: 1024px'), false);
  assert.equal(styleSource.includes('min-width: 0'), true);
});
