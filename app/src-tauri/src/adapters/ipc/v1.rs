use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::infra::config::feature_flags::FeatureFlags as ConfigFeatureFlags;
use crate::infra::errors::{CommandError, CommandResult};
use crate::infra::logging;
use crate::storage::{
    NewScenarioRun, NewSubstance, ReactionTemplate, StorageError, StorageRepository, Substance,
    UpdateScenarioRun, UpdateSubstance,
};

pub const CONTRACT_VERSION_V1: &str = "v1";
const MAX_NAME_LENGTH: usize = 64;
const MAX_SUBSTANCE_SEARCH_LENGTH: usize = 128;
const MAX_SUBSTANCE_ID_LENGTH: usize = 128;
const MAX_SCENARIO_ID_LENGTH: usize = 128;
const MAX_SCENARIO_NAME_LENGTH: usize = 160;
const MAX_SUBSTANCE_NAME_LENGTH: usize = 128;
const MAX_SUBSTANCE_FORMULA_LENGTH: usize = 64;
const MAX_SUBSTANCE_SMILES_LENGTH: usize = 512;
const GREET_COMMAND_NAME: &str = "greet_v1";
const HEALTH_COMMAND_NAME: &str = "health_v1";
const GET_FEATURE_FLAGS_COMMAND_NAME: &str = "get_feature_flags_v1";
const LIST_PRESETS_COMMAND_NAME: &str = "list_presets_v1";
const QUERY_SUBSTANCES_COMMAND_NAME: &str = "query_substances_v1";
const CREATE_SUBSTANCE_COMMAND_NAME: &str = "create_substance_v1";
const UPDATE_SUBSTANCE_COMMAND_NAME: &str = "update_substance_v1";
const DELETE_SUBSTANCE_COMMAND_NAME: &str = "delete_substance_v1";
const SAVE_SCENARIO_DRAFT_COMMAND_NAME: &str = "save_scenario_draft_v1";
const LIST_SAVED_SCENARIOS_COMMAND_NAME: &str = "list_saved_scenarios_v1";
const LOAD_SCENARIO_DRAFT_COMMAND_NAME: &str = "load_scenario_draft_v1";
const SCENARIO_SNAPSHOT_T_SIM_S: f64 = 0.0;
const SCENARIO_SNAPSHOT_VERSION: i64 = 1;
const DEFAULT_SCENARIO_TEMPERATURE_K: f64 = 298.15;
const DEFAULT_SCENARIO_PRESSURE_PA: f64 = 101_325.0;
const DEFAULT_SCENARIO_GAS_MEDIUM: &str = "air";
const DEFAULT_SCENARIO_PRECISION_PROFILE: &str = "balanced";
const DEFAULT_SCENARIO_FPS_LIMIT: i64 = 60;
const DEFAULT_SCENARIO_PARTICLE_LIMIT: i64 = 10_000;
const CALCULATION_SUMMARY_ALLOWED_RESULT_TYPES: &[&str] = &[
    "stoichiometry",
    "limiting_reagent",
    "yield",
    "conversion",
    "concentration",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GreetV1Input {
    pub name: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GreetV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub message: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub status: &'static str,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FeatureFlagsV1 {
    pub simulation: bool,
    pub import_export: bool,
    pub advanced_precision: bool,
}

impl From<ConfigFeatureFlags> for FeatureFlagsV1 {
    fn from(value: ConfigFeatureFlags) -> Self {
        Self {
            simulation: value.simulation,
            import_export: value.import_export,
            advanced_precision: value.advanced_precision,
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GetFeatureFlagsV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub feature_flags: FeatureFlagsV1,
}

#[derive(Debug, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuerySubstancesV1Input {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubstanceCatalogItemV1 {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase: String,
    pub source: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuerySubstancesV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub substances: Vec<SubstanceCatalogItemV1>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresetCatalogItemV1 {
    pub id: String,
    pub title: String,
    pub reaction_class: String,
    pub complexity: String,
    pub description: String,
    pub equation_balanced: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListPresetsV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub presets: Vec<PresetCatalogItemV1>,
}

#[derive(Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubstanceV1Input {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub formula: Option<String>,
    #[serde(default)]
    pub smiles: Option<String>,
    #[serde(default)]
    pub molar_mass_g_mol: Option<f64>,
    #[serde(default)]
    pub phase: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubstanceV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub substance: SubstanceCatalogItemV1,
}

#[derive(Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubstanceV1Input {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub formula: Option<String>,
    #[serde(default)]
    pub smiles: Option<String>,
    #[serde(default)]
    pub molar_mass_g_mol: Option<f64>,
    #[serde(default)]
    pub phase: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubstanceV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub substance: SubstanceCatalogItemV1,
}

#[derive(Debug, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSubstanceV1Input {
    #[serde(default)]
    pub id: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSubstanceV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub deleted: bool,
}

#[derive(Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SaveScenarioDraftV1Input {
    #[serde(default)]
    pub scenario_id: Option<String>,
    #[serde(default)]
    pub scenario_name: Option<String>,
    #[serde(default)]
    pub builder: Option<Value>,
    #[serde(default)]
    pub runtime: Option<Value>,
    #[serde(default)]
    pub calculation_summary: Option<Value>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveScenarioDraftV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub scenario_id: String,
    pub scenario_name: String,
    pub created_at: String,
    pub updated: bool,
}

#[derive(Debug, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListSavedScenariosV1Input {}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedScenarioListItemV1 {
    pub id: String,
    pub name: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListSavedScenariosV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub scenarios: Vec<SavedScenarioListItemV1>,
}

#[derive(Debug, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoadScenarioDraftV1Input {
    #[serde(default)]
    pub scenario_id: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoadScenarioDraftV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub scenario_id: String,
    pub scenario_name: String,
    pub builder: Value,
    pub runtime: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_summary: Option<Value>,
}

pub type CommandErrorV1 = CommandError;

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

#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedSaveScenarioDraftV1Input {
    pub scenario_id: Option<String>,
    pub scenario_name: String,
    pub builder: Value,
    pub runtime: Value,
    pub calculation_summary: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedLoadScenarioDraftV1Input {
    pub scenario_id: String,
}

#[derive(Debug, Clone, PartialEq)]
struct ScenarioRunMetadata {
    temperature_k: f64,
    pressure_pa: f64,
    gas_medium: String,
    precision_profile: String,
    fps_limit: i64,
    particle_limit: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ScenarioDraftSnapshotV1 {
    version: i64,
    saved_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
    builder: Value,
    runtime: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    calculation_summary: Option<Value>,
}

fn validation_error(
    request_id: impl Into<String>,
    code: &'static str,
    message: impl Into<String>,
) -> CommandErrorV1 {
    CommandError::validation(CONTRACT_VERSION_V1, request_id, code, message)
}

pub fn validate_greet_v1_input(input: &GreetV1Input, request_id: &str) -> CommandResult<()> {
    let name = input.name.trim();

    if name.is_empty() {
        return Err(validation_error(
            request_id,
            "NAME_REQUIRED",
            "`name` must not be empty.",
        ));
    }

    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(validation_error(
            request_id,
            "NAME_TOO_LONG",
            format!("`name` must be at most {MAX_NAME_LENGTH} characters."),
        ));
    }

    Ok(())
}

fn normalize_optional_filter(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.to_lowercase())
}

fn source_type_for_contract(source_type: &str) -> String {
    match source_type {
        "user_defined" => "user".to_string(),
        _ => source_type.to_string(),
    }
}

fn map_substance_to_catalog_item(substance: Substance) -> SubstanceCatalogItemV1 {
    SubstanceCatalogItemV1 {
        id: substance.id,
        name: substance.name,
        formula: substance.formula,
        smiles: substance.smiles,
        molar_mass_g_mol: substance.molar_mass_g_mol,
        phase: substance.phase_default,
        source: source_type_for_contract(&substance.source_type),
    }
}

fn complexity_label_for_reaction_class(reaction_class: &str) -> &'static str {
    match reaction_class {
        "inorganic" | "acid_base" => "beginner",
        "redox" | "organic_basic" => "intermediate",
        "equilibrium" => "advanced",
        _ => "intermediate",
    }
}

