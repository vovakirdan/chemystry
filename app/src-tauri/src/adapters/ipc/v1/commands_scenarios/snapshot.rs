use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(super) struct ScenarioDraftSnapshotV1 {
    pub(super) version: i64,
    pub(super) saved_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) updated_at: Option<String>,
    pub(super) builder: Value,
    pub(super) runtime: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) calculation_summary: Option<Value>,
}

pub(super) fn now_unix_timestamp_millis() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis().to_string(),
        Err(_) => "0".to_string(),
    }
}

pub(super) fn next_saved_scenario_id(request_id: &str) -> String {
    format!("scenario-run-{request_id}")
}

pub(super) fn unique_scenario_name(base_name: &str, timestamp_millis: &str) -> String {
    format!("{base_name} [{timestamp_millis}]")
}

pub(super) fn enrich_calculation_summary_with_scenario_metadata(
    calculation_summary: Option<&Value>,
    scenario_id: &str,
    scenario_name: &str,
    saved_at: &str,
    updated: bool,
) -> Option<Value> {
    let summary_object = calculation_summary?.as_object()?;
    let mut enriched_summary = summary_object.clone();

    // Intent: inject scenario linkage metadata so saved summaries remain traceable after reload.
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
