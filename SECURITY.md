# Security Policy

MikaVN Library is local-first desktop software. Security work focuses on local data safety, path handling, privacy-preserving logs, and safe handling of optional metadata/network features.

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting A Vulnerability

Please do not open a public issue for vulnerabilities that could expose private local paths, local data, secrets, or unsafe file operations.

Report privately through GitHub Security Advisories when the repository is published. If advisories are not enabled yet, contact the maintainers through the private channel listed on the project page.

Helpful report details:

- App version and operating system.
- Exact steps to reproduce.
- Whether real local files, database files, logs, or API keys may be exposed.
- Whether the issue requires Tauri desktop mode or also affects browser preview mode.

## Security Boundaries

- The app stores its SQLite database and local caches in the application data directory.
- Real game installation directories should never be deleted, moved, or rewritten by scanner, archive, import, export, or record deletion flows.
- Database restore and save mirror restore are explicit, high-impact actions and must create protection backups first.
- Diagnostic logs and task logs should redact API-like keys, tokens, passwords, and Windows user profile names where the shared logger path is used.
- Metadata providers use public endpoints or public pages. The app does not log into stores, bypass restrictions, or fetch paid content.

## Secret Handling

Do not commit:

- `MIKAVN_AI_API_KEY` or other API keys.
- Real user app data directories.
- Private game installation paths in bug reports unless needed and redacted.
- Local diagnostic logs or generated smoke artifacts.
