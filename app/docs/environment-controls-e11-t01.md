# E11-T01: Environment Controls and Scenario History Logging

## Scope
- Extended right panel environment controls to support:
  - temperature (C)
  - pressure (atm)
  - gas medium (`gas`, `liquid`, `vacuum`)
- Added explicit range validation messages for environment inputs:
  - temperature: `-273.14°C .. 1000°C`
  - pressure: `0.1 .. 50 atm`
- Extended runtime settings and IPC contract handling with `gasMedium`.
- Added environment-to-engine synchronization surface in workspace view (`T[K]`, `P[atm]`, medium).
- Added scenario history logging for environment changes:
  - temperature updates
  - pressure updates
  - gas medium updates
  - scenario load synchronization marker

## Technical Notes
- `RightPanelRuntimeSettings` now includes `gasMedium`.
- Scenario load parsing keeps backward compatibility:
  - missing `gasMedium` falls back to `"gas"`
  - unsupported values are rejected as invalid scenario payloads
- Environment change history is capped (`MAX_SCENARIO_HISTORY_ENTRIES`) and shown in Summary tab.

## Files
- `src/features/right-panel/RightPanelSkeleton.tsx`
- `src/features/right-panel/RightPanelSkeleton.test.tsx`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/shared/contracts/ipc/v1.ts`
- `src/shared/contracts/ipc/client.ts`
- `src/shared/contracts/ipc/client.test.ts`

## Verification
Run from `app/`:

```bash
npm run lint
GOMAXPROCS=1 npx vitest run src/features/right-panel/RightPanelSkeleton.test.tsx src/App.test.tsx src/shared/contracts/ipc/client.test.ts --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1
npm run build
```

Manual smoke checks:
- environment controls are visible in right panel
- out-of-range values show validation messages
- gas medium selection updates engine sync line in center panel
- environment changes appear in Summary -> Scenario history
