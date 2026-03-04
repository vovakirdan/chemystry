# E06-T04: Scenario Save/Load + Baseline Snapshot

## Scope

- Add scenario persistence controls to Builder:
  - `Scenario name`
  - `Save scenario`
  - saved scenarios select + `Load`
  - `Set baseline snapshot`
  - `Revert to baseline`
- Persist scenario payload in local storage through Tauri IPC.
- Keep runtime settings and builder draft synchronized when loading/reverting.

## Implementation Summary

### Frontend

- Added scenario controls to left panel builder view with stable test selectors.
- Added scenario list sorting by parsed timestamp (supports both ISO and unix-millis strings).
- Added scenario label timestamp formatting for consistent UI display.
- Implemented save-as-new behavior by default to avoid implicit overwrite of selected scenario.
- Added scenario-name normalization to remove generated timestamp suffix before next save.
- Split save and list-refresh error handling:
  - save failure => `error`
  - post-save refresh failure => `warn` with preserved saved state
- Added baseline snapshot behavior:
  - set baseline from current builder + runtime
  - revert restores both builder and runtime
- Added right panel remount revision key on load/revert so runtime inputs visually sync with restored values.

### IPC Client/Contracts

- Aligned frontend IPC command names and payload mapping to backend v1 commands:
  - `save_scenario_draft_v1`
  - `list_saved_scenarios_v1`
  - `load_scenario_draft_v1`
- Added parsing/mapping for scenario DTOs returned by backend.
- Added compatibility handling for timestamp aliases and optional runtime fields.

### Backend

- Added v1 IPC commands for save/list/load scenario drafts.
- Added storage helpers for scenario snapshot JSON upsert/read and scenario amounts replace/read.
- Added backend tests for scenario draft roundtrip and update path.

## Acceptance Criteria Coverage

1. Scenario is saved in local DB with unique name/date:
   - backend appends timestamp suffix and persists snapshot at `t=0`.
2. User can load a saved scenario and continue editing:
   - load restores builder draft and runtime settings into UI.
3. Baseline snapshot and revert-to-baseline:
   - explicit baseline action and revert action implemented; both restore visual state.

## Verification

### Automated

- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `npm run rust:fmt:check`
- `npm run rust:clippy`
- `npm run rust:test`

### Manual Smoke (Playwright, 2026-03-04)

- Used browser-mode smoke with mocked Tauri `invoke`.
- Verified:
  - save creates new scenarios (`scenario-1`, `scenario-2`) even when one is selected
  - load restores builder title and environment temperature
  - set baseline enables revert
  - revert restores builder and runtime values
  - controls are disabled during save/load busy state

Result: `PASS`.
