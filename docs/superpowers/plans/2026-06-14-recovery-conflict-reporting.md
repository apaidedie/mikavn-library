# Recovery Conflict Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve existing scanner import, save restore, and task-log surfaces so conflict/recovery operations explain what happened and can be copied as diagnostics.

**Architecture:** Keep operation facts in existing Rust services and task logs. Add focused frontend formatting helpers for scanner next-action hints and task Markdown diagnostics. Avoid schema changes and avoid a new report center.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, existing task log APIs, browser clipboard API.

---

## File Structure

- Modify `src/pages/Scanner/ScannerPage.tsx`: render per-action next-action hints in existing import audit rows.
- Modify `src-tauri/src/services/saves.rs`: compute save restore preview during task execution and append detailed task logs before file restore.
- Create `src/pages/Tasks/taskDiagnostics.ts`: pure TypeScript formatter for task diagnostic Markdown and suggested actions.
- Create `src/pages/Tasks/taskDiagnostics.test.cjs`: lightweight source-level or Node-level tests for diagnostic formatting if practical without changing the frontend test runner.
- Modify `src/pages/Tasks/TasksPage.tsx`: add "copy diagnostic" action for task rows and recent result cards, using existing logs when loaded.
- Modify `package.json` only if adding a new script test is needed.

---

### Task 1: Scanner Import Next-Action Hints

**Files:**
- Modify: `src/pages/Scanner/ScannerPage.tsx`

- [ ] **Step 1: Add a failing source check for action hints**

Run:

```powershell
Select-String -LiteralPath src/pages/Scanner/ScannerPage.tsx -Pattern "importActionHint" -Quiet
```

Expected: exits false before implementation.

- [ ] **Step 2: Implement scanner action hints**

Add this helper near `importActionLabel`:

```ts
function importActionHint(action: ImportScanReportItem['action']) {
  switch (action) {
    case 'add': return '下一步：建议继续批量匹配元数据，并检查封面与外部 ID。';
    case 'merge': return '下一步：已更新现有记录路径、启动程序与别名，建议打开详情页检查路径健康。';
    case 'replace': return '下一步：已覆盖数据库记录字段，建议核对标题、启动程序和别名是否符合预期。';
    case 'duplicate': return '下一步：已保留为独立记录，建议之后在维护页检查是否需要合并重复项。';
    case 'skip': return '下一步：未写入数据库；如需导入，请重新扫描后选择合并、替换或副本导入。';
    default: return '下一步：查看处理消息和冲突原因，确认是否需要手动修正。';
  }
}
```

In `ImportReportRow`, render the hint after the conflict reason:

```tsx
<div className="mt-1 text-slate-400">{importActionHint(item.action)}</div>
```

- [ ] **Step 3: Verify scanner hints compile**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 4: Commit scanner hint slice**

```powershell
git add src/pages/Scanner/ScannerPage.tsx
git commit -m "feat: explain scanner import outcomes"
```

---

### Task 2: Save Restore Detailed Task Logs

**Files:**
- Modify: `src-tauri/src/services/saves.rs`

- [ ] **Step 1: Write failing Rust test for restore log detail helper**

Add this test in `src-tauri/src/services/saves.rs` under the existing tests module:

```rust
#[test]
fn restore_preview_log_lines_include_counts_samples_and_paths() {
    let preview = SaveRestorePreview {
        mode: "mirror".to_string(),
        backup_path: "D:\\Backups\\slot".to_string(),
        save_path: "D:\\Games\\VN\\save".to_string(),
        backup_file_count: 3,
        current_file_count: 2,
        new_files: 1,
        overwritten_files: 1,
        kept_files: 0,
        removed_files: 2,
        sample_new_files: vec!["new.dat".to_string()],
        sample_overwritten_files: vec!["slot1.dat".to_string()],
        sample_kept_files: Vec::new(),
        sample_removed_files: vec!["old.dat".to_string()],
    };

    let lines = restore_preview_log_lines(&preview, "D:\\Protection\\before-restore");

    assert!(lines.iter().any(|line| line.contains("存档恢复模式：镜像")));
    assert!(lines.iter().any(|line| line.contains("新增 1，覆盖 1，保留 0，清理 2")));
    assert!(lines.iter().any(|line| line.contains("新增样例：new.dat")));
    assert!(lines.iter().any(|line| line.contains("覆盖样例：slot1.dat")));
    assert!(lines.iter().any(|line| line.contains("清理样例：old.dat")));
    assert!(lines.iter().any(|line| line.contains("保护备份：D:\\Protection\\before-restore")));
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
cd src-tauri
cargo test services::saves::tests::restore_preview_log_lines_include_counts_samples_and_paths
```

