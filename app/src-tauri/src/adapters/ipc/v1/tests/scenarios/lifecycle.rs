use std::{thread::sleep, time::Duration};

use serde_json::json;

use super::super::*;

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
