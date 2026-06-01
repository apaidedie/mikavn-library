# Contributing

Thanks for helping make MikaVN Library better. The project is a Windows-first, local-first Galgame / Visual Novel library manager built with Tauri 2, React, TypeScript, Rust, and SQLite.

## Development Setup

Required tools:

- Node.js 20 or newer
- Rust stable toolchain
- Windows for full Tauri, launch-profile, shortcut, and desktop smoke coverage

Install dependencies:

```powershell
npm ci
```

Run the browser preview:

```powershell
npm run dev
```

Run the Tauri app:

```powershell
npm run tauri:dev
```

## Quality Gate

Before opening a pull request, run:

```powershell
cd src-tauri
cargo fmt
cargo test
```

```powershell
cd ..
npm run build
```

For UI or release behavior changes, also run the smoke scripts described in `RELEASE_CHECKLIST.md`.

## Code Guidelines

- Keep Tauri command names compatible unless a breaking change is explicitly planned.
- Prefer feature services and repositories over growing command handlers.
- Preserve local-first safety: never delete, move, or rewrite real game installation directories from import/export/scanner/archive flows.
- For destructive-adjacent operations, require explicit UI confirmation and create protection backups where data replacement can happen.
- Keep browser-preview mock behavior close to Tauri behavior so UI work stays testable without Rust.
- Do not commit real API keys, real private game paths, personal app data, generated screenshots, local logs, installers, or build artifacts.

## Documentation

When behavior changes, update the relevant docs:

- `README.md` for user-facing capabilities and commands.
- `ROADMAP.md` for scope and future boundaries.
- `ARCHITECTURE.md` for module or service/repository changes.
- `DATA_MODEL.md` for schema and migration changes.
- `PRIVACY.md` for data, network, or logging changes.
- `ERROR_HANDLING.md` for error contracts and UX expectations.
- `RELEASE_CHECKLIST.md` for release or verification process changes.

## Pull Requests

Use the pull request template and include:

- What changed.
- Why it changed.
- What was tested.
- Any known limitations or follow-up work.

Small, focused pull requests are easier to review and safer for the local data model.
