use super::*;

#[test]
fn scenario_snapshot_and_amount_helpers_support_roundtrip() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("scenario-snapshot.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path);

    repository
        .create_substance(&NewSubstance {
            id: "snapshot-substance-a".to_string(),
            name: "Snapshot A".to_string(),
            formula: "SA".to_string(),
            smiles: None,
            molar_mass_g_mol: 12.0,
            phase_default: "solid".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create first snapshot substance");
    repository
        .create_substance(&NewSubstance {
            id: "snapshot-substance-b".to_string(),
            name: "Snapshot B".to_string(),
            formula: "SB".to_string(),
            smiles: None,
            molar_mass_g_mol: 24.0,
            phase_default: "liquid".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create second snapshot substance");

    repository
        .create_scenario_run(&NewScenarioRun {
            id: "scenario-run-snapshot-1".to_string(),
            reaction_template_id: None,
            name: "Snapshot scenario".to_string(),
            temperature_k: 298.15,
            pressure_pa: 101_325.0,
            gas_medium: "air".to_string(),
            precision_profile: "balanced".to_string(),
            fps_limit: 60,
            particle_limit: 10_000,
        })
        .expect("must create scenario run for snapshot helper");

    repository
        .upsert_simulation_frame_summary_json(
            "scenario-run-snapshot-1",
            0.0,
            "{\"version\":1,\"savedAt\":\"1000\",\"builder\":{\"title\":\"v1\"},\"runtime\":{}}",
        )
        .expect("must insert initial snapshot payload");
    repository
        .upsert_simulation_frame_summary_json(
            "scenario-run-snapshot-1",
            0.0,
            "{\"version\":1,\"savedAt\":\"2000\",\"builder\":{\"title\":\"v2\"},\"runtime\":{}}",
        )
        .expect("must update snapshot payload via upsert");

    let stored_snapshot = repository
        .read_simulation_frame_summary_json("scenario-run-snapshot-1", 0.0)
        .expect("must read snapshot payload")
        .expect("snapshot payload should exist");
    assert_eq!(
        stored_snapshot,
        "{\"version\":1,\"savedAt\":\"2000\",\"builder\":{\"title\":\"v2\"},\"runtime\":{}}"
    );

    repository
        .replace_scenario_amounts_from_value(
            "scenario-run-snapshot-1",
            &json!([
                {
                    "substanceId": "snapshot-substance-a",
                    "amountMol": 1.5
                },
                {
                    "substanceId": "snapshot-substance-b",
                    "massG": 12.5
                },
                {
                    "substanceId": "snapshot-substance-missing",
                    "amountMol": 9.0
                }
            ]),
        )
        .expect("must replace scenario amounts");

    let stored_amounts = repository
        .read_scenario_amounts_as_value("scenario-run-snapshot-1")
        .expect("must read scenario amounts");
    assert_eq!(
        stored_amounts,
        json!([
            {
                "substanceId": "snapshot-substance-a",
                "amountMol": 1.5
            },
            {
                "substanceId": "snapshot-substance-b",
                "massG": 12.5
            }
        ])
    );

    let initial_calculation_summary = json!({
        "version": 1,
        "generatedAt": "2026-03-04T09:00:00.000Z",
        "inputSignature": "signature-initial",
        "scenarioMetadata": {
            "scenarioId": "scenario-run-snapshot-1",
            "scenarioName": "Snapshot scenario [1741089000000]"
        },
        "entries": [
            {
                "resultType": "stoichiometry",
                "inputs": { "participants": [] },
                "outputs": { "reactionExtentMol": 1.0 },
                "warnings": []
            },
            {
                "resultType": "yield",
                "inputs": {},
                "outputs": { "percentYield": 95.0 },
                "warnings": ["Measured value from manual input."]
            }
        ]
    });
    repository
        .replace_calculation_results_from_value(
            "scenario-run-snapshot-1",
            Some(&initial_calculation_summary),
        )
        .expect("must replace scenario calculation results");

    let connection = Connection::open(repository.database_path()).expect("must open database");
    let initial_result_count: i64 = connection
        .query_row(
            "SELECT COUNT(1) FROM calculation_result WHERE scenario_run_id = ?1",
            params!["scenario-run-snapshot-1"],
            |row| row.get(0),
        )
        .expect("must query initial calculation_result count");
    assert_eq!(initial_result_count, 2);

    let yield_payload_json: String = connection
        .query_row(
            "SELECT payload_json
            FROM calculation_result
            WHERE scenario_run_id = ?1 AND result_type = 'yield'
            LIMIT 1",
            params!["scenario-run-snapshot-1"],
            |row| row.get(0),
        )
        .expect("must query yield calculation payload");
    let yield_payload: Value =
        serde_json::from_str(&yield_payload_json).expect("yield payload must decode");
    assert_eq!(
        yield_payload,
        json!({
            "version": 1,
            "inputs": {},
            "outputs": {
                "percentYield": 95.0
            },
            "warnings": ["Measured value from manual input."],
            "metadata": {
                "generatedAt": "2026-03-04T09:00:00.000Z",
                "inputSignature": "signature-initial",
                "scenario": {
                    "scenarioId": "scenario-run-snapshot-1",
                    "scenarioName": "Snapshot scenario [1741089000000]"
                }
            }
        })
    );

    let updated_calculation_summary = json!({
        "version": 1,
        "generatedAt": "2026-03-04T09:10:00.000Z",
        "inputSignature": "signature-updated",
        "entries": [
            {
                "resultType": "conversion",
                "inputs": {},
                "outputs": {},
                "warnings": []
            }
        ]
    });
    repository
        .replace_calculation_results_from_value(
            "scenario-run-snapshot-1",
            Some(&updated_calculation_summary),
        )
        .expect("must replace previous calculation_result rows");

    let updated_result_count: i64 = connection
        .query_row(
            "SELECT COUNT(1) FROM calculation_result WHERE scenario_run_id = ?1",
            params!["scenario-run-snapshot-1"],
            |row| row.get(0),
        )
        .expect("must query updated calculation_result count");
    assert_eq!(updated_result_count, 1);

    let updated_result_type: String = connection
        .query_row(
            "SELECT result_type
            FROM calculation_result
            WHERE scenario_run_id = ?1
            LIMIT 1",
            params!["scenario-run-snapshot-1"],
            |row| row.get(0),
        )
        .expect("must query updated calculation_result type");
    assert_eq!(updated_result_type, "conversion");
}
