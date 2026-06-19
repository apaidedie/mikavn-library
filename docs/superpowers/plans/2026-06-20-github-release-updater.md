# GitHub Release Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows in-app update flow that checks public GitHub Releases, verifies signed Tauri updater packages, and keeps local MikaVN data untouched.

**Architecture:** Use Tauri v2 updater as the only installer/update mechanism after the first NSIS install. Keep updater API calls behind `src/services/updater.ts`, keep deterministic UI/status logic in pure model files for Node tests, and make GitHub Actions publish the installer, signature, and `latest.json` release metadata.

**Tech Stack:** Tauri v2, `tauri-plugin-updater`, `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, React 19, TypeScript, Node `node:test`, existing Playwright smoke runner, GitHub Actions.

---

## File Structure

- Create `scripts/updater-release-config.test.cjs`
  - Verifies updater dependencies, Tauri config, capabilities, Rust plugin registration, GitHub Release endpoint, signing secret checks, release assets, and package scripts.
- Modify `package.json`
  - Add updater JS dependencies and `test:updater-release`.
- Modify `src-tauri/Cargo.toml`
  - Add Rust updater plugin dependency.
- Modify `src-tauri/src/lib.rs`
  - Register the updater plugin before app setup.
- Modify `src-tauri/capabilities/default.json`
  - Allow updater and process restart permissions.
- Modify `src-tauri/tauri.conf.json`
  - Configure updater public key and public `latest.json` endpoint.
- Modify `.github/workflows/release.yml`
  - Require signing secrets for tagged releases, build signed updater artifacts, create `latest.json`, upload all update assets, and publish them on GitHub Releases.
- Create `src/services/updaterModel.ts`
  - Own pure status mapping, release-note summaries, browser-preview fallback labels, and copyable error formatting.
- Create `src/services/updater.ts`
  - Own runtime calls to Tauri updater and process restart APIs.
- Create `scripts/updater-service-model.test.cjs`
  - Tests the real pure updater model source through TypeScript transpilation.
- Create `src/pages/Settings/SettingsUpdateSection.tsx`
  - Renders manual check/download/install/restart UI and browser-preview fallback.
- Modify `src/pages/Settings/SettingsLocalTabContent.tsx`
  - Adds update section to the local settings tab.
- Create `scripts/settings-updater-section.test.cjs`
  - Source-level test for Settings updater section labels, actions, and integration.
- Create `src/app/useStartupUpdater.ts`
  - Performs one quiet startup check after the app mounts.
- Create `src/app/AppUpdateNotice.tsx`
  - Shows a non-blocking update-available notice with install and dismiss actions.
- Modify `src/app/App.tsx`
  - Uses startup updater hook and renders the notice without blocking routes.
- Create `scripts/startup-updater.test.cjs`
  - Source-level test for non-blocking startup updater wiring.
- Modify `scripts/playwright/page-qa-runner.cjs`
  - Browser smoke checks Settings update fallback.
- Modify `scripts/release/check-release-metadata.ps1`
  - Include updater scripts/workflow/assets in existing release metadata gate.
- Modify `README.md` and `RELEASE_CHECKLIST.md`
  - Document update operation, signing secret names, and local data expectations.

Keep these out of scope: custom update server, private GitHub token, cloud sync, database migration, automatic forced installation, macOS/Linux updater support, and moving or deleting `app-data`.

---

## Operational Key Material

Use this committed updater public key in `src-tauri/tauri.conf.json`:

```text
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEY0MTU3QUZBMzZENEJFMzUKUldRMXZ0UTIrbm9WOU95VXJwbEp0VmYzakl6bjE5QlFKN1FGU0VnQTVrRnh5eHJVSE9qL0NhWEUK
```

The matching private key was generated outside the repository at:

```text
C:\Users\Asus\AppData\Local\MikaVN\updater-signing\mikavn-updater.key
```

Before the first public updater release, add the private key content as GitHub secret `TAURI_SIGNING_PRIVATE_KEY`. The generated key has no password, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` may stay empty for this first iteration. Never commit the private key file or print its content in PRs, logs, docs, or issue comments.

---

### Task 1: Add Updater Release Configuration Tests

