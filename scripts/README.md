# Scripts

Reusable automation belongs here. Generated logs, screenshots, installers, browser profiles, and smoke artifacts belong under `output/`.

## Release Gates

- `release/check-release-metadata.ps1` validates release metadata, security configuration, verification docs, and workflow gates.
- `release/check-source-size.cjs` watches known large frontend, Rust, and smoke-runner files so cleanup debt does not quietly grow.
- `release/check-build-chunks.cjs` and `release/check-release-handoff.cjs` validate build and handoff artifacts.
- `release/run-release-validation.ps1` chains the local release validation commands.

## Smoke And QA

- `playwright/page-qa-runner.cjs` is the broad page-level browser-preview QA runner.
- `playwright/core-workflow-smoke.cjs` covers key local workflows in browser preview mode.
- `playwright/large-library-smoke.cjs` seeds a large mock library and checks rendering/search timing.
- `playwright/run-smoke-with-vite.cjs` starts or reuses Vite for browser smoke commands.
- `desktop-smoke/` contains installer, portable app-data, and release executable smoke scripts.

## Migration And Repair Utilities

- `import-playnite-to-mikavn.py` is a manual Playnite migration utility.
- `metadata/repair-description-images.py` repairs missing inline description images from provider pages. Its default app-data root is `MIKAVN_APP_DATA_DIR`, then `%APPDATA%\dev.mikavn.library`; pass `--app-data-root` or explicit path flags for portable installs.
- `metadata/run-description-image-repair-loop.ps1` wraps repeated metadata image repair runs and uses the same app-data root defaults.

Keep reusable command logic in `scripts/`. Keep one-off command outputs in `output/` so `git clean -ndX` remains quiet.
