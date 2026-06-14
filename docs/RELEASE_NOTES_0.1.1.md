# MikaVN Library 0.1.1 Release Notes

## Highlights

- Mature local V1 hardening for the Windows-first desktop library workflow.
- Release executable is built as a Windows GUI application, so the packaged app does not open an extra console window.
- Browser smoke now starts or reuses Vite automatically, making local validation work from a clean terminal.
- Large-library smoke covers 1500 browser-preview records and advanced search performance.
- Clean installer smoke covers the NSIS install, isolated first launch, database creation, main window detection, and silent uninstall lifecycle.
- Release output is copied to `output/release/0.1.1-windows-x64/` with SHA256 checksums for local handoff.

## Safety

- local-only data safety remains the central rule: scanner, archive, import, export, save backup, and record-delete flows do not delete or rewrite real game installation directories.
- Database restore and save mirror restore create protection backups before replacing local data.
- Diagnostic previews and task logs keep the redaction baseline for API-like keys, tokens, passwords, and Windows user profile paths.

## Verification

This build passed:

- `npm run release:validate:strict`
- `npm run release:check:strict`
- `npm run test:release-scripts`
- `npm run test:playwright-scripts`
- `npm run build`
- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo test` with 125 Rust tests
- `npm run smoke:browser`
- `npm run smoke:large`
- `npm run tauri:build`
- `npm run smoke:install`
- `npm run smoke:portable-data`
- `npm run smoke:desktop`

Code signing status can be checked with:

- `npm run release:signing:check`

Public Windows releases should pass `npm run release:signing:require` after signing with a trusted OV/EV certificate.

## Known Boundaries

- Windows is the supported target for this release.
- Cloud sync, WebDAV, plugin ecosystem, CLI/local API, and community workflows remain future milestones.
- A trusted code signing certificate is still required before treating a shared installer as a fully signed public release.
