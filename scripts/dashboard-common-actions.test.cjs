const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const heroPanelsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Dashboard', 'DashboardHeroPanels.tsx'), 'utf8');
const dashboardPageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Dashboard', 'DashboardPage.tsx'), 'utf8');

test('TodayStrip exposes common local maintenance and settings actions', () => {
  assert.equal(heroPanelsSource.includes('维护'), true);
  assert.equal(heroPanelsSource.includes('本地设置'), true);
  assert.equal(dashboardPageSource.includes('onOpenMaintenance={onOpenMaintenance}'), true);
  assert.equal(dashboardPageSource.includes('onOpenSettings={onOpenSettings}'), true);
});
