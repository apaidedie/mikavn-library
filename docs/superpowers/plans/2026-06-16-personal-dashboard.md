# Personal Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Dashboard into a personal daily control surface for a self-use Windows game library.

**Architecture:** Keep this phase frontend-only. Extract deterministic Dashboard ranking/attention logic into a small helper that can be unit-tested from Node, then compose the existing Dashboard page from current APIs and existing App callbacks.

**Tech Stack:** React 19, TypeScript, Tauri command wrapper in `src/services/api.ts`, Node `node:test`, existing Playwright smoke runner, existing UI primitives from `src/components/ui/page.tsx`.

---

## File Structure

- Create `src/pages/Dashboard/dashboardPersonal.ts`
  - Owns pure helper functions for continue-game ranking and Dashboard attention item derivation.
  - Imports only types from `src/types/*`, so it remains easy to test through a Node transpile harness.
- Create `scripts/dashboard-personal-helper.test.cjs`
  - Uses `node:test` and the installed `typescript` package to transpile and execute `dashboardPersonal.ts`.
  - Tests real helper source, not copied logic.
- Modify `package.json`
  - Add `test:dashboard-personal` for the helper tests.
- Modify `scripts/playwright/page-qa-runner.cjs`
  - Add a Dashboard smoke assertion for the new personal Dashboard labels and action text.
- Modify `src/app/App.tsx`
  - Pass Dashboard callbacks for add game, open scanner, open library presets, open maintenance, open metadata, open saves, and open settings.
- Modify `src/pages/Dashboard/DashboardPage.tsx`
  - Load current Dashboard data, settings, diagnostics, tasks, and playing games.
  - Render Today strip, Continue/Recent, Needs Attention, Local Safety, and Recent Tasks using existing UI primitives.

Do not add Rust commands, database migrations, cloud sync, accounts, plugin features, installer changes, or release workflow changes.

---

### Task 1: Add Personal Dashboard Helper Tests

**Files:**
- Create: `scripts/dashboard-personal-helper.test.cjs`
- Create later in Task 2: `src/pages/Dashboard/dashboardPersonal.ts`
- Modify later in Task 2: `package.json`

- [ ] **Step 1: Write the failing helper test**

