# MikaVN Library Privacy Baseline

MikaVN Library is local-first. User library data should stay on the user's Windows machine unless a feature clearly needs network access and the user enables it.

## Local Data

Stored locally today:

- Game records and metadata in SQLite.
- App settings in SQLite.
- Cached cover images in app data `images/`.
- Save backups in app data `save-backups/`.
- Local diagnostic logs in app data `logs/`.

Browser mock mode stores preview data in localStorage only for development.

## Network Behavior

Network-capable features today:

- VNDB metadata search and detail.
- DLsite public page search/detail.
- FANZA public page search/detail.
- Cover image download from selected metadata.
- OpenAI-compatible image recognition if configured.

Rules:

- Provider switches must remain visible in Settings.
- DLsite/FANZA must only use public pages and public search results.
- Do not bypass login, payment, or access controls.
- AI recognition sends the selected local image content to the configured API endpoint.
- No real API key should be committed to source, README examples, or packaged assets.

## API Keys

Priority order:

1. `MIKAVN_AI_API_KEY`
2. `MIKAVN_AI_BASE_URL`
3. `MIKAVN_AI_MODEL`
4. Local app settings

If the user stores an API key in settings, the UI must clearly explain that it is local private configuration and should not be shared.

## Privacy Settings

Implemented settings:

- Hide `hidden` games from the library.
- Blur covers.
- Filter hidden or R18 entries from reports.

Future privacy mode:

- One toggle that enables cover blur, hidden filtering, and report filtering together.
- Optional window title privacy.
- Optional recent activity hiding.

## Logs

Implemented baseline:

- Background tasks write selected diagnostic lines to local daily files under app data `logs/`.
- Task messages, task logs, and local diagnostic logs redact API-like keys/tokens/passwords and Windows user profile names before storage where the shared logger path is used.
- Settings can preview recent redacted log lines and prune logs with the default 30 day / 60 file retention policy.
- Logs stay local and are not uploaded by MikaVN Library.

Current limits:

- Logs may still contain game titles, provider names, error codes, relative folder names, and non-user-profile path segments needed for diagnosis.
- The logger is intentionally file-based; log search/indexing beyond simple preview is not implemented yet.

Policy:

- Avoid logging API keys.
- Avoid logging full sensitive paths unless needed for diagnosis, and redact local Windows user names where possible.
- Prefer error codes plus short messages in UI.
- Keep detailed logs local.

## Delete Semantics

- Deleting a game record must not delete real game files.
- Deleting a save backup record should delete only the record unless a separate explicit delete-files action is added later.
- Restoring a save backup must create a protection backup first.

## Export And Backup

Export surfaces must clearly label what is included:

- Database only.
- Database plus assets.
- Database plus assets plus save backups.

Directory and ZIP exports may contain private paths, titles, tags, notes, and play history. The UI should warn before sharing export archives.

Database restore is scheduled through `pending-restore` and applied on next startup after creating a protection backup of the current database.
