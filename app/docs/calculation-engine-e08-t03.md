# E08-T03: Concentrations and Gas Calculations with T/P (MVP)

## Scope

- Add concentration support (`mol/L`) to the calculation engine DTO.
- Add gas-phase calculations based on runtime temperature/pressure using ideal gas law.
- Keep stoichiometry/yield behavior backward-compatible while extending the standardized result DTO.
- Surface concentration and gas outputs in right-panel summary.

## Implementation Summary

### Engine DTO and Formulas

- File: `src/shared/lib/stoichiometry.ts`
- Extended input DTO:
  - participant fields: `phase`, `volumeLInput`
  - runtime settings: `temperatureC`, `pressureAtm`
- Extended success DTO with:
  - `derivedCalculations.concentrations`
  - `derivedCalculations.gasRuntime`
  - `derivedCalculations.gasCalculations`
- Units DTO now includes:
  - `concentration`, `volume`, `temperature`, `pressure`, `gasConstant`

### Traceable Calculation Rules

- Concentration:
  - `c = n / V`
  - units: `mol/L`
- Ideal gas conversions:
  - `n = (P * V) / (R * T)`
  - `V = (n * R * T) / P`
  - constants/assumptions:
    - `R = 0.082057338 L*atm/(mol*K)`
    - `T(K) = T(°C) + 273.15`

### Validation Paths

- Added explicit validation for requested concentration/gas paths:
  - invalid/missing phase
  - missing/invalid/negative/non-positive volume
  - missing/invalid/non-positive runtime pressure
  - missing/invalid/non-physical runtime temperature (`T(K) <= 0`)
- Validation remains structured (error code + field + participant scope).
- On validation failure, engine returns no partial success payload.

### Dimensional Consistency (E07 Alignment)

- Gas consistency flags in DTO compare:
  - entered gas `V` vs ideal-gas `V(n, T, P)`
  - entered `n` vs implied `n(P, V, T)`
- Tolerance constants are aligned to E07 dimensional check thresholds:
  - absolute tolerance `1e-6`
  - relative tolerance `1e-4`
- Launch validation integration uses runtime-derived gas molar volume (`R*T/P`) when runtime `T/P`
  is valid; otherwise it falls back to `22.4 L/mol` for backward-compatible validation behavior.

### UI Integration

- Files:
  - `src/App.tsx`
  - `src/features/right-panel/RightPanelSkeleton.tsx`
- App now maps Builder participant `phase`/`volumeLInput` plus runtime `temperatureC`/`pressureAtm` into `calculateStoichiometry`.
- Right-panel Summary now shows:
  - concentration list (`mol/L`)
  - gas runtime banner (`T/P`)
  - per-gas-participant ideal volume / implied amount / consistency status

## Acceptance Criteria Coverage

1. Concentration (`mol/L`) support:
   - implemented in `derivedCalculations.concentrations`.
2. Conversions and gas calculations with T/P:
   - implemented in `derivedCalculations.gasRuntime` + `derivedCalculations.gasCalculations`.
3. Standardized Result DTO:
   - extended `StoichiometryCalculationResult` success branch includes all new outputs with units/assumptions preserved.

## Verification

- `npm run lint`
- `GOMAXPROCS=1 npx vitest run --run --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1`
- `npm run build`
