use serde_json::Value;

use crate::infra::errors::CommandResult;

use super::super::super::CALCULATION_SUMMARY_ALLOWED_RESULT_TYPES;
use super::super::validation_error;

pub(super) fn validate_calculation_summary_payload(
    summary: &Value,
    request_id: &str,
) -> CommandResult<()> {
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
    // Intent: signature must stay byte-stable for cache keys and DB deduplication.
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

    // Intent: fail-fast on the first malformed entry to preserve deterministic error reporting.
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
