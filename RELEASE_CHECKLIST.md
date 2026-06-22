# MikaVN Release Checklist

Use this checklist before packaging or sharing a build. The app is Windows-first. Commands below assume PowerShell from the repository root unless noted.

## 1. Source Health

- Confirm `src/`, `src-tauri/src/`, docs, scripts, and `output/README.md` reflect the intended feature set.
- Keep reusable verification scripts under `scripts/`; keep generated QA artifacts, logs, installers, and local packaging tools under `output/`.
- Check version alignment across `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
- Run `npm run release:check`; this verifies version alignment, required release metadata, license consistency, and the hardened Tauri security baseline (explicit CSP, prototype freezing, and scoped asset protocol). Before a public GitHub release, run `npm run release:check:strict` so repository-link placeholders are checked without relying on npm argument forwarding.
- For a full local release candidate pass, run `npm run release:validate:strict`. When browser smoke, large smoke, Tauri build, install smoke, portable app-data smoke, real-data readonly smoke, and desktop smoke were already verified separately, run `npm run release:validate:core` to repeat the strict non-smoke core checks.
- Run `npm run test:release-scripts`, `npm run test:playwright-scripts`, `npm run test:updater-release`, `npm run test:diagnostic-export`, and `npm run test:library-performance` when release tooling, updater wiring, diagnostic export, library performance, or smoke runners change.

## 2. Automated Checks

```powershell
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

```powershell
cd ..
npm run test:release-scripts
npm run test:playwright-scripts
npm run test:updater-release
npm run test:diagnostic-export
npm run test:library-performance
npm run build
```

Expected baseline for the current mature V1 snapshot: Rust tests pass with the current repository test count, release/playwright script unit tests pass, the frontend build completes TypeScript plus Vite production checks, and browser smoke covers backup/restore/archival task logs.

`npm run release:validate:strict` runs these checks in sequence before the smoke and packaging steps, so release candidates can be validated from one command when a full pass is needed. `npm run release:validate:core` skips browser, large-library, Tauri build, clean-install, portable app-data, real-data readonly, and desktop smoke when those slower checks were already verified separately.

## 3. Browser Smoke

Run:

```powershell
npm run smoke:browser
```

The smoke command starts or reuses a local Vite server, and the page QA runner refreshes screenshots in `output/playwright/page-qa-current/`. The workflow smoke covers advanced search and saved searches, asset gallery/cache cleanup, scanner conflict actions, save backup/restore protection, tag maintenance, settings archive/log flows, and task log expansion. Set `MIKAVN_QA_URL` or `MIKAVN_QA_OUT_DIR` to override the target URL or output directory.

For scale-sensitive changes to library rendering, filtering, or advanced search, also run:

```powershell
npm run smoke:large
```

The large-library smoke seeds 4500 browser-preview records by default, validates library list/filter and advanced search timings, and writes screenshots plus `large-library-report.json` under `output/playwright/large-library-current/`.
Record `Large library performance warnings: <count>` in `RELEASE_VALIDATION_REPORT.md` from that report's `history.warnings.length`; `npm run release:handoff:check` requires the warning count so timing regressions stay visible during release handoff.
`npm run release:handoff:check` also prints `manualRiskChecklist.total`, `checked`, `pending`, and `pendingItems`; do not treat a public release as polished while `manualRiskStatus` is `checklist-pending`.
Before publishing a public download, run `npm run release:handoff:require-public`. That stricter mode fails when blocking release risks remain, including unsigned Windows artifacts or pending manual risk checklist items.

CI runs `npm run smoke:browser` and `npm run smoke:large` against a local Vite server and uploads the Playwright screenshots/reports as workflow artifacts. For release candidates, still run them locally when reviewing visual changes so the generated screenshots can be inspected before tagging.

## 4. Desktop Smoke

After a release build exists, run:

```powershell
npm run smoke:install
npm run smoke:portable-data
npm run smoke:real-data:readonly
npm run smoke:real-install:update
npm run smoke:desktop
npm run release:handoff:check
```

`npm run smoke:install` silently installs the NSIS package into `output/clean-install-smoke/run-*/install`, launches the installed app with isolated app data, verifies first-run database/window creation, and silently uninstalls it. `npm run smoke:portable-data` installs without `MIKAVN_APP_DATA_DIR`, verifies executable-adjacent `app-data/` plus `.mikavn-portable`, and fails if `%APPDATA%` receives `mikavn.db`.

`npm run smoke:real-data:readonly` checks the real `E:\MikaVN Library` install without mutation. It verifies SQLite `quick_check`, database backup samples, update-protection backups, local image references, and sampled image-cache headers before a local release candidate is considered safe for your existing library.

