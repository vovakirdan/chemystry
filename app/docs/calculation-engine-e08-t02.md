# E08-T02: Reaction Yield and Percent Yield (MVP)

## Scope

- Extend stoichiometry result model with explicit actual product yield and percent yield.
- Keep theoretical yield calculation from balanced coefficients and limiting reactant extent.
- Return structured validation issues for incomplete or invalid yield inputs.
- Surface yield summary in right panel success/error states.

## Implementation Summary

### Engine Updates

- File: `src/shared/lib/stoichiometry.ts`
- Extended input DTO:
  - `actualYieldMolInput?: string` per participant.
  - App maps Builder product `amountMolInput` to this field for traceable yield input.
- Extended result DTO:
  - per participant `actualYieldAmountMol` and `percentYield`.
  - units now include `percentYield: "%"`.
- Added explicit yield validation codes:
  - `MISSING_ACTUAL_YIELD`
  - `INVALID_ACTUAL_YIELD`
  - `NEGATIVE_ACTUAL_YIELD`
  - `ZERO_THEORETICAL_YIELD`

### Formula Traceability

- Theoretical product yield:
  - `theoreticalAmountMol = productCoefficient * reactionExtentMol`
- Percent yield:
  - `percentYield = (actualYieldAmountMol / theoreticalAmountMol) * 100`
- Coefficients and ratios are still traceable through:
  - `coefficient`
  - `stoichRatioToLimiting`
  - `reactionExtentMol`

### Edge-Case Handling

- `actualYieldMolInput` missing/invalid/negative:
  - fails with structured participant-scoped validation errors.
- Zero actual yield (`actualYieldAmountMol = 0`):
  - valid, returns `percentYield = 0`.
- Zero theoretical yield:
  - fails with `ZERO_THEORETICAL_YIELD` (no partial success payload).

### UI Integration

- Files:
  - `src/features/right-panel/RightPanelSkeleton.tsx`
  - `src/App.tsx`
- Right panel summary now shows, in success state:
  - theoretical product amounts,
  - actual product yields,
  - `% yield` per product.
- Error state remains explicit and lists structured validation messages.

## Acceptance Criteria Coverage

1. Theoretical product yield is calculated:
   - computed from product coefficient and reaction extent.
2. Actual yield input and `% yield` are supported:
   - product actual yield is consumed from explicit input mapping and rendered in summary.
3. Edge cases (0, negative, incomplete) are handled explicitly:
   - zero actual yield returns 0%;
   - negative/missing/invalid input returns structured errors;
   - zero theoretical yield returns structured error.

## Verification

- `npm run lint`
- `GOMAXPROCS=1 npx vitest run --run --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1`
- `npm run build`
