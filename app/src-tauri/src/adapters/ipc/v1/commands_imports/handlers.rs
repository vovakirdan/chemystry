use std::collections::BTreeSet;

use crate::infra::errors::{CommandError, CommandResult};
use crate::io::sdf_mol::parse_sdf_mol;
use crate::io::smiles::parse_smiles;
use crate::io::xyz::parse_xyz;
use crate::storage::{NewSubstance, StorageRepository};

use super::super::contracts::{
    ImportSdfMolV1Input, ImportSdfMolV1Output, ImportSmilesV1Input, ImportSmilesV1Output,
    ImportXyzInferenceSummaryV1, ImportXyzV1Input, ImportXyzV1Output, SubstanceCatalogItemV1,
};
use super::super::mappers::{
    map_import_sdf_mol_parse_error, map_import_smiles_parse_error, map_import_xyz_parse_error,
    map_storage_import_error,
};
use super::super::validation::{
    validate_import_sdf_mol_v1_input, validate_import_smiles_v1_input, validate_import_xyz_v1_input,
};
use super::super::CONTRACT_VERSION_V1;
use super::{IMPORT_SDF_MOL_COMMAND_NAME, IMPORT_SMILES_COMMAND_NAME, IMPORT_XYZ_COMMAND_NAME};

fn next_imported_substance_id(request_id: &str, record_index: usize) -> String {
    format!("imported-substance-{request_id}-{record_index}")
}

fn import_duplicate_key(name: &str, formula: &str) -> (String, String) {
    (name.trim().to_lowercase(), formula.trim().to_lowercase())
}

pub(crate) fn import_sdf_mol_v1_with_repository(
    input: &ImportSdfMolV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<ImportSdfMolV1Output> {
    let validated = validate_import_sdf_mol_v1_input(input, request_id)?;
    let parsed_substances =
        parse_sdf_mol(&validated.file_name, &validated.contents).map_err(|error| {
            eprintln!(
                "[ipc] import_parse_failure command={} request_id={} details={}",
                IMPORT_SDF_MOL_COMMAND_NAME, request_id, error
            );
            map_import_sdf_mol_parse_error(request_id, error)
        })?;

    let existing = repository.list_substances().map_err(|error| {
        eprintln!(
            "[ipc] storage_failure command={} request_id={} details={}",
            IMPORT_SDF_MOL_COMMAND_NAME, request_id, error
        );
        map_storage_import_error(request_id, error)
    })?;
    let mut seen_keys: BTreeSet<(String, String)> = existing
        .iter()
        .map(|substance| import_duplicate_key(&substance.name, &substance.formula))
        .collect();

    let mut batched_inserts = Vec::with_capacity(parsed_substances.len());
    let mut imported_substances = Vec::with_capacity(parsed_substances.len());
    for (index, parsed) in parsed_substances.into_iter().enumerate() {
        let duplicate_key = import_duplicate_key(&parsed.name, &parsed.formula);
        if seen_keys.contains(&duplicate_key) {
            return Err(CommandError::import(
                CONTRACT_VERSION_V1,
                request_id,
                "IMPORT_DUPLICATE_SUBSTANCE",
                format!(
                    "Duplicate substance in `{}` at record {} (name=`{}`, formula=`{}`).",
                    validated.file_name, parsed.record_index, parsed.name, parsed.formula
                ),
            ));
        }
        seen_keys.insert(duplicate_key);

        let import_id = next_imported_substance_id(request_id, index + 1);
        batched_inserts.push(NewSubstance {
            id: import_id.clone(),
            name: parsed.name.clone(),
            formula: parsed.formula.clone(),
            smiles: None,
            molar_mass_g_mol: parsed.molar_mass_g_mol,
            phase_default: "solid".to_string(),
            source_type: "imported".to_string(),
        });
        imported_substances.push(SubstanceCatalogItemV1 {
            id: import_id,
            name: parsed.name,
            formula: parsed.formula,
            smiles: None,
            molar_mass_g_mol: parsed.molar_mass_g_mol,
            phase: "solid".to_string(),
            source: "imported".to_string(),
        });
    }

    repository
        .create_substances_batch(&batched_inserts)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                IMPORT_SDF_MOL_COMMAND_NAME, request_id, error
            );
            map_storage_import_error(request_id, error)
        })?;

    Ok(ImportSdfMolV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        imported_count: imported_substances.len(),
        substances: imported_substances,
    })
}

