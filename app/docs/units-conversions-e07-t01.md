# E07-T01: Units and Conversion Module

## Scope

- Introduce a dedicated unit conversion module for core quantities:
  - mass (`g`)
  - amount (`mol`)
  - volume (`L`)
- Normalize numeric and unit inputs before conversion/calculation usage.
- Integrate conversion logic into Builder participant editing flow.
- Provide explicit user-facing conversion scope for gas-only volume auto-conversion.

## Implementation Summary

### New Shared Module

- Added: `app/src/shared/lib/units.ts`
- Key capabilities:
  - `parseNormalizedNumberInput(...)`
    - supports trim, comma decimal separator, exponent format
    - returns structured `ok/error` result (no silent parse failure)
  - `normalizeUnitInput(...)`
    - normalizes aliases to internal symbols (`g`, `mol`, `L`)
  - `convertQuantityInput(...)`
    - supports:
      - `g <-> mol` with molar mass context
      - `mol <-> L` for gas phase (default or custom molar volume)
      - `g <-> L` through `mol` for supported gas-phase cases
    - returns structured errors for incompatible or under-specified conversions

### Builder Model Integration

- Updated participant conversion flow in:
  - `app/src/features/left-panel/model.ts`
- Replaced ad-hoc conversion helpers with calls to `convertQuantityInput(...)`.
- Added `volumeLInput` as conversion source for gas participants.
- Preserved non-gas behavior by preventing implicit volume-driven conversion for non-gas phases.
- Updated validation numeric parsing to use normalized parser for:
  - participant numeric fields
  - user substance `molarMassInput`

### UI Visibility

- Updated Builder hint text to explicitly communicate volume auto-conversion scope:
  - `Volume (L) auto-converts only for gas phase.`
- Added inline participant warning for non-gas phase:
  - volume auto-conversion requires gas phase.

## Acceptance Criteria Coverage

1. `mass <-> mol <-> volume` conversions for supported cases:
   - implemented in typed shared module and integrated in Builder model updates.
2. Input normalization to internal standard before calculations:
   - numeric and unit normalization applied in parser/conversion module and draft validation.
3. Explicit incompatible conversion signaling:
   - conversion module returns structured incompatibility errors;
   - UI communicates gas-only scope for volume auto-conversion.

## Verification

### Automated

- `npm run lint`
- `npm test -- --run`
- `npm run build`

Key tests:
- `app/src/shared/lib/units.test.ts`
- `app/src/features/left-panel/model.test.ts`
- `app/src/features/left-panel/LeftPanelSkeleton.test.tsx`
- `app/src/App.test.tsx` (added guard for comma-decimal stoichiometric coefficient boundary)

### Manual Smoke (Playwright, 2026-03-04)

- Gas participant:
  - `amount -> mass/volume` auto-conversion: PASS
  - `volume -> amount/mass` auto-conversion: PASS
- Non-gas participant:
  - volume edit does not auto-convert amount/mass: PASS
- Conversion scope hint text present: PASS

Result: `PASS`.
