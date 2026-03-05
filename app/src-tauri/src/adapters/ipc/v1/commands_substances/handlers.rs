use crate::infra::errors::CommandResult;
use crate::storage::{NewSubstance, StorageRepository, Substance, UpdateSubstance};

use super::super::contracts::{
    CreateSubstanceV1Input, CreateSubstanceV1Output, DeleteSubstanceV1Input,
    DeleteSubstanceV1Output, ListPresetsV1Output, QuerySubstancesV1Input, QuerySubstancesV1Output,
    UpdateSubstanceV1Input, UpdateSubstanceV1Output,
};
use super::super::mappers::{
    map_storage_create_error, map_storage_delete_error, map_storage_list_presets_error,
    map_storage_query_error, map_storage_update_error, map_substance_to_catalog_item,
    map_template_to_preset_item,
};
use super::super::validation::{
    validate_create_substance_v1_input, validate_delete_substance_v1_input,
    validate_query_substances_v1_input, validate_update_substance_v1_input, validation_error,
};
use super::super::CONTRACT_VERSION_V1;
use super::{
    CREATE_SUBSTANCE_COMMAND_NAME, DELETE_SUBSTANCE_COMMAND_NAME, LIST_PRESETS_COMMAND_NAME,
    QUERY_SUBSTANCES_COMMAND_NAME, UPDATE_SUBSTANCE_COMMAND_NAME,
};

fn ensure_substance_is_user_defined(substance: &Substance, request_id: &str) -> CommandResult<()> {
    if substance.source_type != "user_defined" {
        return Err(validation_error(
            request_id,
            "SUBSTANCE_SOURCE_IMMUTABLE",
            "Only user-defined substances can be updated or deleted.",
        ));
    }

    Ok(())
}

fn next_user_defined_substance_id(request_id: &str) -> String {
    format!("user-substance-{request_id}")
}

pub(crate) fn list_presets_v1_with_repository(
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<ListPresetsV1Output> {
    let templates = repository
        .list_preset_reaction_templates()
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                LIST_PRESETS_COMMAND_NAME, request_id, error
            );
            map_storage_list_presets_error(request_id, error)
        })?;

    Ok(ListPresetsV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        presets: templates
            .into_iter()
            .map(map_template_to_preset_item)
            .collect(),
    })
}

pub(crate) fn create_substance_v1_with_repository(
    input: &CreateSubstanceV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<CreateSubstanceV1Output> {
    let payload = validate_create_substance_v1_input(input, request_id)?;
    let substance_id = next_user_defined_substance_id(request_id);
    let inserted = repository
        .create_substance(&NewSubstance {
            id: substance_id,
            name: payload.name,
            formula: payload.formula,
            smiles: payload.smiles,
            molar_mass_g_mol: payload.molar_mass_g_mol,
            phase_default: payload.phase,
            source_type: "user_defined".to_string(),
        })
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                CREATE_SUBSTANCE_COMMAND_NAME, request_id, error
            );
            map_storage_create_error(request_id, error)
        })?;

    Ok(CreateSubstanceV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        substance: map_substance_to_catalog_item(inserted),
    })
}

pub(crate) fn update_substance_v1_with_repository(
    input: &UpdateSubstanceV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<UpdateSubstanceV1Output> {
    let validated = validate_update_substance_v1_input(input, request_id)?;
    let existing = repository
        .get_substance(&validated.id)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                UPDATE_SUBSTANCE_COMMAND_NAME, request_id, error
            );
            map_storage_update_error(request_id, error)
        })?
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SUBSTANCE_NOT_FOUND",
                format!("Substance `{}` was not found.", validated.id),
            )
        })?;

    ensure_substance_is_user_defined(&existing, request_id)?;

    let updated = repository
        .update_substance(
            &validated.id,
            &UpdateSubstance {
                name: validated.payload.name,
                formula: validated.payload.formula,
                smiles: validated.payload.smiles,
                molar_mass_g_mol: validated.payload.molar_mass_g_mol,
                phase_default: validated.payload.phase,
                source_type: "user_defined".to_string(),
            },
        )
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                UPDATE_SUBSTANCE_COMMAND_NAME, request_id, error
            );
            map_storage_update_error(request_id, error)
        })?
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SUBSTANCE_NOT_FOUND",
                format!("Substance `{}` was not found.", validated.id),
            )
        })?;

    Ok(UpdateSubstanceV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        substance: map_substance_to_catalog_item(updated),
    })
}

pub(crate) fn delete_substance_v1_with_repository(
    input: &DeleteSubstanceV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<DeleteSubstanceV1Output> {
    let validated = validate_delete_substance_v1_input(input, request_id)?;
    let existing = repository
        .get_substance(&validated.id)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                DELETE_SUBSTANCE_COMMAND_NAME, request_id, error
            );
            map_storage_delete_error(request_id, error)
        })?
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SUBSTANCE_NOT_FOUND",
                format!("Substance `{}` was not found.", validated.id),
            )
        })?;

    ensure_substance_is_user_defined(&existing, request_id)?;

    let usage_count = repository
        .count_substance_scenario_usage(&validated.id)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                DELETE_SUBSTANCE_COMMAND_NAME, request_id, error
            );
            map_storage_delete_error(request_id, error)
        })?;
    if usage_count > 0 {
        return Err(validation_error(
            request_id,
            "SUBSTANCE_IN_USE",
            format!(
                "Substance `{}` is used in {usage_count} scenario amount record(s) and cannot be deleted.",
                validated.id
            ),
        ));
    }

    let deleted = repository
        .delete_substance(&validated.id)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                DELETE_SUBSTANCE_COMMAND_NAME, request_id, error
            );
            map_storage_delete_error(request_id, error)
        })?;

    Ok(DeleteSubstanceV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        deleted,
    })
}

pub(crate) fn query_substances_v1_with_repository(
    input: &QuerySubstancesV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<QuerySubstancesV1Output> {
    let filters = validate_query_substances_v1_input(input, request_id)?;
    let substances = repository
        .query_substances(
            filters.search.as_deref(),
            filters.phase_filter.as_deref(),
            filters.source_filter.as_deref(),
        )
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                QUERY_SUBSTANCES_COMMAND_NAME, request_id, error
            );
            map_storage_query_error(request_id, error)
        })?;

    Ok(QuerySubstancesV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        substances: substances
            .into_iter()
            .map(map_substance_to_catalog_item)
            .collect(),
    })
}
