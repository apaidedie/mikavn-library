const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('startup updater hook checks once and only exposes available updates', () => {
  const hook = read('src/app/useStartupUpdater.ts');

  assert.match(hook, /checkForAppUpdate/);
  assert.match(hook, /useEffect/);
  assert.match(hook, /result\.kind === 'available'/);
  assert.match(hook, /dismissStartupUpdate/);
  assert.match(hook, /installStartupUpdate/);
  assert.match(hook, /restartStartupUpdate/);
});

test('app renders non-blocking update notice before routes', () => {
  const app = read('src/app/App.tsx');
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(app, /useStartupUpdater/);
  assert.match(app, /AppUpdateNotice/);
  assert.ok(app.indexOf('<AppUpdateNotice') < app.indexOf('<AppRoutes'), 'notice should render before routes');
  assert.match(notice, /发现新版本/);
  assert.match(notice, /下载并安装/);
  assert.match(notice, /重启应用/);
  assert.match(notice, /本次忽略/);
});
