# MikaVN Release Checklist

Use this checklist before packaging or sharing a build. The app is Windows-first. Commands below assume PowerShell from the repository root unless noted.

## 1. Source Health

- Confirm `src/`, `src-tauri/src/`, docs, scripts, and `output/README.md` reflect the intended feature set.
- Keep reusable verification scripts under `scripts/`; keep generated QA artifacts, logs, installers, and local packaging tools under `output/`.
- Check version alignment across `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
- Run `npm run release:check`; before a public GitHub release, run `powershell -ExecutionPolicy Bypass -File scripts/release/check-release-metadata.ps1 -StrictGitHubLinks`.

## 2. Automated Checks

```powershell
cd src-tauri
cargo fmt
cargo test
```

```powershell
cd ..
npm run build
```

Expected baseline for the current mature V1 snapshot: Rust tests pass with 78 tests, and the frontend build completes TypeScript plus Vite production checks.

## 3. Browser Smoke

Start Vite if it is not already running:

```powershell
npm run dev -- --host 127.0.0.1
```

Then run:

```powershell
npm run smoke:browser
```

The page QA runner refreshes screenshots in `output/playwright/page-qa-current/`. The workflow smoke covers advanced search and saved searches, asset gallery/cache cleanup, scanner conflict actions, save backup/restore protection, tag maintenance, settings archive/log flows, and task log expansion. Set `MIKAVN_QA_URL` or `MIKAVN_QA_OUT_DIR` to override the target URL or output directory.

## 4. Desktop Smoke

After a release build exists, run:

```powershell
npm run smoke:desktop
```

The smoke should start `src-tauri/target/release/mikavn-library.exe`, detect a main window titled `MikaVN Library`, and create or open the app data database under `%APPDATA%\dev.mikavn.library`.

## 5. Manual Risk Pass

- Launch profiles: direct executable, `.lnk`, custom command, Locale Emulator-style wrapper, and elevated launch cancellation/success where practical.
- Destructive-adjacent flows: database restore scheduling, safe archive import, save mirror restore, tag deletion, and game record deletion. Each flow should require explicit confirmation and avoid deleting real game installations.
- Privacy: diagnostic logs and task messages should redact API-like keys/tokens/passwords and Windows user profile names.
- Search UX: quick searches should work without knowing the DSL; advanced grammar should remain available for power users.

## 6. Package Notes

- `npm run tauri:build` produces the NSIS installer under `src-tauri/target/release/bundle/nsis/`.
- GitHub tag releases are handled by `.github/workflows/release.yml`; tag versions should use `vMAJOR.MINOR.PATCH`, such as `v0.1.0`.
- Keep release notes focused on local-only data safety: real game directories are never moved, rewritten, or deleted by import/export/archive flows.
- If the version changes, update every versioned file before rebuilding.
