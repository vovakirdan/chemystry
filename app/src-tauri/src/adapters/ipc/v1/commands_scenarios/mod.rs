mod handlers;
mod metadata;
mod snapshot;

use tauri::State;

use crate::infra::errors::CommandResult;
use crate::infra::logging;
use crate::storage::StorageRepository;

use super::contracts::{
    ListSavedScenariosV1Output, LoadScenarioDraftV1Input, LoadScenarioDraftV1Output,
    SaveScenarioDraftV1Input, SaveScenarioDraftV1Output,
};

pub(crate) use handlers::{
    list_saved_scenarios_v1_with_repository, load_scenario_draft_v1_with_repository,
    save_scenario_draft_v1_with_repository,
};

pub(super) const SAVE_SCENARIO_DRAFT_COMMAND_NAME: &str = "save_scenario_draft_v1";
pub(super) const LIST_SAVED_SCENARIOS_COMMAND_NAME: &str = "list_saved_scenarios_v1";
pub(super) const LOAD_SCENARIO_DRAFT_COMMAND_NAME: &str = "load_scenario_draft_v1";

#[tauri::command]
pub fn save_scenario_draft_v1(
    input: SaveScenarioDraftV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<SaveScenarioDraftV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(SAVE_SCENARIO_DRAFT_COMMAND_NAME, &request_id);

    let result = save_scenario_draft_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(SAVE_SCENARIO_DRAFT_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(SAVE_SCENARIO_DRAFT_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn list_saved_scenarios_v1(
    repository: State<'_, StorageRepository>,
) -> CommandResult<ListSavedScenariosV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(LIST_SAVED_SCENARIOS_COMMAND_NAME, &request_id);

    let result = list_saved_scenarios_v1_with_repository(&repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(LIST_SAVED_SCENARIOS_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(LIST_SAVED_SCENARIOS_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn load_scenario_draft_v1(
    input: LoadScenarioDraftV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<LoadScenarioDraftV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(LOAD_SCENARIO_DRAFT_COMMAND_NAME, &request_id);

    let result = load_scenario_draft_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(LOAD_SCENARIO_DRAFT_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(LOAD_SCENARIO_DRAFT_COMMAND_NAME, &error);
            Err(error)
        }
    }
}
