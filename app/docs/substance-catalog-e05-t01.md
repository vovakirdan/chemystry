# Substance Catalog (E05-T01)

## Scope
- Add v1 IPC command for local catalog query.
- Render Library tab as a data-backed view (search, filters, list, property card).
- Keep all filtering local in UI after initial load.

## Backend Contract
- Rust command: `query_substances_v1`.
- Input shape: `{ input: { search?: string, phase?: string, source?: string } }`.
- Output shape:
  - `version`, `requestId`
  - `substances[]` with fields:
    - `id`, `name`, `formula`, `smiles?`, `molarMassGMol`, `phase`, `source`
- Validation:
  - `search` max 128 chars.
  - `phase`: `solid|liquid|gas|aqueous`.
  - `source`: `builtin|imported|user`.

## UI Behavior
- Library tab exposes stable selectors:
  - `library-search-input`
  - `library-filter-phase-*`
  - `library-filter-source-*`
  - `library-substance-list`
  - `library-property-card`
- Search works by `name` and `formula` (case-insensitive).
- Filters use multi-select sets for `phase` and `source`.
- Selected substance is preserved if still visible; otherwise fallback to first visible item.

## Tests and QA
- Rust:
  - IPC input validation tests.
  - Repository query tests (`query_substances` for search + combined filters).
- Frontend:
  - `model.test.ts` for normalization/filter/selection logic.
  - `LeftPanelSkeleton.test.tsx` for selectors and error state rendering.
  - IPC client tests for payload normalization and invalid payload rejection.
- Manual smoke (Playwright, web runtime):
  - Verified search input and filter toggles are interactive.
  - In plain Vite mode, Library can show `IPC_INVOKE_FAILED` because Tauri runtime is absent.
  - This state is expected in browser-only smoke and covered by error UI branch.
