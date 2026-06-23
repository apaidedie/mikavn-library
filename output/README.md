# Output Artifacts

This directory keeps generated verification artifacts, local packaging helpers, and smoke outputs only. Runtime source code does not depend on these files.

`output/` is ignored by Git except for this README. Reusable scripts live under `scripts/`.

## Current Artifacts

- `release/<version>-windows-x64/`: copied release installers, release executables, SHA256 checksums, and local build notes for handoff.

## Regenerated Artifacts

These folders are created only when the matching smoke, build, or release command is run. They can be deleted after the evidence is no longer needed.

- `playwright/page-qa-current/`: page-level screenshots for dashboard, library, search, scanner, metadata, tasks, reports, saves, collections, and settings.
- `playwright/workflow-smoke-current/`: workflow smoke screenshot.
- `playwright/large-library-current/`: large-library timing report and screenshots.
- `clean-install-smoke/run-*/`: isolated NSIS install, first-run, and uninstall smoke reports.
- `desktop-smoke/run-*/`: desktop smoke reports and logs.
- `portable-app-data-smoke/run-*/`: portable app-data install smoke evidence.
- `real-app-data-readonly-smoke/`: readonly checks for the real installed library.
- `real-install-update-smoke/`: guarded real install overwrite/update smoke evidence.
- `nsis-*/`, `nsis-*.zip`, and `nsis_tauri_utils.dll`: local Tauri packaging helpers when `useLocalToolsDir` is enabled.

## Archive

- `archive/browser-profiles/`: old browser user data directories from manual debugging.
- `archive/playwright-legacy-screenshots/`: older iterative screenshots kept as historical evidence.
- `archive/playwright-temp/`: superseded temporary Playwright test files.
- `archive/logs/`: old Vite/Tauri/smoke logs.
- `archive/legacy-smoke/`: old one-off smoke artifacts.

Generated output can be deleted if disk space is needed. Keep reusable runners in `scripts/` when changing UI or release behavior.
