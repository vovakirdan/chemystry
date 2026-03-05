use crate::infra::errors::CommandError;
use crate::storage::StorageError;

use super::super::contracts::CommandErrorV1;
use super::super::validation::validation_error;
use super::super::CONTRACT_VERSION_V1;

fn map_substance_unique_constraint_error(
    request_id: &str,
    error: &StorageError,
) -> Option<CommandErrorV1> {
    if let StorageError::Sqlite { message, .. } = error {
        if message.contains("UNIQUE constraint failed: substance.name, substance.formula") {
            return Some(validation_error(
                request_id,
                "SUBSTANCE_DUPLICATE",
                "A substance with the same `name` and `formula` already exists.",
            ));
        }
    }

    None
}

fn map_storage_substance_error(
    request_id: &str,
    error: StorageError,
    io_code: &'static str,
    io_message: &'static str,
    internal_code: &'static str,
    internal_message: &'static str,
) -> CommandErrorV1 {
    // Intent: preserve existing error-category split so IO faults remain recoverable for IPC clients.
    match error {
        StorageError::AppDataPathResolution(_)
        | StorageError::InvalidDatabasePath(_)
        | StorageError::InvalidBackupFormat { .. }
        | StorageError::Io { .. } => {
            CommandError::io(CONTRACT_VERSION_V1, request_id, io_code, io_message)
        }
        StorageError::Sqlite { .. }
        | StorageError::InvalidMigrationPlan(_)
        | StorageError::DataInvariant(_)
        | StorageError::AsyncTaskJoin(_)
        | StorageError::MigrationFailed { .. } => CommandError::internal(
            CONTRACT_VERSION_V1,
            request_id,
            internal_code,
            internal_message,
        ),
    }
}

fn map_storage_scenario_error(
    request_id: &str,
    error: StorageError,
    io_code: &'static str,
    io_message: &'static str,
    internal_code: &'static str,
    internal_message: &'static str,
) -> CommandErrorV1 {
    // Intent: keep scenario storage errors aligned with legacy io/internal contract codes.
    match error {
        StorageError::AppDataPathResolution(_)
        | StorageError::InvalidDatabasePath(_)
        | StorageError::InvalidBackupFormat { .. }
        | StorageError::Io { .. } => {
            CommandError::io(CONTRACT_VERSION_V1, request_id, io_code, io_message)
        }
        StorageError::Sqlite { .. }
        | StorageError::InvalidMigrationPlan(_)
        | StorageError::DataInvariant(_)
        | StorageError::AsyncTaskJoin(_)
        | StorageError::MigrationFailed { .. } => CommandError::internal(
            CONTRACT_VERSION_V1,
            request_id,
            internal_code,
            internal_message,
        ),
    }
}

pub(crate) fn map_storage_save_scenario_error(
    request_id: &str,
    error: StorageError,
) -> CommandErrorV1 {
    map_storage_scenario_error(
        request_id,
        error,
        "SCENARIO_SAVE_IO_FAILED",
        "Failed to write saved scenario data.",
        "SCENARIO_SAVE_FAILED",
        "Failed to save scenario draft.",
    )
}

pub(crate) fn map_storage_list_saved_scenarios_error(
    request_id: &str,
    error: StorageError,
) -> CommandErrorV1 {
    map_storage_scenario_error(
        request_id,
        error,
        "SCENARIO_LIST_IO_FAILED",
        "Failed to read saved scenarios.",
        "SCENARIO_LIST_FAILED",
        "Failed to list saved scenarios.",
    )
}

pub(crate) fn map_storage_load_scenario_error(
    request_id: &str,
    error: StorageError,
) -> CommandErrorV1 {
    map_storage_scenario_error(
        request_id,
        error,
        "SCENARIO_LOAD_IO_FAILED",
        "Failed to read saved scenario data.",
        "SCENARIO_LOAD_FAILED",
        "Failed to load saved scenario draft.",
    )
}

