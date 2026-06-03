# MikaVN Library Release

## Highlights

- Local-first Windows desktop library manager for Galgame / Visual Novel collections.
- Mature V1 workflow: library, detail, scanner, metadata, saves, archives, tasks, reports, settings, collections, and advanced search.
- Non-destructive safety model for real game installation directories.

## Install

Download the Windows NSIS installer attached to this release and run it normally.

## Before Upgrading

- Back up your existing MikaVN database from Settings.
- Review `PRIVACY.md` if you plan to share logs or screenshots.

## Verification

This release should be built with:

- `npm run release:validate:strict`

Or, equivalently, the expanded validation chain:

- `npm run release:check:strict`
- `npm run build`
- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo test`
- `npm run smoke:browser`
- `npm run smoke:large`
- `npm run tauri:build`
- `npm run smoke:install`
- `npm run smoke:desktop`

CI also gates `npm run smoke:browser` and `npm run smoke:large`, and uploads browser, Vite, and desktop smoke artifacts for review. Local release candidates should also pass `npm run smoke:install` so the NSIS installer lifecycle is covered before sharing.

Recommended manual smoke coverage is listed in `RELEASE_CHECKLIST.md`.

## Safety Notes

- Deleting a game deletes only the MikaVN database record, not the real game folder.
- Scanner, archive, import, and export flows do not delete, move, or rewrite real game installations.
- Database restore and save mirror restore create protection backups first.

## Known Boundaries

- Windows is the supported target.
- Cloud sync, WebDAV, plugin system, and community workflows are not part of this release.
