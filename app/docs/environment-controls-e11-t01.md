# E11-T01: Environment Controls and Scenario History Logging

## Scope
- Added environment controls in right panel for:
  - temperature (C)
  - pressure (atm)
  - gas medium (`gas` / `liquid` / `vacuum`)
- Added explicit range validation feedback in the environment section.
- Extended runtime settings contract with `gasMedium` and added client-side contract validation.
- Added scenario history entries for environment parameter changes in `App` state.
- Added engine-sync summary line in workspace panel showing derived environment values used by simulation core.

## Acceptance Mapping
1. T/P/medium controls in right panel: implemented in `RightPanelSkeleton` environment section.
2. Validation of ranges and units: implemented for temperature and pressure with user-facing messages and unit labels.
3. Sync with simulation engine: runtime settings are converted to `ParticleModelEnvironment` and rendered in workspace sync line.
4. Explicit logging: environment changes append scenario history entries visible in right-panel summary.

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
- Environment section shows temperature/pressure/gas medium controls.
- Out-of-range temperature/pressure shows validation text.
- Changing temperature/pressure/gas medium updates workspace environment sync line.
- Summary section shows scenario history entries for environment changes.