**Files:**
- Create: `scripts/updater-release-config.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing source/config test**

Create `scripts/updater-release-config.test.cjs` with this content:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('package scripts and dependencies include updater gates and frontend plugins', () => {
  const pkg = readJson('package.json');

  assert.equal(pkg.scripts['test:updater-release'], 'node --test scripts/updater-release-config.test.cjs scripts/updater-service-model.test.cjs scripts/settings-updater-section.test.cjs scripts/startup-updater.test.cjs');
  assert.match(pkg.scripts['test:release-scripts'], /updater-release-config\.test\.cjs/);
  assert.match(pkg.dependencies['@tauri-apps/plugin-updater'], /^\^2\./);
  assert.match(pkg.dependencies['@tauri-apps/plugin-process'], /^\^2\./);
});

test('tauri updater config points to public GitHub latest metadata and contains a real public key', () => {
  const config = readJson('src-tauri/tauri.conf.json');
  const updater = config.plugins?.updater;

  assert.ok(updater, 'plugins.updater must exist');
  assert.equal(updater.active, true);
  assert.equal(updater.pubkey, 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEY0MTU3QUZBMzZENEJFMzUKUldRMXZ0UTIrbm9WOU95VXJwbEp0VmYzakl6bjE5QlFKN1FGU0VnQTVrRnh5eHJVSE9qL0NhWEUK');
  assert.deepEqual(updater.endpoints, ['https://github.com/apaidedie/mikavn-library/releases/latest/download/latest.json']);
  assert.equal(updater.windows.installMode, 'passive');
});

test('rust updater plugin is registered and desktop capability allows update and restart', () => {
  const cargo = read('src-tauri/Cargo.toml');
  const lib = read('src-tauri/src/lib.rs');
  const capability = readJson('src-tauri/capabilities/default.json');

  assert.match(cargo, /tauri-plugin-updater\s*=\s*"2"/);
  assert.match(lib, /\.plugin\(tauri_plugin_updater::Builder::new\(\)\.build\(\)\)/);
  assert.ok(capability.permissions.includes('updater:default'));
  assert.ok(capability.permissions.includes('process:allow-restart'));
});

test('release workflow requires signing secrets and publishes updater assets', () => {
  const workflow = read('.github/workflows/release.yml');

  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(workflow, /Require updater signing secrets/);
  assert.match(workflow, /Create updater metadata/);
  assert.match(workflow, /latest\.json/);
  assert.match(workflow, /\*\.sig/);
  assert.match(workflow, /releases\/download\/v\$version/);
  assert.match(workflow, /src-tauri\/target\/release\/bundle\/nsis\/latest\.json/);
});

test('release metadata gate knows about updater release checks', () => {
  const gate = read('scripts/release/check-release-metadata.ps1');

  assert.match(gate, /test:updater-release/);
  assert.match(gate, /updater-release-config\.test\.cjs/);
  assert.match(gate, /latest\.json/);
  assert.match(gate, /TAURI_SIGNING_PRIVATE_KEY/);
});
```

- [ ] **Step 2: Run the failing test directly**

Run:

```powershell
node --test scripts/updater-release-config.test.cjs
```

Expected: FAIL because `test:updater-release`, updater dependencies, updater config, plugin registration, permissions, and workflow updater assets do not exist yet.

- [ ] **Step 3: Add the package script shell**

Modify `package.json` scripts:

```json
"test:updater-release": "node --test scripts/updater-release-config.test.cjs scripts/updater-service-model.test.cjs scripts/settings-updater-section.test.cjs scripts/startup-updater.test.cjs"
```

Also append `scripts/updater-release-config.test.cjs` to `test:release-scripts` so the release CI gate includes updater release checks:

```json
"test:release-scripts": "node --test scripts/release/check-build-chunks.test.cjs scripts/release/check-source-size.test.cjs scripts/release/check-release-handoff.test.cjs scripts/updater-release-config.test.cjs"
```

- [ ] **Step 4: Run the new npm script**

Run:

```powershell
npm run test:updater-release
```

Expected: FAIL because the later test files are not created yet and updater implementation is still absent.

- [ ] **Step 5: Commit**

Run:

```powershell
git add package.json scripts/updater-release-config.test.cjs
git commit -m "test: add updater release config gate"
```

---

