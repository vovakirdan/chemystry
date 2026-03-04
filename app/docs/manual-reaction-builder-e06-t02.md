# Manual Reaction Builder Quantities and Phases (E06-T02)

## Scope

Extended Builder participants with quantity and phase inputs required for simulation-ready scenario setup.

## Delivered

- Participant model fields added:
  - `phase`
  - `amountMolInput`
  - `massGInput`
  - `volumeLInput`
- Participant UI now includes:
  - phase selector,
  - `Amount (mol)`, `Mass (g)`, `Volume (L)` inputs with explicit units.
- Conversion behavior:
  - `amountMolInput -> massGInput` via selected substance molar mass;
  - `massGInput -> amountMolInput` via selected substance molar mass;
  - re-sync on substance change.
- Validation and launch blocking:
  - negative numeric values are rejected by launch validation;
  - builder shows launch-blocked banner with concrete reasons;
  - center `Play` control is disabled while launch is blocked and shows reason.
- Legacy draft compatibility:
  - drafts from E06-T01 (without quantity/phase fields) are parsed with defaults;
  - missing legacy phase resolves from matched substance phase during hydration.

## Acceptance Mapping

1. Quantity fields per substance:
   - added `mass/mol/volume` per participant.
2. Phase selection:
   - added per-participant phase control.
3. Units and convertibility:
   - units shown directly in labels;
   - conversion hint visible in Builder;
   - mass/mol auto-conversion implemented.
4. Invalid combinations block launch:
   - launch validation errors block `Play` action in center controls.

## Validation

- Automated:
  - model tests for new fields, conversion, legacy parsing, and launch validation.
  - UI tests for quantity/phase selectors, unit labels, and launch-blocked rendering.
  - center-panel test for blocked `Play` behavior and blocked reason.
- Manual smoke (Playwright):
  - verified quantity fields, conversion behavior, launch blocking, and save-draft flow.
