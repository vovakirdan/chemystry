mod handlers;

use tauri::State;

use crate::infra::errors::CommandResult;
use crate::infra::logging;
use crate::storage::StorageRepository;

use super::contracts::{
    CreateSubstanceV1Input, CreateSubstanceV1Output, DeleteSubstanceV1Input,
    DeleteSubstanceV1Output, ListPresetsV1Output, QuerySubstancesV1Input, QuerySubstancesV1Output,
    UpdateSubstanceV1Input, UpdateSubstanceV1Output,
};

pub(crate) use handlers::{
    create_substance_v1_with_repository, delete_substance_v1_with_repository,
    list_presets_v1_with_repository, query_substances_v1_with_repository,
    update_substance_v1_with_repository,
};

pub(super) const LIST_PRESETS_COMMAND_NAME: &str = "list_presets_v1";
pub(super) const QUERY_SUBSTANCES_COMMAND_NAME: &str = "query_substances_v1";
pub(super) const CREATE_SUBSTANCE_COMMAND_NAME: &str = "create_substance_v1";
pub(super) const UPDATE_SUBSTANCE_COMMAND_NAME: &str = "update_substance_v1";
pub(super) const DELETE_SUBSTANCE_COMMAND_NAME: &str = "delete_substance_v1";

#[tauri::command]
pub fn list_presets_v1(
    repository: State<'_, StorageRepository>,
) -> CommandResult<ListPresetsV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(LIST_PRESETS_COMMAND_NAME, &request_id);

    let result = list_presets_v1_with_repository(&repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(LIST_PRESETS_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(LIST_PRESETS_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn create_substance_v1(
    input: CreateSubstanceV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<CreateSubstanceV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(CREATE_SUBSTANCE_COMMAND_NAME, &request_id);

    let result = create_substance_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(CREATE_SUBSTANCE_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(CREATE_SUBSTANCE_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn update_substance_v1(
    input: UpdateSubstanceV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<UpdateSubstanceV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(UPDATE_SUBSTANCE_COMMAND_NAME, &request_id);

    let result = update_substance_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(UPDATE_SUBSTANCE_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(UPDATE_SUBSTANCE_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn delete_substance_v1(
    input: DeleteSubstanceV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<DeleteSubstanceV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(DELETE_SUBSTANCE_COMMAND_NAME, &request_id);

    let result = delete_substance_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(DELETE_SUBSTANCE_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(DELETE_SUBSTANCE_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn query_substances_v1(
    input: QuerySubstancesV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<QuerySubstancesV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(QUERY_SUBSTANCES_COMMAND_NAME, &request_id);

    let result = query_substances_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(QUERY_SUBSTANCES_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(QUERY_SUBSTANCES_COMMAND_NAME, &error);
            Err(error)
        }
    }
}
