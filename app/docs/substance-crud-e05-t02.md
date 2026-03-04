# Substance CRUD (E05-T02)

## Scope
- Add create/update/delete IPC for user-defined substances.
- Enforce read-only behavior for `builtin` and `imported` entries.
- Validate form data before submit in UI and revalidate on backend.

## IPC Commands
- `create_substance_v1`
- `update_substance_v1`
- `delete_substance_v1`

All commands use Tauri argument shape `invoke(command, { input })`.

## Server Rules
- Only `source_type = user_defined` can be updated/deleted.
- Delete is blocked when substance is referenced in `scenario_amount`.
- Stable validation codes include:
  - `SUBSTANCE_NAME_REQUIRED`
  - `SUBSTANCE_FORMULA_REQUIRED`
  - `SUBSTANCE_PHASE_INVALID`
  - `SUBSTANCE_MOLAR_MASS_REQUIRED`
  - `SUBSTANCE_MOLAR_MASS_INVALID`
  - `SUBSTANCE_SOURCE_IMMUTABLE`
  - `SUBSTANCE_IN_USE`
  - `SUBSTANCE_NOT_FOUND`
  - `SUBSTANCE_DUPLICATE`

## Repository Support
- Added `count_substance_scenario_usage(id)` to pre-check delete constraints against `scenario_amount`.

## UI Behavior
- Library tab has:
  - create form for user substance,
  - edit form + delete action for selected user substance,
  - read-only message for builtin/imported entries.
- Client-side validation blocks submit when:
  - name/formula missing,
  - phase invalid,
  - molar mass missing or non-positive.

## QA
- Automated:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run rust:fmt:check`
  - `npm run rust:clippy`
  - `npm run rust:test`
- Manual UI smoke (Playwright with mocked `window.__TAURI_INTERNALS__.invoke`):
  - search/filter/list/property card,
  - read-only message for builtin,
  - create validation before submit,
  - create/update/delete flow for user substance.
