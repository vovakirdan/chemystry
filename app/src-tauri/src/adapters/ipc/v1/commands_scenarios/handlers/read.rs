use crate::infra::errors::{CommandError, CommandResult};
use crate::storage::StorageRepository;

use super::super::super::contracts::{
    ListSavedScenariosV1Output, LoadScenarioDraftV1Input, LoadScenarioDraftV1Output,
    SavedScenarioListItemV1,
};
use super::super::super::mappers::{
    map_storage_list_saved_scenarios_error, map_storage_load_scenario_error,
};
use super::super::super::validation::{validate_load_scenario_draft_v1_input, validation_error};
use super::super::super::{
    CONTRACT_VERSION_V1, SCENARIO_SNAPSHOT_T_SIM_S, SCENARIO_SNAPSHOT_VERSION,
};
use super::super::snapshot::ScenarioDraftSnapshotV1;
use super::super::{LIST_SAVED_SCENARIOS_COMMAND_NAME, LOAD_SCENARIO_DRAFT_COMMAND_NAME};

pub(crate) fn list_saved_scenarios_v1_with_repository(
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<ListSavedScenariosV1Output> {
    let runs = repository.list_scenario_runs().map_err(|error| {
        eprintln!(
            "[ipc] storage_failure command={} request_id={} details={}",
            LIST_SAVED_SCENARIOS_COMMAND_NAME, request_id, error
        );
        map_storage_list_saved_scenarios_error(request_id, error)
    })?;

    let mut scenarios = Vec::new();
    for run in runs {
        let snapshot_json = repository
            .read_simulation_frame_summary_json(&run.id, SCENARIO_SNAPSHOT_T_SIM_S)
            .map_err(|error| {
                eprintln!(
                    "[ipc] storage_failure command={} request_id={} details={}",
                    LIST_SAVED_SCENARIOS_COMMAND_NAME, request_id, error
                );
                map_storage_list_saved_scenarios_error(request_id, error)
            })?;
        let Some(snapshot_json) = snapshot_json else {
            continue;
        };

        let snapshot: ScenarioDraftSnapshotV1 =
            serde_json::from_str(&snapshot_json).map_err(|error| {
                eprintln!(
                    "[ipc] serialization_failure command={} request_id={} details={}",
                    LIST_SAVED_SCENARIOS_COMMAND_NAME, request_id, error
                );
                CommandError::internal(
                    CONTRACT_VERSION_V1,
                    request_id,
                    "SCENARIO_LIST_CORRUPTED_SNAPSHOT",
                    "Failed to decode saved scenario snapshot.",
                )
            })?;
        if snapshot.version != SCENARIO_SNAPSHOT_VERSION {
            return Err(CommandError::internal(
                CONTRACT_VERSION_V1,
                request_id,
                "SCENARIO_LIST_UNSUPPORTED_SNAPSHOT_VERSION",
                "Saved scenario snapshot version is not supported.",
            ));
        }

        scenarios.push(SavedScenarioListItemV1 {
            id: run.id,
            name: run.name,
            created_at: run.created_at,
            updated_at: snapshot.updated_at,
        });
    }

    Ok(ListSavedScenariosV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        scenarios,
    })
}

pub(crate) fn load_scenario_draft_v1_with_repository(
    input: &LoadScenarioDraftV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<LoadScenarioDraftV1Output> {
    let validated = validate_load_scenario_draft_v1_input(input, request_id)?;
    let run = repository
        .get_scenario_run(&validated.scenario_id)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                LOAD_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
            );
            map_storage_load_scenario_error(request_id, error)
        })?
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_NOT_FOUND",
                format!("Scenario `{}` was not found.", validated.scenario_id),
            )
        })?;

    let snapshot_json = repository
        .read_simulation_frame_summary_json(&run.id, SCENARIO_SNAPSHOT_T_SIM_S)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                LOAD_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
            );
            map_storage_load_scenario_error(request_id, error)
        })?
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_DRAFT_NOT_FOUND",
                format!("Saved draft for scenario `{}` was not found.", run.id),
            )
        })?;

    let snapshot: ScenarioDraftSnapshotV1 =
        serde_json::from_str(&snapshot_json).map_err(|error| {
            eprintln!(
                "[ipc] serialization_failure command={} request_id={} details={}",
                LOAD_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
            );
            CommandError::internal(
                CONTRACT_VERSION_V1,
                request_id,
                "SCENARIO_LOAD_CORRUPTED_SNAPSHOT",
                "Failed to decode saved scenario payload.",
            )
        })?;
    if snapshot.version != SCENARIO_SNAPSHOT_VERSION {
        return Err(CommandError::internal(
            CONTRACT_VERSION_V1,
            request_id,
            "SCENARIO_LOAD_UNSUPPORTED_SNAPSHOT_VERSION",
            "Saved scenario snapshot version is not supported.",
        ));
    }

    Ok(LoadScenarioDraftV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        scenario_id: run.id,
        scenario_name: run.name,
        builder: snapshot.builder,
        runtime: snapshot.runtime,
        calculation_summary: snapshot.calculation_summary,
    })
}