pub(crate) fn map_storage_create_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    if let Some(mapped_error) = map_substance_unique_constraint_error(request_id, &error) {
        return mapped_error;
    }

    map_storage_substance_error(
        request_id,
        error,
        "SUBSTANCE_CREATE_IO_FAILED",
        "Failed to write local catalog storage.",
        "SUBSTANCE_CREATE_FAILED",
        "Failed to create substance in local catalog.",
    )
}

pub(crate) fn map_storage_update_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    if let Some(mapped_error) = map_substance_unique_constraint_error(request_id, &error) {
        return mapped_error;
    }

    map_storage_substance_error(
        request_id,
        error,
        "SUBSTANCE_UPDATE_IO_FAILED",
        "Failed to write local catalog storage.",
        "SUBSTANCE_UPDATE_FAILED",
        "Failed to update substance in local catalog.",
    )
}

pub(crate) fn map_storage_delete_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    map_storage_substance_error(
        request_id,
        error,
        "SUBSTANCE_DELETE_IO_FAILED",
        "Failed to write local catalog storage.",
        "SUBSTANCE_DELETE_FAILED",
        "Failed to delete substance from local catalog.",
    )
}

pub(crate) fn map_storage_import_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    if let Some(mapped_error) = map_substance_unique_constraint_error(request_id, &error) {
        return CommandError::import(
            CONTRACT_VERSION_V1,
            request_id,
            "IMPORT_DUPLICATE_SUBSTANCE",
            mapped_error.message,
        );
    }

    // Intent: import failures keep a dedicated code path because UI handles them differently than CRUD.
    match error {
        StorageError::AppDataPathResolution(_)
        | StorageError::InvalidDatabasePath(_)
        | StorageError::InvalidBackupFormat { .. }
        | StorageError::Io { .. } => CommandError::io(
            CONTRACT_VERSION_V1,
            request_id,
            "IMPORT_IO_FAILED",
            "Failed to write imported substances to local catalog storage.",
        ),
        StorageError::Sqlite { .. }
        | StorageError::InvalidMigrationPlan(_)
        | StorageError::DataInvariant(_)
        | StorageError::AsyncTaskJoin(_)
        | StorageError::MigrationFailed { .. } => CommandError::internal(
            CONTRACT_VERSION_V1,
            request_id,
            "IMPORT_FAILED",
            "Failed to persist imported substances in local catalog.",
        ),
    }
}

pub(crate) fn map_storage_query_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    match error {
        StorageError::AppDataPathResolution(_)
        | StorageError::InvalidDatabasePath(_)
        | StorageError::InvalidBackupFormat { .. }
        | StorageError::Io { .. } => CommandError::io(
            CONTRACT_VERSION_V1,
            request_id,
            "CATALOG_QUERY_IO_FAILED",
            "Failed to read local catalog storage.",
        ),
        StorageError::Sqlite { .. }
        | StorageError::InvalidMigrationPlan(_)
        | StorageError::DataInvariant(_)
        | StorageError::AsyncTaskJoin(_)
        | StorageError::MigrationFailed { .. } => CommandError::internal(
            CONTRACT_VERSION_V1,
            request_id,
            "CATALOG_QUERY_FAILED",
            "Failed to query local catalog data.",
        ),
    }
}

pub(crate) fn map_storage_list_presets_error(
    request_id: &str,
    error: StorageError,
) -> CommandErrorV1 {
    match error {
        StorageError::AppDataPathResolution(_)
        | StorageError::InvalidDatabasePath(_)
        | StorageError::InvalidBackupFormat { .. }
        | StorageError::Io { .. } => CommandError::io(
            CONTRACT_VERSION_V1,
            request_id,
            "PRESET_LIST_IO_FAILED",
            "Failed to read local preset storage.",
        ),
        StorageError::Sqlite { .. }
        | StorageError::InvalidMigrationPlan(_)
        | StorageError::DataInvariant(_)
        | StorageError::AsyncTaskJoin(_)
        | StorageError::MigrationFailed { .. } => CommandError::internal(
            CONTRACT_VERSION_V1,
            request_id,
            "PRESET_LIST_FAILED",
            "Failed to list local presets.",
        ),
    }
}
