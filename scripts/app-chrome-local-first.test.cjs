const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appChromeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'AppChrome.tsx'), 'utf8');

test('AppChrome keeps the top bar local-first and avoids cloud sync affordances', () => {
  assert.equal(appChromeSource.includes('同步状态'), false);
  assert.equal(appChromeSource.includes('Cloud'), false);
});
