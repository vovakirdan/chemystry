# E11-T02: Live Derived Metrics for Environment What-If

## Scope
- Added live-derived environment metrics in right-panel summary.
- Metrics now show **current** and **baseline** values side by side for:
  - temperature (K)
  - pressure (atm)
  - gas medium
  - ideal gas molar volume (L/mol)
  - collision-rate index (dimensionless educational indicator)
- Added warning/error surface for invalid or unstable environment combinations.
- Metrics update reactively from runtime settings without full simulation reload.

## Acceptance Mapping
1. Live update in acceptable delay: metrics are computed via memoized derivation from current runtime settings.
2. Current vs baseline: both snapshots are rendered when baseline exists; baseline-empty state is explicit.
3. Warning/error signaling: impossible or out-of-range combinations are listed in dedicated warning/error blocks.

## Files
- `src/App.tsx`
- `src/App.test.tsx`
- `src/features/right-panel/RightPanelSkeleton.tsx`
- `src/features/right-panel/RightPanelSkeleton.test.tsx`

## Verification
Run from `app/`:

```bash
npm run lint
GOMAXPROCS=1 npx vitest run src/App.test.tsx src/features/right-panel/RightPanelSkeleton.test.tsx --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1
npm run build
```

Manual checks:
- Change temperature/pressure/gas medium and verify metrics update immediately.
- Verify current and baseline blocks are visible together when baseline exists.
- Trigger invalid combos and confirm warning/error lists are shown.
