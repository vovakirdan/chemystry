# E08-T01: Stoichiometry and Limiting Reactant (MVP)

## Scope

- Implement core stoichiometric calculations from balanced Builder coefficients.
- Determine limiting reactant(s), including co-limiting cases.
- Return explicit assumptions and units in every result.
- Fail fast with structured validation errors when Builder input is incomplete or invalid.

## Implementation Summary

### Calculation Engine

- Added a dedicated calculation module:
  - `src/shared/lib/stoichiometry.ts`
- Implemented typed result DTO with explicit success/failure union:
  - success: limiting reactant(s), reaction extent, per-participant theoretical values;
  - failure: array of structured validation errors.
- Added explicit domain assumptions and unit descriptors:
  - coefficients are treated as exact balanced molar ratios;
  - input amounts are interpreted as `mol`;
  - complete conversion until limiting reactant depletion.

### Validation Rules

- Added hard validation for:
  - missing participants,
  - missing reactant,
  - missing product,
  - invalid/non-positive stoichiometric coefficients,
  - missing/invalid/negative amount input.
- Engine returns no partial calculation payload on validation failure.

### Numerical Robustness

- Implemented scale-aware tolerance for limiting-reactant detection:
  - relative tolerance + absolute floor (to avoid tiny-number misclassification).
- Added near-zero clamping for remaining reactant amounts to avoid negative zero artifacts.
- Added formatter helper for stable UI output (`formatStoichiometryValue`).

### UI Integration

- Wired stoichiometry computation into `App` with memoized builder-driven input mapping.
- Extended right panel Summary section:
  - success state: limiting reactant, reaction extent, product yields, reactant remainder;
  - blocked state: clear validation messages;
  - units and assumptions always visible.
- Added `initialBuilderDraft` prop to `App` for deterministic success-path integration testing.

## Acceptance Criteria Coverage

1. Stoichiometric ratios are calculated from balanced equation coefficients:
   - implemented in `calculateStoichiometry`.
2. Limiting reactant is identified correctly:
   - supports single and co-limiting reactants with tolerance-aware comparison.
3. Results include assumptions and units:
   - both success and failure DTOs include units + assumptions.
4. Missing data returns explicit validation errors instead of partial output:
   - implemented as strict failure branch with structured errors.

## Verification

### Automated

- `npm run lint`
- `GOMAXPROCS=1 npx vitest run --run --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1`
- `npm run build`

Coverage includes:

- limiting reactant and theoretical amount calculation;
- co-limiting scenario;
- tiny-extent regression to validate tolerance logic;
- missing-product / missing-setup validation errors;
- localized numeric input handling;
- App-level summary rendering for both error and success states.

### Manual UI Smoke (Playwright)

- Summary shows blocking stoichiometry message for incomplete Builder setup: PASS
- Summary shows limiting reactant and theoretical products for valid setup: PASS
- Greeting template/demo remains absent: PASS
