# Documentation

Root-level Markdown files remain at the repository root because the release metadata gate validates them as public project entry points.

## Root Entry Points

- `README.md`: user-facing overview, commands, and verification snapshot.
- `ROADMAP.md`: current maturity state, cleanup debt, and future milestones.
- `ARCHITECTURE.md`: layering, boundaries, and verification rules.
- `DATA_MODEL.md`: app-data layout, SQLite tables, and migration notes.
- `DESIGN.md`: UI and interaction design state.
- `ERROR_HANDLING.md`: error contract and recovery expectations.
- `RELEASE_CHECKLIST.md`: release validation and handoff process.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `PRIVACY.md`, `SECURITY.md`, `SUPPORT.md`, and `LICENSE`: project metadata.

## Files Under `docs/`

- `CODE_SIGNING.md`: Windows Authenticode signing guidance.
- `RELEASE_NOTES_TEMPLATE.md` and versioned release notes: public release copy.
- `superpowers/specs/` and `superpowers/plans/`: implementation design and execution history. Move completed work here instead of leaving planning notes in the root.
