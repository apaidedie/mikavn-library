# MikaVN Library Error Handling Contract

The mature product needs stable errors so UI can show clear messages, retry actions, and diagnostics. This document defines the target Rust/TypeScript contract.

## TypeScript Shape

```ts
type AppError = {
  code: string;
  message: string;
  details?: unknown;
};
```

Frontend rules:

- All Tauri errors are normalized in the API wrapper.
- UI can display `message` immediately.
- UI can branch on `code` for retry, relocate, provider settings, or diagnostics.
- Do not expose raw tokens or sensitive full paths unless the user needs them to repair the issue.

## Rust Shape

Rust commands should return `AppResult<T> = Result<T, AppError>` directly or through compatible aliases.

Required fields:

- `code`: stable machine-readable string.
- `message`: human-readable string.
- `details`: optional structured diagnostics.

## Error Codes

Initial stable codes:

- `DB_ERROR`
- `MIGRATION_FAILED`
- `IO_ERROR`
- `PATH_NOT_FOUND`
- `PATH_ACCESS_DENIED`
- `EXECUTABLE_NOT_FOUND`
- `LAUNCH_CANCELLED`
- `LAUNCH_FAILED`
- `SCAN_FAILED`
- `METADATA_PROVIDER_FAILED`
- `ASSET_DOWNLOAD_FAILED`
- `BACKUP_FAILED`
- `RESTORE_FAILED`
- `SEARCH_QUERY_INVALID`
- `TASK_CANCELLED`
- `VALIDATION_ERROR`
- `UNKNOWN_ERROR`

## Mapping Rules

- SQLite errors map to `DB_ERROR`.
- Migration failures map to `MIGRATION_FAILED` when they happen in migration code.
- Missing files or directories map to `PATH_NOT_FOUND`.
- Permission failures map to `PATH_ACCESS_DENIED`.
- Missing executable paths map to `EXECUTABLE_NOT_FOUND`.
- UAC cancellation maps to `LAUNCH_CANCELLED`; other process spawn failures map to `LAUNCH_FAILED`.
- Provider failures should not crash global metadata search. They should be provider-level errors where possible.
- Save backup failures map to `BACKUP_FAILED`.
- Restore failures map to `RESTORE_FAILED`.
- Advanced search validation failures should return a successful validation payload when possible; command-level invalid input still maps to `VALIDATION_ERROR`.

## Current State And Gaps

- Backend command errors now use the structured `AppError` shape.
- Frontend command calls normalize backend errors into `MikaAppError`.
- Some flows still use broad codes where richer repair actions will need more specific details.
- The frontend mostly displays message text and does not yet branch on error codes.
- Advanced search shows parser warnings inline and avoids treating syntax mistakes as fatal app errors.
- Database restore is scheduled as a task and writes failures to task logs; the actual file replacement happens on next startup after a protection backup.
- ZIP archive read/write failures map to `ARCHIVE_ERROR`; unsafe archive paths are rejected before extraction.

## UI Recovery Requirements

- `PATH_NOT_FOUND`: offer relocate or remove path.
- `EXECUTABLE_NOT_FOUND`: offer edit executable path.
- `LAUNCH_CANCELLED`: show a quiet cancellation notice and do not create a play session.
- `LAUNCH_FAILED`: show executable, working directory, and short failure reason.
- `METADATA_PROVIDER_FAILED`: show provider name and keep other provider results.
- `ARCHIVE_ERROR`: show the archive path/action and suggest previewing or re-exporting the archive.
- `BACKUP_FAILED`: show source and destination when safe.
- `TASK_CANCELLED`: show cancelled state, not an error alert.

## Testing Requirements

- Unit test error serialization.
- Verify frontend `normalizeAppError` handles strings, objects, and `Error` instances.
- Browser check that provider errors and launch failures display readable messages.
