# E08-T04: UI/Storage/Export Integration for Calculation Summary

## Scope

- Show calculation output in the right panel with explicit breakdown by calculation type.
- Save calculation summary during scenario save into `calculation_result`.
- Export the calculation summary in a local JSON format from UI.
- Invalidate stale persisted/exported calculation state when Builder/runtime inputs change.

## Implementation Summary

### Right Panel Breakdown

- Files:
  - `src/App.tsx`
  - `src/features/right-panel/RightPanelSkeleton.tsx`
- The Summary tab now renders calculation blocks by type:
  - Stoichiometry
  - Limiting reagent
  - Yield
  - Concentration
  - Gas conversion
- Export button added to Summary:
  - `Export summary (JSON)`
  - Uses local browser download (`Blob` + object URL).

### Calculation Summary DTO (v1)

- Files:
  - `src/shared/contracts/ipc/v1.ts`
  - `src/shared/contracts/ipc/client.ts`
- `ScenarioPayloadV1` extended with optional `calculationSummary`.
- Summary shape:
  - `version`
  - `generatedAt`
  - `inputSignature`
  - `entries[]`
- Entry shape:
  - `resultType` (`stoichiometry`, `limiting_reagent`, `yield`, `conversion`, `concentration`)
  - `inputs`
  - `outputs`
  - `warnings`

### Storage Persistence

- Files:
  - `src-tauri/src/adapters/ipc/v1.rs`
  - `src-tauri/src/adapters/storage/repository.rs`
- Save IPC input now accepts optional `calculationSummary`.
- On scenario save:
  - scenario metadata is attached (`scenarioId`, `scenarioName`, `savedAt`, `updated`);
  - `replace_calculation_results_from_value` is called;
  - previous `calculation_result` rows for scenario are deleted and replaced.
- Deterministic storage mapping:
  - ordered by enum domain order:
    - `stoichiometry`, `limiting_reagent`, `yield`, `conversion`, `concentration`
  - each stored payload includes at minimum:
    - `version`, `inputs`, `outputs`, `warnings`
  - metadata is included when present (`generatedAt`, `inputSignature`, scenario metadata).

### Stale Invalidation

- File:
  - `src/App.tsx`
- `inputSignature` is derived from Builder + runtime state.
- Persisted/exported signature is tracked.
- `isCalculationSummaryStale` is true when current input signature differs from last persisted/exported signature.

## Acceptance Criteria Coverage

1. Right panel breakdown by calc type:
   - implemented via type-specific sections in Summary tab.
2. Save calculations in `CalculationResult` with scenario metadata:
   - implemented in scenario save IPC + repository replacement transaction.
3. Export summary in supported local format:
   - implemented as local JSON download from right panel.
4. Input change invalidates stale results:
   - implemented via signature-based stale detection and tested.

## Verification

- `npm run lint`
- `GOMAXPROCS=1 npx vitest run --run --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1`
- `npm run build`
- `npm run rust:fmt:check`
- `npm run rust:clippy`
- `npm run rust:test`
