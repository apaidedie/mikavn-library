# Large Library Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Library page render and image-loading pressure for a 4000+ game local library.

**Architecture:** Keep the existing Library page architecture and harden hot paths: lower list render budgets, cap selected-item expansion, add native image loading hints, and debounce text filters before API queries. Use source/model tests to prove the behavior before changing implementation.

**Tech Stack:** React, TypeScript, Node `node:test`, Vite build, existing Library page model tests.

---

## File Structure

- Modify `src/pages/Library/libraryPageModel.ts`: render budgets and selected expansion cap.
- Modify `scripts/library-page-model.test.cjs`: assertions for new budgets and selected cap.
- Modify `src/components/ui/cover.tsx`: native image `loading` and `decoding` props.
- Create `scripts/cover-image-performance.test.cjs`: source test for image loading hints.
- Modify `src/pages/Library/GameDetailHero.tsx`: async hero image decoding and eager above-fold cover.
- Modify `src/pages/Library/useLibraryFilters.ts`: debounced query/tag/developer values in API filter.
- Create `scripts/library-filter-performance.test.cjs`: source test for debounced filter values.
- Modify `package.json`: add `test:library-performance`.

## Task 1: Library Render Budget Model

**Files:**
- Modify: `src/pages/Library/libraryPageModel.ts`
- Modify: `scripts/library-page-model.test.cjs`

- [ ] **Step 1: Write failing model tests**

Append to `scripts/library-page-model.test.cjs`:

```javascript
test('library render budgets keep large sidebars bounded', () => {
  const {
    libraryListInitialRenderCount,
    libraryListRenderBatchSize,
    libraryGridInitialRenderCount,
    libraryGridRenderBatchSize,
    librarySelectedRenderExpansionCap,
  } = loadLibraryPageModel();

  assert.equal(libraryListInitialRenderCount, 240);
  assert.equal(libraryListRenderBatchSize, 240);
  assert.equal(libraryGridInitialRenderCount, 160);
  assert.equal(libraryGridRenderBatchSize, 160);
  assert.equal(librarySelectedRenderExpansionCap, 960);
});

test('getLibraryVisibleCount caps far selected items instead of rendering thousands', () => {
  const { getLibraryVisibleCount } = loadLibraryPageModel();

  assert.equal(getLibraryVisibleCount(5000, 240, 300), 301);
  assert.equal(getLibraryVisibleCount(5000, 240, 4000), 960);
  assert.equal(getLibraryVisibleCount(5000, 1200, 4000), 1200);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm run test:library-page-model
```

Expected: FAIL because constants still use old values and no selected expansion cap exists.

- [ ] **Step 3: Implement model changes**

Update `src/pages/Library/libraryPageModel.ts`:

```ts
export const libraryListInitialRenderCount = 240;
export const libraryListRenderBatchSize = 240;
export const libraryGridInitialRenderCount = 160;
export const libraryGridRenderBatchSize = 160;
export const librarySelectedRenderExpansionCap = 960;
```

Update `getLibraryVisibleCount`:

```ts
export function getLibraryVisibleCount(totalCount: number, renderCount: number, selectedIndex: number) {
  const current = Math.min(totalCount, renderCount);
  if (selectedIndex < current) return current;
  const selectedTarget = selectedIndex + 1;
  return Math.min(totalCount, Math.max(current, Math.min(selectedTarget, librarySelectedRenderExpansionCap)));
}
```

- [ ] **Step 4: Run model tests**

Run:

```powershell
npm run test:library-page-model
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/Library/libraryPageModel.ts scripts/library-page-model.test.cjs
git commit -m "perf: bound library sidebar render window"
```

## Task 2: Image Loading Hints

**Files:**
- Modify: `src/components/ui/cover.tsx`
- Modify: `src/pages/Library/GameDetailHero.tsx`
- Create: `scripts/cover-image-performance.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing source test**

Create `scripts/cover-image-performance.test.cjs`:

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('CoverImage defaults to native lazy loading and async decoding', () => {
  const source = fs.readFileSync('src/components/ui/cover.tsx', 'utf8');

  assert.match(source, /loading = 'lazy'/);
  assert.match(source, /decoding = 'async'/);
  assert.match(source, /loading=\\{loading\\}/);
  assert.match(source, /decoding=\\{decoding\\}/);
});

test('library detail hero decodes images asynchronously', () => {
  const source = fs.readFileSync('src/pages/Library/GameDetailHero.tsx', 'utf8');

  assert.match(source, /decoding="async"/);
  assert.match(source, /loading="eager"/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
node --test scripts/cover-image-performance.test.cjs
```

