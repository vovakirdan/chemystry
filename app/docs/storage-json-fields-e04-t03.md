# Storage JSON Field Contracts (E04-T03)

This document defines versioned payload shapes for JSON fields introduced by migration `0003_create_scenario_calculation_import_data`.

## Versioning Rule

- JSON payloads are stored as `TEXT` in SQLite.
- Each payload has a required top-level numeric `version` field.
- Current payload version is `1` for all fields below.
- Breaking payload changes must increment `version` and keep backward readers for existing rows.

## `simulation_frame_summary.key_metrics_json`

Payload version: `1`

```json
{
  "version": 1,
  "metrics": {
    "temperature_k": 298.15,
    "pressure_pa": 101325,
    "reactant_mol_total": 1.25,
    "product_mol_total": 0.42,
    "conversion_ratio": 0.336
  },
  "units": {
    "temperature_k": "K",
    "pressure_pa": "Pa",
    "amount": "mol",
    "ratio": "fraction_0_1"
  }
}
```

Field notes:
- `metrics` is required and contains snapshot numbers for timeline rendering.
- `conversion_ratio` is expected in `[0, 1]` when present.
- Additional metric keys are allowed if they are backward compatible.

## `calculation_result.payload_json`

Payload version: `1`

```json
{
  "version": 1,
  "resultType": "stoichiometry",
  "inputs": {
    "reactionTemplateId": "3eba79d3-2f03-43b4-b1a8-8576f7983b8c",
    "amounts": [
      {
        "substanceId": "e70ee765-cc3b-4f90-9f7f-ab8897be2a36",
        "amountMol": 2.0
      }
    ]
  },
  "outputs": {
    "limitingSubstanceId": "e70ee765-cc3b-4f90-9f7f-ab8897be2a36",
    "productMol": 2.0
  },
  "warnings": []
}
```

Field notes:
- `resultType` must match `calculation_result.result_type`.
- `inputs` and `outputs` are required objects for deterministic replay/export.
- `warnings` is required and contains machine-readable or UI-safe warning messages.

## `import_job.warnings_json`

Payload version: `1`

```json
{
  "version": 1,
  "warnings": [
    {
      "code": "UNRECOGNIZED_BOND_TYPE",
      "message": "Bond type 9 was skipped.",
      "line": 128
    }
  ]
}
```

Field notes:
- `warnings` is always present; use an empty array when no warnings were produced.
- Each warning object should include stable `code` and user-readable `message`.
- `line` is optional and used when source formats expose line-based diagnostics.