fn map_template_to_preset_item(template: ReactionTemplate) -> PresetCatalogItemV1 {
    let complexity = complexity_label_for_reaction_class(&template.reaction_class).to_string();

    PresetCatalogItemV1 {
        id: template.id,
        title: template.title,
        reaction_class: template.reaction_class,
        complexity,
        description: template.description,
        equation_balanced: template.equation_balanced,
    }
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

fn validate_required_text_field(
    value: Option<&str>,
    request_id: &str,
    field_name: &'static str,
    required_code: &'static str,
    too_long_code: &'static str,
    max_length: usize,
) -> CommandResult<String> {
    let Some(normalized) = normalize_optional_text(value) else {
        return Err(validation_error(
            request_id,
            required_code,
            format!("`{field_name}` is required."),
        ));
    };

    if normalized.chars().count() > max_length {
        return Err(validation_error(
            request_id,
            too_long_code,
            format!("`{field_name}` must be at most {max_length} characters."),
        ));
    }

    Ok(normalized)
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

fn validate_optional_scenario_id(
    value: Option<&str>,
    request_id: &str,
) -> CommandResult<Option<String>> {
    match value {
        Some(raw) => Ok(Some(validate_required_text_field(
            Some(raw),
            request_id,
            "scenarioId",
            "SCENARIO_ID_REQUIRED",
            "SCENARIO_ID_TOO_LONG",
            MAX_SCENARIO_ID_LENGTH,
        )?)),
        None => Ok(None),
    }
}

fn validate_required_scenario_id(value: Option<&str>, request_id: &str) -> CommandResult<String> {
    validate_required_text_field(
        value,
        request_id,
        "scenarioId",
        "SCENARIO_ID_REQUIRED",
        "SCENARIO_ID_TOO_LONG",
        MAX_SCENARIO_ID_LENGTH,
    )
}

fn validate_required_object_payload(
    value: Option<&Value>,
    request_id: &str,
    field_name: &'static str,
    required_code: &'static str,
    invalid_code: &'static str,
) -> CommandResult<Value> {
    let Some(payload) = value else {
        return Err(validation_error(
            request_id,
            required_code,
            format!("`{field_name}` is required."),
        ));
    };
    if payload.is_null() {
        return Err(validation_error(
            request_id,
            required_code,
            format!("`{field_name}` is required."),
        ));
    }
    if !payload.is_object() {
        return Err(validation_error(
            request_id,
            invalid_code,
            format!("`{field_name}` must be a JSON object."),
        ));
    }

    Ok(payload.clone())
}

fn validate_optional_object_payload(
    value: Option<&Value>,
    request_id: &str,
    field_name: &'static str,
    invalid_code: &'static str,
) -> CommandResult<Option<Value>> {
    let Some(payload) = value else {
        return Ok(None);
    };

    if payload.is_null() {
        return Ok(None);
    }
    if !payload.is_object() {
        return Err(validation_error(
            request_id,
            invalid_code,
            format!("`{field_name}` must be a JSON object when provided."),
        ));
    }

    Ok(Some(payload.clone()))
}

fn validate_calculation_summary_payload(summary: &Value, request_id: &str) -> CommandResult<()> {
    let summary_object = summary.as_object().ok_or_else(|| {
        validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            "`calculationSummary` must be a JSON object.",
        )
    })?;

    let version = summary_object
        .get("version")
        .and_then(Value::as_i64)
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                "`calculationSummary.version` must be a positive integer.",
            )
        })?;
    if version <= 0 {
        return Err(validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            "`calculationSummary.version` must be a positive integer.",
        ));
    }

    summary_object
        .get("generatedAt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                "`calculationSummary.generatedAt` must be a non-empty string.",
            )
        })?;

    let input_signature = summary_object
        .get("inputSignature")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                "`calculationSummary.inputSignature` must be a non-empty string.",
            )
        })?;
    let normalized_input_signature = input_signature.trim();
    if normalized_input_signature.is_empty() || normalized_input_signature != input_signature {
        return Err(validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            "`calculationSummary.inputSignature` must be non-empty and must not include leading/trailing whitespace.",
        ));
    }

    if let Some(scenario_metadata) = summary_object.get("scenarioMetadata") {
        if !scenario_metadata.is_null() && !scenario_metadata.is_object() {
            return Err(validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                "`calculationSummary.scenarioMetadata` must be a JSON object when provided.",
            ));
        }
    }

    let entries = summary_object
        .get("entries")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                "`calculationSummary.entries` must be an array.",
            )
        })?;

    for (index, entry) in entries.iter().enumerate() {
        validate_calculation_summary_entry_payload(entry, index, request_id)?;
    }

    Ok(())
}

fn validate_calculation_summary_entry_payload(
    entry: &Value,
    index: usize,
    request_id: &str,
) -> CommandResult<()> {
    let entry_object = entry.as_object().ok_or_else(|| {
        validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            format!("`calculationSummary.entries[{index}]` must be a JSON object."),
        )
    })?;

    let result_type = entry_object
        .get("resultType")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                format!(
                    "`calculationSummary.entries[{index}].resultType` must be a non-empty string."
                ),
            )
        })?;

    if !CALCULATION_SUMMARY_ALLOWED_RESULT_TYPES.contains(&result_type) {
        return Err(validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            format!(
                "`calculationSummary.entries[{index}].resultType` has unsupported value `{result_type}`."
            ),
        ));
    }

    if !entry_object.get("inputs").is_some_and(Value::is_object) {
        return Err(validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            format!("`calculationSummary.entries[{index}].inputs` must be a JSON object."),
        ));
    }
    if !entry_object.get("outputs").is_some_and(Value::is_object) {
        return Err(validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            format!("`calculationSummary.entries[{index}].outputs` must be a JSON object."),
        ));
    }

    let warnings = entry_object
        .get("warnings")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                format!("`calculationSummary.entries[{index}].warnings` must be an array."),
            )
        })?;
    if warnings.iter().any(|warning| !warning.is_string()) {
        return Err(validation_error(
            request_id,
            "SCENARIO_CALCULATION_SUMMARY_INVALID",
            format!("`calculationSummary.entries[{index}].warnings` must contain only strings."),
        ));
    }

    if let Some(metadata) = entry_object.get("metadata") {
        if !metadata.is_null() && !metadata.is_object() {
            return Err(validation_error(
                request_id,
                "SCENARIO_CALCULATION_SUMMARY_INVALID",
                format!(
                    "`calculationSummary.entries[{index}].metadata` must be a JSON object when provided."
                ),
            ));
        }
    }

    Ok(())
}

pub fn validate_save_scenario_draft_v1_input(
    input: &SaveScenarioDraftV1Input,
    request_id: &str,
) -> CommandResult<ValidatedSaveScenarioDraftV1Input> {
    let scenario_name = validate_required_text_field(
        input.scenario_name.as_deref(),
        request_id,
        "scenarioName",
        "SCENARIO_NAME_REQUIRED",
        "SCENARIO_NAME_TOO_LONG",
        MAX_SCENARIO_NAME_LENGTH,
    )?;

    let calculation_summary = validate_optional_object_payload(
        input.calculation_summary.as_ref(),
        request_id,
        "calculationSummary",
        "SCENARIO_CALCULATION_SUMMARY_INVALID",
    )?;
    if let Some(summary) = calculation_summary.as_ref() {
        validate_calculation_summary_payload(summary, request_id)?;
    }

    Ok(ValidatedSaveScenarioDraftV1Input {
        scenario_id: validate_optional_scenario_id(input.scenario_id.as_deref(), request_id)?,
        scenario_name,
        builder: validate_required_object_payload(
            input.builder.as_ref(),
            request_id,
            "builder",
            "SCENARIO_BUILDER_REQUIRED",
            "SCENARIO_BUILDER_INVALID",
        )?,
        runtime: validate_required_object_payload(
            input.runtime.as_ref(),
            request_id,
            "runtime",
            "SCENARIO_RUNTIME_REQUIRED",
            "SCENARIO_RUNTIME_INVALID",
        )?,
        calculation_summary,
    })
}

pub fn validate_load_scenario_draft_v1_input(
    input: &LoadScenarioDraftV1Input,
    request_id: &str,
) -> CommandResult<ValidatedLoadScenarioDraftV1Input> {
    Ok(ValidatedLoadScenarioDraftV1Input {
        scenario_id: validate_required_scenario_id(input.scenario_id.as_deref(), request_id)?,
    })
}

fn now_unix_timestamp_millis() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis().to_string(),
        Err(_) => "0".to_string(),
    }
}

fn next_saved_scenario_id(request_id: &str) -> String {
    format!("scenario-run-{request_id}")
}

fn unique_scenario_name(base_name: &str, timestamp_millis: &str) -> String {
    format!("{base_name} [{timestamp_millis}]")
}

fn parse_optional_number(value: Option<&Value>) -> Option<f64> {
    let value = value?;
    if let Some(number) = value.as_f64() {
        return Some(number);
    }

    value
        .as_str()
        .and_then(|text| text.trim().parse::<f64>().ok())
}

