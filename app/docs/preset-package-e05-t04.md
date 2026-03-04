# Preset Package Coverage (E05-T04)

## Goal

Ship a baseline preset package with one preset for each MVP reaction class:

- `inorganic`
- `acid_base`
- `redox`
- `organic_basic`
- `equilibrium`

## Baseline Presets

| Preset ID | Class | Equation | Educational Note |
| --- | --- | --- | --- |
| `builtin-preset-magnesium-oxidation-v1` | `inorganic` | `2Mg + O2 -> 2MgO` | Metal oxidation as a basic inorganic synthesis pattern. |
| `builtin-preset-acid-base-neutralization-v1` | `acid_base` | `HCl + NaOH -> NaCl + H2O` | Proton transfer and salt + water formation in aqueous media. |
| `builtin-preset-hydrogen-combustion-v1` | `redox` | `2H2 + O2 -> 2H2O` | Exothermic redox where oxygen is reduced and hydrogen is oxidized. |
| `builtin-preset-ethene-hydration-v1` | `organic_basic` | `C2H4 + H2O -> C2H5OH` | Introductory organic addition reaction (alkene hydration). |
| `builtin-preset-haber-process-v1` | `equilibrium` | `N2 + 3H2 <-> 2NH3` | Reversible process to demonstrate equilibrium shifts. |

## Validation

- Rust tests verify:
  - all five classes are present in preset listing;
  - each preset description includes `Educational note:`;
  - each preset has at least one reactant and one product;
  - each preset passes basic launch precheck via `scenario_run` creation.
- Seed reconciliation preserves pre-existing non-builtin substances matched by natural key and avoids forced source conversion to `builtin`.

## Versioning

- Preset identifiers use `...-v1`.
- `reaction_template.version` is set to `1`.
- Seed remains idempotent through upsert logic for substances, templates, and species.
