# E06-T05: Simulation Lifecycle (Start/Pause/Reset)

## Scope

- Implement centralized simulation lifecycle commands in App state:
  - `start`
  - `pause`
  - `reset`
- Make center control bar fully controlled by App lifecycle state.
- Ensure reset restores baseline behavior for timeline/runtime (and builder when baseline snapshot exists).
- Remove template greeting/demo content from center panel and keep product-focused workspace cards.

## Implementation Summary

### Lifecycle Model

- Added `applySimulationLifecycleCommand(...)` as deterministic command reducer in `App`.
- Commands are idempotent:
  - `start` does nothing when already running or when launch is blocked.
  - `pause` does nothing when already paused.
  - `reset` resolves to the same object references when state already matches target.
- Reset targets:
  - without baseline snapshot: timeline `0%`, paused, runtime defaults;
  - with baseline snapshot: restore baseline timeline/runtime and builder draft.

### Center Panel Control Wiring

- `CenterPanelSkeleton` now receives required controlled `controlState`.
- Play/Pause/Reset buttons call explicit callbacks from App.
- Timeline slider updates App state via callback.
- Removed local lifecycle state drift in center panel.

### Baseline and Scenario Behavior

- Baseline snapshot now includes simulation control state (timeline + paused state).
- `Set baseline snapshot` captures builder/runtime/timeline.
- `Revert to baseline` restores builder/runtime/timeline.
- `load scenario` initializes baseline timeline to `0%` (paused), preventing fallback to template `25%`.

### UI Cleanup

- Removed `Greeting demo` form and template welcome/logo block from center panel.
- Added product-oriented `Simulation workspace` summary card.

## Acceptance Criteria Coverage

1. Start/Pause/Reset controls available and synchronized:
   - state is controlled from App and reflected in center control/status bar.
2. Reset returns scene/calculation state to baseline:
   - runtime + timeline restored to defaults or baseline snapshot values.
3. Pause/Resume preserves simulation progress:
   - timeline position is preserved across pause/resume transitions.

## Verification

### Automated

- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `npm run rust:fmt:check`
- `npm run rust:clippy`
- `npm run rust:test`

### Manual Smoke (Playwright, 2026-03-04)

- `Greeting demo` and template welcome content are absent.
- Play/Pause/Reset buttons and status transitions are consistent.
- Pause/resume preserves timeline progress.
- Reset with baseline restores baseline runtime/timeline.
- Reset without baseline restores timeline `0%` + default runtime values.
- Re-check after final adjustments: `load scenario` + `reset` keeps timeline at `0%`.

Result: `PASS`.
