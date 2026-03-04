# Pre-Run Validation and Launch Gate (E06-T03)

## Scope

Implemented unified pre-run validation that blocks simulation start until scenario inputs are valid.

## Delivered

- Unified launch validation model in `App` with grouped sections:
  - `Builder`
  - `Environment`
  - `Calculations`
- Grouped validation UI:
  - `Pre-run checks` card in center workspace;
  - per-section issue lists;
  - clear ready/blocked state text.
- Launch gate:
  - center `Play` disabled while any grouped section has errors;
  - user-visible blocked reason shown near controls;
  - gate re-evaluates reactively without page reload.
- Builder validation improvements:
  - actionable, user-friendly messages;
  - participant messages use readable labels (`Participant N (Substance)`), not internal ids.
- Right panel runtime settings now expose values required for validation:
  - `temperatureC`
  - `pressureAtm`
  - `calculationPasses`
  - `precisionProfile`
  - `fpsLimit`

## Validation Rules (MVP)

- Builder:
  - at least one participant;
  - at least one reactant and one product;
  - required coefficient, mol, mass, volume fields;
  - numeric and non-negative checks.
- Environment:
  - temperature and pressure required;
  - temperature range: `-273.15..1000 °C`;
  - pressure range: `0.1..50 atm`.
- Calculations:
  - iteration passes required, integer, range `1..10000`;
  - fps required, integer, range `15..240`;
  - profile constraints:
    - `High Precision` recommends `<= 120 fps`;
    - `Custom` requires at least `50` passes.

## Acceptance Mapping

1. Required fields/coefficients/ranges validated:
   - covered by grouped launch validation model.
2. Errors grouped by `Builder/Environment/Calculations`:
   - rendered in dedicated grouped sections.
3. Launch re-enabled after fixes without reload:
   - `Play` gate reacts to live input state updates.
4. Actionable messages:
   - human-readable instructions with section context and participant labels.

## Verification

- Automated:
  - `App.test.tsx` for grouped validation, user-friendly text, label formatting, gate open/close model checks.
  - updated component tests for center play blocked/unblocked rendering states.
- Manual smoke (Playwright):
  - verified blocked state with grouped errors;
  - fixed fields live across sections;
  - confirmed `Play` re-enabled without reload.
