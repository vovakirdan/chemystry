# Storage Migrations and Repository (E04)

## Policy

- All schema changes are applied through versioned Rust migration entries in `src-tauri/src/adapters/storage/mod.rs`.
- Migration versions are contiguous and start from `1`.
- Applied versions are tracked in SQLite table `schema_migrations`.
- Re-running startup migrations is idempotent: already applied versions are skipped.

## Startup Behavior

- On app startup, `bootstrap_storage` resolves the app-local DB path:
  - `<app_data_dir>/storage/chemystry.sqlite3`
- The storage directory is created if missing.
- The runner acquires an exclusive cross-process lock file (`*.migration.lock`) so only one app instance can migrate at a time.
- Pending migrations execute automatically before IPC handlers are used.
- After migrations, baseline storage seed runs via `StorageRepository::seed_baseline_data()`.

## Implemented Versions

- `0001_init_storage_metadata`: creates `app_metadata`.
- `0002_create_core_chemical_data`: creates `substance`, `reaction_template`, `reaction_species` with FK/unique/check constraints.
- `0003_create_scenario_calculation_import_data`: creates `scenario_run`, `scenario_amount`, `simulation_frame_summary`, `calculation_result`, `import_job` with FK/unique/check constraints and query indexes for `scenario_run_id`/`created_at`.
- Review artifacts:
  - `schema-dump-e04-t03.sql`
  - `storage-json-fields-e04-t03.md`

## Repository API (E04-T04)

Repository entry point: `src-tauri/src/adapters/storage/repository.rs` (`StorageRepository`).

Critical entity CRUD covered:

- `substance`
  - `create_substance`, `get_substance`, `list_substances`, `update_substance`, `delete_substance`
- `reaction_template`
  - `create_reaction_template`, `get_reaction_template`, `list_reaction_templates`, `update_reaction_template`, `delete_reaction_template`
- `scenario_run`
  - `create_scenario_run`, `get_scenario_run`, `list_scenario_runs`, `update_scenario_run`, `delete_scenario_run`

All repository methods return typed Rust structs and map SQL/IO failures to `StorageError`.

## Baseline Seed (Idempotent)

`seed_baseline_data` runs in a single transaction and reconciles rows by natural unique keys before id-based updates/inserts:

- `substance`: `name + formula`
- `reaction_template`: `title + version`
- `reaction_species`: `reaction_template_id + substance_id + role`

Seed set includes:

- Built-in substances: `H2`, `O2`, `H2O`, `HCl`, `NaOH`, `NaCl`
- Built-in preset templates:
  - `Hydrogen combustion` (`2H2 + O2 -> 2H2O`)
  - `Strong acid/base neutralization` (`HCl + NaOH -> NaCl + H2O`)
- Preset reaction species rows for stoichiometric participants

Running seed multiple times does not create duplicates and safely handles upgraded DBs where built-in rows may already exist under different IDs.

## Backup / Restore

Sync methods:

- `backup_database(&Path)`
- `restore_database(&Path)`

Async wrappers (UI-safe):

- `backup_database_async(PathBuf)`
- `restore_database_async(PathBuf)`

Async wrappers run the blocking file work using `tauri::async_runtime::spawn_blocking` to avoid blocking the UI thread.

Validation/consistency rules:

- Backup/restore file format validation checks SQLite magic header (`SQLite format 3\0`) at minimum.
- `restore_database` validates source file, stages a temporary restore copy, then performs safe replacement:
  - tries rename-over-existing (atomic where supported),
  - if that fails, moves current DB to rollback file, promotes restored DB, and rolls back on failure.
- Restore flow does not delete the current DB before promotion succeeds.
- Migration SQL remains the schema source of truth; seed and restore do not mutate migration history manually.

## Failure Recovery

- Each migration executes inside a SQLite transaction and is recorded in `schema_migrations` only on commit.
- If migration execution fails:
  - The active transaction is rolled back by SQLite.
  - The failed migration version is not written to `schema_migrations`.
  - Startup returns an error and the app does not continue with partially applied schema changes.

This provides deterministic rollback/repair behavior for migration failures and keeps local data consistent.
