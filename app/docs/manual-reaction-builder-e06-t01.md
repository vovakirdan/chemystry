# Manual Reaction Builder Editor (E06-T01)

## Scope

Implemented the first functional Builder editor increment for manual reaction assembly.

## Delivered

- Builder draft model now includes editable participants:
  - `id`
  - `substanceId`
  - `role` (`reactant` or `product`)
  - `stoichCoeffInput`
- Builder UI supports:
  - adding participants from local substance catalog (`builtin/imported/user`);
  - editing participant role, coefficient input, and selected substance;
  - removing participants;
  - saving draft without running simulation.
- Draft persistence:
  - localStorage key: `chemystery.builder.draft.v1`;
  - versioned serialized payload with safe parse/validation on restore.

## Acceptance Mapping

1. Add/remove reactants/products:
   - implemented via participant add/remove controls in Builder.
2. Set coefficient and role:
   - each participant has editable `role` and `stoichCoeffInput`.
3. Save draft without simulation:
   - `Save draft` action stores Builder draft locally and confirms via notification.
4. Works with library and user-defined substances:
   - add form uses full catalog source list from app state.

## Validation

- Automated:
  - model tests for participant operations and safe storage parse/serialize.
  - component tests for stable selectors across participant controls.
  - app lint/test/build checks pass.
- Manual smoke:
  - Playwright-based tester flow passed:
    - `Presets -> Use in Builder -> Add participant -> Edit role/coeff -> Save draft`.
