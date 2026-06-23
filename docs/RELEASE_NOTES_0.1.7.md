# MikaVN Library 0.1.7 Release Notes

## Highlights

- Adds a Maintenance `导出诊断包` action for faster startup, update, image, and metadata issue investigation.
- Diagnostic packages include generated summaries, app-data health, environment metadata, and redacted log previews.
- Large-library behavior remains tuned for 4000+ game libraries through bounded render windows, lazy cover loading, async image decoding, debounced text filters, lower-priority decorative detail backgrounds, and deferred play-session history loading.
- Game detail collection membership now uses a direct current-game query instead of per-collection membership scans, improving detail switching on libraries with many collections.
- Image health maintenance now reports missing references, orphan cache files, duplicate names, oversized files, content-type mismatches, and legacy Playnite-style cache paths in one place.

## Safety

- Diagnostic ZIPs do not include the full `mikavn.db`, raw logs, image cache files, save-backup contents, or real game installation folders.
- Diagnostic export is read-only with respect to the real library and writes only generated files under app-data export/staging directories.
- Orphan image cleanup remains quarantine-first rather than permanent deletion.
- Update installation still creates a verified database protection backup before installer handoff.

## Verification

This build should pass:

- `npm run release:validate:core`
- `npm run test:diagnostic-export`
- `cargo test -q diagnostic --manifest-path src-tauri/Cargo.toml`
- `npm run smoke:large`

Latest large-library smoke covered 4,500 browser-preview records with list load, detail switch, topbar quick search, and advanced search inside the current budgets.

Local installed-app smoke on `E:\MikaVN Library` verified:

- app window opens as `MikaVN Library`;
- `mikavn.db` remains `quick_check=ok`;
- real data counts stayed at 4456 games and 17738 asset records.

## Known Boundaries

- Windows is the supported target.
- Public software-internal update artifacts require `TAURI_SIGNING_PRIVATE_KEY`; local unsigned installers are suitable for local testing only.
- Cloud sync, WebDAV, plugin system, and community workflows remain out of scope.
