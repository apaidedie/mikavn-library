const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
const { resolvePlaywright } = require('./playwright-resolution.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const baseUrl = process.env.MIKAVN_QA_URL || 'http://127.0.0.1:1420/';
const mode = process.argv[2];

const smokeScripts = {
  browser: ['page-qa-runner.cjs', 'core-workflow-smoke.cjs'],
  large: ['large-library-smoke.cjs'],
};

if (!smokeScripts[mode]) {
  console.error('Usage: node scripts/playwright/run-smoke-with-vite.cjs <browser|large>');
  process.exit(1);
}

function browserLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return executablePath ? { executablePath, headless: true } : { headless: true };
}

function checkUrl(urlString) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const target = new URL(urlString);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.get(target, (response) => {
      response.resume();
      finish(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('error', () => finish(false));
    request.setTimeout(2000, () => {
      request.destroy();
      finish(false);
    });
  });
}

function startVite() {
  const target = new URL(baseUrl);
  const outDir = path.join(repoRoot, 'output', 'dev-server');
  fs.mkdirSync(outDir, { recursive: true });

  const logId = `${mode}-${process.pid}-${Date.now()}`;
  const stdoutPath = path.join(outDir, `smoke-vite-${logId}.out.log`);
  const stderrPath = path.join(outDir, `smoke-vite-${logId}.err.log`);
  const stdout = fs.openSync(stdoutPath, 'w');
  const stderr = fs.openSync(stderrPath, 'w');
  const host = target.hostname || '127.0.0.1';
  const port = target.port || (target.protocol === 'https:' ? '443' : '1420');
  const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');

  const child = spawn(process.execPath, [viteBin, '--host', host, '--port', port], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', stdout, stderr],
    windowsHide: true,
  });

  let exitInfo = null;
  child.on('exit', (code, signal) => {
    exitInfo = { code, signal };
  });

  return { child, exitInfo: () => exitInfo, stdout, stderr, stdoutPath, stderrPath };
}

async function waitForVite(server) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await checkUrl(baseUrl)) return;
    const exitInfo = server.exitInfo();
    if (exitInfo) {
      throw new Error(`Vite exited before becoming ready (code=${exitInfo.code}, signal=${exitInfo.signal}). See ${server.stderrPath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Vite did not become ready at ${baseUrl}. See ${server.stderrPath}`);
}

async function warmViteForBudgetedSmoke() {
  const { chromium } = require(resolvePlaywright(repoRoot));
  const browser = await chromium.launch(browserLaunchOptions());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(
      () => !document.body.innerText.includes('载入页面...') && document.body.innerText.length > 20,
      null,
      { timeout: 60000 },
    );
    await page.waitForTimeout(500);
  } finally {
    await browser.close();
  }
}

function runNodeScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      env: { ...process.env, MIKAVN_QA_URL: baseUrl },
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} failed (code=${code}, signal=${signal})`));
      }
    });
  });
}

async function stopVite(server) {
  if (!server) return;
  if (!server.exitInfo()) {
    server.child.kill();
    const deadline = Date.now() + 3000;
    while (!server.exitInfo() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!server.exitInfo()) server.child.kill('SIGKILL');
  }
  fs.closeSync(server.stdout);
  fs.closeSync(server.stderr);
}

async function main() {
  let server = null;
  try {
    if (!(await checkUrl(baseUrl))) {
      server = startVite();
      await waitForVite(server);
    }

    if (mode === 'large') {
      await warmViteForBudgetedSmoke();
    }
    for (const scriptName of smokeScripts[mode]) {
      await runNodeScript(scriptName);
    }
  } finally {
    await stopVite(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
