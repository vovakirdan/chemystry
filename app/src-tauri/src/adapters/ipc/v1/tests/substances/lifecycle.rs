use rusqlite::{params, Connection};

use super::super::*;
use crate::infra::errors::ErrorCategory;
use crate::storage::{NewScenarioRun, NewSubstance};

#[test]
fn update_substance_v1_rejects_builtin_substances() {
    let (_temp_dir, repository) = setup_repository("update-builtin.sqlite3");
    repository
        .create_substance(&NewSubstance {
            id: "builtin-test-substance".to_string(),
            name: "Built-in hydrogen".to_string(),
            formula: "H2".to_string(),
            smiles: None,
            molar_mass_g_mol: 2.01588,
            phase_default: "gas".to_string(),
            source_type: "builtin".to_string(),
        })
        .expect("must create builtin substance");

    let error = update_substance_v1_with_repository(
        &UpdateSubstanceV1Input {
            id: Some("builtin-test-substance".to_string()),
            name: Some("Hydrogen updated".to_string()),
            formula: Some("H2".to_string()),
            smiles: None,
            molar_mass_g_mol: Some(2.1),
            phase: Some("gas".to_string()),
        },
        &repository,
        "req-update-builtin",
    )
    .expect_err("builtin substance updates must be rejected");

    assert_eq!(error.category, ErrorCategory::Validation);
    assert_eq!(error.code, "SUBSTANCE_SOURCE_IMMUTABLE");
}

#[test]
fn delete_substance_v1_rejects_imported_substances() {
    let (_temp_dir, repository) = setup_repository("delete-imported.sqlite3");
    repository
        .create_substance(&NewSubstance {
            id: "imported-test-substance".to_string(),
            name: "Imported acetone".to_string(),
            formula: "C3H6O".to_string(),
            smiles: Some("CC(=O)C".to_string()),
            molar_mass_g_mol: 58.08,
            phase_default: "liquid".to_string(),
            source_type: "imported".to_string(),
        })
        .expect("must create imported substance");

    let error = delete_substance_v1_with_repository(
        &DeleteSubstanceV1Input {
            id: Some("imported-test-substance".to_string()),
        },
        &repository,
        "req-delete-imported",
    )
    .expect_err("imported substance delete must be rejected");

    assert_eq!(error.category, ErrorCategory::Validation);
    assert_eq!(error.code, "SUBSTANCE_SOURCE_IMMUTABLE");
}

#[test]
fn delete_substance_v1_rejects_substances_used_in_scenarios() {
    let (_temp_dir, repository) = setup_repository("delete-in-use.sqlite3");
    repository
        .create_substance(&NewSubstance {
            id: "user-in-use-substance".to_string(),
            name: "In-use custom".to_string(),
            formula: "IU1".to_string(),
            smiles: None,
            molar_mass_g_mol: 10.0,
            phase_default: "solid".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create user-defined substance");
    repository
        .create_scenario_run(&NewScenarioRun {
            id: "scenario-run-in-use".to_string(),
            reaction_template_id: None,
            name: "Scenario with in-use substance".to_string(),
            temperature_k: 298.15,
            pressure_pa: 101_325.0,
            gas_medium: "air".to_string(),
            precision_profile: "balanced".to_string(),
            fps_limit: 60,
            particle_limit: 5_000,
        })
        .expect("must create scenario run");

    let connection = Connection::open(repository.database_path()).expect("must open database");
    connection
        .execute(
            "INSERT INTO scenario_amount(
                    id,
                    scenario_run_id,
                    substance_id,
                    amount_mol,
                    mass_g,
                    volume_l,
                    concentration_mol_l
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "scenario-amount-in-use",
                "scenario-run-in-use",
                "user-in-use-substance",
                1.5_f64,
                Option::<f64>::None,
                Option::<f64>::None,
                Option::<f64>::None
            ],
        )
        .expect("must insert scenario amount");

    let error = delete_substance_v1_with_repository(
        &DeleteSubstanceV1Input {
            id: Some("user-in-use-substance".to_string()),
        },
        &repository,
        "req-delete-in-use",
    )
    .expect_err("in-use substance delete must be rejected");

    assert_eq!(error.category, ErrorCategory::Validation);
    assert_eq!(error.code, "SUBSTANCE_IN_USE");
}

#[test]
fn user_substance_crud_happy_path_succeeds() {
    let (_temp_dir, repository) = setup_repository("crud-happy.sqlite3");
    let create_output = create_substance_v1_with_repository(
        &CreateSubstanceV1Input {
            name: Some("Custom methane".to_string()),
            formula: Some("CH4".to_string()),
            smiles: Some("C".to_string()),
            molar_mass_g_mol: Some(16.0425),
            phase: Some("gas".to_string()),
        },
        &repository,
        "req-crud-create",
    )
    .expect("must create user-defined substance");
    assert_eq!(create_output.substance.source, "user");
    assert_eq!(create_output.substance.phase, "gas");

    let update_output = update_substance_v1_with_repository(
        &UpdateSubstanceV1Input {
            id: Some(create_output.substance.id.clone()),
            name: Some("Custom methane updated".to_string()),
            formula: Some("CH4".to_string()),
            smiles: Some("C".to_string()),
            molar_mass_g_mol: Some(16.1),
            phase: Some("liquid".to_string()),
        },
        &repository,
        "req-crud-update",
    )
    .expect("must update user-defined substance");
    assert_eq!(update_output.substance.name, "Custom methane updated");
    assert_eq!(update_output.substance.phase, "liquid");
    assert_eq!(update_output.substance.source, "user");

    let delete_output = delete_substance_v1_with_repository(
        &DeleteSubstanceV1Input {
            id: Some(update_output.substance.id.clone()),
        },
        &repository,
        "req-crud-delete",
    )
    .expect("must delete user-defined substance");
    assert!(delete_output.deleted);
    assert!(repository
        .get_substance(&update_output.substance.id)
        .expect("must query deleted substance")
        .is_none());
}

#[test]
fn create_substance_v1_rejects_duplicate_name_formula_pairs() {
    let (_temp_dir, repository) = setup_repository("create-duplicate.sqlite3");
    create_substance_v1_with_repository(
        &CreateSubstanceV1Input {
            name: Some("Acetic acid".to_string()),
            formula: Some("C2H4O2".to_string()),
            smiles: Some("CC(=O)O".to_string()),
            molar_mass_g_mol: Some(60.052),
            phase: Some("liquid".to_string()),
        },
        &repository,
        "req-create-dup-1",
    )
    .expect("must create first custom substance");

    let error = create_substance_v1_with_repository(
        &CreateSubstanceV1Input {
            name: Some("Acetic acid".to_string()),
            formula: Some("C2H4O2".to_string()),
            smiles: Some("CC(=O)O".to_string()),
            molar_mass_g_mol: Some(60.052),
            phase: Some("liquid".to_string()),
        },
        &repository,
        "req-create-dup-2",
    )
    .expect_err("duplicate name+formula should fail");

    assert_eq!(error.category, ErrorCategory::Validation);
    assert_eq!(error.code, "SUBSTANCE_DUPLICATE");
}