### Task 2: Wire Tauri Updater Dependencies, Config, and Release Assets

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/release/check-release-metadata.ps1`

- [ ] **Step 1: Install frontend updater plugins**

Run:

```powershell
npm install @tauri-apps/plugin-updater@^2.10.1 @tauri-apps/plugin-process@^2.3.1
```

Expected: `package.json` and `package-lock.json` include both dependencies.

- [ ] **Step 2: Add Rust updater plugin dependency**

In `src-tauri/Cargo.toml`, add this dependency beside the existing Tauri plugins:

```toml
tauri-plugin-updater = "2"
```

Then run:

```powershell
Set-Location src-tauri
cargo check
Set-Location ..
```

Expected: Cargo resolves `tauri-plugin-updater` and updates `src-tauri/Cargo.lock`.

- [ ] **Step 3: Register updater plugin**

In `src-tauri/src/lib.rs`, register the plugin after opener:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
```

- [ ] **Step 4: Add capabilities**

In `src-tauri/capabilities/default.json`, make the permissions array:

```json
[
  "core:default",
  "dialog:default",
  "dialog:allow-open",
  "dialog:allow-save",
  "opener:default",
  "updater:default",
  "process:allow-restart"
]
```

- [ ] **Step 5: Add updater config**

In `src-tauri/tauri.conf.json`, add this root-level `plugins` block after `bundle`:

```json
"plugins": {
  "updater": {
    "active": true,
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEY0MTU3QUZBMzZENEJFMzUKUldRMXZ0UTIrbm9WOU95VXJwbEp0VmYzakl6bjE5QlFKN1FGU0VnQTVrRnh5eHJVSE9qL0NhWEUK",
    "endpoints": ["https://github.com/apaidedie/mikavn-library/releases/latest/download/latest.json"],
    "windows": {
      "installMode": "passive"
    }
  }
}
```

Keep valid JSON commas around the inserted block.

- [ ] **Step 6: Require signing secrets and publish updater metadata**

In `.github/workflows/release.yml`, add this step before `Build Tauri bundle`:

```yaml
      - name: Require updater signing secrets
        if: startsWith(github.ref, 'refs/tags/')
        shell: pwsh
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        run: |
          if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
            throw "TAURI_SIGNING_PRIVATE_KEY is required for tagged updater releases."
          }
```

Modify the existing `Build Tauri bundle` step:

```yaml
      - name: Build Tauri bundle
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        run: npm run tauri:build
```

Add this step after `Build Tauri bundle`:

```yaml
      - name: Create updater metadata
        if: startsWith(github.ref, 'refs/tags/')
        shell: pwsh
        run: |
          $package = Get-Content package.json -Raw | ConvertFrom-Json
          $version = [string]$package.version
          $bundleDir = "src-tauri/target/release/bundle/nsis"
          $installer = Get-ChildItem $bundleDir -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
          if (-not $installer) { throw "No NSIS installer found in $bundleDir." }
          $signaturePath = "$($installer.FullName).sig"
          if (-not (Test-Path -LiteralPath $signaturePath)) { throw "Missing updater signature: $signaturePath." }
          $signature = (Get-Content -LiteralPath $signaturePath -Raw).Trim()
          $notes = Get-Content docs/RELEASE_NOTES_TEMPLATE.md -Raw
          $metadata = [ordered]@{
            version = "v$version"
            notes = $notes
            pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            platforms = [ordered]@{
              "windows-x86_64" = [ordered]@{
                signature = $signature
                url = "https://github.com/apaidedie/mikavn-library/releases/download/v$version/$($installer.Name)"
              }
            }
          }
          $metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $bundleDir "latest.json") -Encoding UTF8
```

Change `Upload installer artifact` path to:

```yaml
          path: |
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/nsis/*.sig
            src-tauri/target/release/bundle/nsis/latest.json
```

Change `Create GitHub release` files to:

```yaml
          files: |
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/nsis/*.sig
            src-tauri/target/release/bundle/nsis/latest.json
```

- [ ] **Step 7: Extend release metadata gate**

In `scripts/release/check-release-metadata.ps1`, add `test:updater-release` to `$requiredScripts` and add checks near the release workflow section:

```powershell
foreach ($token in @("TAURI_SIGNING_PRIVATE_KEY", "Require updater signing secrets", "Create updater metadata", "latest.json", "*.sig")) {
  if (-not $releaseWorkflow.Contains($token)) {
    throw "Release workflow must include updater token '$token'."
  }
}

$testUpdaterRelease = [string]$package.scripts.'test:updater-release'
foreach ($token in @("updater-release-config.test.cjs", "updater-service-model.test.cjs", "settings-updater-section.test.cjs", "startup-updater.test.cjs")) {
  if (-not $testUpdaterRelease.Contains($token)) {
    throw "package.json test:updater-release must include token '$token'."
  }
}
```

