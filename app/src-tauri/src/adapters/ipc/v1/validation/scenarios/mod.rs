mod calculation_summary;

use serde_json::Value;

use crate::infra::errors::CommandResult;

use super::super::contracts::{LoadScenarioDraftV1Input, SaveScenarioDraftV1Input};
use super::super::{MAX_SCENARIO_ID_LENGTH, MAX_SCENARIO_NAME_LENGTH};
use super::common::validate_required_text_field;
use super::validation_error;
use calculation_summary::validate_calculation_summary_payload;

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

    // Intent: treat explicit JSON null the same as omission to preserve old contract behavior.
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