Expected: fails because `restore_preview_log_lines` does not exist.

- [ ] **Step 3: Implement restore preview log helper**

Add helper functions near `restore_mode_label`:

```rust
fn restore_preview_log_lines(preview: &SaveRestorePreview, protection_path: &str) -> Vec<String> {
    let mut lines = vec![
        format!("存档恢复模式：{}", restore_mode_label(&preview.mode)),
        format!("备份来源：{}", preview.backup_path),
        format!("恢复目标：{}", preview.save_path),
        format!(
            "存档恢复差异：备份 {}，当前 {}，新增 {}，覆盖 {}，保留 {}，清理 {}。",
            preview.backup_file_count,
            preview.current_file_count,
            preview.new_files,
            preview.overwritten_files,
            preview.kept_files,
            preview.removed_files
        ),
    ];
    push_sample_line(&mut lines, "新增样例", &preview.sample_new_files);
    push_sample_line(&mut lines, "覆盖样例", &preview.sample_overwritten_files);
    push_sample_line(&mut lines, "保留样例", &preview.sample_kept_files);
    push_sample_line(&mut lines, "清理样例", &preview.sample_removed_files);
    lines.push(format!("保护备份：{protection_path}"));
    lines
}

fn push_sample_line(lines: &mut Vec<String>, label: &str, samples: &[String]) {
    if !samples.is_empty() {
        lines.push(format!("{label}：{}", samples.join("，")));
    }
}
```

- [ ] **Step 4: Use helper in save restore task**

Inside `enqueue_save_restore_task`, before `restore_files_from_backup`, compute preview and append lines:

```rust
let preview = preview_restore_files(
    Path::new(&backup.backup_path),
    Path::new(&save_path.path),
    &mode,
)?;
for line in restore_preview_log_lines(&preview, &protection.backup_path) {
    db.append_task_log(&task_id, "info", &line)?;
}
```

Keep the existing protection backup log and final restore report log.

- [ ] **Step 5: Run focused Rust tests**

Run:

```powershell
cd src-tauri
cargo test services::saves::tests::restore_preview_log_lines_include_counts_samples_and_paths services::saves::tests::restore_entry_creates_protection_backup_record_before_copying_files
```

Expected: both tests pass.

- [ ] **Step 6: Commit save restore logs**

```powershell
git add src-tauri/src/services/saves.rs
git commit -m "feat: log save restore diff details"
```

---

### Task 3: Task Diagnostic Markdown Copy

**Files:**
- Create: `src/pages/Tasks/taskDiagnostics.ts`
- Modify: `src/pages/Tasks/TasksPage.tsx`

- [ ] **Step 1: Write diagnostic formatter**

Create `src/pages/Tasks/taskDiagnostics.ts`:

