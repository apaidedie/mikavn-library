# MikaVN Library Design Baseline

This document turns `galgame-library-codex-brief.md` into project-local UI rules. The goal is a Windows-first Galgame/VN library manager with an immersive library/detail surface and calm utility workflows.

## Product UI Direction

- Library and detail pages should feel Vnite-like: media-first, dark layered, compact, and attractive.
- Import, metadata, save backup, reports, and settings should feel PotatoVN-like: clear rows, command bars, calm panels, and visible state.
- Vnite and PotatoVN are references only. Do not copy GPL/source code/assets/icons/fonts/screenshots/business content.

## Layout Tokens

- Rail width: 56px.
- Library side panel: 320px to 368px. Current implementation uses 23rem.
- Poster aspect ratio: 2:3.
- Detail hero minimum height: 17rem.
- Main content max width: 76rem to 88rem depending on page density.
- Compact control height: 32px.
- Standard control height: 36px.

## Color Tokens

Current implementation keeps tokens in `src/style.css`.

- `--app-bg`: app window background.
- `--panel-rgb`: base panel surface.
- `--panel-strong-rgb`: elevated panel/dialog surface.
- `--app-border`: common border color.
- `--accent-rgb`: theme accent.
- `--accent-strong-rgb`: stronger accent for posters and primary actions.
- `--accent-contrast`: text on accent.

Required semantic groups for future extraction:

- background, surface-1, surface-2, surface-3, popover.
- text, muted, border, input.
- primary, accent, danger, warning, success.

## Typography

- 12px: dense metadata, timestamps, badges.
- 14px: normal app text and controls.
- 16px: page titles and section headers.
- 24px: detail hero title.
- 32px: only for true hero moments, not utility pages.
- Letter spacing should remain 0.

## Motion

- Default interaction motion: 120ms to 180ms.
- Page entry: small opacity plus 8px vertical movement.
- Poster hover: 2px lift and accent shadow.
- Button active: subtle 0.98 scale.
- Must respect `prefers-reduced-motion`.

## Component Rules

- Prefer icon buttons for repeated tools and rail navigation.
- Icon-only buttons must have `aria-label` or `title`.
- Utility pages use `PageShell`, `PageFrame`, `PageHeader`, `Panel`, `PanelHeader`, `PanelContent`, `MetricTile`, and `SoftRow`.
- Do not nest cards inside cards.
- Error and warning states use `Notice` and must include text, not color alone.

## Page Archetypes

### Library

- Left library panel with search, filters, list/grid switch, and compact rows.
- Right detail page with cover hero, one primary launch action, secondary edit/delete actions.
- Tabs should include Overview, Metadata, and Files today. Future tabs: Records, Saves, Notes, Links, Tools.

### Import Scanner

- Command bar for folder selection, recursive toggle, scan/import actions.
- Candidate review before import.
- Future work: background task progress, cancel, retry, duplicate conflict resolution.

### Metadata

- Provider level errors must be visible.
- Batch result rows should expose status, reason, candidates, score, provider, and sniff markers.
- Applying metadata must be explicit and field based.

### Saves

- Game selector on the left, path and backup management on the right.
- Restore must clearly say that a protection backup is created first.

### Settings

- Rows use title and description on the left, control on the right.
- Privacy and network settings must be explicit.
- API key risk must be explained when saved locally.

## Current State

- The app already has a unified shell, dark and light theme, accent color options, reusable page primitives, poster interactions, and reduced-motion support.
- Remaining design debt: extract `src/style.css` into a stronger token/design folder later, add keyboard shortcut affordances, refine detail tabs, and add task/progress surfaces.
