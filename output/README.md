# Output Artifacts

This directory keeps generated verification artifacts, local packaging helpers, and smoke outputs only. Runtime source code does not depend on these files.

`output/` is ignored by Git except for this README. Reusable scripts live under `scripts/`.

## Current Artifacts

- `release/<version>-windows-x64/`: copied release installers, release executables, and SHA256 checksums for local handoff.
- `playwright/page-qa-current/`: latest page-level screenshots for dashboard, library, search, scanner, metadata, tasks, reports, saves, collections, and settings.
- `playwright/workflow-smoke-current/`: latest workflow smoke screenshot.
- `clean-install-smoke/run-*/`: isolated NSIS install, first-run, and uninstall smoke reports.
- `desktop-smoke/run-*/`: desktop smoke reports and logs.
- `nsis-3.11/`, `nsis-3.11.zip`, and `nsis_tauri_utils.dll`: local Tauri packaging helpers when `useLocalToolsDir` is enabled.

## Archive

- `archive/browser-profiles/`: old browser user data directories from manual debugging.
- `archive/playwright-legacy-screenshots/`: older iterative screenshots kept as historical evidence.
- `archive/playwright-temp/`: superseded temporary Playwright test files.
- `archive/logs/`: old Vite/Tauri/smoke logs.
- `archive/legacy-smoke/`: old one-off smoke artifacts.

Generated output can be deleted if disk space is needed. Keep reusable runners in `scripts/` when changing UI or release behavior.
