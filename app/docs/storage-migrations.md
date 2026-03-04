# Storage Migrations (E04-T01)

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

## Failure Recovery

- Each migration executes inside a SQLite transaction and is recorded in `schema_migrations` only on commit.
- If migration execution fails:
  - The active transaction is rolled back by SQLite.
  - The failed migration version is not written to `schema_migrations`.
  - Startup returns an error and the app does not continue with partially applied schema changes.

This provides deterministic rollback/repair behavior for migration failures and keeps local data consistent.