fn parse_optional_positive_integer(value: Option<&Value>) -> Option<i64> {
    let value = value?;
    if let Some(number) = value.as_i64() {
        return (number > 0).then_some(number);
    }

    if let Some(number) = value.as_u64() {
        if let Ok(number) = i64::try_from(number) {
            return (number > 0).then_some(number);
        }
    }

    if let Some(number) = value.as_f64() {
        if number.is_finite() && number > 0.0 {
            let rounded = number.round();
            if (rounded - number).abs() <= f64::EPSILON && rounded <= i64::MAX as f64 {
                return Some(rounded as i64);
            }
        }
    }

    value
        .as_str()
        .and_then(|text| text.trim().parse::<i64>().ok())
        .filter(|value| *value > 0)
}

fn normalize_precision_profile(value: Option<&Value>) -> String {
    let normalized = value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase());

    match normalized.as_deref() {
        Some("balanced") => "balanced".to_string(),
        Some("high_precision") | Some("high precision") => "high_precision".to_string(),
        Some("custom") => "custom".to_string(),
        _ => DEFAULT_SCENARIO_PRECISION_PROFILE.to_string(),
    }
}

fn scenario_run_metadata_from_runtime(runtime: &Value) -> ScenarioRunMetadata {
    let runtime = runtime.as_object();
    let temperature_c = runtime
        .and_then(|object| parse_optional_number(object.get("temperatureC")))
        .filter(|value| value.is_finite() && *value > -273.15)
        .unwrap_or(DEFAULT_SCENARIO_TEMPERATURE_K - 273.15);
    let pressure_atm = runtime
        .and_then(|object| parse_optional_number(object.get("pressureAtm")))
        .filter(|value| value.is_finite() && *value > 0.0)
        .unwrap_or(DEFAULT_SCENARIO_PRESSURE_PA / 101_325.0);
    let gas_medium = runtime
        .and_then(|object| object.get("gasMedium"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| DEFAULT_SCENARIO_GAS_MEDIUM.to_string());
    let precision_profile = runtime
        .map(|object| normalize_precision_profile(object.get("precisionProfile")))
        .unwrap_or_else(|| DEFAULT_SCENARIO_PRECISION_PROFILE.to_string());
    let fps_limit = runtime
        .and_then(|object| parse_optional_positive_integer(object.get("fpsLimit")))
        .unwrap_or(DEFAULT_SCENARIO_FPS_LIMIT);
    let particle_limit = runtime
        .and_then(|object| parse_optional_positive_integer(object.get("particleLimit")))
        .or_else(|| {
            runtime
                .and_then(|object| parse_optional_positive_integer(object.get("calculationPasses")))
        })
        .unwrap_or(DEFAULT_SCENARIO_PARTICLE_LIMIT);

    ScenarioRunMetadata {
        temperature_k: temperature_c + 273.15,
        pressure_pa: pressure_atm * 101_325.0,
        gas_medium,
        precision_profile,
        fps_limit,
        particle_limit,
    }
}

fn parse_optional_positive_builder_number(value: Option<&Value>) -> Option<f64> {
    let parsed = parse_optional_number(value)?;
    if parsed.is_finite() && parsed > 0.0 {
        Some(parsed)
    } else {
        None
    }
}

fn extract_scenario_amounts_from_builder(builder: &Value) -> Value {
    let mut amounts = Vec::new();
    let Some(builder_object) = builder.as_object() else {
        return Value::Array(amounts);
    };
    let Some(participants) = builder_object.get("participants").and_then(Value::as_array) else {
        return Value::Array(amounts);
    };

    for participant in participants {
        let Some(participant) = participant.as_object() else {
            continue;
        };
        let Some(substance_id) = participant
            .get("substanceId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
        else {
            continue;
        };

        let amount_mol = parse_optional_positive_builder_number(
            participant
                .get("amountMolInput")
                .or_else(|| participant.get("amountMol")),
        );
        let mass_g = parse_optional_positive_builder_number(
            participant
                .get("massGInput")
                .or_else(|| participant.get("massG")),
        );
        let volume_l = parse_optional_positive_builder_number(
            participant
                .get("volumeLInput")
                .or_else(|| participant.get("volumeL")),
        );
        let concentration_mol_l = parse_optional_positive_builder_number(
            participant
                .get("concentrationMolLInput")
                .or_else(|| participant.get("concentrationMolL")),
        );

        if amount_mol.is_none()
            && mass_g.is_none()
            && volume_l.is_none()
            && concentration_mol_l.is_none()
        {
            continue;
        }

        let mut amount_object = Map::new();
        amount_object.insert("substanceId".to_string(), Value::String(substance_id));
        if let Some(value) = amount_mol {
            amount_object.insert("amountMol".to_string(), Value::from(value));
        }
        if let Some(value) = mass_g {
            amount_object.insert("massG".to_string(), Value::from(value));
        }
        if let Some(value) = volume_l {
            amount_object.insert("volumeL".to_string(), Value::from(value));
        }
        if let Some(value) = concentration_mol_l {
            amount_object.insert("concentrationMolL".to_string(), Value::from(value));
        }

        amounts.push(Value::Object(amount_object));
    }

    Value::Array(amounts)
}

fn enrich_calculation_summary_with_scenario_metadata(
    calculation_summary: Option<&Value>,
    scenario_id: &str,
    scenario_name: &str,
    saved_at: &str,
    updated: bool,
) -> Option<Value> {
    let summary_object = calculation_summary?.as_object()?;
    let mut enriched_summary = summary_object.clone();
    let mut scenario_metadata = Map::new();
    scenario_metadata.insert(
        "scenarioId".to_string(),
        Value::String(scenario_id.to_string()),
    );
    scenario_metadata.insert(
        "scenarioName".to_string(),
        Value::String(scenario_name.to_string()),
    );
    scenario_metadata.insert("savedAt".to_string(), Value::String(saved_at.to_string()));
    scenario_metadata.insert("updated".to_string(), Value::Bool(updated));
    enriched_summary.insert(
        "scenarioMetadata".to_string(),
        Value::Object(scenario_metadata),
    );

    Some(Value::Object(enriched_summary))
}

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

fn map_storage_save_scenario_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    map_storage_scenario_error(
        request_id,
        error,
        "SCENARIO_SAVE_IO_FAILED",
        "Failed to write saved scenario data.",
        "SCENARIO_SAVE_FAILED",
        "Failed to save scenario draft.",
    )
}

fn map_storage_list_saved_scenarios_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    map_storage_scenario_error(
        request_id,
        error,
        "SCENARIO_LIST_IO_FAILED",
        "Failed to read saved scenarios.",
        "SCENARIO_LIST_FAILED",
        "Failed to list saved scenarios.",
    )
}

fn map_storage_load_scenario_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    map_storage_scenario_error(
        request_id,
        error,
        "SCENARIO_LOAD_IO_FAILED",
        "Failed to read saved scenario data.",
        "SCENARIO_LOAD_FAILED",
        "Failed to load saved scenario draft.",
    )
}

fn map_storage_create_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
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

fn map_storage_update_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
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

fn map_storage_delete_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
    map_storage_substance_error(
        request_id,
        error,
        "SUBSTANCE_DELETE_IO_FAILED",
        "Failed to write local catalog storage.",
        "SUBSTANCE_DELETE_FAILED",
        "Failed to delete substance from local catalog.",
    )
}

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

fn map_storage_query_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
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

