# Presets Library and Builder Copy (E05-T03)

## Goal

Provide a read-only preset library with metadata and allow loading any preset into Builder as an editable copy.

## Scope

- Backend IPC command:
  - `list_presets_v1` returns only rows with `reaction_template.is_preset = true`.
- Frontend Presets tab:
  - shows preset cards with `title`, `reactionClass`, `complexity`, `description`, `equationBalanced`;
  - supports preset selection and `Use in Builder`.
- Frontend Builder tab:
  - opens editable draft created from selected preset;
  - displays copy feedback:
    - `You are editing copy of preset "<title>". Original preset remains unchanged.`

## Contract Notes

- Preset list response:
  - `version: "v1"`
  - `requestId: string`
  - `presets: PresetCatalogEntryV1[]`
- `complexity` is derived from `reactionClass`:
  - `inorganic`, `acid_base` -> `beginner`
  - `redox`, `organic_basic` -> `intermediate`
  - `equilibrium` -> `advanced`

## Invariants

- Preset rows are sorted deterministically by `title` and `id`.
- Non-preset templates are excluded from `list_presets_v1`.
- Editing Builder draft never mutates original preset data.

## Verification

- Automated:
  - Rust tests for preset filtering, output shape, deterministic ordering.
  - Frontend tests for preset rendering and copy-to-builder flow.
- Manual smoke:
  - Playwright smoke with mocked Tauri IPC confirms:
    - metadata rendering;
    - `Use in Builder` transfer;
    - copy feedback visibility;
    - edits remain local to Builder copy.
