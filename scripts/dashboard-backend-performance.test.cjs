const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dashboardService = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'services', 'dashboard.rs'), 'utf8');
const dashboardDb = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'db', 'dashboard_ext.rs'), 'utf8');

test('dashboard backend avoids loading the full game list for homepage summary', () => {
  assert.doesNotMatch(dashboardService, /db\.list_games\(GameFilter::default\(\)\)/);
  assert.doesNotMatch(dashboardDb, /list_games\(GameFilter::default\(\)\)/);
  assert.match(dashboardDb, /dashboard_totals/);
  assert.match(dashboardDb, /dashboard_recent_games/);
  assert.match(dashboardDb, /dashboard_recently_added/);
});