Use the existing variable names in the script. If the workflow content variable has a different name in the target section, use that same existing variable.

- [ ] **Step 8: Verify config tests pass for this layer**

Run:

```powershell
node --test scripts/updater-release-config.test.cjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```powershell
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/tauri.conf.json .github/workflows/release.yml scripts/release/check-release-metadata.ps1
git commit -m "feat: configure signed github release updater"
```

---

### Task 3: Add Updater Service Model and Runtime Wrapper

**Files:**
- Create: `scripts/updater-service-model.test.cjs`
- Create: `src/services/updaterModel.ts`
- Create: `src/services/updater.ts`

- [ ] **Step 1: Write the failing model tests**

Create `scripts/updater-service-model.test.cjs`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadModel() {
  const sourcePath = path.join(__dirname, '..', 'src', 'services', 'updaterModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', transpiled)(module, module.exports);
  return module.exports;
}

test('browser fallback reports desktop updater unavailable', () => {
  const { createBrowserUpdaterUnavailableResult } = loadModel();
  assert.deepEqual(createBrowserUpdaterUnavailableResult(), {
    kind: 'unavailable',
    message: '桌面更新仅在 Windows 应用内可用，浏览器预览不会下载或安装更新。',
  });
});

test('release notes summary keeps concise non-empty lines', () => {
  const { summarizeReleaseNotes } = loadModel();
  assert.equal(summarizeReleaseNotes('\\n# MikaVN 0.2.0\\n\\n- 新增内置更新\\n- 保留本地数据\\n- 第三条'), '新增内置更新 / 保留本地数据');
  assert.equal(summarizeReleaseNotes(''), '没有发布说明摘要。');
});

test('update result mapping normalizes available and up-to-date states', () => {
  const { mapTauriUpdateResult } = loadModel();

  assert.deepEqual(mapTauriUpdateResult(null), { kind: 'up_to_date', message: '当前已是最新版本。' });
  assert.deepEqual(mapTauriUpdateResult({ version: '0.2.0', currentVersion: '0.1.1', body: '- 新增内置更新\\n- 保留本地数据' }), {
    kind: 'available',
    version: '0.2.0',
    currentVersion: '0.1.1',
    notes: '新增内置更新 / 保留本地数据',
    message: '发现新版本 0.2.0。',
  });
});

test('copyable failure message keeps useful error text', () => {
  const { formatUpdaterError } = loadModel();

  assert.equal(formatUpdaterError(new Error('signature verification failed')), '更新失败：signature verification failed');
  assert.equal(formatUpdaterError('network unavailable'), '更新失败：network unavailable');
  assert.equal(formatUpdaterError({ message: 'download failed' }), '更新失败：download failed');
});
```

- [ ] **Step 2: Run failing model tests**

Run:

```powershell
node --test scripts/updater-service-model.test.cjs
```

Expected: FAIL because `src/services/updaterModel.ts` does not exist.

- [ ] **Step 3: Create pure updater model**

Create `src/services/updaterModel.ts`:

```ts
export type UpdaterCheckResult =
  | { kind: 'unavailable'; message: string }
  | { kind: 'up_to_date'; message: string }
  | { kind: 'available'; version: string; currentVersion?: string; notes: string; message: string };

export type UpdaterInstallResult =
  | { kind: 'installed'; message: string }
  | { kind: 'failed'; message: string };

type RawTauriUpdate = {
  version?: string;
  currentVersion?: string;
  body?: string | null;
};

export function isDesktopUpdaterRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function createBrowserUpdaterUnavailableResult(): UpdaterCheckResult {
  return {
    kind: 'unavailable',
    message: '桌面更新仅在 Windows 应用内可用，浏览器预览不会下载或安装更新。',
  };
}

export function summarizeReleaseNotes(notes: string | null | undefined): string {
  const lines = String(notes ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 2);

  return lines.length > 0 ? lines.join(' / ') : '没有发布说明摘要。';
}

export function mapTauriUpdateResult(update: RawTauriUpdate | null): UpdaterCheckResult {
  if (!update) {
    return { kind: 'up_to_date', message: '当前已是最新版本。' };
  }

  const version = update.version ?? '未知版本';
  return {
    kind: 'available',
    version,
    currentVersion: update.currentVersion,
    notes: summarizeReleaseNotes(update.body),
    message: `发现新版本 ${version}。`,
  };
}

export function formatUpdaterError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `更新失败：${error.message}`;
  }
  if (typeof error === 'string' && error.trim()) {
    return `更新失败：${error}`;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return `更新失败：${error.message}`;
  }
  return '更新失败：未知错误';
}
```

