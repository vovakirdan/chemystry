use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::infra::config::feature_flags::FeatureFlags as ConfigFeatureFlags;
use crate::infra::errors::CommandError;

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
pub struct ImportSdfMolV1Input {
    #[serde(default, alias = "file_name")]
    pub file_name: Option<String>,
    #[serde(default)]
    pub contents: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportSdfMolV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub imported_count: usize,
    pub substances: Vec<SubstanceCatalogItemV1>,
}

#[derive(Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportSmilesV1Input {
    #[serde(default, alias = "file_name")]
    pub file_name: Option<String>,
    #[serde(default)]
    pub contents: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportSmilesV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub imported_count: usize,
    pub substances: Vec<SubstanceCatalogItemV1>,
}

#[derive(Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportXyzV1Input {
    #[serde(default, alias = "file_name")]
    pub file_name: Option<String>,
    #[serde(default)]
    pub contents: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportXyzInferenceSummaryV1 {
    pub record_index: usize,
    pub inferred_bond_count: usize,
    pub avg_confidence: f64,
    pub min_confidence: f64,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportXyzV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub imported_count: usize,
    pub substances: Vec<SubstanceCatalogItemV1>,
    pub inference_summaries: Vec<ImportXyzInferenceSummaryV1>,
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
