use serde::{Deserialize, Serialize};
use tauri::State;

use crate::infra::config::feature_flags::FeatureFlags as ConfigFeatureFlags;
use crate::infra::errors::{CommandError, CommandResult};
use crate::infra::logging;
use crate::storage::{StorageError, StorageRepository, Substance};

pub const CONTRACT_VERSION_V1: &str = "v1";
const MAX_NAME_LENGTH: usize = 64;
const MAX_SUBSTANCE_SEARCH_LENGTH: usize = 128;
const GREET_COMMAND_NAME: &str = "greet_v1";
const HEALTH_COMMAND_NAME: &str = "health_v1";
const GET_FEATURE_FLAGS_COMMAND_NAME: &str = "get_feature_flags_v1";
const QUERY_SUBSTANCES_COMMAND_NAME: &str = "query_substances_v1";

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

pub type CommandErrorV1 = CommandError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuerySubstancesFiltersV1 {
    pub search: Option<String>,
    pub phase_filter: Option<String>,
    pub source_filter: Option<String>,
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
    use super::*;
    use crate::infra::errors::ErrorCategory;

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
}
