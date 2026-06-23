const { advancedSearchPageQaCases } = require('./page-qa-advanced-search-cases.cjs');
const { collectionsPageQaCases } = require('./page-qa-collections-cases.cjs');
const { dashboardPageQaCases } = require('./page-qa-dashboard-cases.cjs');
const { libraryPageQaCases } = require('./page-qa-library-cases.cjs');
const { metadataPageQaCases } = require('./page-qa-metadata-cases.cjs');
const { maintenancePageQaCases } = require('./page-qa-maintenance-cases.cjs');
const { reportsPageQaCases } = require('./page-qa-reports-cases.cjs');
const { savesPageQaCases } = require('./page-qa-saves-cases.cjs');
const { settingsPageQaCases } = require('./page-qa-settings-cases.cjs');
const { runScannerPageQaCases } = require('./page-qa-scanner-cases.cjs');
const { runTaskPageQaCases } = require('./page-qa-tasks-cases.cjs');
const {
  launchPageQaBrowser,
  runCase,
} = require('./page-qa-runner-helpers.cjs');

async function main() {
  const browser = await launchPageQaBrowser();
  try {
    const cases = [
      ...collectionsPageQaCases,
      ...dashboardPageQaCases,
      ...libraryPageQaCases,
      ...metadataPageQaCases,
      ...reportsPageQaCases,
      ...savesPageQaCases,
      ...maintenancePageQaCases,
      ...settingsPageQaCases,
      ...advancedSearchPageQaCases,
    ];

    for (const [name, view, overrides, interact, options] of cases) {
      await runCase(browser, name, view, overrides || {}, interact, options);
    }

    await runScannerPageQaCases(browser);
    await runTaskPageQaCases(browser);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
