use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::storage::{run_migrations, StorageError};

use super::StorageRepository;

const SQLITE_HEADER_MAGIC: &[u8; 16] = b"SQLite format 3\0";

impl StorageRepository {
    pub fn backup_database(&self, backup_path: &Path) -> Result<(), StorageError> {
        ensure_parent_directory(backup_path, "failed to create backup directory")?;
        validate_sqlite_file(&self.database_path)?;
        let connection = self.open()?;
        connection
            .execute_batch("PRAGMA wal_checkpoint(FULL);")
            .map_err(|error| {
                self.sqlite_error("failed to checkpoint sqlite database before backup", error)
            })?;
        drop(connection);

        fs::copy(&self.database_path, backup_path).map_err(|error| StorageError::Io {
            context: "failed to write database backup",
            path: backup_path.to_path_buf(),
            message: error.to_string(),
        })?;

        validate_sqlite_file(backup_path)
    }

    pub async fn backup_database_async(&self, backup_path: PathBuf) -> Result<(), StorageError> {
        let repository = self.clone();
        tauri::async_runtime::spawn_blocking(move || repository.backup_database(&backup_path))
            .await
            .map_err(|error| StorageError::AsyncTaskJoin(error.to_string()))?
    }

    // Intent: restore validates and stages the candidate database before
    // promotion so the live file is never deleted before a valid replacement exists.
    pub fn restore_database(&self, backup_path: &Path) -> Result<(), StorageError> {
        validate_sqlite_file(backup_path)?;

        let database_parent = self
            .database_path
            .parent()
            .ok_or_else(|| StorageError::InvalidDatabasePath(self.database_path.clone()))?;
        fs::create_dir_all(database_parent).map_err(|error| StorageError::Io {
            context: "failed to create database directory for restore",
            path: database_parent.to_path_buf(),
            message: error.to_string(),
        })?;

        let restore_temp_path = self.database_path.with_extension("restore.tmp.sqlite3");
        fs::copy(backup_path, &restore_temp_path).map_err(|error| StorageError::Io {
            context: "failed to copy backup for restore",
            path: restore_temp_path.clone(),
            message: error.to_string(),
        })?;

        if let Err(validation_error) = validate_sqlite_file(&restore_temp_path) {
            let _ = fs::remove_file(&restore_temp_path);
            return Err(validation_error);
        }

        replace_database_file_atomically(&self.database_path, &restore_temp_path)?;

        run_migrations(&self.database_path)?;
        self.seed_baseline_data()?;
        Ok(())
    }

    pub async fn restore_database_async(&self, backup_path: PathBuf) -> Result<(), StorageError> {
        let repository = self.clone();
        tauri::async_runtime::spawn_blocking(move || repository.restore_database(&backup_path))
            .await
            .map_err(|error| StorageError::AsyncTaskJoin(error.to_string()))?
    }
}

fn replace_database_file_atomically(
    database_path: &Path,
    restore_temp_path: &Path,
) -> Result<(), StorageError> {
    replace_database_file_atomically_with(database_path, restore_temp_path, |source, target| {
        fs::rename(source, target)
    })
}

// Intent: the promote -> rollback fallback sequence preserves the current
// database when rename-over-existing is not supported or fails mid-flight.
pub(super) fn replace_database_file_atomically_with<F>(
    database_path: &Path,
    restore_temp_path: &Path,
    mut rename_path: F,
) -> Result<(), StorageError>
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    let first_promote_error = match rename_path(restore_temp_path, database_path) {
        Ok(()) => return Ok(()),
        Err(error) => error,
    };

    if !database_path.exists() {
        return Err(StorageError::Io {
            context: "failed to promote restored database file",
            path: database_path.to_path_buf(),
            message: first_promote_error.to_string(),
        });
    }

    let rollback_path = database_path.with_extension("restore.rollback.sqlite3");
    if rollback_path.exists() {
        fs::remove_file(&rollback_path).map_err(|error| StorageError::Io {
            context: "failed to clear stale restore rollback file",
            path: rollback_path.clone(),
            message: error.to_string(),
        })?;
    }

    rename_path(database_path, &rollback_path).map_err(|error| StorageError::Io {
        context: "failed to move current database into rollback file",
        path: rollback_path.clone(),
        message: error.to_string(),
    })?;

    match rename_path(restore_temp_path, database_path) {
        Ok(()) => {
            let _ = fs::remove_file(&rollback_path);
            Ok(())
        }
        Err(promote_error) => {
            let rollback_result = rename_path(&rollback_path, database_path);
            if let Err(rollback_error) = rollback_result {
                return Err(StorageError::Io {
                    context:
                        "failed to promote restored database file and rollback current database",
                    path: database_path.to_path_buf(),
                    message: format!(
                        "promote_error={promote_error}; rollback_error={rollback_error}"
                    ),
                });
            }

            Err(StorageError::Io {
                context: "failed to promote restored database file",
                path: database_path.to_path_buf(),
                message: promote_error.to_string(),
            })
        }
    }
}

fn ensure_parent_directory(path: &Path, error_context: &'static str) -> Result<(), StorageError> {
    if let Some(parent) = path.parent().filter(|entry| !entry.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|error| StorageError::Io {
            context: error_context,
            path: parent.to_path_buf(),
            message: error.to_string(),
        })?;
    }

    Ok(())
}

pub(super) fn validate_sqlite_file(path: &Path) -> Result<(), StorageError> {
    let mut file = File::open(path).map_err(|error| StorageError::Io {
        context: "failed to open sqlite file",
        path: path.to_path_buf(),
        message: error.to_string(),
    })?;

    let mut header = [0_u8; SQLITE_HEADER_MAGIC.len()];
    file.read_exact(&mut header)
        .map_err(|error| StorageError::InvalidBackupFormat {
            path: path.to_path_buf(),
            message: format!("unable to read sqlite header: {error}"),
        })?;

    if &header != SQLITE_HEADER_MAGIC {
        return Err(StorageError::InvalidBackupFormat {
            path: path.to_path_buf(),
            message: "expected SQLite header 'SQLite format 3\\0'".to_string(),
        });
    }

    Ok(())
}
