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

test('TodayStrip includes the planned games metric from dashboard data', () => {
  assert.equal(heroPanelsSource.includes('label="想玩"'), true);
  assert.equal(heroPanelsSource.includes('data.plannedGames'), true);
});

test('TodayStrip action buttons use a stable responsive grid on narrow screens', () => {
  assert.equal(heroPanelsSource.includes('grid w-full grid-cols-2'), true);
  assert.equal(heroPanelsSource.includes('sm:w-auto sm:grid-cols-3'), true);
  assert.equal(heroPanelsSource.includes('lg:grid-cols-5'), true);
  assert.equal(heroPanelsSource.includes('justify-center'), true);
  assert.equal(heroPanelsSource.includes('flex-1 justify-center sm:flex-none'), false);
});