- [ ] **Step 4: Create runtime updater wrapper**

Create `src/services/updater.ts`:

```ts
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import {
  createBrowserUpdaterUnavailableResult,
  formatUpdaterError,
  isDesktopUpdaterRuntime,
  mapTauriUpdateResult,
  type UpdaterCheckResult,
  type UpdaterInstallResult,
} from './updaterModel';

export type AppUpdateHandle = Update;

export async function checkForAppUpdate(): Promise<{ result: UpdaterCheckResult; update: AppUpdateHandle | null }> {
  if (!isDesktopUpdaterRuntime()) {
    return { result: createBrowserUpdaterUnavailableResult(), update: null };
  }

  const update = await check();
  return { result: mapTauriUpdateResult(update), update };
}

export async function installAppUpdate(update: AppUpdateHandle | null): Promise<UpdaterInstallResult> {
  if (!update) {
    return { kind: 'failed', message: '更新失败：没有可安装的更新。' };
  }

  try {
    await update.downloadAndInstall();
    return { kind: 'installed', message: '更新已安装，重启后生效。' };
  } catch (error) {
    return { kind: 'failed', message: formatUpdaterError(error) };
  }
}

export async function restartAfterUpdate(): Promise<void> {
  await relaunch();
}
```

- [ ] **Step 5: Run model tests**

Run:

```powershell
node --test scripts/updater-service-model.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add scripts/updater-service-model.test.cjs src/services/updaterModel.ts src/services/updater.ts
git commit -m "feat: add updater service wrapper"
```

---

### Task 4: Add Manual Settings Update Section

**Files:**
- Create: `scripts/settings-updater-section.test.cjs`
- Create: `src/pages/Settings/SettingsUpdateSection.tsx`
- Modify: `src/pages/Settings/SettingsLocalTabContent.tsx`

- [ ] **Step 1: Write failing Settings source test**

Create `scripts/settings-updater-section.test.cjs`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('settings update section exposes manual updater actions and browser fallback text', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.match(source, /检查更新/);
  assert.match(source, /下载并安装/);
  assert.match(source, /重启应用/);
  assert.match(source, /浏览器预览不会下载或安装更新/);
  assert.match(source, /checkForAppUpdate/);
  assert.match(source, /installAppUpdate/);
  assert.match(source, /restartAfterUpdate/);
});

test('local settings tab renders updater section before data maintenance', () => {
  const source = read('src/pages/Settings/SettingsLocalTabContent.tsx');
  const updateIndex = source.indexOf('<SettingsUpdateSection');
  const dataIndex = source.indexOf('<SettingsLocalDataSection');

  assert.match(source, /import \{ SettingsUpdateSection \}/);
  assert.ok(updateIndex > -1, 'SettingsUpdateSection must be rendered');
  assert.ok(dataIndex > -1, 'SettingsLocalDataSection must still be rendered');
  assert.ok(updateIndex < dataIndex, 'Updater section should be near the top of local maintenance settings');
});
```

- [ ] **Step 2: Run failing Settings test**

Run:

```powershell
node --test scripts/settings-updater-section.test.cjs
```

Expected: FAIL because the component is not created.

- [ ] **Step 3: Create Settings update component**

Create `src/pages/Settings/SettingsUpdateSection.tsx`:

```tsx
import { Download, RefreshCw, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfigItem, ConfigSection } from '@/components/ui/config-item';
import { checkForAppUpdate, installAppUpdate, restartAfterUpdate, type AppUpdateHandle } from '@/services/updater';
import type { UpdaterCheckResult } from '@/services/updaterModel';

type InstallState = 'idle' | 'checking' | 'available' | 'up_to_date' | 'installing' | 'installed' | 'failed' | 'unavailable';

