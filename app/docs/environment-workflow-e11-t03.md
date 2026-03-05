# E11-T03: Scenario Workflow Save/Reset/Rewind

## Scope
- Extended scenario controls with explicit `Rewind last step` action in Builder scenario block.
- Added rewind workflow for environment controls (`temperatureC`, `pressureAtm`, `gasMedium`):
  - restore previous environment snapshot
  - keep non-environment runtime controls unchanged
  - skip redundant runtime update when rewind target already matches current settings
- Added scenario history + rewind stack persistence in local storage:
  - `chemystery.scenario.history.v1`
  - `chemystery.environment.rewind.v1`
- Added robust parse/filter logic for malformed persisted payloads.
- Preserved existing save/load/baseline behavior and synchronized right panel remount on rewind.

## Technical Notes
- Rewind uses a dedicated helper (`rewindEnvironmentStep`) returning structured outcomes:
  - `unavailable`
  - `no_change`
  - `applied`
- App runtime change observer appends rewind snapshots only when environment fields changed.
- Rewind applies `setRightPanelSyncRevision(...)` to avoid control desync after rollback.

## Files
- `src/App.tsx`
- `src/App.test.tsx`
- `src/features/left-panel/LeftPanelSkeleton.tsx`
- `src/features/left-panel/LeftPanelSkeleton.test.tsx`

## Verification
Run from `app/`:

```bash
npm run lint
GOMAXPROCS=1 npx vitest run src/App.test.tsx src/features/left-panel/LeftPanelSkeleton.test.tsx src/features/right-panel/RightPanelSkeleton.test.tsx --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1
npm run build
```

Expected:
- rewind action is present in scenario controls
- rewind helper applies previous environment snapshot and preserves non-environment runtime fields
- no-op rewind path does not produce redundant runtime update payload
- persisted scenario history and rewind stack are parsed safely, malformed entries are ignored

## Manual QA Checklist
- Open Builder scenario controls and confirm `Rewind last step` button is visible.
- Change environment controls at least twice (`temperatureC`, `pressureAtm`, `gasMedium`) and verify history entries appear in Summary.
- Trigger `Rewind last step` and verify:
  - environment controls move to the previous snapshot;
  - non-environment runtime controls (`calculationPasses`, `precisionProfile`, `fpsLimit`) remain unchanged;
  - center panel environment sync text matches rewound values.
- Refresh/restart app and verify persisted scenario history is restored and malformed stored entries are ignored without crash.