```ts
import type { TaskLogEntry, TaskRecord } from '@/types/task';
import { taskLabel, taskStatusLabel } from '@/utils/taskLabels';
import { formatDateTime } from '@/utils/time';

export function buildTaskDiagnosticMarkdown(task: TaskRecord, logs: TaskLogEntry[] = []) {
  const lines = [
    `# MikaVN Task Diagnostic`,
    ``,
    `- ID: ${task.id}`,
    `- Type: ${taskLabel(task.taskType)} (${task.taskType})`,
    `- Status: ${taskStatusLabel(task.status)} (${task.status})`,
    `- Progress: ${Math.round(boundedProgress(task.progress) * 100)}%`,
    `- Created: ${formatDateTime(task.createdAt)}`,
    `- Updated: ${formatDateTime(task.updatedAt)}`,
  ];
  if (task.message) lines.push(`- Message: ${task.message}`);
  if (task.error) lines.push(`- Error: ${task.error}`);

  const suggestions = taskDiagnosticSuggestions(task, logs);
  if (suggestions.length > 0) {
    lines.push(``, `## Suggested Next Actions`, ...suggestions.map((item) => `- ${item}`));
  }

  if (logs.length > 0) {
    lines.push(``, `## Recent Logs`);
    for (const log of logs.slice(-20)) {
      lines.push(`- ${formatDateTime(log.createdAt)} [${log.level}] ${log.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function taskDiagnosticSuggestions(task: TaskRecord, logs: TaskLogEntry[] = []) {
  const text = [task.taskType, task.status, task.message, task.error, ...logs.map((log) => log.message)].filter(Boolean).join('\n').toLocaleLowerCase();
  const suggestions: string[] = [];
  if (task.status === 'failed' || task.status === 'cancelled') {
    suggestions.push('检查任务错误和最近日志；如果任务可重试，先确认路径和权限后再重试。');
  }
  if (task.taskType.includes('scan')) {
    suggestions.push('确认扫描目录仍存在、可读取，并检查冲突候选是否需要合并、替换或副本导入。');
  }
  if (task.taskType.includes('archive_import') || text.includes('跳过')) {
    suggestions.push('查看归档导入冲突日志；如只想补缺失条目，保留跳过项并重新导入缺失标题。');
  }
  if (task.taskType.includes('save.restore')) {
    suggestions.push('启动游戏确认存档可用；确认正常前保留恢复前保护备份。');
  }
  if (suggestions.length === 0) {
    suggestions.push('复制此摘要后，可在设置页查看本地诊断日志以继续排查。');
  }
  return [...new Set(suggestions)];
}

function boundedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
```

- [ ] **Step 2: Wire copy action into Tasks page**

In `TasksPage.tsx`, import the helper:

```ts
import { buildTaskDiagnosticMarkdown } from './taskDiagnostics';
```

Add a function near `copyTaskLog`:

```ts
async function copyTaskDiagnostic(task: TaskRecord) {
  setError(null);
  try {
    const logs = logsByTask[task.id] ?? await api.listTaskLogs(task.id);
    setLogsByTask((current) => ({ ...current, [task.id]: logs }));
    await navigator.clipboard.writeText(buildTaskDiagnosticMarkdown(task, logs));
    setMessage('已复制任务诊断摘要。');
  } catch (reason) {
    setError(errorMessage(reason));
  }
}
```

Add a button beside each task row action:

```tsx
<Button size="sm" variant="ghost" onClick={() => void copyTaskDiagnostic(task)}><Copy className="h-4 w-4" />诊断</Button>
```

Also add the same action in recent result cards next to the log button.

- [ ] **Step 3: Verify TypeScript build**

Run:

```powershell
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit task diagnostics**

```powershell
git add src/pages/Tasks/TasksPage.tsx src/pages/Tasks/taskDiagnostics.ts
git commit -m "feat: copy task diagnostic summaries"
```

---

### Task 4: Final Verification And Release Notes

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Optional modify: `docs/RELEASE_NOTES_0.1.1.md` only if treating this as part of 0.1.1.

- [ ] **Step 1: Update docs**

Add one bullet to README feature list:

```md
- Task diagnostics can copy Markdown summaries with status, errors, recent logs, and suggested next actions for recovery/conflict workflows
```

Update ROADMAP "Next Smallest Steps" so the completed first reporting slice is no longer listed as pending.

- [ ] **Step 2: Run full core validation**

Run:

```powershell
npm run release:validate:core
npm run release:handoff:check
git diff --check
```

Expected:

- script unit tests pass,
- frontend build passes,
- Rust fmt/clippy/tests pass,
- release handoff check passes,
- no whitespace errors.

- [ ] **Step 3: Commit docs and verification updates**

```powershell
git add README.md ROADMAP.md docs/RELEASE_NOTES_0.1.1.md
git commit -m "docs: record recovery reporting improvements"
```

---

## Execution Notes

- Keep commits small. If a task reveals a larger refactor need, stop and update this plan before changing unrelated files.
- Do not change release artifacts in `output/release/0.1.1-windows-x64/` for this feature slice.
- Do not introduce schema changes unless a current task cannot be completed through existing task logs and frontend formatting.
