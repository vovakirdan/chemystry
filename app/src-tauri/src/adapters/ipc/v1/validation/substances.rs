use crate::infra::errors::CommandResult;

use super::super::contracts::{
    CreateSubstanceV1Input, DeleteSubstanceV1Input, QuerySubstancesV1Input, UpdateSubstanceV1Input,
};
use super::super::{
    MAX_SUBSTANCE_FORMULA_LENGTH, MAX_SUBSTANCE_ID_LENGTH, MAX_SUBSTANCE_NAME_LENGTH,
    MAX_SUBSTANCE_SEARCH_LENGTH, MAX_SUBSTANCE_SMILES_LENGTH,
};
use super::common::{
    normalize_optional_filter, normalize_optional_text, validate_required_text_field,
};
use super::validation_error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuerySubstancesFiltersV1 {
    pub search: Option<String>,
    pub phase_filter: Option<String>,
    pub source_filter: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedSubstancePayloadV1 {
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedUpdateSubstanceV1Input {
    pub id: String,
    pub payload: ValidatedSubstancePayloadV1,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedDeleteSubstanceV1Input {
    pub id: String,
}

fn validate_substance_id(value: Option<&str>, request_id: &str) -> CommandResult<String> {
    validate_required_text_field(
        value,
        request_id,
        "id",
        "SUBSTANCE_ID_REQUIRED",
        "SUBSTANCE_ID_TOO_LONG",
        MAX_SUBSTANCE_ID_LENGTH,
    )
}

fn validate_substance_phase(value: Option<&str>, request_id: &str) -> CommandResult<String> {
    let Some(phase) = normalize_optional_filter(value) else {
        return Err(validation_error(
            request_id,
            "SUBSTANCE_PHASE_REQUIRED",
            "`phase` is required.",
        ));
    };

    if !matches!(phase.as_str(), "solid" | "liquid" | "gas" | "aqueous") {
        return Err(validation_error(
            request_id,
            "SUBSTANCE_PHASE_INVALID",
            "`phase` must be one of: solid, liquid, gas, aqueous.",
        ));
    }

    Ok(phase)
}

fn validate_substance_molar_mass(value: Option<f64>, request_id: &str) -> CommandResult<f64> {
    let Some(molar_mass) = value else {
        return Err(validation_error(
            request_id,
            "SUBSTANCE_MOLAR_MASS_REQUIRED",
            "`molarMassGMol` is required.",
        ));
    };

    if !molar_mass.is_finite() || molar_mass <= 0.0 {
        return Err(validation_error(
            request_id,
            "SUBSTANCE_MOLAR_MASS_INVALID",
            "`molarMassGMol` must be a positive number.",
        ));
    }

    Ok(molar_mass)
}

fn validate_substance_payload(
    name: Option<&str>,
    formula: Option<&str>,
    smiles: Option<&str>,
    molar_mass_g_mol: Option<f64>,
    phase: Option<&str>,
    request_id: &str,
) -> CommandResult<ValidatedSubstancePayloadV1> {
    let name = validate_required_text_field(
        name,
        request_id,
        "name",
        "SUBSTANCE_NAME_REQUIRED",
        "SUBSTANCE_NAME_TOO_LONG",
        MAX_SUBSTANCE_NAME_LENGTH,
    )?;
    let formula = validate_required_text_field(
        formula,
        request_id,
        "formula",
        "SUBSTANCE_FORMULA_REQUIRED",
        "SUBSTANCE_FORMULA_TOO_LONG",
        MAX_SUBSTANCE_FORMULA_LENGTH,
    )?;
    let smiles = match normalize_optional_text(smiles) {
        Some(value) if value.chars().count() > MAX_SUBSTANCE_SMILES_LENGTH => {
            return Err(validation_error(
                request_id,
                "SUBSTANCE_SMILES_TOO_LONG",
                format!("`smiles` must be at most {MAX_SUBSTANCE_SMILES_LENGTH} characters."),
            ));
        }
        value => value,
    };

    Ok(ValidatedSubstancePayloadV1 {
        name,
        formula,
        smiles,
        molar_mass_g_mol: validate_substance_molar_mass(molar_mass_g_mol, request_id)?,
        phase: validate_substance_phase(phase, request_id)?,
    })
}

pub fn validate_create_substance_v1_input(
    input: &CreateSubstanceV1Input,
    request_id: &str,
) -> CommandResult<ValidatedSubstancePayloadV1> {
    validate_substance_payload(
        input.name.as_deref(),
        input.formula.as_deref(),
        input.smiles.as_deref(),
        input.molar_mass_g_mol,
        input.phase.as_deref(),
        request_id,
    )
}

pub fn validate_update_substance_v1_input(
    input: &UpdateSubstanceV1Input,
    request_id: &str,
) -> CommandResult<ValidatedUpdateSubstanceV1Input> {
    Ok(ValidatedUpdateSubstanceV1Input {
        id: validate_substance_id(input.id.as_deref(), request_id)?,
        payload: validate_substance_payload(
            input.name.as_deref(),
            input.formula.as_deref(),
            input.smiles.as_deref(),
            input.molar_mass_g_mol,
            input.phase.as_deref(),
            request_id,
        )?,
    })
}

pub fn validate_delete_substance_v1_input(
    input: &DeleteSubstanceV1Input,
    request_id: &str,
) -> CommandResult<ValidatedDeleteSubstanceV1Input> {
    Ok(ValidatedDeleteSubstanceV1Input {
        id: validate_substance_id(input.id.as_deref(), request_id)?,
    })
}

pub fn validate_query_substances_v1_input(
    input: &QuerySubstancesV1Input,
    request_id: &str,
) -> CommandResult<QuerySubstancesFiltersV1> {
    let normalized_search = input
        .search
        .as_deref()
        .map(str::trim)
        .filter(|entry| !entry.is_empty());

    if let Some(search) = normalized_search {
        if search.chars().count() > MAX_SUBSTANCE_SEARCH_LENGTH {
            return Err(validation_error(
                request_id,
                "SEARCH_QUERY_TOO_LONG",
                format!("`search` must be at most {MAX_SUBSTANCE_SEARCH_LENGTH} characters."),
            ));
        }
    }

    let phase_filter = match normalize_optional_filter(input.phase.as_deref()) {
        Some(phase) if matches!(phase.as_str(), "solid" | "liquid" | "gas" | "aqueous") => {
            Some(phase)
        }
        Some(_) => {
            return Err(validation_error(
                request_id,
                "PHASE_FILTER_INVALID",
                "`phase` must be one of: solid, liquid, gas, aqueous.",
            ));
        }
        None => None,
    };

    let source_filter = match normalize_optional_filter(input.source.as_deref()) {
        Some(source) if matches!(source.as_str(), "builtin" | "imported") => Some(source),
        // Intent: keep backward compatibility for legacy `user` token while storing canonical `user_defined`.
        Some(source) if source == "user" => Some("user_defined".to_string()),
        Some(_) => {
            return Err(validation_error(
                request_id,
                "SOURCE_FILTER_INVALID",
                "`source` must be one of: builtin, imported, user.",
            ));
        }
        None => None,
    };

    Ok(QuerySubstancesFiltersV1 {
        search: normalized_search.map(str::to_string),
        phase_filter,
        source_filter,
    })
}