fn map_storage_list_presets_error(request_id: &str, error: StorageError) -> CommandErrorV1 {
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

fn list_presets_v1_with_repository(
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

fn create_substance_v1_with_repository(
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

fn update_substance_v1_with_repository(
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

fn delete_substance_v1_with_repository(
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

fn save_scenario_draft_v1_with_repository(
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

fn list_saved_scenarios_v1_with_repository(
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

fn load_scenario_draft_v1_with_repository(
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

#[tauri::command]
pub fn greet_v1(input: GreetV1Input) -> CommandResult<GreetV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(GREET_COMMAND_NAME, &request_id);

    let result = validate_greet_v1_input(&input, &request_id).map(|_| GreetV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.clone(),
        message: format!(
            "Hello, {}! You've been greeted from Rust!",
            input.name.trim()
        ),
    });

    match result {
        Ok(output) => {
            logging::log_command_success(GREET_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(GREET_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn health_v1() -> HealthV1Output {
    let request_id = logging::next_request_id();
    logging::log_command_start(HEALTH_COMMAND_NAME, &request_id);

    let output = HealthV1Output {
        version: CONTRACT_VERSION_V1,
        request_id,
        status: "ok",
    };

    logging::log_command_success(HEALTH_COMMAND_NAME, &output.request_id);
    output
}

#[tauri::command]
pub fn get_feature_flags_v1() -> GetFeatureFlagsV1Output {
    let request_id = logging::next_request_id();
    logging::log_command_start(GET_FEATURE_FLAGS_COMMAND_NAME, &request_id);

    let output = GetFeatureFlagsV1Output {
        version: CONTRACT_VERSION_V1,
        request_id,
        feature_flags: ConfigFeatureFlags::from_env().into(),
    };

    logging::log_command_success(GET_FEATURE_FLAGS_COMMAND_NAME, &output.request_id);
    output
}

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

#[tauri::command]
pub fn query_substances_v1(
    input: QuerySubstancesV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<QuerySubstancesV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(QUERY_SUBSTANCES_COMMAND_NAME, &request_id);

    let result = (|| -> CommandResult<QuerySubstancesV1Output> {
        let filters = validate_query_substances_v1_input(&input, &request_id)?;
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
                map_storage_query_error(&request_id, error)
            })?;

        Ok(QuerySubstancesV1Output {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.clone(),
            substances: substances
                .into_iter()
                .map(map_substance_to_catalog_item)
                .collect(),
        })
    })();

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

#[cfg(test)]
mod tests {
    use std::{collections::BTreeSet, thread::sleep, time::Duration};

    use rusqlite::{params, Connection};
    use serde_json::json;
    use tempfile::TempDir;

    use super::*;
    use crate::infra::errors::ErrorCategory;
    use crate::storage::{
        run_migrations, NewReactionTemplate, NewScenarioRun, NewSubstance, StorageRepository,
    };

    fn setup_repository(file_name: &str) -> (TempDir, StorageRepository) {
        let temp_dir = TempDir::new().expect("must create temp directory");
        let database_path = temp_dir.path().join(file_name);
        run_migrations(&database_path).expect("migrations should succeed");
        (temp_dir, StorageRepository::new(database_path))
    }

    fn create_builder_test_substance(repository: &StorageRepository, id: &str) {
        repository
            .create_substance(&NewSubstance {
                id: id.to_string(),
                name: format!("Draft {id}"),
                formula: format!("F-{id}"),
                smiles: None,
                molar_mass_g_mol: 10.0,
                phase_default: "solid".to_string(),
                source_type: "user_defined".to_string(),
            })
            .expect("must create builder draft test substance");
    }

    fn sample_builder_payload(substance_id: &str) -> Value {
        json!({
            "title": "Builder scenario",
            "reactionClass": "inorganic",
            "equation": "A + B -> AB",
            "description": "Draft payload",
            "participants": [
                {
                    "id": "participant-1",
                    "substanceId": substance_id,
                    "role": "reactant",
                    "stoichCoeffInput": "1",
                    "phase": "solid",
                    "amountMolInput": "1.5",
                    "massGInput": "",
                    "volumeLInput": ""
                }
            ]
        })
    }

    fn sample_runtime_payload() -> Value {
        json!({
            "temperatureC": 20.0,
            "pressureAtm": 1.0,
            "calculationPasses": 500,
            "precisionProfile": "Balanced",
            "fpsLimit": 90
        })
    }

    fn sample_calculation_summary_payload(signature: &str) -> Value {
        json!({
            "version": 1,
            "generatedAt": "2026-03-04T09:00:00.000Z",
            "inputSignature": signature,
            "entries": [
                {
                    "resultType": "stoichiometry",
                    "inputs": {},
                    "outputs": {
                        "reactionExtentMol": 1.0
                    },
                    "warnings": []
                },
                {
                    "resultType": "limiting_reagent",
                    "inputs": {},
                    "outputs": {
                        "limitingReactants": ["participant-1"]
                    },
                    "warnings": []
                },
                {
                    "resultType": "yield",
                    "inputs": {},
                    "outputs": {
                        "percentYield": 95.0
                    },
                    "warnings": []
                },
                {
                    "resultType": "conversion",
                    "inputs": {},
                    "outputs": {},
                    "warnings": ["Ideal-gas approximation"]
                },
                {
                    "resultType": "concentration",
                    "inputs": {},
                    "outputs": {},
                    "warnings": []
                }
            ]
        })
    }

    fn sample_save_input(substance_id: &str) -> SaveScenarioDraftV1Input {
        SaveScenarioDraftV1Input {
            scenario_id: None,
            scenario_name: Some("Saved Draft".to_string()),
            builder: Some(sample_builder_payload(substance_id)),
            runtime: Some(sample_runtime_payload()),
            calculation_summary: None,
        }
    }

    #[test]
    fn validate_greet_v1_input_accepts_valid_name() {
        let input = GreetV1Input {
            name: "Marie".to_string(),
        };

        assert_eq!(validate_greet_v1_input(&input, "req-test-1"), Ok(()));
    }

    #[test]
    fn validate_greet_v1_input_rejects_empty_name() {
        let input = GreetV1Input {
            name: "   ".to_string(),
        };
        let request_id = "req-empty";

        assert_eq!(
            validate_greet_v1_input(&input, request_id),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                request_id: request_id.to_string(),
                category: ErrorCategory::Validation,
                code: "NAME_REQUIRED",
                message: "`name` must not be empty.".to_string(),
            })
        );
    }

    #[test]
    fn validate_greet_v1_input_rejects_too_long_name() {
        let input = GreetV1Input {
            name: "x".repeat(MAX_NAME_LENGTH + 1),
        };
        let request_id = "req-too-long";

        let error =
            validate_greet_v1_input(&input, request_id).expect_err("expected validation error");
        assert_eq!(error.version, CONTRACT_VERSION_V1);
        assert_eq!(error.request_id, request_id);
        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "NAME_TOO_LONG");
        assert_eq!(
            error.message,
            format!("`name` must be at most {MAX_NAME_LENGTH} characters.")
        );
    }

    #[test]
    fn maps_config_feature_flags_to_contract_payload() {
        let flags = FeatureFlagsV1::from(ConfigFeatureFlags {
            simulation: false,
            import_export: true,
            advanced_precision: false,
        });

        assert_eq!(
            flags,
            FeatureFlagsV1 {
                simulation: false,
                import_export: true,
                advanced_precision: false,
            }
        );
    }

    #[test]
    fn validate_query_substances_v1_input_normalizes_filters() {
        let input = QuerySubstancesV1Input {
            search: Some("  H2  ".to_string()),
            phase: Some(" Gas ".to_string()),
            source: Some(" user ".to_string()),
        };

        let filters = validate_query_substances_v1_input(&input, "req-query-valid")
            .expect("filters should be accepted");
        assert_eq!(
            filters,
            QuerySubstancesFiltersV1 {
                search: Some("H2".to_string()),
                phase_filter: Some("gas".to_string()),
                source_filter: Some("user_defined".to_string()),
            }
        );
    }

    #[test]
    fn validate_query_substances_v1_input_rejects_too_long_search() {
        let input = QuerySubstancesV1Input {
            search: Some("x".repeat(MAX_SUBSTANCE_SEARCH_LENGTH + 1)),
            phase: None,
            source: None,
        };
        let request_id = "req-search-too-long";

        let error = validate_query_substances_v1_input(&input, request_id)
            .expect_err("expected validation error");
        assert_eq!(error.version, CONTRACT_VERSION_V1);
        assert_eq!(error.request_id, request_id);
        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "SEARCH_QUERY_TOO_LONG");
        assert_eq!(
            error.message,
            format!("`search` must be at most {MAX_SUBSTANCE_SEARCH_LENGTH} characters.")
        );
    }

    #[test]
    fn validate_query_substances_v1_input_rejects_invalid_phase_filter() {
        let input = QuerySubstancesV1Input {
            search: None,
            phase: Some("plasma".to_string()),
            source: None,
        };
        let request_id = "req-phase-invalid";

        assert_eq!(
            validate_query_substances_v1_input(&input, request_id),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                request_id: request_id.to_string(),
                category: ErrorCategory::Validation,
                code: "PHASE_FILTER_INVALID",
                message: "`phase` must be one of: solid, liquid, gas, aqueous.".to_string(),
            })
        );
    }

    #[test]
    fn validate_query_substances_v1_input_rejects_invalid_source_filter() {
        let input = QuerySubstancesV1Input {
            search: None,
            phase: None,
            source: Some("api".to_string()),
        };
        let request_id = "req-source-invalid";

        assert_eq!(
            validate_query_substances_v1_input(&input, request_id),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                request_id: request_id.to_string(),
                category: ErrorCategory::Validation,
                code: "SOURCE_FILTER_INVALID",
                message: "`source` must be one of: builtin, imported, user.".to_string(),
            })
        );
    }

    #[test]
    fn validate_create_substance_v1_input_rejects_missing_required_fields() {
        let request_id = "req-create-missing";

        assert_eq!(
            validate_create_substance_v1_input(&CreateSubstanceV1Input::default(), request_id),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                request_id: request_id.to_string(),
                category: ErrorCategory::Validation,
                code: "SUBSTANCE_NAME_REQUIRED",
                message: "`name` is required.".to_string(),
            })
        );
    }

    #[test]
    fn validate_create_substance_v1_input_rejects_invalid_phase() {
        let request_id = "req-create-phase";
        let input = CreateSubstanceV1Input {
            name: Some("Acetone".to_string()),
            formula: Some("C3H6O".to_string()),
            smiles: Some("CC(=O)C".to_string()),
            molar_mass_g_mol: Some(58.08),
            phase: Some("plasma".to_string()),
        };

        assert_eq!(
            validate_create_substance_v1_input(&input, request_id),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                request_id: request_id.to_string(),
                category: ErrorCategory::Validation,
                code: "SUBSTANCE_PHASE_INVALID",
                message: "`phase` must be one of: solid, liquid, gas, aqueous.".to_string(),
            })
        );
    }

    #[test]
    fn validate_update_substance_v1_input_rejects_missing_id() {
        let request_id = "req-update-missing-id";
        let input = UpdateSubstanceV1Input {
            id: Some("  ".to_string()),
            name: Some("Acetone".to_string()),
            formula: Some("C3H6O".to_string()),
            smiles: None,
            molar_mass_g_mol: Some(58.08),
            phase: Some("liquid".to_string()),
        };

        assert_eq!(
            validate_update_substance_v1_input(&input, request_id),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                request_id: request_id.to_string(),
                category: ErrorCategory::Validation,
                code: "SUBSTANCE_ID_REQUIRED",
                message: "`id` is required.".to_string(),
            })
        );
    }

    #[test]
    fn validate_update_substance_v1_input_rejects_invalid_molar_mass() {
        let request_id = "req-update-mass";
        let input = UpdateSubstanceV1Input {
            id: Some("substance-1".to_string()),
            name: Some("Acetone".to_string()),
            formula: Some("C3H6O".to_string()),
            smiles: None,
            molar_mass_g_mol: Some(0.0),
            phase: Some("liquid".to_string()),
        };

        assert_eq!(
            validate_update_substance_v1_input(&input, request_id),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                request_id: request_id.to_string(),
                category: ErrorCategory::Validation,
                code: "SUBSTANCE_MOLAR_MASS_INVALID",
                message: "`molarMassGMol` must be a positive number.".to_string(),
            })
        );
    }

    #[test]
    fn list_presets_v1_only_returns_rows_marked_as_presets() {
        let (_temp_dir, repository) = setup_repository("list-presets-only.sqlite3");
        repository
            .seed_baseline_data()
            .expect("baseline seed should succeed");
        repository
            .create_reaction_template(&NewReactionTemplate {
                id: "user-template-non-preset".to_string(),
                title: "Temporary user template".to_string(),
                reaction_class: "inorganic".to_string(),
                equation_balanced: "A + B -> AB".to_string(),
                description: "Should not appear in preset list.".to_string(),
                is_preset: false,
                version: 1,
            })
            .expect("must create non-preset template");

        let output = list_presets_v1_with_repository(&repository, "req-list-presets")
            .expect("listing presets should succeed");
        let preset_ids = output
            .presets
            .iter()
            .map(|preset| preset.id.as_str())
            .collect::<BTreeSet<_>>();

        assert_eq!(output.version, CONTRACT_VERSION_V1);
        assert_eq!(output.request_id, "req-list-presets");
        assert!(!preset_ids.contains("user-template-non-preset"));
        for required_id in [
            "builtin-preset-hydrogen-combustion-v1",
            "builtin-preset-acid-base-neutralization-v1",
            "builtin-preset-magnesium-oxidation-v1",
            "builtin-preset-ethene-hydration-v1",
            "builtin-preset-haber-process-v1",
        ] {
            assert!(
                preset_ids.contains(required_id),
                "required baseline preset {required_id} must be present"
            );
        }
    }

    #[test]
    fn list_presets_v1_baseline_covers_classes_and_supports_launch_precheck() {
        let (_temp_dir, repository) = setup_repository("list-presets-baseline-coverage.sqlite3");
        repository
            .seed_baseline_data()
            .expect("baseline seed should succeed");

        let output = list_presets_v1_with_repository(&repository, "req-list-presets-coverage")
            .expect("listing presets should succeed");
        let connection = Connection::open(repository.database_path()).expect("must open database");

        let classes = output
            .presets
            .iter()
            .map(|preset| preset.reaction_class.as_str())
            .collect::<BTreeSet<_>>();
        assert_eq!(
            classes,
            BTreeSet::from([
                "inorganic",
                "acid_base",
                "redox",
                "organic_basic",
                "equilibrium",
            ])
        );

        for preset in &output.presets {
            let reactant_count: i64 = connection
                .query_row(
                    "SELECT COUNT(1) FROM reaction_species
                    WHERE reaction_template_id = ?1 AND role = 'reactant'",
                    params![preset.id.as_str()],
                    |row| row.get(0),
                )
                .expect("must query reactant count for preset");
            assert!(
                reactant_count >= 1,
                "preset {} should have at least one reactant in reaction_species",
                preset.id
            );

            let product_count: i64 = connection
                .query_row(
                    "SELECT COUNT(1) FROM reaction_species
                    WHERE reaction_template_id = ?1 AND role = 'product'",
                    params![preset.id.as_str()],
                    |row| row.get(0),
                )
                .expect("must query product count for preset");
            assert!(
                product_count >= 1,
                "preset {} should have at least one product in reaction_species",
                preset.id
            );

            assert!(
                preset.description.starts_with("Educational note:"),
                "preset {} should include an educational note prefix",
                preset.id
            );

            let run_id = format!("scenario-run-precheck-{}", preset.id);
            let created_run = repository
                .create_scenario_run(&NewScenarioRun {
                    id: run_id.clone(),
                    reaction_template_id: Some(preset.id.clone()),
                    name: format!("Precheck {}", preset.title),
                    temperature_k: 298.15,
                    pressure_pa: 101_325.0,
                    gas_medium: "air".to_string(),
                    precision_profile: "balanced".to_string(),
                    fps_limit: 60,
                    particle_limit: 10_000,
                })
                .expect("scenario run precheck should succeed for every baseline preset");

            assert_eq!(created_run.id, run_id);
            assert_eq!(
                created_run.reaction_template_id.as_deref(),
                Some(preset.id.as_str())
            );
        }
    }

    #[test]
    fn list_presets_v1_contract_serialization_has_expected_fields() {
        let item = map_template_to_preset_item(ReactionTemplate {
            id: "builtin-preset-redox-demo-v1".to_string(),
            title: "Redox demo".to_string(),
            reaction_class: "redox".to_string(),
            equation_balanced: "2H2 + O2 -> 2H2O".to_string(),
            description: "Demo preset".to_string(),
            is_preset: true,
            version: 1,
        });

        assert_eq!(item.complexity, "intermediate");

        let payload = serde_json::to_value(ListPresetsV1Output {
            version: CONTRACT_VERSION_V1,
            request_id: "req-preset-shape".to_string(),
            presets: vec![item],
        })
        .expect("payload must serialize");

        assert_eq!(
            payload,
            json!({
                "version": "v1",
                "requestId": "req-preset-shape",
                "presets": [{
                    "id": "builtin-preset-redox-demo-v1",
                    "title": "Redox demo",
                    "reactionClass": "redox",
                    "complexity": "intermediate",
                    "description": "Demo preset",
                    "equationBalanced": "2H2 + O2 -> 2H2O"
                }]
            })
        );
    }

    #[test]
    fn list_presets_v1_returns_deterministic_ordering() {
        let (_temp_dir, repository) = setup_repository("list-presets-ordering.sqlite3");
        repository
            .create_reaction_template(&NewReactionTemplate {
                id: "preset-beta-v1".to_string(),
                title: "Beta".to_string(),
                reaction_class: "inorganic".to_string(),
                equation_balanced: "B -> B".to_string(),
                description: "Beta".to_string(),
                is_preset: true,
                version: 1,
            })
            .expect("must create beta preset");
        repository
            .create_reaction_template(&NewReactionTemplate {
                id: "preset-alpha-v2".to_string(),
                title: "Alpha".to_string(),
                reaction_class: "acid_base".to_string(),
                equation_balanced: "HA + B -> A- + BH+".to_string(),
                description: "Alpha v2".to_string(),
                is_preset: true,
                version: 2,
            })
            .expect("must create alpha v2 preset");
        repository
            .create_reaction_template(&NewReactionTemplate {
                id: "preset-alpha-v1".to_string(),
                title: "Alpha".to_string(),
                reaction_class: "acid_base".to_string(),
                equation_balanced: "HA + OH- -> A- + H2O".to_string(),
                description: "Alpha v1".to_string(),
                is_preset: true,
                version: 1,
            })
            .expect("must create alpha v1 preset");
        repository
            .create_reaction_template(&NewReactionTemplate {
                id: "non-preset-order-check".to_string(),
                title: "Aardvark".to_string(),
                reaction_class: "inorganic".to_string(),
                equation_balanced: "A -> A".to_string(),
                description: "Should be filtered out".to_string(),
                is_preset: false,
                version: 1,
            })
            .expect("must create non-preset template");

        let first_call = list_presets_v1_with_repository(&repository, "req-order-1")
            .expect("first list call should succeed");
        let second_call = list_presets_v1_with_repository(&repository, "req-order-2")
            .expect("second list call should succeed");

        let first_ids = first_call
            .presets
            .iter()
            .map(|preset| preset.id.as_str())
            .collect::<Vec<_>>();
        let second_ids = second_call
            .presets
            .iter()
            .map(|preset| preset.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            first_ids,
            vec!["preset-alpha-v1", "preset-alpha-v2", "preset-beta-v1"]
        );
        assert_eq!(second_ids, first_ids);
    }

    #[test]
    fn update_substance_v1_rejects_builtin_substances() {
        let (_temp_dir, repository) = setup_repository("update-builtin.sqlite3");
        repository
            .create_substance(&NewSubstance {
                id: "builtin-test-substance".to_string(),
                name: "Built-in hydrogen".to_string(),
                formula: "H2".to_string(),
                smiles: None,
                molar_mass_g_mol: 2.01588,
                phase_default: "gas".to_string(),
                source_type: "builtin".to_string(),
            })
            .expect("must create builtin substance");

        let error = update_substance_v1_with_repository(
            &UpdateSubstanceV1Input {
                id: Some("builtin-test-substance".to_string()),
                name: Some("Hydrogen updated".to_string()),
                formula: Some("H2".to_string()),
                smiles: None,
                molar_mass_g_mol: Some(2.1),
                phase: Some("gas".to_string()),
            },
            &repository,
            "req-update-builtin",
        )
        .expect_err("builtin substance updates must be rejected");

        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "SUBSTANCE_SOURCE_IMMUTABLE");
    }

    #[test]
    fn delete_substance_v1_rejects_imported_substances() {
        let (_temp_dir, repository) = setup_repository("delete-imported.sqlite3");
        repository
            .create_substance(&NewSubstance {
                id: "imported-test-substance".to_string(),
                name: "Imported acetone".to_string(),
                formula: "C3H6O".to_string(),
                smiles: Some("CC(=O)C".to_string()),
                molar_mass_g_mol: 58.08,
                phase_default: "liquid".to_string(),
                source_type: "imported".to_string(),
            })
            .expect("must create imported substance");

        let error = delete_substance_v1_with_repository(
            &DeleteSubstanceV1Input {
                id: Some("imported-test-substance".to_string()),
            },
            &repository,
            "req-delete-imported",
        )
        .expect_err("imported substance delete must be rejected");

        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "SUBSTANCE_SOURCE_IMMUTABLE");
    }

    #[test]
    fn delete_substance_v1_rejects_substances_used_in_scenarios() {
        let (_temp_dir, repository) = setup_repository("delete-in-use.sqlite3");
        repository
            .create_substance(&NewSubstance {
                id: "user-in-use-substance".to_string(),
                name: "In-use custom".to_string(),
                formula: "IU1".to_string(),
                smiles: None,
                molar_mass_g_mol: 10.0,
                phase_default: "solid".to_string(),
                source_type: "user_defined".to_string(),
            })
            .expect("must create user-defined substance");
        repository
            .create_scenario_run(&NewScenarioRun {
                id: "scenario-run-in-use".to_string(),
                reaction_template_id: None,
                name: "Scenario with in-use substance".to_string(),
                temperature_k: 298.15,
                pressure_pa: 101_325.0,
                gas_medium: "air".to_string(),
                precision_profile: "balanced".to_string(),
                fps_limit: 60,
                particle_limit: 5_000,
            })
            .expect("must create scenario run");

        let connection = Connection::open(repository.database_path()).expect("must open database");
        connection
            .execute(
                "INSERT INTO scenario_amount(
                    id,
                    scenario_run_id,
                    substance_id,
                    amount_mol,
                    mass_g,
                    volume_l,
                    concentration_mol_l
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "scenario-amount-in-use",
                    "scenario-run-in-use",
                    "user-in-use-substance",
                    1.5_f64,
                    Option::<f64>::None,
                    Option::<f64>::None,
                    Option::<f64>::None
                ],
            )
            .expect("must insert scenario amount");

        let error = delete_substance_v1_with_repository(
            &DeleteSubstanceV1Input {
                id: Some("user-in-use-substance".to_string()),
            },
            &repository,
            "req-delete-in-use",
        )
        .expect_err("in-use substance delete must be rejected");

        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "SUBSTANCE_IN_USE");
    }

    #[test]
    fn user_substance_crud_happy_path_succeeds() {
        let (_temp_dir, repository) = setup_repository("crud-happy.sqlite3");
        let create_output = create_substance_v1_with_repository(
            &CreateSubstanceV1Input {
                name: Some("Custom methane".to_string()),
                formula: Some("CH4".to_string()),
                smiles: Some("C".to_string()),
                molar_mass_g_mol: Some(16.0425),
                phase: Some("gas".to_string()),
            },
            &repository,
            "req-crud-create",
        )
        .expect("must create user-defined substance");
        assert_eq!(create_output.substance.source, "user");
        assert_eq!(create_output.substance.phase, "gas");

        let update_output = update_substance_v1_with_repository(
            &UpdateSubstanceV1Input {
                id: Some(create_output.substance.id.clone()),
                name: Some("Custom methane updated".to_string()),
                formula: Some("CH4".to_string()),
                smiles: Some("C".to_string()),
                molar_mass_g_mol: Some(16.1),
                phase: Some("liquid".to_string()),
            },
            &repository,
            "req-crud-update",
        )
        .expect("must update user-defined substance");
        assert_eq!(update_output.substance.name, "Custom methane updated");
        assert_eq!(update_output.substance.phase, "liquid");
        assert_eq!(update_output.substance.source, "user");

        let delete_output = delete_substance_v1_with_repository(
            &DeleteSubstanceV1Input {
                id: Some(update_output.substance.id.clone()),
            },
            &repository,
            "req-crud-delete",
        )
        .expect("must delete user-defined substance");
        assert!(delete_output.deleted);
        assert!(repository
            .get_substance(&update_output.substance.id)
            .expect("must query deleted substance")
            .is_none());
    }

    #[test]
    fn create_substance_v1_rejects_duplicate_name_formula_pairs() {
        let (_temp_dir, repository) = setup_repository("create-duplicate.sqlite3");
        create_substance_v1_with_repository(
            &CreateSubstanceV1Input {
                name: Some("Acetic acid".to_string()),
                formula: Some("C2H4O2".to_string()),
                smiles: Some("CC(=O)O".to_string()),
                molar_mass_g_mol: Some(60.052),
                phase: Some("liquid".to_string()),
            },
            &repository,
            "req-create-dup-1",
        )
        .expect("must create first custom substance");

        let error = create_substance_v1_with_repository(
            &CreateSubstanceV1Input {
                name: Some("Acetic acid".to_string()),
                formula: Some("C2H4O2".to_string()),
                smiles: Some("CC(=O)O".to_string()),
                molar_mass_g_mol: Some(60.052),
                phase: Some("liquid".to_string()),
            },
            &repository,
            "req-create-dup-2",
        )
        .expect_err("duplicate name+formula should fail");

        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "SUBSTANCE_DUPLICATE");
    }

    #[test]
    fn maps_repository_substance_to_catalog_contract_shape() {
        let item = map_substance_to_catalog_item(Substance {
            id: "substance-1".to_string(),
            name: "Methane".to_string(),
            formula: "CH4".to_string(),
            smiles: Some("C".to_string()),
            molar_mass_g_mol: 16.0425,
            phase_default: "gas".to_string(),
            source_type: "user_defined".to_string(),
            created_at: "2026-03-04T00:00:00Z".to_string(),
        });

        assert_eq!(
            item,
            SubstanceCatalogItemV1 {
                id: "substance-1".to_string(),
                name: "Methane".to_string(),
                formula: "CH4".to_string(),
                smiles: Some("C".to_string()),
                molar_mass_g_mol: 16.0425,
                phase: "gas".to_string(),
                source: "user".to_string(),
            }
        );
    }

    #[test]
    fn save_list_and_load_scenario_draft_roundtrip_succeeds() {
        let (_temp_dir, repository) = setup_repository("scenario-draft-roundtrip.sqlite3");
        create_builder_test_substance(&repository, "scenario-draft-substance-1");

        let save_output = save_scenario_draft_v1_with_repository(
            &sample_save_input("scenario-draft-substance-1"),
            &repository,
            "req-scenario-save-roundtrip",
        )
        .expect("save scenario draft should succeed");
        assert!(!save_output.updated);
        assert_eq!(save_output.version, CONTRACT_VERSION_V1);
        assert!(
            save_output.scenario_name.starts_with("Saved Draft ["),
            "saved scenario name should include timestamp suffix"
        );

        let list_output = list_saved_scenarios_v1_with_repository(&repository, "req-scenario-list")
            .expect("list saved scenarios should succeed");
        assert_eq!(list_output.version, CONTRACT_VERSION_V1);
        assert_eq!(list_output.scenarios.len(), 1);
        assert_eq!(list_output.scenarios[0].id, save_output.scenario_id);
        assert_eq!(list_output.scenarios[0].name, save_output.scenario_name);
        assert_eq!(list_output.scenarios[0].updated_at, None);

        let load_output = load_scenario_draft_v1_with_repository(
            &LoadScenarioDraftV1Input {
                scenario_id: Some(save_output.scenario_id.clone()),
            },
            &repository,
            "req-scenario-load",
        )
        .expect("load scenario draft should succeed");
        assert_eq!(load_output.version, CONTRACT_VERSION_V1);
        assert_eq!(
            load_output.builder,
            sample_builder_payload("scenario-draft-substance-1")
        );
        assert_eq!(load_output.runtime, sample_runtime_payload());
        assert_eq!(load_output.calculation_summary, None);

        let saved_amounts = repository
            .read_scenario_amounts_as_value(&save_output.scenario_id)
            .expect("must read persisted scenario amounts");
        assert_eq!(
            saved_amounts,
            json!([
                {
                    "substanceId": "scenario-draft-substance-1",
                    "amountMol": 1.5
                }
            ])
        );
    }

    #[test]
    fn save_scenario_draft_updates_existing_scenario_when_scenario_id_is_provided() {
        let (_temp_dir, repository) = setup_repository("scenario-draft-update.sqlite3");
        create_builder_test_substance(&repository, "scenario-draft-substance-update");

        let initial_save = save_scenario_draft_v1_with_repository(
            &sample_save_input("scenario-draft-substance-update"),
            &repository,
            "req-scenario-update-initial",
        )
        .expect("initial scenario save should succeed");
        sleep(Duration::from_millis(1));

        let update_input = SaveScenarioDraftV1Input {
            scenario_id: Some(initial_save.scenario_id.clone()),
            scenario_name: Some("Saved Draft".to_string()),
            builder: Some(json!({
                "title": "Builder scenario updated",
                "reactionClass": "redox",
                "equation": "A + B -> AB",
                "description": "Updated draft payload",
                "participants": [
                    {
                        "id": "participant-1",
                        "substanceId": "scenario-draft-substance-update",
                        "role": "reactant",
                        "stoichCoeffInput": "1",
                        "phase": "solid",
                        "amountMolInput": "2.25",
                        "massGInput": "",
                        "volumeLInput": ""
                    }
                ]
            })),
            runtime: Some(json!({
                "temperatureC": 25.0,
                "pressureAtm": 1.0,
                "calculationPasses": 700,
                "precisionProfile": "High Precision",
                "fpsLimit": 120
            })),
            calculation_summary: None,
        };
        let expected_builder = update_input
            .builder
            .clone()
            .expect("builder payload should be present");
        let expected_runtime = update_input
            .runtime
            .clone()
            .expect("runtime payload should be present");
        let updated_save = save_scenario_draft_v1_with_repository(
            &update_input,
            &repository,
            "req-scenario-update-second",
        )
        .expect("updated scenario save should succeed");
        assert!(updated_save.updated);
        assert_eq!(updated_save.scenario_id, initial_save.scenario_id);
        assert_ne!(updated_save.scenario_name, initial_save.scenario_name);

        let list_output =
            list_saved_scenarios_v1_with_repository(&repository, "req-scenario-update-list")
                .expect("list saved scenarios should succeed");
        assert_eq!(list_output.scenarios.len(), 1);
        assert_eq!(list_output.scenarios[0].id, updated_save.scenario_id);
        assert!(list_output.scenarios[0].updated_at.is_some());

        let load_output = load_scenario_draft_v1_with_repository(
            &LoadScenarioDraftV1Input {
                scenario_id: Some(updated_save.scenario_id.clone()),
            },
            &repository,
            "req-scenario-update-load",
        )
        .expect("load updated scenario should succeed");
        assert_eq!(load_output.builder, expected_builder);
        assert_eq!(load_output.runtime, expected_runtime);
        assert_eq!(load_output.calculation_summary, None);
    }

    #[test]
    fn save_scenario_draft_persists_and_replaces_calculation_results() {
        let (_temp_dir, repository) =
            setup_repository("scenario-draft-calculation-results.sqlite3");
        create_builder_test_substance(&repository, "scenario-draft-substance-calculation");

        let initial_input = SaveScenarioDraftV1Input {
            scenario_id: None,
            scenario_name: Some("Saved Draft".to_string()),
            builder: Some(sample_builder_payload(
                "scenario-draft-substance-calculation",
            )),
            runtime: Some(sample_runtime_payload()),
            calculation_summary: Some(sample_calculation_summary_payload("signature-initial")),
        };

        let initial_save = save_scenario_draft_v1_with_repository(
            &initial_input,
            &repository,
            "req-scenario-calculation-initial",
        )
        .expect("initial save with calculation summary should succeed");

        let connection = Connection::open(repository.database_path()).expect("must open database");
        let initial_count: i64 = connection
            .query_row(
                "SELECT COUNT(1) FROM calculation_result WHERE scenario_run_id = ?1",
                params![initial_save.scenario_id.as_str()],
                |row| row.get(0),
            )
            .expect("must query initial calculation_result count");
        assert_eq!(initial_count, 5);

        let conversion_payload_json: String = connection
            .query_row(
                "SELECT payload_json
                FROM calculation_result
                WHERE scenario_run_id = ?1 AND result_type = 'conversion'
                LIMIT 1",
                params![initial_save.scenario_id.as_str()],
                |row| row.get(0),
            )
            .expect("must query conversion payload");
        let conversion_payload: Value =
            serde_json::from_str(&conversion_payload_json).expect("payload must decode");
        assert_eq!(
            conversion_payload["metadata"]["inputSignature"],
            Value::String("signature-initial".to_string())
        );
        assert_eq!(
            conversion_payload["metadata"]["scenario"]["scenarioId"],
            Value::String(initial_save.scenario_id.clone())
        );
        assert_eq!(
            conversion_payload["metadata"]["scenario"]["scenarioName"],
            Value::String(initial_save.scenario_name.clone())
        );

        let update_input = SaveScenarioDraftV1Input {
            scenario_id: Some(initial_save.scenario_id.clone()),
            scenario_name: Some("Saved Draft".to_string()),
            builder: Some(sample_builder_payload(
                "scenario-draft-substance-calculation",
            )),
            runtime: Some(sample_runtime_payload()),
            calculation_summary: Some(sample_calculation_summary_payload("signature-updated")),
        };
        let updated_save = save_scenario_draft_v1_with_repository(
            &update_input,
            &repository,
            "req-scenario-calculation-updated",
        )
        .expect("updated save with calculation summary should succeed");
        assert!(updated_save.updated);

        let updated_count: i64 = connection
            .query_row(
                "SELECT COUNT(1) FROM calculation_result WHERE scenario_run_id = ?1",
                params![initial_save.scenario_id.as_str()],
                |row| row.get(0),
            )
            .expect("must query updated calculation_result count");
        assert_eq!(updated_count, 5);

        let stoichiometry_payload_json: String = connection
            .query_row(
                "SELECT payload_json
                FROM calculation_result
                WHERE scenario_run_id = ?1 AND result_type = 'stoichiometry'
                LIMIT 1",
                params![initial_save.scenario_id.as_str()],
                |row| row.get(0),
            )
            .expect("must query updated stoichiometry payload");
        let stoichiometry_payload: Value =
            serde_json::from_str(&stoichiometry_payload_json).expect("payload must decode");
        assert_eq!(
            stoichiometry_payload["metadata"]["inputSignature"],
            Value::String("signature-updated".to_string())
        );
    }

    #[test]
    fn save_scenario_draft_rejects_malformed_calculation_summary_without_partial_persistence() {
        let (_temp_dir, repository) =
            setup_repository("scenario-draft-calculation-invalid.sqlite3");
        create_builder_test_substance(&repository, "scenario-draft-substance-calculation-invalid");

        let initial_save = save_scenario_draft_v1_with_repository(
            &sample_save_input("scenario-draft-substance-calculation-invalid"),
            &repository,
            "req-scenario-calculation-invalid-initial",
        )
        .expect("initial scenario save should succeed");

        let snapshot_before = repository
            .read_simulation_frame_summary_json(
                &initial_save.scenario_id,
                SCENARIO_SNAPSHOT_T_SIM_S,
            )
            .expect("must read snapshot before malformed save")
            .expect("snapshot must exist before malformed save");
        let run_before = repository
            .get_scenario_run(&initial_save.scenario_id)
            .expect("must query run before malformed save")
            .expect("run must exist before malformed save");
        let amounts_before = repository
            .read_scenario_amounts_as_value(&initial_save.scenario_id)
            .expect("must read scenario amounts before malformed save");

        let malformed_update_input = SaveScenarioDraftV1Input {
            scenario_id: Some(initial_save.scenario_id.clone()),
            scenario_name: Some("Saved Draft".to_string()),
            builder: Some(sample_builder_payload(
                "scenario-draft-substance-calculation-invalid",
            )),
            runtime: Some(sample_runtime_payload()),
            calculation_summary: Some(json!({
                "version": 1,
                "generatedAt": "2026-03-04T09:00:00.000Z",
                "inputSignature": "sig-invalid",
                "entries": [
                    {
                        "resultType": "stoichiometry",
                        "inputs": {},
                        "outputs": {},
                        "warnings": [123]
                    }
                ]
            })),
        };
        let error = save_scenario_draft_v1_with_repository(
            &malformed_update_input,
            &repository,
            "req-scenario-calculation-invalid-update",
        )
        .expect_err("malformed calculation summary must be rejected");
        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "SCENARIO_CALCULATION_SUMMARY_INVALID");

        let snapshot_after = repository
            .read_simulation_frame_summary_json(
                &initial_save.scenario_id,
                SCENARIO_SNAPSHOT_T_SIM_S,
            )
            .expect("must read snapshot after malformed save")
            .expect("snapshot must still exist after malformed save");
        assert_eq!(snapshot_after, snapshot_before);

        let run_after = repository
            .get_scenario_run(&initial_save.scenario_id)
            .expect("must query run after malformed save")
            .expect("run must still exist after malformed save");
        assert_eq!(run_after.name, run_before.name);

        let amounts_after = repository
            .read_scenario_amounts_as_value(&initial_save.scenario_id)
            .expect("must read scenario amounts after malformed save");
        assert_eq!(amounts_after, amounts_before);

        let connection = Connection::open(repository.database_path()).expect("must open database");
        let calculation_result_count: i64 = connection
            .query_row(
                "SELECT COUNT(1) FROM calculation_result WHERE scenario_run_id = ?1",
                params![initial_save.scenario_id.as_str()],
                |row| row.get(0),
            )
            .expect("must query calculation_result count after malformed save");
        assert_eq!(calculation_result_count, 0);
    }

    #[test]
    fn validate_save_scenario_draft_v1_rejects_empty_name_and_invalid_payload() {
        let empty_name_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("  ".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: None,
            },
            "req-scenario-validate-empty",
        )
        .expect_err("empty scenario name must be rejected");
        assert_eq!(empty_name_error.category, ErrorCategory::Validation);
        assert_eq!(empty_name_error.code, "SCENARIO_NAME_REQUIRED");

        let invalid_payload_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!("invalid-builder-shape")),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: None,
            },
            "req-scenario-validate-payload",
        )
        .expect_err("non-object builder payload must be rejected");
        assert_eq!(invalid_payload_error.category, ErrorCategory::Validation);
        assert_eq!(invalid_payload_error.code, "SCENARIO_BUILDER_INVALID");

        let invalid_calculation_summary_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: Some(json!(["invalid"])),
            },
            "req-scenario-validate-calculation-summary",
        )
        .expect_err("non-object calculation summary payload must be rejected");
        assert_eq!(
            invalid_calculation_summary_error.category,
            ErrorCategory::Validation
        );
        assert_eq!(
            invalid_calculation_summary_error.code,
            "SCENARIO_CALCULATION_SUMMARY_INVALID"
        );

        let invalid_calculation_summary_entry_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: Some(json!({
                    "version": 1,
                    "generatedAt": "2026-03-04T09:00:00.000Z",
                    "inputSignature": "sig",
                    "entries": [
                        {
                            "resultType": "stoichiometry",
                            "inputs": {},
                            "warnings": []
                        }
                    ]
                })),
            },
            "req-scenario-validate-calculation-summary-entry",
        )
        .expect_err("malformed entry object must be rejected");
        assert_eq!(
            invalid_calculation_summary_entry_error.category,
            ErrorCategory::Validation
        );
        assert_eq!(
            invalid_calculation_summary_entry_error.code,
            "SCENARIO_CALCULATION_SUMMARY_INVALID"
        );

        let whitespace_signature_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: Some(json!({
                    "version": 1,
                    "generatedAt": "2026-03-04T09:00:00.000Z",
                    "inputSignature": "   ",
                    "entries": []
                })),
            },
            "req-scenario-validate-calculation-summary-signature-whitespace",
        )
        .expect_err("whitespace-only inputSignature must be rejected");
        assert_eq!(
            whitespace_signature_error.category,
            ErrorCategory::Validation
        );
        assert_eq!(
            whitespace_signature_error.code,
            "SCENARIO_CALCULATION_SUMMARY_INVALID"
        );

        let padded_signature_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: Some(json!({
                    "version": 1,
                    "generatedAt": "2026-03-04T09:00:00.000Z",
                    "inputSignature": " sig ",
                    "entries": []
                })),
            },
            "req-scenario-validate-calculation-summary-signature-padded",
        )
        .expect_err("padded inputSignature must be rejected");
        assert_eq!(padded_signature_error.category, ErrorCategory::Validation);
        assert_eq!(
            padded_signature_error.code,
            "SCENARIO_CALCULATION_SUMMARY_INVALID"
        );

        let invalid_scenario_metadata_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: Some(json!({
                    "version": 1,
                    "generatedAt": "2026-03-04T09:00:00.000Z",
                    "inputSignature": "sig",
                    "scenarioMetadata": "invalid",
                    "entries": []
                })),
            },
            "req-scenario-validate-calculation-summary-scenario-metadata",
        )
        .expect_err("non-object scenarioMetadata must be rejected");
        assert_eq!(
            invalid_scenario_metadata_error.category,
            ErrorCategory::Validation
        );
        assert_eq!(
            invalid_scenario_metadata_error.code,
            "SCENARIO_CALCULATION_SUMMARY_INVALID"
        );

        let invalid_entry_metadata_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: Some(json!({
                    "version": 1,
                    "generatedAt": "2026-03-04T09:00:00.000Z",
                    "inputSignature": "sig",
                    "entries": [
                        {
                            "resultType": "stoichiometry",
                            "inputs": {},
                            "outputs": {},
                            "warnings": [],
                            "metadata": "invalid"
                        }
                    ]
                })),
            },
            "req-scenario-validate-calculation-summary-entry-metadata",
        )
        .expect_err("non-object entry metadata must be rejected");
        assert_eq!(
            invalid_entry_metadata_error.category,
            ErrorCategory::Validation
        );
        assert_eq!(
            invalid_entry_metadata_error.code,
            "SCENARIO_CALCULATION_SUMMARY_INVALID"
        );

        let padded_result_type_error = validate_save_scenario_draft_v1_input(
            &SaveScenarioDraftV1Input {
                scenario_id: None,
                scenario_name: Some("Valid draft".to_string()),
                builder: Some(json!({"title": "draft"})),
                runtime: Some(json!({"temperatureC": 20})),
                calculation_summary: Some(json!({
                    "version": 1,
                    "generatedAt": "2026-03-04T09:00:00.000Z",
                    "inputSignature": "sig",
                    "entries": [
                        {
                            "resultType": " stoichiometry ",
                            "inputs": {},
                            "outputs": {},
                            "warnings": []
                        }
                    ]
                })),
            },
            "req-scenario-validate-calculation-summary-entry-result-type-padded",
        )
        .expect_err("padded resultType token must be rejected");
        assert_eq!(padded_result_type_error.category, ErrorCategory::Validation);
        assert_eq!(
            padded_result_type_error.code,
            "SCENARIO_CALCULATION_SUMMARY_INVALID"
        );
    }
}