Create `scripts/dashboard-personal-helper.test.cjs` with this content:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadDashboardPersonal() {
  const sourcePath = path.join(__dirname, '..', 'src', 'pages', 'Dashboard', 'dashboardPersonal.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function('module', 'exports', transpiled);
  fn(module, module.exports);
  return module.exports;
}

function game(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    aliases: [],
    tags: [],
    genres: [],
    playStatus: overrides.playStatus ?? 'planned',
    favorite: false,
    hidden: overrides.hidden ?? false,
    installPath: `D:\\Games\\${overrides.id}`,
    pathStatus: overrides.pathStatus ?? 'ok',
    coverImage: overrides.coverImage ?? null,
    bannerImage: overrides.bannerImage ?? null,
    backgroundImage: overrides.backgroundImage ?? null,
    vndbId: overrides.vndbId ?? null,
    bangumiId: overrides.bangumiId ?? null,
    dlsiteId: overrides.dlsiteId ?? null,
    fanzaId: overrides.fanzaId ?? null,
    ymgalId: overrides.ymgalId ?? null,
    totalPlaySeconds: overrides.totalPlaySeconds ?? 0,
    lastPlayedAt: overrides.lastPlayedAt ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

function task(overrides) {
  return {
    id: overrides.id,
    taskType: overrides.taskType ?? 'scan.directory',
    status: overrides.status,
    progress: overrides.progress ?? 0,
    message: overrides.message ?? null,
    error: overrides.error ?? null,
    retryable: overrides.retryable ?? false,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

test('rankContinueGames prefers playing, recent, and played games while hiding hidden entries', () => {
  const { rankContinueGames } = loadDashboardPersonal();
  const ranked = rankContinueGames([
    game({ id: 'completed-old', playStatus: 'completed', totalPlaySeconds: 100, lastPlayedAt: '2026-01-01T00:00:00.000Z' }),
    game({ id: 'hidden-playing', playStatus: 'playing', hidden: true, lastPlayedAt: '2026-06-01T00:00:00.000Z' }),
    game({ id: 'planned-new', playStatus: 'planned', createdAt: '2026-06-02T00:00:00.000Z' }),
    game({ id: 'playing-recent', playStatus: 'playing', totalPlaySeconds: 60, lastPlayedAt: '2026-06-10T00:00:00.000Z' }),
    game({ id: 'paused-played', playStatus: 'paused', totalPlaySeconds: 7200, lastPlayedAt: '2026-06-09T00:00:00.000Z' }),
  ], { hideHidden: true, limit: 3 });

  assert.deepEqual(ranked.map((item) => item.id), ['playing-recent', 'paused-played', 'completed-old']);
});

test('deriveDashboardAttentionItems creates deterministic local action items', () => {
  const { deriveDashboardAttentionItems } = loadDashboardPersonal();
  const items = deriveDashboardAttentionItems({
    diagnostics: {
      database: {
        metadataCoverage: {
          missingCoverCount: 2,
          missingBannerCount: 1,
          missingBackgroundCount: 0,
          missingExternalIdCount: 4,
        },
        pathStatus: {
          brokenCount: 1,
          incompleteCount: 2,
          uncheckedCount: 3,
        },
      },
      databaseBackups: {
        fileCount: 0,
      },
    },
    tasks: [
      task({ id: 'failed-task', status: 'failed', error: 'scan failed', retryable: true }),
      task({ id: 'running-task', status: 'running', progress: 0.4 }),
      task({ id: 'done-task', status: 'completed', progress: 1 }),
    ],
  });

  assert.deepEqual(items.map((item) => item.kind), [
    'failed_tasks',
    'running_tasks',
    'path_health',
    'missing_artwork',
    'missing_external_ids',
    'database_backup',
  ]);
  assert.equal(items.find((item) => item.kind === 'path_health').count, 6);
  assert.equal(items.find((item) => item.kind === 'missing_artwork').count, 3);
  assert.equal(items.find((item) => item.kind === 'missing_external_ids').count, 4);
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```powershell
node --test scripts/dashboard-personal-helper.test.cjs
```

Expected:

```text
not ok ... ENOENT ... dashboardPersonal.ts
```

This confirms the test is looking for the helper that does not exist yet.

---

### Task 2: Implement Helper And Test Script

**Files:**
- Create: `src/pages/Dashboard/dashboardPersonal.ts`
- Modify: `package.json`
- Test: `scripts/dashboard-personal-helper.test.cjs`

- [ ] **Step 1: Add the helper implementation**

Create `src/pages/Dashboard/dashboardPersonal.ts` with this content:

```ts
import type { AppDataDiagnostics } from '@/types/archive';
import type { Game } from '@/types/game';
import type { TaskRecord } from '@/types/task';

export type DashboardAttentionKind =
  | 'failed_tasks'
  | 'running_tasks'
  | 'path_health'
  | 'missing_artwork'
  | 'missing_external_ids'
  | 'database_backup';

export type DashboardAttentionItem = {
  kind: DashboardAttentionKind;
  title: string;
  detail: string;
  count: number;
  tone: 'danger' | 'warning' | 'info';
  action: 'tasks_attention' | 'tasks_active' | 'library_paths' | 'maintenance_artwork' | 'metadata_missing_ids' | 'settings_local';
};

type RankOptions = {
  hideHidden?: boolean;
  limit?: number;
};

type AttentionInput = {
  diagnostics?: Pick<AppDataDiagnostics, 'database' | 'databaseBackups'> | null;
  tasks: TaskRecord[];
};

export function rankContinueGames(games: Game[], options: RankOptions = {}) {
  const limit = options.limit ?? 6;
  return [...games]
    .filter((game) => !options.hideHidden || !game.hidden)
    .filter((game) => game.playStatus === 'playing' || game.lastPlayedAt || game.totalPlaySeconds > 0)
    .sort((a, b) => continueScore(b) - continueScore(a))
    .slice(0, limit);
}

export function deriveDashboardAttentionItems(input: AttentionInput): DashboardAttentionItem[] {
  const failedTasks = input.tasks.filter((task) => task.status === 'failed' || task.status === 'cancelled').length;
  const runningTasks = input.tasks.filter((task) => task.status === 'pending' || task.status === 'running').length;
  const pathStatus = input.diagnostics?.database.pathStatus;
  const metadata = input.diagnostics?.database.metadataCoverage;
  const backupCount = input.diagnostics?.databaseBackups.fileCount ?? 0;
  const pathIssueCount = (pathStatus?.brokenCount ?? 0) + (pathStatus?.incompleteCount ?? 0) + (pathStatus?.uncheckedCount ?? 0);
  const missingArtworkCount = (metadata?.missingCoverCount ?? 0) + (metadata?.missingBannerCount ?? 0) + (metadata?.missingBackgroundCount ?? 0);
  const missingExternalIdCount = metadata?.missingExternalIdCount ?? 0;
  const items: DashboardAttentionItem[] = [];

  if (failedTasks > 0) {
    items.push({
      kind: 'failed_tasks',
      title: '任务需要处理',
      detail: `${failedTasks} 个任务失败或已取消，建议先查看日志。`,
      count: failedTasks,
      tone: 'danger',
      action: 'tasks_attention',
    });
  }

  if (runningTasks > 0) {
    items.push({
      kind: 'running_tasks',
      title: '任务正在进行',
      detail: `${runningTasks} 个任务仍在运行或等待。`,
      count: runningTasks,
      tone: 'info',
      action: 'tasks_active',
    });
  }

  if (pathIssueCount > 0) {
    items.push({
      kind: 'path_health',
      title: '路径需要复核',
      detail: `${pathIssueCount} 个路径未检查、不完整或异常。`,
      count: pathIssueCount,
      tone: pathStatus?.brokenCount ? 'danger' : 'warning',
      action: 'library_paths',
    });
  }

  if (missingArtworkCount > 0) {
    items.push({
      kind: 'missing_artwork',
      title: '媒体素材不完整',
      detail: `${missingArtworkCount} 个封面、横幅或背景缺口。`,
      count: missingArtworkCount,
      tone: 'warning',
      action: 'maintenance_artwork',
    });
  }

  if (missingExternalIdCount > 0) {
    items.push({
      kind: 'missing_external_ids',
      title: '外部 ID 缺失',
      detail: `${missingExternalIdCount} 个条目缺少 VNDB / DLsite / FANZA 等外部 ID。`,
      count: missingExternalIdCount,
      tone: 'warning',
      action: 'metadata_missing_ids',
    });
  }

  if (backupCount === 0) {
    items.push({
      kind: 'database_backup',
      title: '还没有数据库备份',
      detail: '建议先做一次本地数据库备份，之后再批量整理。',
      count: 0,
      tone: 'info',
      action: 'settings_local',
    });
  }

  return items;
}

function continueScore(game: Game) {
  const statusScore = game.playStatus === 'playing' ? 1_000_000_000_000_000 : game.playStatus === 'paused' ? 700_000_000_000_000 : 0;
  const playedScore = Math.min(game.totalPlaySeconds, 500 * 60 * 60) * 1000;
  return statusScore + dateMillis(game.lastPlayedAt ?? game.updatedAt ?? game.createdAt) + playedScore;
}

function dateMillis(value?: string | null) {
  if (!value) return 0;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
}
```

- [ ] **Step 2: Add a package script**

In `package.json`, add this script entry near the other test scripts:

```json
"test:dashboard-personal": "node --test scripts/dashboard-personal-helper.test.cjs",
```

- [ ] **Step 3: Run the helper test to verify it passes**

Run:

```powershell
npm run test:dashboard-personal
```

Expected:

```text
# tests 2
# pass 2
# fail 0
```

- [ ] **Step 4: Commit helper and tests**

Run:

```powershell
git add package.json scripts/dashboard-personal-helper.test.cjs src/pages/Dashboard/dashboardPersonal.ts
git commit -m "test: cover personal dashboard helpers"
```

---

### Task 3: Add Browser Smoke Coverage For Dashboard Surface

**Files:**
- Modify: `scripts/playwright/page-qa-runner.cjs`

- [ ] **Step 1: Add the failing Dashboard smoke assertion**

In `scripts/playwright/page-qa-runner.cjs`, find the existing Dashboard or first-page QA section. Add this assertion after the app has loaded and before leaving the Dashboard:

```js
await page.getByTitle('MikaVN').click();
for (const text of ['今日状态', '继续游玩', '需要关注', '本地安全', '添加游戏', '扫描入库']) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 5000 });
}
```

If the file is not using Playwright's `expect`, add this local helper near the top of the file:

```js
async function expectTextVisible(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: 'visible', timeout: 5000 });
}
```

Then use:

```js
await page.getByTitle('MikaVN').click();
for (const text of ['今日状态', '继续游玩', '需要关注', '本地安全', '添加游戏', '扫描入库']) {
  await expectTextVisible(page, text);
}
```

- [ ] **Step 2: Run smoke to verify it fails before UI implementation**

Run:

```powershell
npm run smoke:browser
```

Expected failure includes one of the new missing labels such as:

```text
Timeout ... 今日状态
```

- [ ] **Step 3: Commit only if the failing assertion is intentionally preserved for Task 4**

Do not commit a red smoke test by itself. Leave this change unstaged until Task 4 makes it pass.

---

### Task 4: Wire App Navigation Callbacks Into Dashboard

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/pages/Dashboard/DashboardPage.tsx`

- [ ] **Step 1: Extend Dashboard props**

In `src/pages/Dashboard/DashboardPage.tsx`, replace the props type with:

```ts
type DashboardPageProps = {
  refreshKey: number;
  onOpenGame: (id: string) => void;
  onAddGame?: () => void;
  onOpenScanner?: () => void;
  onOpenLibrary?: (preset?: LibraryFilterPreset | null) => void;
  onOpenMaintenance?: (section?: string | null) => void;
  onOpenMetadata?: (preset?: { query?: string; missingProvider?: string } | null) => void;
  onOpenSaves?: () => void;
  onOpenSettings?: () => void;
  onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void;
};
```

Add this type import:

```ts
import type { DashboardData, Game, LibraryFilterPreset } from '@/types/game';
```

- [ ] **Step 2: Pass callbacks from App**

In `src/app/App.tsx`, add these callbacks near the existing `openMetadata` function:

```ts
const openScanner = useCallback(() => {
  setView('scanner');
}, []);

const openSaves = useCallback(() => {
  setView('saves');
}, []);

const openSettings = useCallback(() => {
  setView('settings');
}, []);
```

Replace the Dashboard render line with:

```tsx
{view === 'dashboard' && (
  <DashboardPage
    refreshKey={refreshKey}
    onOpenGame={openGame}
    onAddGame={requestAddGame}
    onOpenScanner={openScanner}
    onOpenLibrary={openLibrary}
    onOpenMaintenance={openMaintenance}
    onOpenMetadata={openMetadata}
    onOpenSaves={openSaves}
    onOpenSettings={openSettings}
    onOpenTasks={openTasks}
  />
)}
```

- [ ] **Step 3: Run TypeScript check**

Run:

```powershell
npm run typecheck
```

Expected:

```text
no TypeScript errors
```

Do not commit yet; Task 5 completes the UI that consumes these props.

---

### Task 5: Implement Personal Dashboard UI

**Files:**
- Modify: `src/pages/Dashboard/DashboardPage.tsx`
- Uses: `src/pages/Dashboard/dashboardPersonal.ts`

- [ ] **Step 1: Update imports**

Replace the Dashboard icon import with:

```ts
import { Activity, AlertTriangle, Archive, Clock3, Database, FolderSearch, Gamepad2, HardDrive, ImageOff, ListChecks, Plus, RotateCcw, Search, ShieldCheck, Trophy, Wrench } from 'lucide-react';
```

Add these imports:

```ts
import type { AppDataDiagnostics } from '@/types/archive';
import { deriveDashboardAttentionItems, rankContinueGames, type DashboardAttentionItem } from './dashboardPersonal';
```

- [ ] **Step 2: Add state and data loading**

Inside `DashboardPage`, add state:

```ts
const [playingGames, setPlayingGames] = useState<Game[]>([]);
const [settings, setSettings] = useState<Record<string, string>>({});
const [diagnostics, setDiagnostics] = useState<AppDataDiagnostics | null>(null);
const [sectionErrors, setSectionErrors] = useState<string[]>([]);
```

Replace the current `useEffect` body with:

```ts
useEffect(() => {
  let cancelled = false;
  const errors: string[] = [];

  api
    .getDashboard()
    .then((next) => {
      if (!cancelled) {
        setData(next);
        setError(null);
      }
    })
    .catch((reason: unknown) => {
      if (!cancelled) setError(errorMessage(reason));
    });

  api.listTasks(8).then((next) => !cancelled && setTasks(next)).catch(() => !cancelled && setTasks([]));
  api.getAppSettings().then((next) => !cancelled && setSettings(next)).catch(() => undefined);
  api.getAppDataDiagnostics()
    .then((next) => !cancelled && setDiagnostics(next))
    .catch((reason: unknown) => {
      errors.push(`本地自检暂时不可用：${errorMessage(reason)}`);
      if (!cancelled) setSectionErrors([...errors]);
    });
  api.listGames({ status: 'playing', sortBy: 'last_played_at', sortDirection: 'desc' })
    .then((next) => !cancelled && setPlayingGames(next))
    .catch((reason: unknown) => {
      errors.push(`继续游玩列表暂时不可用：${errorMessage(reason)}`);
      if (!cancelled) setSectionErrors([...errors]);
    });

  return () => {
    cancelled = true;
  };
}, [refreshKey]);
```

- [ ] **Step 3: Derive Dashboard presentation data**

After the loading guard and before `return`, add:

```ts
const hideHidden = settings.privacy_hide_hidden === 'true';
const continueGames = rankContinueGames([...playingGames, ...data.recentGames, ...data.recentlyAdded], { hideHidden, limit: 6 });
const attentionItems = deriveDashboardAttentionItems({ diagnostics, tasks });
const runningCount = tasks.filter((task) => task.status === 'pending' || task.status === 'running').length;
const attentionCount = tasks.filter((task) => task.status === 'failed' || task.status === 'cancelled').length;
```

- [ ] **Step 4: Replace the top of the render with personal sections**

Inside `PageFrame`, before `RecentTasksPanel`, render:

```tsx
<TodayStrip
  data={data}
  attentionCount={attentionItems.length}
  runningCount={runningCount}
  onAddGame={onAddGame}
  onOpenScanner={onOpenScanner}
  onOpenTasks={onOpenTasks}
/>
{sectionErrors.length > 0 && (
  <div className="space-y-2">
    {sectionErrors.map((item) => <Notice key={item} tone="warning">{item}</Notice>)}
  </div>
)}
<div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
  <ContinuePanel games={continueGames} onOpenGame={onOpenGame} onAddGame={onAddGame} onOpenScanner={onOpenScanner} />
  <NeedsAttentionPanel items={attentionItems} onOpenLibrary={onOpenLibrary} onOpenMaintenance={onOpenMaintenance} onOpenMetadata={onOpenMetadata} onOpenSettings={onOpenSettings} onOpenTasks={onOpenTasks} />
</div>
<LocalSafetyPanel diagnostics={diagnostics} onOpenSaves={onOpenSaves} onOpenSettings={onOpenSettings} onOpenTasks={onOpenTasks} />
```

Remove the old generic metric grid, `最近游玩`, and `最近入库` sections from the Dashboard render. Keep `RecentTasksPanel`.

- [ ] **Step 5: Add the new Dashboard subcomponents**

Add these components below `RecentTasksPanel`:

```tsx
function TodayStrip({ data, attentionCount, runningCount, onAddGame, onOpenScanner, onOpenTasks }: { data: DashboardData; attentionCount: number; runningCount: number; onAddGame?: () => void; onOpenScanner?: () => void; onOpenTasks?: (taskId?: string | null, preset?: TaskFilterPreset | null) => void }) {
  return (
    <Panel>
      <PanelContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">今日状态</h2>
            <p className="mt-1 text-xs text-slate-500">先继续游戏，再处理本地路径、素材和任务提醒。</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onAddGame}><Plus className="h-4 w-4" />添加游戏</Button>
            <Button variant="outline" onClick={onOpenScanner}><FolderSearch className="h-4 w-4" />扫描入库</Button>
            {onOpenTasks && <Button variant="ghost" onClick={() => onOpenTasks(null, { statusFilter: 'attention' })}><Activity className="h-4 w-4" />任务</Button>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <MetricTile icon={<Gamepad2 className="h-4 w-4" />} label="游戏总数" value={`${data.totalGames}`} />
          <MetricTile icon={<Clock3 className="h-4 w-4" />} label="总游玩时间" value={formatPlayTime(data.totalPlaySeconds)} />
          <MetricTile icon={<ListChecks className="h-4 w-4" />} label="进行中" value={`${data.playingGames}`} />
          <MetricTile icon={<Trophy className="h-4 w-4" />} label="已通关" value={`${data.completedGames}`} />
          <MetricTile icon={<AlertTriangle className="h-4 w-4" />} label="待处理" value={`${attentionCount}`} detail={runningCount > 0 ? `${runningCount} 个任务进行中` : '本地提醒'} />
        </div>
      </PanelContent>
    </Panel>
  );
}

function ContinuePanel({ games, onOpenGame, onAddGame, onOpenScanner }: { games: Game[]; onOpenGame: (id: string) => void; onAddGame?: () => void; onOpenScanner?: () => void }) {
  return (
    <Panel>
      <PanelHeader title="继续游玩" description="优先显示进行中、最近玩过或有游玩时长的条目。" icon={<Gamepad2 className="h-4 w-4" />} />
      <PanelContent>
        {games.length === 0 ? (
          <EmptyState className="py-8">
            <div className="space-y-3">
              <div>还没有可继续的游戏。添加或扫描本地目录后，这里会变成你的启动入口。</div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={onAddGame}><Plus className="h-4 w-4" />添加游戏</Button>
                <Button size="sm" variant="outline" onClick={onOpenScanner}><FolderSearch className="h-4 w-4" />扫描入库</Button>
              </div>
            </div>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,148px)] justify-between gap-6 gap-y-9 pb-2">
            {games.map((game) => (
              <button className="group text-left" key={game.id} onClick={() => onOpenGame(game.id)} type="button">
                <div className="motion-poster relative overflow-hidden rounded-lg shadow-md shadow-black/25 group-hover:ring-2 group-hover:ring-[rgb(var(--accent-rgb))]">
                  <CoverImage alt={game.title} className="aspect-[2/3] w-[148px]" src={game.coverImage} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="media-overlay-text flex items-center justify-between gap-2 text-[11px]">
                      <span>{formatPlayTime(game.totalPlaySeconds)}</span>
                      <Badge className="min-h-5 px-2 text-[10px]">{PLAY_STATUS_LABEL[game.playStatus]}</Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-2 truncate text-center text-xs text-slate-200 group-hover:text-[rgb(var(--accent-rgb))]">{game.title}</div>
                <div className="mt-0.5 truncate text-center text-[11px] text-slate-500">{formatDateTime(game.lastPlayedAt ?? game.createdAt)}</div>
              </button>
            ))}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
```

Add `NeedsAttentionPanel`, `LocalSafetyPanel`, `AttentionIcon`, and `openAttentionItem` with the same action strings from `dashboardPersonal.ts`. Keep them local to `DashboardPage.tsx`.

- [ ] **Step 6: Run helper test and typecheck**

Run:

```powershell
npm run test:dashboard-personal
npm run typecheck
```

Expected:

```text
helper tests pass
no TypeScript errors
```

Do not commit yet; Task 6 completes smoke.

---

### Task 6: Make Browser Smoke Pass

**Files:**
- Modify: `src/pages/Dashboard/DashboardPage.tsx`
- Modify: `scripts/playwright/page-qa-runner.cjs`

- [ ] **Step 1: Run the browser smoke**

Run:

```powershell
npm run smoke:browser
```

Expected after Task 5:

```text
smoke:browser passes
```

- [ ] **Step 2: Fix only Dashboard-related failures**

If the smoke fails on Dashboard labels or actions, fix `DashboardPage.tsx` so these exact labels are visible:

```text
今日状态
继续游玩
需要关注
本地安全
添加游戏
扫描入库
```

Do not weaken the new smoke assertion unless the locator is flaky while the labels are visibly rendered.

- [ ] **Step 3: Commit Dashboard UI and smoke**

Run:

```powershell
git add src/app/App.tsx src/pages/Dashboard/DashboardPage.tsx scripts/playwright/page-qa-runner.cjs
git commit -m "feat: polish personal dashboard"
```

---

### Task 7: Final Build Verification

**Files:**
- Verify: entire frontend

- [ ] **Step 1: Run production build**

Run:

```powershell
npm run build
```

Expected:

```text
TypeScript check passes
Vite production build completes
release chunk checks pass
```

- [ ] **Step 2: Run helper test again**

Run:

```powershell
npm run test:dashboard-personal
```

Expected:

```text
# tests 2
# pass 2
# fail 0
```

- [ ] **Step 3: Check git status**

Run:

```powershell
git status --short
```

Expected:

```text
clean working tree or only intentional uncommitted verification artifacts under output/
```

No extra commit is needed if Tasks 2 and 6 already committed all source changes.

---

## Self-Review

- Spec coverage:
  - Today strip: Task 5.
  - Continue/recent ranking: Tasks 1, 2, and 5.
  - Needs Attention: Tasks 1, 2, and 5.
  - Local Safety: Task 5.
  - Common actions: Tasks 4 and 5.
  - Browser preview support: Tasks 5 and 6 use existing mockStore APIs.
  - No schema/Rust changes: File structure excludes Rust and DB files.
  - Build verification: Task 7.
- Unfinished-marker scan: no unfinished markers are used as implementation instructions.
- Type consistency: `DashboardAttentionItem`, action strings, `Game`, `TaskRecord`, `AppDataDiagnostics`, and callback prop names are defined before use.
