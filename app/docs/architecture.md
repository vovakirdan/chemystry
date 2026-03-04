# Architecture (E01-T03)

This document defines where architecture artifacts live for the Tauri + React app.

## Baseline Preservation Rule

Preserve the quickstart-generated baseline from `create-tauri-app` (React + TS + Tauri v2).
Do not remove or relocate baseline entry/config files; extend them incrementally.
Baseline anchors include:

- Frontend bootstrap: `src/main.tsx`, `src/App.tsx`
- Tauri bootstrap: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Existing scaffold/config files under `app/` and `src-tauri/`

## Frontend Module Layout

- `src/app/`: application shell and composition root (providers, routing, global app wiring)
- `src/features/`: feature modules, one folder per business capability
- `src/shared/`: reusable cross-feature code (UI primitives, shared utilities, shared types/API clients)

## Backend (Tauri/Rust) Module Layout

- `src-tauri/src/domain/`: core domain models and business rules
- `src-tauri/src/adapters/`: ports/adapters for boundaries (UI command handlers, external interfaces)
- `src-tauri/src/infra/`: infrastructure implementations (filesystem, persistence, OS/service integrations)

## Artifact Location Map

| Artifact type | Location |
| --- | --- |
| Frontend app composition/root wiring | `src/app/` |
| Frontend feature logic/UI by capability | `src/features/<feature>/` |
| Frontend shared reusable modules | `src/shared/` |
| Backend domain model/rules | `src-tauri/src/domain/` |
| Backend boundary adapters | `src-tauri/src/adapters/` |
| Backend infrastructure implementations | `src-tauri/src/infra/` |
| Architecture documentation | `docs/architecture.md` |
| Architecture decisions (ADR) | `docs/adr/` |
