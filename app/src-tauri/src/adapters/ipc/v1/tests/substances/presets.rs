use std::collections::BTreeSet;

use rusqlite::{params, Connection};
use serde_json::json;

use super::super::*;
use crate::storage::{NewReactionTemplate, NewScenarioRun, ReactionTemplate};

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
