# ADR-0001: Layer Boundaries and Dependency Direction (E02-T01)

- Status: Accepted
- Date: 2026-03-04
- Related: `PRD-cheMystry-2026-03-04.md`, `tasks/E02-architecture-and-contracts.md`

## Context

Before functional implementation, the MVP needs stable boundaries between `UI`, `domain`, `simulation`, `storage`, and `import`.
This ADR enforces PRD constraints: explicit sync boundary between UI state and simulation engine state, deterministic simulation inputs, and fully local-first data flow.

## Decision

Use one-way dependencies toward core rules:

`UI -> IPC adapters -> {simulation, storage, import} -> domain`

Rules:

- `domain` is the innermost layer (pure business/calculation rules).
- `simulation` depends on `domain`, but `domain` does not depend on `simulation`.
- `storage` and `import` may depend on `domain` types/rules for mapping and validation.
- `UI` never bypasses IPC adapters to reach Rust internals or persistence.

## Layer Dependency Rules (Allowed vs Forbidden)

| Layer | Primary location | Allowed imports/dependencies | Forbidden imports/dependencies |
| --- | --- | --- | --- |
| UI | `app/src/app`, `app/src/features`, `app/src/shared` | Frontend modules (`src/app`, `src/features`, `src/shared`), Tauri frontend API (`@tauri-apps/api/*`), versioned IPC DTO/contracts | Direct DB/filesystem persistence access for app data, direct coupling to `src-tauri/src/**`, direct parser/engine internals |
| Domain | `app/src-tauri/src/domain/chemistry`, `app/src-tauri/src/domain/units` | Domain-only modules and deterministic math/unit utilities | `adapters/*`, `infra/*`, Tauri command adapters, storage drivers, file parser libs, UI concerns |
| Simulation | `app/src-tauri/src/domain/simulation` | `domain/chemistry`, `domain/units`, deterministic time-step/state logic | Direct storage writes, direct import file reads/parsing, UI formatting/state management, ad-hoc command payload shaping |
| Storage | `app/src-tauri/src/adapters/storage` | DB/filesystem dependencies, `infra/config`, `infra/logging`, `infra/errors`, domain mapping types | UI dependencies, simulation step logic, import parser logic/format inference |
| Import | `app/src-tauri/src/adapters/io` | Format parsers/serializers (SDF/MOL, SMILES, XYZ), domain mapping/validation, `infra/errors`, `infra/logging` | UI dependencies, simulation control logic, direct storage internals mutation from parser code |

## Explicit Anti-Patterns

- UI reads/writes SQLite or local files directly (for example, React code bypassing IPC for `ScenarioRun` data).
- UI sends unversioned/ad-hoc payloads directly to simulation internals instead of contract-based IPC.
- Simulation loop persists frame data directly to DB in the step function.
- Import parser both parses and persists entities in one adapter method.
- Domain code imports adapters/infra/Tauri APIs (inversion of dependency direction).

## Code Review Checklist

- Every changed module maps clearly to one layer from this ADR.
- New imports do not violate the table above.
- Any new cross-layer dependency is rejected unless the ADR is explicitly updated.
