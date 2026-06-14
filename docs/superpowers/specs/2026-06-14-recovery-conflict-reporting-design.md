# Recovery And Conflict Reporting Design

## Context

MikaVN Library already has mature local workflows for scanning, archive import/restore, save backup/restore, and task logs. The remaining daily-use gap is not raw feature coverage; it is explaining what happened after risky or conflict-prone operations, and making those explanations easy to copy when diagnosing a failed or surprising task.

This first phase improves existing surfaces instead of adding a new report center.

## Goals

- Make scanner import results explain why each selected candidate was added, merged, replaced, duplicated, or skipped.
- Make save restore tasks record the same kind of useful file-difference detail that the restore preview already shows before execution.
- Add a task-page action that copies a concise Markdown diagnostic summary for a task, including status, error, recent logs, and suggested next actions.
- Keep all reporting local-only and redacted through the existing task/log persistence paths.

## Non-Goals

- No WebDAV, cloud sync, plugin system, or public release workflow changes.
- No new report center page in this phase.
- No destructive behavior changes. Scanner import still only changes database records, and save restore still only acts on registered save directories after creating protection backups.
- No database schema migration unless existing task logs and frontend state are insufficient.

## Scope

### Scanner Import Report

The existing `ImportScanReportItem` stays as the primary data model. It will gain user-facing explanation detail without changing the import actions:

- `message`: keep the current short result text.
- `conflictReason`: keep the existing conflict source.
- Add or derive a next-action hint in the UI for each result row.

Examples:

- `add`: "建议继续批量匹配元数据。"
- `merge`: "已更新现有记录的路径/启动程序/别名；建议检查路径健康。"
- `replace`: "已覆盖数据库记录字段；建议打开详情页核对标题和启动程序。"
- `duplicate`: "已保留为独立记录；建议确认是否需要合并重复项。"
- `skip`: "未写入数据库；如需导入请重新选择处理方式。"

### Save Restore Task Report

The restore preview already computes new, overwritten, kept, and removed file samples. Save restore execution should reuse that same analysis before copying files and append task logs with:

- restore mode label,
- backup and target paths,
- new/overwritten/kept/removed counts,
- up to five sample paths for each relevant group,
- protection backup path.

The task completion message remains compact, but the expanded detail is available from task logs.

### Task Diagnostic Summary

The Tasks page will expose a "copy diagnostic summary" action for each task. The copied Markdown should include:

- task id, type, status, progress, created/updated timestamps,
- task message and error when present,
- recent log entries already returned by the task detail command,
- suggested next actions inferred from task type/status/error/logs.

Suggested actions should be deterministic local text. Examples:

- Failed scan: check path existence and permissions, then retry.
- Archive import skipped games: review conflict logs and import only missing titles.
- Save restore: verify the restored save directory and keep the protection backup until the game launches correctly.
- Unknown failure: copy diagnostics and inspect local logs from Settings.

## Architecture

- Rust services remain responsible for operation facts and task logs.
- Frontend utilities format those facts into UI hints and Markdown diagnostics.
- Existing task log redaction remains the safety boundary. The frontend should not fetch raw log files for this feature.
- No new global state is required.

## Data Flow

1. Scanner import returns `ImportScanReport`.
2. Scanner page renders existing rows plus derived next-action hints.
3. Save restore task computes preview data before restore, performs restore, writes protection backup, then appends detailed task logs.
4. Tasks page fetches task details as it already does, then builds a Markdown diagnostic summary from task record plus returned logs when the user clicks copy.

## Error Handling

- Copy failures should show the existing page-level error pattern.
- Restore preview failure should fail the restore task before any file copy, preserving the existing protection-first model.
- Diagnostic generation should never throw for missing optional task fields; it should omit absent sections.

## Testing

- Rust tests:
  - save restore task/report helper logs preview counts and samples,
  - existing save restore protection behavior remains intact.
- Frontend/build checks:
  - `npm run build` covers TypeScript for scanner hints and task diagnostics.
- Existing release gates:
  - `npm run release:validate:core` must pass after implementation.

## Acceptance Criteria

- Scanner import audit rows show a next-action hint for every action type.
- Save restore task logs include preview-style counts and file samples before/after restore completion.
- Tasks page has a copy-diagnostic action that writes Markdown to the clipboard.
- Copied diagnostics include task metadata, logs, and deterministic suggested actions.
- No release artifact, signing, or packaging behavior changes in this phase.
