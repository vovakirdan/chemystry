use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};

use fs2::FileExt;
use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager, Runtime};

const STORAGE_DIRECTORY_NAME: &str = "storage";
const DATABASE_FILE_NAME: &str = "chemystry.sqlite3";
const SCHEMA_MIGRATIONS_TABLE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"#;

const MIGRATION_0001_INIT_STORAGE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"#;

#[derive(Debug, Clone, Copy)]
struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "0001_init_storage_metadata",
    sql: MIGRATION_0001_INIT_STORAGE_SQL,
}];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationReport {
    pub applied_versions: Vec<i64>,
}

#[derive(Debug)]
pub enum StorageError {
    AppDataPathResolution(String),
    InvalidDatabasePath(PathBuf),
    Io {
        context: &'static str,
        path: PathBuf,
        message: String,
    },
    Sqlite {
        context: &'static str,
        path: PathBuf,
        message: String,
    },
    InvalidMigrationPlan(String),
    MigrationFailed {
        version: i64,
        name: &'static str,
        message: String,
        repaired: bool,
    },
}

impl Display for StorageError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AppDataPathResolution(message) => {
                write!(f, "failed to resolve app data directory: {message}")
            }
            Self::InvalidDatabasePath(path) => {
                write!(
                    f,
                    "database path has no parent directory: {}",
                    path.display()
                )
            }
            Self::Io {
                context,
                path,
                message,
            } => write!(f, "{context} at {}: {message}", path.display()),
            Self::Sqlite {
                context,
                path,
                message,
            } => write!(f, "{context} at {}: {message}", path.display()),
            Self::InvalidMigrationPlan(message) => write!(f, "{message}"),
            Self::MigrationFailed {
                version,
                name,
                message,
                repaired,
            } => write!(
                f,
                "migration {version} ({name}) failed: {message}. repair_applied={repaired}"
            ),
        }
    }
}

impl Error for StorageError {}

/// Resolves the app-local database path and runs all pending migrations.
///
/// This is intentionally invoked during app startup to keep the on-disk schema
/// aligned with the binary before any repository code starts using SQLite.
pub fn bootstrap_storage<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, StorageError> {
    let database_path = resolve_database_path(app_handle)?;
    run_migrations(&database_path)?;
    Ok(database_path)
}

fn resolve_database_path<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, StorageError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| StorageError::AppDataPathResolution(error.to_string()))?;
    let storage_dir = app_data_dir.join(STORAGE_DIRECTORY_NAME);

    fs::create_dir_all(&storage_dir).map_err(|error| StorageError::Io {
        context: "failed to create storage directory",
        path: storage_dir.clone(),
        message: error.to_string(),
    })?;

    Ok(storage_dir.join(DATABASE_FILE_NAME))
}

pub fn run_migrations(database_path: &Path) -> Result<MigrationReport, StorageError> {
    run_migrations_with(database_path, MIGRATIONS)
}

fn run_migrations_with(
    database_path: &Path,
    migrations: &[Migration],
) -> Result<MigrationReport, StorageError> {
    validate_migration_plan(migrations)?;
    ensure_database_directory(database_path)?;
    let _migration_lock = MigrationLock::acquire(database_path)?;
    ensure_schema_migrations_table(database_path)?;

    let applied = load_applied_migrations(database_path)?;
    ensure_applied_migrations_are_known(migrations, &applied)?;
    let applied_versions = applied.keys().copied().collect::<BTreeSet<_>>();
    let mut newly_applied = Vec::new();

    for migration in migrations {
        if applied_versions.contains(&migration.version) {
            continue;
        }

        if let Err(error) = apply_single_migration(database_path, migration) {
            return Err(StorageError::MigrationFailed {
                version: migration.version,
                name: migration.name,
                message: error.to_string(),
                repaired: true,
            });
        }

        newly_applied.push(migration.version);
    }

    Ok(MigrationReport {
        applied_versions: newly_applied,
    })
}

fn validate_migration_plan(migrations: &[Migration]) -> Result<(), StorageError> {
    if migrations.is_empty() {
        return Ok(());
    }

    let mut expected_next_version = 1_i64;
    for migration in migrations {
        if migration.version != expected_next_version {
            return Err(StorageError::InvalidMigrationPlan(format!(
                "migration versions must be contiguous and start at 1. expected version {expected_next_version}, got {} ({})",
                migration.version, migration.name
            )));
        }
        expected_next_version += 1;
    }

    Ok(())
}

fn ensure_database_directory(database_path: &Path) -> Result<(), StorageError> {
    let parent_directory = database_path
        .parent()
        .ok_or_else(|| StorageError::InvalidDatabasePath(database_path.to_path_buf()))?;

    fs::create_dir_all(parent_directory).map_err(|error| StorageError::Io {
        context: "failed to create database directory",
        path: parent_directory.to_path_buf(),
        message: error.to_string(),
    })
}

