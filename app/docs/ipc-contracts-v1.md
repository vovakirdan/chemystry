# IPC Contracts v1 (E02-T03)

This document defines the baseline versioned IPC contracts shared by frontend and Tauri backend.

## Versioning Rule

- Command names include a version suffix, for example: `greet_v1`.
- Payloads include a `version` field with value `"v1"` in all success and error outputs.
- Payloads include a `requestId` field for end-to-end command tracing.
- New breaking contract changes must be introduced as `*_v2` commands (keeping `v1` available while migrating).

## Shared DTO Catalog (v1)

### `GreetV1Input`

```json
{
  "name": "string (required, trimmed, 1..64 chars)"
}
```

### `GreetV1Output`

```json
{
  "version": "v1",
  "requestId": "string",
  "message": "string"
}
```

### `HealthV1Output`

```json
{
  "version": "v1",
  "requestId": "string",
  "status": "ok"
}
```

### `GetFeatureFlagsV1Output`

```json
{
  "version": "v1",
  "requestId": "string",
  "featureFlags": {
    "simulation": "boolean",
    "importExport": "boolean",
    "advancedPrecision": "boolean"
  }
}
```

### `CommandErrorV1`

```json
{
  "version": "v1",
  "requestId": "string",
  "category": "validation | io | simulation | import | internal",
  "code": "string",
  "message": "string"
}
```

## Command Table

| Command | Input schema | Output schema | Error schema |
| --- | --- | --- | --- |
| `greet_v1` | `GreetV1Input` | `GreetV1Output` | `CommandErrorV1` |
| `health_v1` | `{}` (no input payload) | `HealthV1Output` | `CommandErrorV1` (reserved for future failures) |
| `get_feature_flags_v1` | `{}` (no input payload) | `GetFeatureFlagsV1Output` | `CommandErrorV1` (reserved for future failures) |

## Validation Baseline (Rust Side)

- `greet_v1` validates `name` at runtime.
- Validation failures return `CommandErrorV1` with:
  - `category: "validation"`
  - `code`: machine-readable (`NAME_REQUIRED`, `NAME_TOO_LONG`)
  - `message`: human-readable detail
  - `requestId`: correlation id matching backend logs

## Tracing and Error Mapping

- Backend emits lightweight logs for each command start/success/failure with `request_id`.
- Frontend maps backend error categories/codes to user-facing messages and includes `requestId` for support correlation.

## Feature Flag Notes

- `get_feature_flags_v1` reports backend-resolved module availability for:
  - `simulation`
  - `importExport`
  - `advancedPrecision`
- Detailed operational behavior and environment variable mapping are documented in `docs/feature-flags.md`.