pub(crate) fn import_smiles_v1_with_repository(
    input: &ImportSmilesV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<ImportSmilesV1Output> {
    let validated = validate_import_smiles_v1_input(input, request_id)?;
    let parsed_substances =
        parse_smiles(&validated.file_name, &validated.contents).map_err(|error| {
            eprintln!(
                "[ipc] import_parse_failure command={} request_id={} details={}",
                IMPORT_SMILES_COMMAND_NAME, request_id, error
            );
            map_import_smiles_parse_error(request_id, error)
        })?;

    let existing = repository.list_substances().map_err(|error| {
        eprintln!(
            "[ipc] storage_failure command={} request_id={} details={}",
            IMPORT_SMILES_COMMAND_NAME, request_id, error
        );
        map_storage_import_error(request_id, error)
    })?;
    let mut seen_keys: BTreeSet<(String, String)> = existing
        .iter()
        .map(|substance| import_duplicate_key(&substance.name, &substance.formula))
        .collect();

    let mut batched_inserts = Vec::with_capacity(parsed_substances.len());
    let mut imported_substances = Vec::with_capacity(parsed_substances.len());
    for (index, parsed) in parsed_substances.into_iter().enumerate() {
        let duplicate_key = import_duplicate_key(&parsed.name, &parsed.formula);
        if seen_keys.contains(&duplicate_key) {
            return Err(CommandError::import(
                CONTRACT_VERSION_V1,
                request_id,
                "IMPORT_DUPLICATE_SUBSTANCE",
                format!(
                    "Duplicate substance in `{}` at record {} (name=`{}`, formula=`{}`).",
                    validated.file_name, parsed.record_index, parsed.name, parsed.formula
                ),
            ));
        }
        seen_keys.insert(duplicate_key);

        let import_id = next_imported_substance_id(request_id, index + 1);
        batched_inserts.push(NewSubstance {
            id: import_id.clone(),
            name: parsed.name.clone(),
            formula: parsed.formula.clone(),
            smiles: Some(parsed.smiles.clone()),
            molar_mass_g_mol: parsed.molar_mass_g_mol,
            phase_default: "solid".to_string(),
            source_type: "imported".to_string(),
        });
        imported_substances.push(SubstanceCatalogItemV1 {
            id: import_id,
            name: parsed.name,
            formula: parsed.formula,
            smiles: Some(parsed.smiles),
            molar_mass_g_mol: parsed.molar_mass_g_mol,
            phase: "solid".to_string(),
            source: "imported".to_string(),
        });
    }

    repository
        .create_substances_batch(&batched_inserts)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                IMPORT_SMILES_COMMAND_NAME, request_id, error
            );
            map_storage_import_error(request_id, error)
        })?;

    Ok(ImportSmilesV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        imported_count: imported_substances.len(),
        substances: imported_substances,
    })
}

pub(crate) fn import_xyz_v1_with_repository(
    input: &ImportXyzV1Input,
    repository: &StorageRepository,
    request_id: &str,
) -> CommandResult<ImportXyzV1Output> {
    let validated = validate_import_xyz_v1_input(input, request_id)?;
    let parsed_substances =
        parse_xyz(&validated.file_name, &validated.contents).map_err(|error| {
            eprintln!(
                "[ipc] import_parse_failure command={} request_id={} details={}",
                IMPORT_XYZ_COMMAND_NAME, request_id, error
            );
            map_import_xyz_parse_error(request_id, error)
        })?;

    let existing = repository.list_substances().map_err(|error| {
        eprintln!(
            "[ipc] storage_failure command={} request_id={} details={}",
            IMPORT_XYZ_COMMAND_NAME, request_id, error
        );
        map_storage_import_error(request_id, error)
    })?;
    let mut seen_keys: BTreeSet<(String, String)> = existing
        .iter()
        .map(|substance| import_duplicate_key(&substance.name, &substance.formula))
        .collect();

    let mut batched_inserts = Vec::with_capacity(parsed_substances.len());
    let mut imported_substances = Vec::with_capacity(parsed_substances.len());
    let mut inference_summaries = Vec::with_capacity(parsed_substances.len());
    for (index, parsed) in parsed_substances.into_iter().enumerate() {
        let duplicate_key = import_duplicate_key(&parsed.name, &parsed.formula);
        if seen_keys.contains(&duplicate_key) {
            return Err(CommandError::import(
                CONTRACT_VERSION_V1,
                request_id,
                "IMPORT_DUPLICATE_SUBSTANCE",
                format!(
                    "Duplicate substance in `{}` at record {} (name=`{}`, formula=`{}`).",
                    validated.file_name, parsed.record_index, parsed.name, parsed.formula
                ),
            ));
        }
        seen_keys.insert(duplicate_key);

        let import_id = next_imported_substance_id(request_id, index + 1);
        batched_inserts.push(NewSubstance {
            id: import_id.clone(),
            name: parsed.name.clone(),
            formula: parsed.formula.clone(),
            smiles: None,
            molar_mass_g_mol: parsed.molar_mass_g_mol,
            phase_default: "solid".to_string(),
            source_type: "imported".to_string(),
        });
        imported_substances.push(SubstanceCatalogItemV1 {
            id: import_id,
            name: parsed.name,
            formula: parsed.formula,
            smiles: None,
            molar_mass_g_mol: parsed.molar_mass_g_mol,
            phase: "solid".to_string(),
            source: "imported".to_string(),
        });
        inference_summaries.push(ImportXyzInferenceSummaryV1 {
            record_index: parsed.inference_summary.record_index,
            inferred_bond_count: parsed.inference_summary.inferred_bond_count,
            avg_confidence: parsed.inference_summary.avg_confidence,
            min_confidence: parsed.inference_summary.min_confidence,
        });
    }

    repository
        .create_substances_batch(&batched_inserts)
        .map_err(|error| {
            eprintln!(
                "[ipc] storage_failure command={} request_id={} details={}",
                IMPORT_XYZ_COMMAND_NAME, request_id, error
            );
            map_storage_import_error(request_id, error)
        })?;

    Ok(ImportXyzV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.to_string(),
        imported_count: imported_substances.len(),
        substances: imported_substances,
        inference_summaries,
    })
}