fn ensure_schema_migrations_table(database_path: &Path) -> Result<(), StorageError> {
    let connection = open_connection(database_path)?;
    connection
        .execute_batch(SCHEMA_MIGRATIONS_TABLE_SQL)
        .map_err(|error| StorageError::Sqlite {
            context: "failed to create schema_migrations table",
            path: database_path.to_path_buf(),
            message: error.to_string(),
        })
}

fn load_applied_migrations(database_path: &Path) -> Result<BTreeMap<i64, String>, StorageError> {
    let connection = open_connection(database_path)?;
    let mut statement = connection
        .prepare("SELECT version, name FROM schema_migrations ORDER BY version ASC")
        .map_err(|error| StorageError::Sqlite {
            context: "failed to prepare applied migrations query",
            path: database_path.to_path_buf(),
            message: error.to_string(),
        })?;

    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<usize, i64>(0)?, row.get::<usize, String>(1)?))
        })
        .map_err(|error| StorageError::Sqlite {
            context: "failed to read applied migrations",
            path: database_path.to_path_buf(),
            message: error.to_string(),
        })?;

    let mut migrations = BTreeMap::new();
    for row in rows {
        let (version, name) = row.map_err(|error| StorageError::Sqlite {
            context: "failed to decode applied migration row",
            path: database_path.to_path_buf(),
            message: error.to_string(),
        })?;
        migrations.insert(version, name);
    }

    Ok(migrations)
}

fn ensure_applied_migrations_are_known(
    migration_plan: &[Migration],
    applied: &BTreeMap<i64, String>,
) -> Result<(), StorageError> {
    let known = migration_plan
        .iter()
        .map(|migration| (migration.version, migration.name))
        .collect::<BTreeMap<_, _>>();

    for (version, name) in applied {
        let Some(expected_name) = known.get(version) else {
            return Err(StorageError::InvalidMigrationPlan(format!(
                "database contains unknown migration version {version} ({name})"
            )));
        };

        if name != expected_name {
            return Err(StorageError::InvalidMigrationPlan(format!(
                "database migration name mismatch for version {version}: expected {expected_name}, got {name}"
            )));
        }
    }

    Ok(())
}

fn apply_single_migration(
    database_path: &Path,
    migration: &Migration,
) -> Result<(), rusqlite::Error> {
    let mut connection = Connection::open(database_path)?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;

    let transaction = connection.transaction()?;
    transaction.execute_batch(migration.sql)?;
    transaction.execute(
        "INSERT INTO schema_migrations(version, name) VALUES (?1, ?2)",
        params![migration.version, migration.name],
    )?;
    transaction.commit()?;
    Ok(())
}

fn open_connection(database_path: &Path) -> Result<Connection, StorageError> {
    let connection = Connection::open(database_path).map_err(|error| StorageError::Sqlite {
        context: "failed to open sqlite database",
        path: database_path.to_path_buf(),
        message: error.to_string(),
    })?;

    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| StorageError::Sqlite {
            context: "failed to configure sqlite connection",
            path: database_path.to_path_buf(),
            message: error.to_string(),
        })?;

    Ok(connection)
}

/// Cross-process lock that guarantees only one migration runner mutates schema.
struct MigrationLock {
    _file: File,
}

impl MigrationLock {
    fn acquire(database_path: &Path) -> Result<Self, StorageError> {
        let lock_path = migration_lock_path_for(database_path);
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&lock_path)
            .map_err(|error| StorageError::Io {
                context: "failed to open migration lock file",
                path: lock_path.clone(),
                message: error.to_string(),
            })?;

        file.lock_exclusive().map_err(|error| StorageError::Io {
            context: "failed to acquire migration lock",
            path: lock_path,
            message: error.to_string(),
        })?;

        Ok(Self { _file: file })
    }
}

