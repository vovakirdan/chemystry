# E07-T03: Validation UX (Errors + Warnings + Model Limits)

## Scope

- Add a unified UI format for pre-run validation output (errors and warnings in one list model).
- Separate blocking issues (`error`) from non-blocking model-limit notices (`warning`).
- Add explain hints for model-approximation limitations.
- Deduplicate repeated messages to reduce UI noise.

## Implementation Summary

### Launch Validation Model

- Extended launch validation section payload with:
  - `errors: string[]`
  - `warnings: { message, explainHint }[]`
  - `items: { severity, message, explainHint }[]` for unified rendering.
- Added model-level flags:
  - `hasErrors`
  - `hasWarnings`
  - `firstError` (blocking reason for Play button).

### Warning Layer for Model Limitations

- Added Builder warning for gas amount-volume checks:
  - message uses PRD terminology: `Model confidence / approximation limit`.
  - explain hint clarifies ideal-gas MVP assumption (`22.4 L/mol`) and current non-ideal/T-P limitation.
- Warning appears only when gas amount and volume inputs are parseable numeric values.
- Warnings do not block Play.

### Unified UI Rendering

- Extracted pre-run checks card into reusable `LaunchValidationCard`.
- Rendered section output as one issue list with severity badges:
  - `Error`
  - `Warning`
- Added warning card style (`launch-validation-card--warning`) when only warnings are present.
- Preserved blocked style precedence when both errors and warnings exist.

### Dedupe

- Added per-section dedupe for launch validation items (by `severity + message + explainHint` key).

## Acceptance Criteria Coverage

1. Errors and warnings shown in one consistent UI format:
   - implemented via `items` list + severity badge rendering.
2. Model-limit warnings provide explain hints:
   - implemented with explicit ideal-gas approximation explain text.
3. Repeated messages deduplicated:
   - implemented in section item assembly.

## Verification

### Automated

- `npm run lint`
- `GOMAXPROCS=1 npx vitest run --run --pool forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=1`
- `npm run build`

Key test coverage additions:
- warning presence and non-blocking launch behavior,
- warning suppression for non-numeric gas inputs,
- explain hint rendering in unified list,
- blocked-card precedence when errors and warnings coexist,
- launch item dedupe behavior.

### Manual UI Smoke

- Attempted Playwright browser smoke in this run, but tooling transport/thread resources were unstable in this environment.
- Fallback validation was executed through App-level integration tests covering the same UX behavior paths.