Expected: FAIL because `CoverImage` and detail hero do not expose these hints.

- [ ] **Step 3: Implement image loading hints**

Update `src/components/ui/cover.tsx`:

```tsx
export function CoverImage({
  src,
  alt,
  className,
  blur = false,
  loading = 'lazy',
  decoding = 'async',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  blur?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
}) {
```

Update the `<img>`:

```tsx
<img alt={alt} className={cn('relative h-full w-full object-cover', blur && 'blur-md scale-105')} decoding={decoding} loading={loading} src={resolved} />
```

Update `src/pages/Library/GameDetailHero.tsx`:

```tsx
<img alt="" className={cn('absolute inset-x-0 top-0 h-[520px] w-full object-cover opacity-55', blurCover && 'scale-105 blur-md')} decoding="async" loading="eager" src={heroImage} />
```

Pass eager loading for the visible detail poster:

```tsx
<CoverImage ... loading="eager" />
```

- [ ] **Step 4: Add npm script and run tests**

Add to `package.json`:

```json
"test:library-performance": "node --test scripts/cover-image-performance.test.cjs scripts/library-filter-performance.test.cjs"
```

For this task, run:

```powershell
node --test scripts/cover-image-performance.test.cjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add package.json src/components/ui/cover.tsx src/pages/Library/GameDetailHero.tsx scripts/cover-image-performance.test.cjs
git commit -m "perf: lazy load library cover images"
```

## Task 3: Debounced Library Text Filters

**Files:**
- Modify: `src/pages/Library/useLibraryFilters.ts`
- Create: `scripts/library-filter-performance.test.cjs`

- [ ] **Step 1: Write failing source test**

Create `scripts/library-filter-performance.test.cjs`:

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('library filters debounce text inputs before building api filters', () => {
  const source = fs.readFileSync('src/pages/Library/useLibraryFilters.ts', 'utf8');

  assert.match(source, /useDebouncedValue/);
  assert.match(source, /debouncedQuery/);
  assert.match(source, /debouncedTag/);
  assert.match(source, /debouncedDeveloper/);
  assert.match(source, /query: debouncedQuery/);
  assert.match(source, /tag: debouncedTag\\.trim\\(\\) \\|\\| undefined/);
  assert.match(source, /developer: debouncedDeveloper\\.trim\\(\\) \\|\\| undefined/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
node --test scripts/library-filter-performance.test.cjs
```

Expected: FAIL because text filters are not debounced.

- [ ] **Step 3: Implement debounce helper**

Update import in `src/pages/Library/useLibraryFilters.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
```

Add helper above `useLibraryFilters`:

```ts
function useDebouncedValue<T>(value: T, delayMs = 180) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}
```

Inside `useLibraryFilters`, add:

```ts
const debouncedQuery = useDebouncedValue(query);
const debouncedTag = useDebouncedValue(tag);
const debouncedDeveloper = useDebouncedValue(developer);
```

Use debounced values in `filter`:

```ts
query: debouncedQuery,
tag: debouncedTag.trim() || undefined,
developer: debouncedDeveloper.trim() || undefined,
```

Update memo dependencies accordingly.

- [ ] **Step 4: Run performance tests**

Run:

```powershell
npm run test:library-performance
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/Library/useLibraryFilters.ts scripts/library-filter-performance.test.cjs package.json
git commit -m "perf: debounce library text filters"
```

## Task 4: Verification

**Files:** no code changes unless verification exposes a defect.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm run test:library-page-model
npm run test:library-performance
npm run typecheck
```

Expected: all pass.

- [ ] **Step 2: Run build**

Run:

```powershell
npm run build
```

Expected: pass.

- [ ] **Step 3: Run large library smoke if resources allow**

Run:

```powershell
npm run smoke:large
```

Expected: pass. If machine memory pressure prevents this, capture the exact error and do not claim the smoke passed.

- [ ] **Step 4: Push**

Run:

```powershell
git status --short --branch
git push origin main
```

Expected: push succeeds.

## Self-Review

Spec coverage:

- lower Library initial render cost: Task 1;
- selected render cap: Task 1;
- cover and hero image loading hints: Task 2;
- text filter debounce: Task 3;
- validation: Task 4.

No placeholders remain. Full virtualization and server-side pagination stay out of this first performance increment.
