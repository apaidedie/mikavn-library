# Large Library Performance Design

Date: 2026-06-20

## Context

MikaVN Library is now a real daily-use Windows app with a large local library:

- 4456 games;
- 23445 image cache files;
- 17738 media asset records.

The Library page already avoids rendering every game at once by using a "load more" window in `GameList` and `GameGrid`. It also has a large-library browser smoke that seeds 1500 preview records. The current weak spots are still on the hot path:

- the list view initially renders 500 rows, each with a cover component;
- cover images do not use native lazy loading or async decoding;
- the detail hero background image decodes eagerly when switching selection;
- filter state immediately drives `api.listGames`, so fast typing can trigger repeated list queries;
- the selected item can expand the render window if it is far beyond the initial budget.

This increment should make the current page more tolerant of 4000+ games without replacing the whole Library architecture.

## Goals

1. Reduce the Library sidebar initial render cost.
2. Make cover and hero images load more politely through native browser hints.
3. Debounce or defer user text filters before they trigger list queries.
4. Keep selected-game visibility behavior predictable without rendering thousands of rows by surprise.
5. Preserve existing Library behavior, bulk selection, list/grid modes, and smoke-test coverage.

## Non-Goals

- No full virtualized list/grid implementation in this increment.
- No database schema change.
- No server-side pagination.
- No rewrite of search repositories.
- No visual redesign of the Library page.

## Current State

Relevant files:

- `src/pages/Library/LibraryGameNav.tsx`
  - `GameList` initially renders `libraryListInitialRenderCount`.
  - `GameGrid` initially renders `libraryGridInitialRenderCount`.
  - Both render `CoverImage` for each visible item.
- `src/pages/Library/libraryPageModel.ts`
  - list initial count is 500;
  - list batch size is 500;
  - grid initial count is 160;
  - grid batch size is 160;
  - `getLibraryVisibleCount` forces the selected row into the render window.
- `src/components/ui/cover.tsx`
  - wraps image rendering but does not set `loading`, `decoding`, or fetch priority.
- `src/pages/Library/useLibraryFilters.ts`
  - builds the filter object directly from query, tag, and developer state.
- `src/pages/Library/useLibraryPageData.ts`
  - calls `api.listGames(filters.filter)` whenever the filter object changes.

## Recommended Approach

Use a low-risk first pass that improves the existing model:

1. Lower list initial render count from 500 to 240 and batch size from 500 to 240.
2. Keep grid initial render count at 160 because grid cards are heavier but already bounded.
3. Cap selected-item forced rendering to a reasonable "selected visibility budget" rather than expanding to thousands of rows.
4. Add `loading="lazy"` and `decoding="async"` to `CoverImage`, with an optional `loading` prop so detail-page primary images can stay eager if needed.
5. Add `decoding="async"` to the detail hero background and keep only the visible hero eager.
6. Debounce text-like filters (`query`, `tag`, `developer`) before building the API filter object.

This gives immediate performance relief while preserving user workflows and leaving full virtualization as a later increment.

## Alternatives Considered

1. Full virtualized list/grid now.
   - Benefit: best long-term scrolling performance.
   - Cost: larger UI rewrite with higher risk around grouping, selected item visibility, bulk selection, and screenshots.
   - Decision: defer to a second increment after the low-risk hot path is stable.

2. Server-side pagination now.
   - Benefit: reduces memory and payload size.
   - Cost: bigger backend/API contract change and more UI state.
   - Decision: defer; current data volume is still manageable if rendering and image loading are controlled.

3. Only add lazy images.
   - Benefit: smallest change.
   - Cost: does not reduce DOM and repeated query work.
   - Decision: insufficient alone.

## Frontend Design

### CoverImage

Extend `CoverImage` props:

- `loading?: 'lazy' | 'eager'`;
- `decoding?: 'async' | 'sync' | 'auto'`.

Default:

- `loading = 'lazy'`;
- `decoding = 'async'`.

Existing callers automatically get lazy loading. Detail hero poster can pass `loading="eager"` only when the image is primary and above the fold.

### Library Render Window

Update model constants:

- list initial render count: 240;
- list render batch size: 240;
- grid initial render count: 160;
- grid batch size: 160;
- selected visibility expansion cap: 960.

Update `getLibraryVisibleCount(totalCount, renderCount, selectedIndex)`:

- if selected item is within the current render window, keep current behavior;
- if selected item is outside but within the cap, include it;
- if selected item is far beyond the cap, keep the cap and rely on filtering/search or explicit load more.

This avoids rendering 4000+ rows just because selection points near the end after a data refresh.

### Filter Debounce

Add a small hook or helper in `useLibraryFilters`:

- debounce query, tag, and developer by 180 ms;
- use debounced values in the `filter` object;
- keep raw values in inputs so typing feels immediate.

Advanced boolean/select filters can update immediately because they are discrete actions.

## Testing Plan

Node/source tests:

- `libraryPageModel` verifies the lower list counts and selected expansion cap.
- `image-src` or new source test verifies `CoverImage` includes `loading` and `decoding`.
- Source test verifies `useLibraryFilters` uses debounced query/tag/developer values.

Existing tests:

- `npm run test:library-page-model`;
- `npm run test:image-src`;
- `npm run typecheck`;
- `npm run build`;
- `npm run smoke:large` if local resources allow.

Manual smoke:

- open Library with the real installed data;
- confirm list and grid still select games;
- confirm images still display;
- confirm search input remains responsive.

## Acceptance Criteria

1. Library list initial render budget is lower and explicit.
2. Selecting a far-off item no longer forces rendering thousands of rows.
3. Cover images lazy-load and decode asynchronously by default.
4. Detail hero image decodes asynchronously.
5. Text filter queries are debounced before calling `api.listGames`.
6. Existing Library tests, typecheck, and build pass.
7. The large-library smoke remains available and should pass when run.

## Spec Self-Review

- No placeholders remain.
- Scope is limited to low-risk frontend hot-path performance.
- Full virtualization and server-side pagination are intentionally deferred.
- The design preserves existing behavior while reducing accidental render and image-load pressure.
