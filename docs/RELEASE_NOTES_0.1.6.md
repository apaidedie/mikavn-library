# MikaVN Library 0.1.6 Release Notes

## Highlights

- Adds an automatic verified database backup before installing app updates.
- Makes database backup and restore entry points clearer in Settings and Dashboard.
- Keeps update-protection backups inside `app-data/database-backups/update-protection`.
- Keeps restore behavior conservative: database restore is still scheduled for next startup and creates a protection backup before replacement.

## Safety

- Update installation is cancelled if the pre-update database backup fails.
- Update-protection backups are included in diagnostics and safe old-backup cleanup.
- Real game installation folders are not moved, rewritten, or deleted.
- Existing `app-data`, `mikavn.db`, image cache, logs, and save backups stay in place during updates.

## Verification

This build should pass:

- `npm run release:validate:core`
- `npm run test:updater-release`
- `cargo test -q backup --manifest-path src-tauri/Cargo.toml`

## Known Boundaries

- Windows is the supported target.
- This release focuses on local database safety. Large-library performance, image repair, diagnostic package export, and richer update progress remain follow-up hardening work.
