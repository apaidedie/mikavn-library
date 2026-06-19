const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appChromeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'AppChrome.tsx'), 'utf8');

test('AppChrome keeps the top bar local-first and avoids cloud sync affordances', () => {
  assert.equal(appChromeSource.includes('同步状态'), false);
  assert.equal(appChromeSource.includes('Cloud'), false);
});

test('AppChrome top bar collapses fixed-width chrome on narrow screens', () => {
  assert.equal(appChromeSource.includes('hidden h-8 w-8 sm:flex'), true);
  assert.equal(appChromeSource.includes('hidden max-w-36'), true);
  assert.equal(appChromeSource.includes('md:block'), true);
  assert.equal(appChromeSource.includes('hidden min-w-0 sm:relative sm:ml-2 sm:block sm:w-[250px]'), true);
});
