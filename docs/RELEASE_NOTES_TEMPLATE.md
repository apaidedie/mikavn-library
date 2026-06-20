# MikaVN Library 0.1.7 Release

## Highlights

- Adds a Maintenance `导出诊断包` action for startup, update, image, and metadata issue investigation.
- Diagnostic packages include generated summaries, app-data health, environment metadata, and redacted log previews.
- Large-library behavior remains tuned for 4000+ game libraries through smaller render windows, lazy cover loading, async image decoding, and debounced text filters.
- Image health maintenance reports missing references, orphan cache files, duplicate names, oversized files, and legacy Playnite-style cache paths in one place.

## Install

Download the Windows NSIS installer attached to this release and run it normally.

## Before Upgrading

- Back up your existing MikaVN database from Settings, or confirm update-protection backups are enabled.
- Review `PRIVACY.md` if you plan to share logs or screenshots.

## Verification

This release should be built with:

- `npm run release:validate:strict`

Or, equivalently, the expanded validation chain:

- `npm run release:check:strict`
- `npm run test:release-scripts`
- `npm run test:playwright-scripts`
- `npm run test:updater-release`
- `npm run test:diagnostic-export`
- `npm run build`
- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo test`
- `npm run smoke:browser`
- `npm run smoke:large`
- `npm run tauri:build`
- `npm run smoke:install`
- `npm run smoke:portable-data`
- `npm run smoke:desktop`

CI also gates `npm run smoke:browser` and `npm run smoke:large`, and uploads browser, Vite, and desktop smoke artifacts for review. Local release candidates should also pass `npm run smoke:install` and `npm run smoke:portable-data` so the NSIS installer lifecycle and executable-adjacent app-data behavior are covered before sharing.

Recommended manual smoke coverage is listed in `RELEASE_CHECKLIST.md`.

## Safety Notes

- Deleting a game deletes only the MikaVN database record, not the real game folder.
- Scanner, archive, import, and export flows do not delete, move, or rewrite real game installations.
- Database restore and save mirror restore create protection backups first.
- Diagnostic ZIPs do not include the full `mikavn.db`, raw logs, image cache files, save-backup contents, or real game installation folders.
- Orphan image cleanup remains quarantine-first rather than permanent deletion.

## Known Boundaries

- Windows is the supported target.
- Public software-internal update artifacts require `TAURI_SIGNING_PRIVATE_KEY`.
- Cloud sync, WebDAV, plugin system, and community workflows are not part of this release.
