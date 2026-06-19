# Personal Dashboard Design

## Context

MikaVN Library already covers the mature local V1 feature set: local game records, metadata matching, scanner import review, launch profiles, save backups, tasks, reports, maintenance, archives, diagnostics, and Windows packaging. The project is now more capable than a minimal personal app, so the next improvement should make the existing capability feel calmer and more useful for daily self-use instead of adding another large subsystem.

This phase turns the Dashboard into a personal Windows game-library control surface. It should answer three questions quickly:

- What can I continue playing?
- What needs attention before my library feels tidy and safe?
- Which common local actions should I run next?

## Goals

- Make the Dashboard the best first screen for a self-use Windows app.
- Surface recent or continue-worthy games without forcing the user into the full Library page first.
- Surface local-only attention items: broken or unchecked paths, missing artwork, missing external IDs, failed/running tasks, and backup/self-check shortcuts.
- Put common actions in one obvious place: add game, scan library, open maintenance, open tasks, and open settings/local data.
- Reuse existing frontend APIs and backend data. Avoid schema changes in this phase.
- Keep advanced features available, but make the daily path feel simpler.

## Non-Goals

- No cloud sync, accounts, plugin system, community workflows, or remote library service.
- No redesign of every page.
- No removal of existing advanced features.
- No database migration unless implementation discovers the Dashboard cannot get required facts from current APIs.
- No installer, signing, or release pipeline behavior changes.
- No visual hero/marketing landing page. The first screen remains the working app.

## User Experience

### Dashboard Structure

The Dashboard should be organized as a personal control panel:

1. **Today strip**
   - Shows compact library totals and attention totals.
   - Uses existing metrics when available: total games, playing/planned/completed counts, hidden-safe report behavior where applicable, and task attention counts.
   - Includes primary actions for add game and scan library.

2. **Continue and Recent**
   - Shows a short list of games that are most likely to be resumed.
   - Prefer games with `playStatus = playing`, recent `lastPlayedAt`, or nonzero playtime.
   - Each item opens the game detail through the existing `onOpenGame` callback.
   - If there are no useful candidates, show a quiet empty state with add/scan actions.

3. **Needs Attention**
   - Shows actionable library hygiene items instead of generic warnings:
     - broken or unchecked paths,
     - missing artwork,
     - missing external IDs,
     - failed tasks,
     - running tasks.
   - Each item links to the existing page that can resolve it: Library filter, Maintenance, Metadata, or Tasks.

4. **Local Safety**
   - Shows shortcuts into local self-use safety workflows:
     - database backup/settings,
     - save backup page,
     - app-data diagnostics/settings,
     - recent failed task logs.
   - It should not imply automatic cloud backup or account-based recovery.

### Visual Direction

The screen should stay compact and utility-focused. It may use the existing dark/light theme, accent colors, `PageShell`, `Panel`, `MetricTile`, and `SoftRow` primitives. It should avoid marketing-style hero copy, oversized banners, and nested cards.

### Navigation Behavior

Dashboard cards should use existing callbacks from `App.tsx`:

- `onOpenGame(id)` for game rows.
- `onOpenTasks(taskId?, preset?)` for task attention.
- `onOpenLibrary(preset?)` may be added to Dashboard props if needed, matching the existing Reports/Maintenance pattern.
- `onOpenMaintenance(section?)` and `onOpenMetadata(preset?)` may be added if the Dashboard needs direct resolution shortcuts.
- Settings shortcuts can use a new lightweight callback only if implementation needs it; otherwise use existing navigation affordances.

## Architecture

This phase is primarily frontend composition. The current backend already exposes enough primitives:

- `api.getDashboard()` for aggregate dashboard data.
- `api.listGames(filter)` for recent/playing/missing metadata/path filtered rows.
- `api.listTasks(limit)` or `api.getTaskDetail(id)` for task attention.
- `api.listLibraryRoots()` if scan shortcuts need to know whether roots exist.
- `api.getAppDataDiagnostics()` only if a local safety panel needs current app-data facts.

Implementation should keep data shaping near the Dashboard page unless a helper is reusable and test-worthy. Suggested frontend boundaries:

- `DashboardPage.tsx` remains the page owner.
- Add a small `dashboardPersonal.ts` helper only for deterministic ranking/classification logic, such as "continue game" ordering and attention item derivation.
- Keep command calls in `api.ts`; components must not call Tauri `invoke()` directly.

No Rust command should be added unless current APIs prove insufficient.

## Data Flow

1. Dashboard loads aggregate dashboard data as it already does.
2. Dashboard loads a small set of game lists for resume and attention panels.
3. Dashboard loads recent tasks to classify failed/running/attention states.
4. Helper functions rank games and derive action items.
5. User clicks route through existing `App.tsx` callbacks into Library, Maintenance, Metadata, Tasks, Saves, or Settings.

All fallback and browser preview behavior should continue working through `mockStore`.

## Error Handling

- If a secondary panel fails to load, keep the rest of the Dashboard usable.
- Show concise inline notices for failed data sections.
- Empty states should be actionable, not explanatory essays.
- Task and path warnings should not claim files were changed. The Dashboard only points to existing repair flows.
- Privacy settings must still be respected where current APIs and pages already enforce them. The Dashboard should avoid exposing hidden entries if `privacy_hide_hidden` is enabled.

## Testing

Follow TDD for behavior changes.

Recommended tests and checks:

- Add Node or TypeScript test coverage for any extracted ranking/classification helper.
- Verify the helper ranks `playing` and recently played games ahead of older completed records.
- Verify attention derivation creates deterministic items for failed tasks, broken paths, missing artwork, and missing external IDs.
- Run `npm run build` after implementation.
- If Dashboard navigation or page smoke expectations change, run `npm run smoke:browser`.

## Acceptance Criteria

- Dashboard first screen presents a personal daily workflow rather than only generic metrics.
- Continue/recent game rows are visible and open the selected game detail.
- Attention items link to existing resolution surfaces.
- Common local actions include add game and scan/open scanner at minimum.
- Dashboard remains usable in browser preview mode.
- No database migration is introduced for this phase.
- Existing advanced pages remain reachable.
- `npm run build` passes after implementation.

## Spec Self-Review

- No unfinished markers remain.
- Scope is limited to the personal Dashboard and routing needed to support it.
- The design preserves local-first self-use boundaries and avoids cloud/plugin/product expansion.
- Testing expectations are explicit and tied to implementation risk.
