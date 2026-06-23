const fs = require('fs');
const path = require('path');
const { mockData } = require('./page-qa-fixtures.cjs');
const { resolvePlaywright } = require('./playwright-resolution.cjs');

const baseUrl = process.env.MIKAVN_QA_URL || 'http://127.0.0.1:1420/';
const repoRoot = path.resolve(__dirname, '..', '..');
const { chromium } = require(resolvePlaywright(repoRoot));
const outDir = path.resolve(process.env.MIKAVN_QA_OUT_DIR || path.join(repoRoot, 'output', 'playwright', 'page-qa-current'));
fs.mkdirSync(outDir, { recursive: true });

function browserLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return executablePath ? { executablePath, headless: true } : { headless: true };
}

function descriptionRepairRows(panel) {
  return panel.locator('.rounded-md').filter({ hasText: /^(已修复|跳过|失败)/ });
}

function descriptionRepairRow(panel, providerId) {
  return descriptionRepairRows(panel).filter({ hasText: providerId });
}

async function expectDescriptionRepairRowVisible(panel, providerId) {
  await descriptionRepairRow(panel, providerId).first().waitFor({ timeout: 5000 });
}

async function expectDescriptionRepairRowHidden(panel, providerId) {
  if (await descriptionRepairRow(panel, providerId).count() > 0) throw new Error(`description repair provider filter did not hide ${providerId} results`);
}

async function seed(page, view, overrides = {}) {
  await page.addInitScript(({ nextView, data }) => {
    localStorage.clear();
    localStorage.setItem('mikavn.currentView', nextView);
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, { nextView: view, data: mockData(overrides) });
}

async function readTaskRetryPayload(page, task) {
  return page.evaluate((taskId) => {
    const payloads = JSON.parse(localStorage.getItem('mikavn-library.mock.taskRetryPayloads') || '{}');
    return JSON.parse(payloads?.[taskId] || '{}');
  }, task?.id ?? null);
}

async function waitForApp(page) {
  await page.waitForSelector('body', { timeout: 10000 });
  await page.waitForFunction(() => /MikaVN|游戏|任务|搜索|设置|存档|扫描|报告|合集|维护|Library/i.test(document.body.innerText), null, { timeout: 10000 });
  await page.waitForTimeout(650);
}

async function openSeeded(browser, view, overrides = {}, options = {}) {
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));
      page.on('dialog', async (dialog) => {
        await dialog.accept(dialog.type() === 'prompt' ? dialog.defaultValue() : undefined);
      });
      await seed(page, view, overrides);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForApp(page);
      return { context, page, consoleErrors };
    } catch (error) {
      lastError = error;
      await context.close().catch(() => undefined);
      if (!isRetryableOpenError(error) || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

function isRetryableOpenError(error) {
  const message = String(error?.message ?? error);
  return /page\.goto: Timeout|Timeout \d+ms exceeded|Navigation timeout|net::ERR_CONNECTION|Target closed/i.test(message);
}

async function capture(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function runCase(browser, name, view, overrides = {}, interact, options = {}) {
  const { context, page, consoleErrors } = await openSeeded(browser, view, overrides, options);
  try {
    if (interact) await interact(page);
    const file = await capture(page, name);
    const text = await page.locator('body').innerText({ timeout: 5000 });
    if (!text.trim()) throw new Error(`${name}: blank body`);
    if (consoleErrors.length > 0) {
      const important = consoleErrors.filter((item) => !/favicon|DevTools/.test(item));
      if (important.length > 0) throw new Error(`${name}: console errors: ${important.join(' | ')}`);
    }
    console.log(`OK ${name} -> ${file}`);
  } finally {
    await context.close();
  }
}

async function clickMaintenanceStart(page, label) {
  const row = page.locator('.items-center.justify-between').filter({ has: page.getByText(label, { exact: true }) }).filter({ has: page.getByRole('button', { name: /开始/ }) }).first();
  await row.getByRole('button', { name: /开始/ }).click();
}

async function openHome(page) {
  await page.getByRole('button', { name: '首页' }).first().click();
}

async function openLibrary(page) {
  await page.getByRole('button', { name: '游戏库' }).first().click();
}

async function waitForImageHealthWorkflow(page) {
  await page.getByText(/维护中心/).first().waitFor({ timeout: 5000 });
  await page.getByText(/图片健康/).first().waitFor({ timeout: 5000 });
  await page.getByText(/一键安全整理/).first().waitFor({ timeout: 5000 });
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow <= 2) return;

  const wideElements = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        className: typeof element.className === 'string' ? element.className : '',
        tagName: element.tagName,
        text: (element.textContent ?? '').trim().slice(0, 60),
        width: Math.round(rect.width),
      };
    })
    .filter((item) => item.width > document.documentElement.clientWidth)
    .sort((a, b) => b.width - a.width)
    .slice(0, 8));
  throw new Error(`${label} has horizontal overflow: ${overflow}px ${JSON.stringify(wideElements)}`);
}

async function launchPageQaBrowser() {
  return chromium.launch(browserLaunchOptions());
}

module.exports = {
  baseUrl,
  clickMaintenanceStart,
  descriptionRepairRow,
  expectDescriptionRepairRowHidden,
  expectDescriptionRepairRowVisible,
  expectNoHorizontalOverflow,
  launchPageQaBrowser,
  openHome,
  openLibrary,
  readTaskRetryPayload,
  runCase,
  waitForImageHealthWorkflow,
};
