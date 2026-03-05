use rusqlite::{params, Connection};
use serde_json::{json, Value};

use super::super::*;
use crate::infra::errors::ErrorCategory;

#[test]
fn save_scenario_draft_persists_and_replaces_calculation_results() {
    let (_temp_dir, repository) = setup_repository("scenario-draft-calculation-results.sqlite3");
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
    let (_temp_dir, repository) = setup_repository("scenario-draft-calculation-invalid.sqlite3");
    create_builder_test_substance(&repository, "scenario-draft-substance-calculation-invalid");

    let initial_save = save_scenario_draft_v1_with_repository(
        &sample_save_input("scenario-draft-substance-calculation-invalid"),
        &repository,
        "req-scenario-calculation-invalid-initial",
    )
    .expect("initial scenario save should succeed");

    let snapshot_before = repository
        .read_simulation_frame_summary_json(&initial_save.scenario_id, SCENARIO_SNAPSHOT_T_SIM_S)
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
        .read_simulation_frame_summary_json(&initial_save.scenario_id, SCENARIO_SNAPSHOT_T_SIM_S)
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
