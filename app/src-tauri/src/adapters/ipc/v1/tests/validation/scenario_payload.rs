use serde_json::json;

use super::super::*;
use crate::infra::errors::ErrorCategory;

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