export function SettingsUpdateSection() {
  const [state, setState] = useState<InstallState>('idle');
  const [result, setResult] = useState<UpdaterCheckResult | null>(null);
  const [update, setUpdate] = useState<AppUpdateHandle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkUpdates = async () => {
    setState('checking');
    setError(null);
    const response = await checkForAppUpdate();
    setResult(response.result);
    setUpdate(response.update);
    setState(response.result.kind);
  };

  const installUpdate = async () => {
    setState('installing');
    setError(null);
    const installResult = await installAppUpdate(update);
    if (installResult.kind === 'installed') {
      setState('installed');
      setResult({ kind: 'available', version: result?.kind === 'available' ? result.version : '新版本', notes: result?.kind === 'available' ? result.notes : '更新已安装。', message: installResult.message });
    } else {
      setState('failed');
      setError(installResult.message);
    }
  };

  return (
    <ConfigSection title="应用更新">
      <ConfigItem title="Windows 更新" description="通过公开 GitHub Releases 检查并安装已签名的 Windows 更新。">
        <div className="flex flex-col items-end gap-3">
          <Button disabled={state === 'checking' || state === 'installing'} onClick={() => void checkUpdates()} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            {state === 'checking' ? '检查中' : '检查更新'}
          </Button>
          <div className="max-w-[42rem] text-right text-sm text-slate-300">{result?.message ?? '尚未检查更新。'}</div>
          {result?.kind === 'available' && <div className="max-w-[42rem] text-right text-xs text-slate-400">发布说明：{result.notes}</div>}
          {result?.kind === 'unavailable' && <div className="max-w-[42rem] text-right text-xs text-amber-200">浏览器预览不会下载或安装更新。</div>}
          {error && <textarea className="min-h-16 w-[min(42rem,calc(100vw-3rem))] rounded-md bg-black/30 p-2 text-xs text-rose-100" readOnly value={error} />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={state !== 'available'} onClick={() => void installUpdate()} type="button" variant="secondary">
              <Download className="h-4 w-4" />
              下载并安装
            </Button>
            <Button disabled={state !== 'installed'} onClick={() => void restartAfterUpdate()} type="button" variant="secondary">
              <RotateCw className="h-4 w-4" />
              重启应用
            </Button>
          </div>
        </div>
      </ConfigItem>
    </ConfigSection>
  );
}
```

- [ ] **Step 4: Render it in local Settings**

In `src/pages/Settings/SettingsLocalTabContent.tsx`, add:

```ts
import { SettingsUpdateSection } from './SettingsUpdateSection';
```

Render it before `SettingsLocalDataSection`:

```tsx
      <SettingsUpdateSection />

      <SettingsLocalDataSection
```

- [ ] **Step 5: Run Settings test**

Run:

```powershell
node --test scripts/settings-updater-section.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add scripts/settings-updater-section.test.cjs src/pages/Settings/SettingsUpdateSection.tsx src/pages/Settings/SettingsLocalTabContent.tsx
git commit -m "feat: add manual update settings section"
```

---

### Task 5: Add Quiet Startup Update Check and Notice

**Files:**
- Create: `scripts/startup-updater.test.cjs`
- Create: `src/app/useStartupUpdater.ts`
- Create: `src/app/AppUpdateNotice.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing startup wiring test**

Create `scripts/startup-updater.test.cjs`:

```js
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
});

test('app renders non-blocking update notice before routes', () => {
  const app = read('src/app/App.tsx');
  const notice = read('src/app/AppUpdateNotice.tsx');

  assert.match(app, /useStartupUpdater/);
  assert.match(app, /AppUpdateNotice/);
  assert.ok(app.indexOf('<AppUpdateNotice') < app.indexOf('<AppRoutes'), 'notice should render before routes');
  assert.match(notice, /发现新版本/);
  assert.match(notice, /下载并安装/);
  assert.match(notice, /本次忽略/);
});
```

- [ ] **Step 2: Run failing startup test**

Run:

```powershell
node --test scripts/startup-updater.test.cjs
```

Expected: FAIL because startup updater files do not exist.

- [ ] **Step 3: Create startup hook**

Create `src/app/useStartupUpdater.ts`:

```ts
import { useEffect, useState } from 'react';
import { checkForAppUpdate, installAppUpdate, type AppUpdateHandle } from '@/services/updater';
import type { UpdaterCheckResult } from '@/services/updaterModel';

export function useStartupUpdater() {
  const [notice, setNotice] = useState<UpdaterCheckResult | null>(null);
  const [update, setUpdate] = useState<AppUpdateHandle | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.setTimeout(() => {
      void checkForAppUpdate()
        .then(({ result, update }) => {
          if (cancelled || result.kind !== 'available') return;
          setNotice(result);
          setUpdate(update);
        })
        .catch(() => {
          if (!cancelled) setNotice(null);
        });
    }, 1200);

    return () => {
      cancelled = true;
    };
  }, []);

  const dismissStartupUpdate = () => {
    setNotice(null);
    setError(null);
  };

  const installStartupUpdate = async () => {
    setInstalling(true);
    setError(null);
    const result = await installAppUpdate(update);
    setInstalling(false);
    if (result.kind === 'installed') {
      setInstalled(true);
    } else {
      setError(result.message);
    }
  };

  return { notice, installing, installed, error, dismissStartupUpdate, installStartupUpdate };
}
```

- [ ] **Step 4: Create notice component**

Create `src/app/AppUpdateNotice.tsx`:

```tsx
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UpdaterCheckResult } from '@/services/updaterModel';

type AppUpdateNoticeProps = {
  notice: Extract<UpdaterCheckResult, { kind: 'available' }>;
  installing: boolean;
  installed: boolean;
  error: string | null;
  onDismiss: () => void;
  onInstall: () => void;
};

export function AppUpdateNotice({ notice, installing, installed, error, onDismiss, onInstall }: AppUpdateNoticeProps) {
  return (
    <div className="border-b border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">发现新版本 {notice.version}</p>
          <p className="truncate text-xs text-emerald-100/80">{installed ? '更新已安装，请重启应用。' : notice.notes}</p>
          {error && <p className="mt-1 select-text text-xs text-rose-100">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button disabled={installing || installed} onClick={onInstall} size="sm" type="button" variant="secondary">
            <Download className="h-4 w-4" />
            {installing ? '安装中' : '下载并安装'}
          </Button>
          <Button aria-label="本次忽略" onClick={onDismiss} size="icon" title="本次忽略" type="button" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire notice into App**

In `src/app/App.tsx`, add imports:

```ts
import { AppUpdateNotice } from './AppUpdateNotice';
import { useStartupUpdater } from './useStartupUpdater';
```

Inside `App`, after theme setup:

```ts
  const startupUpdater = useStartupUpdater();
```

Inside `<AppChrome>` before `<AppRoutes>`:

```tsx
      {startupUpdater.notice?.kind === 'available' && (
        <AppUpdateNotice
          error={startupUpdater.error}
          installed={startupUpdater.installed}
          installing={startupUpdater.installing}
          notice={startupUpdater.notice}
          onDismiss={startupUpdater.dismissStartupUpdate}
          onInstall={startupUpdater.installStartupUpdate}
        />
      )}

      <AppRoutes
```

- [ ] **Step 6: Run startup test**

Run:

```powershell
node --test scripts/startup-updater.test.cjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add scripts/startup-updater.test.cjs src/app/useStartupUpdater.ts src/app/AppUpdateNotice.tsx src/app/App.tsx
git commit -m "feat: add quiet startup update notice"
```

---

### Task 6: Add Browser Smoke Coverage and Release Docs

**Files:**
- Modify: `scripts/playwright/page-qa-runner.cjs`
- Modify: `README.md`
- Modify: `RELEASE_CHECKLIST.md`

- [ ] **Step 1: Add browser Settings smoke assertions**

In `scripts/playwright/page-qa-runner.cjs`, in the Settings QA case after Settings opens, add:

```js
        await page.getByText('应用更新').first().waitFor({ timeout: 5000 });
        await page.getByRole('button', { name: /检查更新/ }).first().click();
        await page.getByText(/浏览器预览不会下载或安装更新/).first().waitFor({ timeout: 5000 });
```

- [ ] **Step 2: Document updater operations in README**

Add a short release note under the existing release section in `README.md`:

```md
In-app Windows updates use the Tauri v2 updater plugin and public GitHub Releases. Tagged releases must publish the NSIS installer, its `.sig` updater signature, and `latest.json` at the release asset URL. The desktop app checks `https://github.com/apaidedie/mikavn-library/releases/latest/download/latest.json` and never embeds a GitHub token.
```

- [ ] **Step 3: Document release checklist update steps**

Add this to `RELEASE_CHECKLIST.md` near the GitHub release steps:

```md
- Ensure GitHub secret `TAURI_SIGNING_PRIVATE_KEY` is present before tagging an updater-capable release. The updater public key is committed in `src-tauri/tauri.conf.json`; the private key must stay outside the repository.
- Confirm the release contains `latest.json`, the NSIS installer, and the installer `.sig` file.
- Before relying on the updater for daily use, install the previous version, run Settings -> 检查更新, install the new version, restart, and verify `app-data`, `mikavn.db`, `images`, `cache`, `logs`, and `save-backups` still exist.
```

- [ ] **Step 4: Run browser smoke**

Run:

```powershell
npm run smoke:browser
```

Expected: PASS and the Settings page smoke confirms the browser-preview updater fallback.

- [ ] **Step 5: Commit**

Run:

```powershell
git add scripts/playwright/page-qa-runner.cjs README.md RELEASE_CHECKLIST.md
git commit -m "docs: document updater release operations"
```

---

### Task 7: Run Full Verification Gates

**Files:**
- No source files should be edited in this task unless a verification failure points to a specific defect.

- [ ] **Step 1: Run updater tests**

Run:

```powershell
npm run test:updater-release
```

Expected: PASS.

- [ ] **Step 2: Run release script tests**

Run:

```powershell
npm run test:release-scripts
npm run test:playwright-scripts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript and web build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run Rust checks**

Run:

```powershell
Set-Location src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
Set-Location ..
```

Expected: PASS.

- [ ] **Step 5: Run Tauri build with local signing key**

Run:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:LOCALAPPDATA\MikaVN\updater-signing\mikavn-updater.key"
npm run tauri:build
Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY_PATH
```

Expected: PASS and `src-tauri/target/release/bundle/nsis` contains the installer and a `.sig` file.

- [ ] **Step 6: Run desktop data safety smokes**

Run:

```powershell
npm run smoke:install
npm run smoke:portable-data
npm run smoke:desktop
```

Expected: PASS. The portable app-data smoke continues to verify executable-adjacent `app-data` preservation.

- [ ] **Step 7: Run release validation core**

Run:

```powershell
npm run release:validate:core
```

Expected: PASS.

- [ ] **Step 8: Commit verification fixes only if needed**

Check whether verification changed files:

```powershell
git status --short
```

If the command prints nothing, do not create an empty commit. If it prints verification-related fixes, stage only those files from the status output and commit with:

```powershell
git commit -m "fix: stabilize updater verification"
```

---

### Task 8: Manual Lower-Version Update Rehearsal

**Files:**
- No source files are required.
- Generated release artifacts live under `src-tauri/target/release/bundle/nsis`.

- [ ] **Step 1: Prepare two local versions**

Use the last public installer as the old version. Build the new version with Task 7 signing command.

- [ ] **Step 2: Publish a test GitHub draft or prerelease**

Upload these assets to a temporary tagged release matching `package.json` version:

```text
MikaVN.Library_0.1.2_x64-setup.exe
MikaVN.Library_0.1.2_x64-setup.exe.sig
latest.json
```

The `latest.json` URL field must point at the installer asset in the same release.

- [ ] **Step 3: Exercise the real updater**

Install the old version, open Settings, click `检查更新`, click `下载并安装`, restart after install, then verify these paths still exist:

```text
C:\Users\Asus\AppData\Local\Programs\MikaVN Library\app-data\mikavn.db
C:\Users\Asus\AppData\Local\Programs\MikaVN Library\app-data\images
C:\Users\Asus\AppData\Local\Programs\MikaVN Library\app-data\cache
C:\Users\Asus\AppData\Local\Programs\MikaVN Library\app-data\logs
C:\Users\Asus\AppData\Local\Programs\MikaVN Library\app-data\save-backups
```

- [ ] **Step 4: Record result**

Add the result to the final PR or handoff note:

```md
- Manual updater rehearsal: passed from 0.1.1 to 0.1.2.
- Local data retained: app-data, mikavn.db, images, cache, logs, save-backups.
```

If the rehearsal is skipped, state the exact reason and keep the feature behind manual verification before trusting it for daily updates.

---

## Self-Review

- Spec coverage:
  - Public GitHub Releases source: Task 2 config and workflow.
  - No embedded credentials: Task 2 endpoint uses public release asset; signing key stays in GitHub Secret.
  - Startup quiet check: Task 5.
  - Settings manual check: Task 4.
  - Signed updater packages: Task 2 and Task 7.
  - No install-directory prompt after first install: Task 2 uses updater plugin with passive Windows install mode.
  - Browser preview fallback: Task 3, Task 4, Task 6.
  - Data safety: Task 7 and Task 8 keep existing install/portable smokes plus manual verification.
  - Release workflow validation: Task 1, Task 2, Task 7.
- The plan does not add cloud sync, accounts, private token use, custom server, database migration, macOS/Linux support, or forced install.
- The committed public key is present in the plan; the private signing key path is outside the repository.