fn migration_lock_path_for(database_path: &Path) -> PathBuf {
    let lock_name = format!(
        "{}.migration.lock",
        database_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(DATABASE_FILE_NAME)
    );

    database_path.with_file_name(lock_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    const TEST_MIGRATION_0001_SQL: &str = r#"
CREATE TABLE baseline_table (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL
);
INSERT INTO baseline_table(id, label) VALUES (1, 'baseline');
"#;

    const TEST_MIGRATION_0002_FAIL_SQL: &str = r#"
CREATE TABLE broken_table (
    id INTEGER PRIMARY KEY
);
THIS IS NOT VALID SQL;
"#;

    #[test]
    fn runs_migrations_on_clean_database_and_is_idempotent() {
        let temp_dir = TempDir::new().expect("must create temporary directory");
        let database_path = temp_dir.path().join("nested").join("clean.sqlite3");

        let first_run = run_migrations(&database_path).expect("migrations should succeed");
        assert_eq!(first_run.applied_versions, vec![1]);

        assert!(
            table_exists(&database_path, "schema_migrations"),
            "schema_migrations table should exist"
        );
        assert!(
            table_exists(&database_path, "app_metadata"),
            "initial migration table should exist"
        );

        let second_run = run_migrations(&database_path).expect("rerun should be safe");
        assert!(
            second_run.applied_versions.is_empty(),
            "no migration should re-apply"
        );
    }

    #[test]
    fn rolls_back_failed_migration_when_plan_errors() {
        let temp_dir = TempDir::new().expect("must create temporary directory");
        let database_path = temp_dir.path().join("repair.sqlite3");

        let initial_migrations = [Migration {
            version: 1,
            name: "0001_create_baseline",
            sql: TEST_MIGRATION_0001_SQL,
        }];
        run_migrations_with(&database_path, &initial_migrations)
            .expect("baseline migration should succeed");

        let failing_plan = [
            Migration {
                version: 1,
                name: "0001_create_baseline",
                sql: TEST_MIGRATION_0001_SQL,
            },
            Migration {
                version: 2,
                name: "0002_broken_migration",
                sql: TEST_MIGRATION_0002_FAIL_SQL,
            },
        ];

        let error = run_migrations_with(&database_path, &failing_plan)
            .expect_err("second migration should fail and trigger repair");
        match error {
            StorageError::MigrationFailed {
                version,
                name,
                repaired,
                ..
            } => {
                assert_eq!(version, 2);
                assert_eq!(name, "0002_broken_migration");
                assert!(repaired, "repair strategy should run");
            }
            other => panic!("unexpected error type: {other:?}"),
        }

        let applied_versions = read_applied_versions(&database_path);
        assert_eq!(
            applied_versions,
            vec![1],
            "failed migration must not be recorded"
        );
        assert!(
            table_exists(&database_path, "baseline_table"),
            "baseline state should be preserved after repair"
        );
        assert_eq!(
            read_baseline_row_count(&database_path),
            1,
            "baseline row should remain after repair"
        );
        assert!(
            !table_exists(&database_path, "broken_table"),
            "failed migration table must not exist after rollback"
        );
    }

    #[test]
    fn repairs_failed_first_migration_without_preexisting_database() {
        let temp_dir = TempDir::new().expect("must create temporary directory");
        let database_path = temp_dir.path().join("fresh-failure.sqlite3");

        let failing_plan = [Migration {
            version: 1,
            name: "0001_broken_migration",
            sql: TEST_MIGRATION_0002_FAIL_SQL,
        }];

        let error = run_migrations_with(&database_path, &failing_plan)
            .expect_err("migration should fail and trigger repair");

        match error {
            StorageError::MigrationFailed {
                version,
                name,
                repaired,
                ..
            } => {
                assert_eq!(version, 1);
                assert_eq!(name, "0001_broken_migration");
                assert!(repaired, "repair strategy should complete");
            }
            other => panic!("unexpected error type: {other:?}"),
        }

        assert!(
            database_path.exists(),
            "repair should restore baseline database file"
        );
        assert!(
            table_exists(&database_path, "schema_migrations"),
            "schema_migrations table should remain available after repair"
        );
        assert!(
            !table_exists(&database_path, "broken_table"),
            "failed migration table must not exist after repair"
        );
        assert_eq!(
            read_applied_versions(&database_path),
            Vec::<i64>::new(),
            "failed first migration must not be recorded as applied"
        );
    }

    fn table_exists(database_path: &Path, table_name: &str) -> bool {
        let connection = Connection::open(database_path).expect("must open test database");
        let mut statement = connection
            .prepare("SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .expect("must prepare table lookup");
        let count: i64 = statement
            .query_row([table_name], |row| row.get(0))
            .expect("must query table lookup");
        count == 1
    }

    fn read_applied_versions(database_path: &Path) -> Vec<i64> {
        let connection = Connection::open(database_path).expect("must open test database");
        let mut statement = connection
            .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
            .expect("must prepare migrations query");
        let rows = statement
            .query_map([], |row| row.get::<usize, i64>(0))
            .expect("must query applied migrations");

        rows.map(|row| row.expect("must decode row"))
            .collect::<Vec<_>>()
    }

    fn read_baseline_row_count(database_path: &Path) -> i64 {
        let connection = Connection::open(database_path).expect("must open test database");
        connection
            .query_row("SELECT COUNT(1) FROM baseline_table", [], |row| row.get(0))
            .expect("must query baseline row count")
    }
}
