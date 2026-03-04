# E07-T02: Dimensional Validation and Input Normalization

## Scope

- Enforce dimensional consistency checks before simulation launch:
  - `mass (g) <-> amount (mol)` with selected substance molar mass.
  - `volume (L) <-> amount (mol)` for gas-phase participants.
- Harden numeric normalization rules for user input:
  - keep support for comma decimals and exponent notation;
  - reject malformed whitespace that can silently change number magnitude.
- Surface actionable validation messages in Launch pre-checks.

## Implementation Summary

### Validation Model

- Updated `validateBuilderDraftForLaunch(...)` to require catalog context explicitly and apply dimensional checks for each participant.
- Added consistency tolerance strategy:
  - absolute tolerance for near-zero values;
  - relative tolerance for scaled values.
- Added explicit error paths for:
  - inconsistent `mass <-> mol`,
  - inconsistent gas `volume <-> mol`,
  - missing molar mass for `mass <-> mol` checks.

### Numeric Input Parsing

- Updated parser to reject digit-separated whitespace patterns (for example `1 2`, `1 e 2 3`) instead of compacting them into unintended values.
- Preserved support for valid normalized forms like `1,5 e0`.

### App-Level UX Mapping

- Extended actionable message mapping in launch validation UI for all new dimensional validation errors:
  - mass inconsistency,
  - gas volume inconsistency,
  - missing molar mass.

## Acceptance Criteria Coverage

1. Dimension checks added to launch validation flow for MVP formulas:
   - implemented in Builder validation model and consumed by App launch gate.
2. Input normalization covers decimal separators, spaces, and exponent formats:
   - valid normalized forms accepted; malformed whitespace forms rejected.
3. Boundary cases covered by tests:
   - added unit tests for near-zero mismatches, tolerance boundaries, malformed numeric input, and actionable UI message mapping.

## Verification

### Automated

- `npm run lint`
- `npx vitest run --run --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1`
- `npm run build`
- `npm run rust:fmt:check`
- `npm run rust:clippy`
- `npm run rust:test`

### Manual Smoke (Playwright, 2026-03-04)

- Dimensional mismatch blocks Play and shows actionable Builder error: PASS
- Valid spaced exponent input (for example `1,5 e0`) accepted when dimensions are consistent: PASS
- Malformed whitespace input (`1 2`, `1 e 2 3`) rejected and blocks Play: PASS
- Template greeting/demo remains removed: PASS

Result: `PASS`.
