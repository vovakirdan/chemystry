# Feature Flags (E02-T04)

Feature flags are configured on the backend through environment variables and exposed to the frontend via IPC command `get_feature_flags_v1`.

## Environment Variables

Unset or invalid values fall back to defaults.

| Variable | Default | Description |
| --- | --- | --- |
| `CHEMYSTRY_FEATURE_SIMULATION` | `true` | Enables simulation module paths. |
| `CHEMYSTRY_FEATURE_IMPORT_EXPORT` | `true` | Enables import/export module paths. |
| `CHEMYSTRY_FEATURE_ADVANCED_PRECISION` | `true` | Enables advanced precision module paths. |

Accepted boolean values (case-insensitive):

- `true`, `1`, `yes`, `on`
- `false`, `0`, `no`, `off`

## IPC Contract

- Command: `get_feature_flags_v1`
- Output payload:

```json
{
  "version": "v1",
  "requestId": "req-...",
  "featureFlags": {
    "simulation": true,
    "importExport": true,
    "advancedPrecision": true
  }
}
```

## Disabled Module Behavior

- Frontend always displays module state as `available` or `unavailable`.
- Frontend attempts to run a disabled feature path produce explicit typed error `FEATURE_DISABLED` and a user-facing message.
- If feature-flags IPC call is unavailable, frontend uses fallback defaults and shows that fallback was applied (including request reference).