`npm run smoke:real-install:update` is the explicit real installed-app overwrite check. It refuses to run while MikaVN is active, creates a verified database backup under `E:\MikaVN Library\app-data\database-backups\manual-install-smoke`, runs the NSIS installer against `E:\MikaVN Library`, launches the app, and verifies game, asset, and image counts are preserved. Run it only when you intend to update the real local install.

The smoke should start `src-tauri/target/release/mikavn-library.exe`, detect that the main window was exposed, and create or open `mikavn.db` only under `output/desktop-smoke/run-*/isolated-app-data`. The report records `mainWindowDetected`, `mainWindowHandle`, and `mainWindowTitle` when available. The script sets `MIKAVN_APP_DATA_DIR` for the launched process and must fail if the database appears outside that isolated root; desktop smoke must not read from or write to the real `%APPDATA%\dev.mikavn.library` profile.

After copying the release executable, installer, `SHA256SUMS.txt`, `RELEASE_VALIDATION_REPORT.md`, and `MANUAL_RISK_PASS_CHECKLIST.md` into `output/release/<version>-windows-x64/`, run `npm run release:handoff:check` to verify the handoff artifacts, checksums, signing-status documentation, and manual risk-pass checklist have not drifted. For public downloads, rerun it as `npm run release:handoff:require-public` and resolve any reported blocking risks before tagging.

## 5. Manual Risk Pass

- Launch profiles: direct executable, `.lnk`, custom command, Locale Emulator-style wrapper, and elevated launch cancellation/success where practical.
  - For elevated success, run `npm run smoke:elevated-launch -- success 60`, approve the Windows UAC prompt, and record the generated `elevated-launch-smoke-report.json` path when it reports `status: completed` and `succeeded: true`.
  - For elevated cancellation, run `npm run smoke:elevated-launch -- cancel 60`, choose No/Cancel in the Windows UAC prompt, and record the report path only when it reports `status: cancelled`, `succeeded: true`, and no marker was written.
  - If the cancellation run reports `status: approved`, the UAC prompt was approved and the item is still not passed; rerun the cancellation smoke and choose No/Cancel.
  - If the cancellation run reports `status: unsupported` with `ConsentPromptBehaviorAdmin = 0`, the Windows profile is configured to elevate administrators without prompting; this environment cannot validate cancellation, so rerun on a Windows profile that prompts for elevation before checking the manual item.
- Destructive-adjacent flows: database restore scheduling, safe archive import, save mirror restore, tag deletion, and game record deletion. Each flow should require explicit confirmation and avoid deleting real game installations.
- Privacy: diagnostic log previews and task messages should keep the tested redaction baseline for API-like keys/tokens/passwords and Windows user profile names.
- Search UX: quick searches should work without knowing the DSL; advanced grammar should remain available for power users.

## 6. Package Notes

- `npm run tauri:build` produces the NSIS installer under `src-tauri/target/release/bundle/nsis/`.
- Before public sharing, follow `docs/CODE_SIGNING.md`: sign with a trusted certificate, then run `npm run release:signing:require`.
- If signed artifacts are recopied into `output/release/<version>-windows-x64/`, regenerate `SHA256SUMS.txt` and rerun `npm run release:handoff:check`.
- GitHub tag releases are handled by `.github/workflows/release.yml`; tag versions should use `vMAJOR.MINOR.PATCH`, such as `v0.1.0`. The release workflow runs `npm run test:release-scripts`, `npm run test:playwright-scripts`, `npm run test:updater-release`, `npm run test:diagnostic-export`, `npm run test:library-performance`, `npm run smoke:install`, `npm run smoke:portable-data`, and `npm run smoke:desktop` after strict metadata checks and before uploading installer artifacts, then uploads the isolated clean-install, portable app-data, and desktop smoke reports under `output/clean-install-smoke/`, `output/portable-app-data-smoke/`, and `output/desktop-smoke/`.
- Ensure GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are present before tagging an updater-capable release. The updater public key is committed in `src-tauri/tauri.conf.json`; the private key and password must stay outside the repository.
- Confirm the release contains `latest.json`, the NSIS installer, and the installer `.sig` file.
- Before relying on the updater for daily use, install the previous version, run Settings -> 检查更新, install the new version, restart, and verify `app-data`, `mikavn.db`, `images`, `cache`, `logs`, and `save-backups` still exist.
- Keep release notes focused on local-only data safety: real game directories are never moved, rewritten, or deleted by import/export/archive flows.
- If the version changes, update every versioned file before rebuilding.
