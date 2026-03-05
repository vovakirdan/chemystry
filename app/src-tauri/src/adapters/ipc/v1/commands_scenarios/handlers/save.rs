use crate::infra::errors::{CommandError, CommandResult};
use crate::storage::{NewScenarioRun, StorageRepository, UpdateScenarioRun};

use super::super::super::contracts::{SaveScenarioDraftV1Input, SaveScenarioDraftV1Output};
use super::super::super::mappers::map_storage_save_scenario_error;
use super::super::super::validation::{validate_save_scenario_draft_v1_input, validation_error};
use super::super::super::{
    CONTRACT_VERSION_V1, SCENARIO_SNAPSHOT_T_SIM_S, SCENARIO_SNAPSHOT_VERSION,
};
use super::super::metadata::{
    extract_scenario_amounts_from_builder, scenario_run_metadata_from_runtime,
};
use super::super::snapshot::{
    enrich_calculation_summary_with_scenario_metadata, next_saved_scenario_id,
    now_unix_timestamp_millis, unique_scenario_name, ScenarioDraftSnapshotV1,
};
use super::super::SAVE_SCENARIO_DRAFT_COMMAND_NAME;

pub(crate) fn save_scenario_draft_v1_with_repository(
    input: &SaveScenarioDraftV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<SaveScenarioDraftV1Output> {
    let validated = validate_save_scenario_draft_v1_input(input, request_id)?;
    let metadata = scenario_run_metadata_from_runtime(&validated.runtime);
    let saved_at = now_unix_timestamp_millis();
    let scenario_name = unique_scenario_name(&validated.scenario_name, &saved_at);
    let updated = validated.scenario_id.is_some();

    let saved_run = if let Some(scenario_id) = validated.scenario_id.as_deref() {
        repository
            .get_scenario_run(scenario_id)
            .map_err(|error| {
                eprintln!(
                    "[ipc] storage_failure command={} request_id={} details={}",
                    SAVE_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
                );
                map_storage_save_scenario_error(request_id, error)
            })?
            .ok_or_else(|| {
                validation_error(
                    request_id,
                    "SCENARIO_NOT_FOUND",
                    format!("Scenario `{scenario_id}` was not found."),
                )
            })?;

        repository
            .update_scenario_run(
                scenario_id,
                &UpdateScenarioRun {
                    reaction_template_id: None,
                    name: scenario_name,
                    temperature_k: metadata.temperature_k,
                    pressure_pa: metadata.pressure_pa,
                    gas_medium: metadata.gas_medium,
                    precision_profile: metadata.precision_profile,
                    fps_limit: metadata.fps_limit,
                    particle_limit: metadata.particle_limit,
                },
            )
            .map_err(|error| {
                eprintln!(
                    "[ipc] storage_failure command={} request_id={} details={}",
                    SAVE_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
                );
                map_storage_save_scenario_error(request_id, error)
            })?
            .ok_or_else(|| {
                validation_error(
                    request_id,
                    "SCENARIO_NOT_FOUND",
                    format!("Scenario `{scenario_id}` was not found."),
                )
            })?
    } else {
        let scenario_id = next_saved_scenario_id(request_id);
        repository
            .create_scenario_run(&NewScenarioRun {
                id: scenario_id,
                reaction_template_id: None,
                name: scenario_name,
                temperature_k: metadata.temperature_k,
                pressure_pa: metadata.pressure_pa,
                gas_medium: metadata.gas_medium,
                precision_profile: metadata.precision_profile,
                fps_limit: metadata.fps_limit,
                particle_limit: metadata.particle_limit,
            })
            .map_err(|error| {
                eprintln!(
                    "[ipc] storage_failure command={} request_id={} details={}",
                    SAVE_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
                );
                map_storage_save_scenario_error(request_id, error)
            })?
    };

    let snapshot_payload = ScenarioDraftSnapshotV1 {
        version: SCENARIO_SNAPSHOT_VERSION,
        saved_at: saved_at.clone(),
        updated_at: if updated {
            Some(saved_at.clone())
        } else {
            None
        },
        builder: validated.builder.clone(),
        runtime: validated.runtime.clone(),
        calculation_summary: validated.calculation_summary.clone(),
    };
    let snapshot_json = serde_json::to_string(&snapshot_payload).map_err(|error| {
        eprintln!(
            "[ipc] serialization_failure command={} request_id={} details={}",
            SAVE_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
        );
        CommandError::internal(
            CONTRACT_VERSION_V1,
            request_id,
            "SCENARIO_SNAPSHOT_SERIALIZATION_FAILED",
            "Failed to encode saved scenario payload.",
        )
    })?;
    repository
        .upsert_simulation_frame_summary_json(
            &saved_run.id,
            SCENARIO_SNAPSHOT_T_SIM_S,
            &snapshot_json,
        )
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                SAVE_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
            );
            map_storage_save_scenario_error(request_id, error)
        })?;

    let scenario_amounts = extract_scenario_amounts_from_builder(&validated.builder);
    repository
        .replace_scenario_amounts_from_value(&saved_run.id, &scenario_amounts)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                SAVE_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
            );
            map_storage_save_scenario_error(request_id, error)
        })?;

    let calculation_summary = enrich_calculation_summary_with_scenario_metadata(
        validated.calculation_summary.as_ref(),
        &saved_run.id,
        &saved_run.name,
        &saved_at,
        updated,
    );
    repository
        .replace_calculation_results_from_value(&saved_run.id, calculation_summary.as_ref())
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                SAVE_SCENARIO_DRAFT_COMMAND_NAME, request_id, error
            );
            map_storage_save_scenario_error(request_id, error)
        })?;

    Ok(SaveScenarioDraftV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        scenario_id: saved_run.id,
        scenario_name: saved_run.name,
        created_at: saved_run.created_at,
        updated,
    })
}
