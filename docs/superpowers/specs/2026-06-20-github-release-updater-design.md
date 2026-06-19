# GitHub Release Updater Design

## Context

MikaVN Library can already build a Windows NSIS installer through Tauri and publish tagged Windows release artifacts through GitHub Actions. The current update path is still manual: download or build a new installer, run it, and pick or confirm the install location. For a self-use Windows app, the preferred daily workflow is to install once and then update from inside the application.

The repository and release assets can be publicly downloadable. That allows the app to use GitHub Releases as the update source without embedding private tokens or account credentials in the desktop client.

## Goals

- Add an in-app update flow backed by public GitHub Releases.
- Keep the first install as a normal Windows NSIS installer.
- Let future updates reuse the current install location instead of asking for an install directory again.
- Add a startup update check that is quiet unless an update is available.
- Add a manual "check for updates" action in Settings.
- Verify updater downloads with Tauri updater signatures.
- Preserve the current local data rules: updates must not delete or relocate `app-data`, `mikavn.db`, image cache, logs, or save backups.
- Keep the implementation suitable for self-use first, while leaving room for public release hardening later.

## Non-Goals

- No accounts, login, private GitHub token, cloud sync, WebDAV, or remote library service.
- No forced automatic installation without user confirmation.
- No custom update server.
- No macOS or Linux updater support in this phase.
- No trusted Windows code-signing certificate requirement in this phase. Authenticode signing remains recommended for public distribution, but Tauri updater signing is the required integrity check for this feature.
- No change to the app's local database schema unless the implementation discovers a narrowly necessary setting field for update preferences.

## User Experience

### Startup Check

On app startup, the app should check for updates in the background after the main window is usable. If the current version is up to date, the app should not interrupt the user. If a newer version is available, show a concise non-blocking notice with:

- the available version,
- a short release note summary when available,
- an action to download and install,
- an action to dismiss for the current session.

The startup check must not block the Dashboard, database initialization, or local workflows.

### Manual Check

Settings should include a local maintenance/update section with a "检查更新" action. The manual action should report one of these states:

- checking,
- up to date,
- update available,
- downloading/installing,
- installed and ready to restart,
- failed with a copyable error message.

The manual action should be available in both normal desktop builds and browser preview. Browser preview can show a clear "desktop updater unavailable in browser preview" message instead of calling Tauri updater APIs.

### Install And Restart

When the user chooses to update, the app downloads and installs the signed update package through Tauri updater. The UI should then prompt the user to restart the app. The update flow should not ask the user to choose an install path.

If the update fails, the app should keep running and display a recoverable error. It should not modify local data directories.

## Architecture

### Tauri Integration

Add Tauri updater support using the Tauri v2 updater plugin. The Rust side should register the updater plugin in the app builder, and the frontend should call the official JavaScript updater API through a small local wrapper.

Suggested boundaries:

- `src/services/updater.ts`
  - Owns frontend calls to the updater API.
  - Converts Tauri updater responses into app-facing status objects.
  - Handles browser preview fallback.
- Settings page update section
  - Owns user-triggered checks and update actions.
  - Displays status and errors.
- App startup hook
  - Performs one quiet startup check.
  - Shows update-available notice only when needed.

Components should not call low-level updater APIs directly outside `src/services/updater.ts`.

### Configuration

`src-tauri/tauri.conf.json` should include updater configuration that points to the public GitHub latest release metadata endpoint or another Tauri-supported static endpoint generated from GitHub Releases. The configuration must include the updater public key. The private signing key must never be committed.

Expected release assets:

- NSIS installer or updater-compatible Windows package,
- updater signature file or metadata required by Tauri,
- release notes,
- checksums where the existing release workflow already produces them.

### GitHub Release Workflow

The existing `.github/workflows/release.yml` should be extended so tagged releases publish all updater-required artifacts. The workflow should fail if updater signing secrets are missing for a tagged public release.

Required secret handling:

- updater private key stored as a GitHub Actions secret,
- updater password stored as a GitHub Actions secret if the key is encrypted,
- no updater private key in repository files, PR bodies, logs, or generated docs.

### Versioning

The app version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json` should remain aligned with existing release metadata checks. Updates should only be offered when GitHub Releases contains a semver version newer than the running app.

## Data Safety

The updater must operate on application binaries and updater-managed package files only. It must not delete or rewrite:

- executable-adjacent `app-data`,
- `%APPDATA%\MikaVN`,
- `mikavn.db`,
- `images`,
- `cache`,
- `logs`,
- `save-backups`,
- pending restore or protection backup directories.

The existing portable app-data behavior remains unchanged. First install may migrate old default app data into executable-adjacent `app-data`; later in-app updates should continue using that same directory.

## Error Handling

Update errors should be visible but non-fatal:

- network unavailable,
- GitHub Release unavailable,
- no valid update metadata,
- signature verification failure,
- download failure,
- install failure,
- restart failure.

Signature verification failures should be treated as hard failures. The app must not offer to install an update that fails signature verification.

Errors shown in the UI should be concise and copyable. Detailed logs may be written through the existing diagnostic logging system if the updater API exposes enough information.

## Testing

Follow TDD for behavior changes.

Recommended tests and checks:

- Unit or Node tests for frontend updater status mapping and browser-preview fallback.
- Source/config tests that verify updater configuration exists and references public GitHub release metadata.
- Release script tests that verify updater artifacts are part of the release workflow.
- Browser smoke checks that Settings renders the update section and browser-preview fallback.
- Desktop smoke or scripted release smoke that verifies updater availability in a desktop build without requiring a real version upgrade.
- A manual or scripted lower-version-to-higher-version update test before relying on the flow for personal daily updates.

Existing gates should still pass:

- `npm run build`
- `npm run smoke:browser`
- `npm run tauri:build`
- `npm run smoke:desktop`
- `npm run smoke:install`
- `npm run smoke:portable-data`

## Acceptance Criteria

- Settings has a manual "检查更新" action.
- App startup performs a quiet update check and only notifies when an update is available.
- A public GitHub Release can serve update metadata without app-embedded credentials.
- Update packages are verified with Tauri updater signatures before installation.
- Updating from inside the app does not ask for an install directory.
- Local app data remains in place across update.
- Browser preview degrades gracefully without desktop updater APIs.
- Release workflow publishes or validates updater-required artifacts for tagged releases.
- The private updater signing key is not committed.
- Existing build and smoke gates still pass.

## Release Operations

For each public update release:

1. Bump the version consistently across project metadata.
2. Build a tagged release through GitHub Actions.
3. Ensure updater signing secrets are present.
4. Publish GitHub Release assets and notes.
5. Install the previous version locally.
6. Use the app's "检查更新" flow to update to the new version.
7. Confirm app data, database, images, logs, and save backups remain available after restart.

## Spec Self-Review

- No incomplete markers remain.
- Scope is limited to Windows in-app updates through public GitHub Releases.
- The design keeps local-first data safety intact.
- The design avoids private tokens and custom servers.
- Testing requirements cover config, UI fallback, release workflow, desktop packaging, and data preservation.
