use super::*;

#[test]
fn supports_crud_for_critical_entities() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("repo.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path);

    let inserted_substance = repository
        .create_substance(&NewSubstance {
            id: "substance-test-1".to_string(),
            name: "Methane".to_string(),
            formula: "CH4".to_string(),
            smiles: Some("C".to_string()),
            molar_mass_g_mol: 16.0425,
            phase_default: "gas".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create substance");
    assert_eq!(inserted_substance.name, "Methane");

    let updated_substance = repository
        .update_substance(
            "substance-test-1",
            &UpdateSubstance {
                name: "Methane (updated)".to_string(),
                formula: "CH4".to_string(),
                smiles: Some("C".to_string()),
                molar_mass_g_mol: 16.043,
                phase_default: "gas".to_string(),
                source_type: "user_defined".to_string(),
            },
        )
        .expect("update should succeed")
        .expect("substance should exist");
    assert_eq!(updated_substance.name, "Methane (updated)");

    let inserted_template = repository
        .create_reaction_template(&NewReactionTemplate {
            id: "reaction-template-test-1".to_string(),
            title: "Methane oxidation".to_string(),
            reaction_class: "redox".to_string(),
            equation_balanced: "CH4 + 2O2 -> CO2 + 2H2O".to_string(),
            description: "Unit test template".to_string(),
            is_preset: false,
            version: 1,
        })
        .expect("must create reaction template");
    assert_eq!(inserted_template.version, 1);

    let updated_template = repository
        .update_reaction_template(
            "reaction-template-test-1",
            &UpdateReactionTemplate {
                title: "Methane oxidation (updated)".to_string(),
                reaction_class: "redox".to_string(),
                equation_balanced: "CH4 + 2O2 -> CO2 + 2H2O".to_string(),
                description: "Updated template".to_string(),
                is_preset: false,
                version: 2,
            },
        )
        .expect("template update should succeed")
        .expect("template should exist");
    assert_eq!(updated_template.version, 2);

    let inserted_run = repository
        .create_scenario_run(&NewScenarioRun {
            id: "scenario-run-test-1".to_string(),
            reaction_template_id: Some("reaction-template-test-1".to_string()),
            name: "Methane run".to_string(),
            temperature_k: 298.15,
            pressure_pa: 101_325.0,
            gas_medium: "air".to_string(),
            precision_profile: "balanced".to_string(),
            fps_limit: 60,
            particle_limit: 10_000,
        })
        .expect("must create scenario run");
    assert_eq!(inserted_run.name, "Methane run");

    let updated_run = repository
        .update_scenario_run(
            "scenario-run-test-1",
            &UpdateScenarioRun {
                reaction_template_id: None,
                name: "Methane run (updated)".to_string(),
                temperature_k: 320.0,
                pressure_pa: 95_000.0,
                gas_medium: "nitrogen".to_string(),
                precision_profile: "high_precision".to_string(),
                fps_limit: 120,
                particle_limit: 50_000,
            },
        )
        .expect("scenario run update should succeed")
        .expect("scenario run should exist");
    assert_eq!(updated_run.reaction_template_id, None);
    assert_eq!(updated_run.precision_profile, "high_precision");

    let all_substances = repository.list_substances().expect("must list substances");
    assert_eq!(all_substances.len(), 1);

    let all_templates = repository
        .list_reaction_templates()
        .expect("must list templates");
    assert_eq!(all_templates.len(), 1);

    let all_runs = repository
        .list_scenario_runs()
        .expect("must list scenario runs");
    assert_eq!(all_runs.len(), 1);

    assert!(repository
        .delete_scenario_run("scenario-run-test-1")
        .expect("scenario run delete should succeed"));
    assert!(repository
        .delete_reaction_template("reaction-template-test-1")
        .expect("template delete should succeed"));
    assert!(repository
        .delete_substance("substance-test-1")
        .expect("substance delete should succeed"));
}

#[test]
fn count_substance_scenario_usage_tracks_references() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("scenario-usage.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path.clone());

    repository
        .create_substance(&NewSubstance {
            id: "substance-usage-target".to_string(),
            name: "Usage target".to_string(),
            formula: "U1".to_string(),
            smiles: None,
            molar_mass_g_mol: 11.0,
            phase_default: "solid".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create usage target substance");

    repository
        .create_scenario_run(&NewScenarioRun {
            id: "scenario-run-usage-1".to_string(),
            reaction_template_id: None,
            name: "Usage scenario".to_string(),
            temperature_k: 298.15,
            pressure_pa: 101_325.0,
            gas_medium: "air".to_string(),
            precision_profile: "balanced".to_string(),
            fps_limit: 60,
            particle_limit: 10_000,
        })
        .expect("must create scenario run");

    let connection = Connection::open(database_path).expect("must open sqlite database");
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
                "scenario-amount-usage-1",
                "scenario-run-usage-1",
                "substance-usage-target",
                0.25_f64,
                Option::<f64>::None,
                Option::<f64>::None,
                Option::<f64>::None
            ],
        )
        .expect("must insert scenario amount");

    let usage_count = repository
        .count_substance_scenario_usage("substance-usage-target")
        .expect("must count scenario usage");
    assert_eq!(usage_count, 1);
    assert_eq!(
        repository
            .count_substance_scenario_usage("substance-usage-missing")
            .expect("must count missing scenario usage"),
        0
    );
}

#[test]
fn query_substances_supports_search_and_filters() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("query-substances.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path);

    repository
        .create_substance(&NewSubstance {
            id: "substance-methane".to_string(),
            name: "Methane".to_string(),
            formula: "CH4".to_string(),
            smiles: Some("C".to_string()),
            molar_mass_g_mol: 16.0425,
            phase_default: "gas".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create methane");
    repository
        .create_substance(&NewSubstance {
            id: "substance-hydrogen-peroxide".to_string(),
            name: "Hydrogen peroxide".to_string(),
            formula: "H2O2".to_string(),
            smiles: Some("OO".to_string()),
            molar_mass_g_mol: 34.0147,
            phase_default: "liquid".to_string(),
            source_type: "imported".to_string(),
        })
        .expect("must create hydrogen peroxide");
    repository
        .create_substance(&NewSubstance {
            id: "substance-hydrogen".to_string(),
            name: "Hydrogen".to_string(),
            formula: "H2".to_string(),
            smiles: None,
            molar_mass_g_mol: 2.01588,
            phase_default: "gas".to_string(),
            source_type: "builtin".to_string(),
        })
        .expect("must create hydrogen");

    let all_results = repository
        .query_substances(None, None, None)
        .expect("must query all substances");
    let all_ids = all_results
        .iter()
        .map(|substance| substance.id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        all_ids,
        vec![
            "substance-hydrogen",
            "substance-hydrogen-peroxide",
            "substance-methane"
        ]
    );

    let search_results = repository
        .query_substances(Some("h2"), None, None)
        .expect("must query by case-insensitive formula search");
    let search_ids = search_results
        .iter()
        .map(|substance| substance.id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        search_ids,
        vec!["substance-hydrogen", "substance-hydrogen-peroxide"]
    );

    let filtered_results = repository
        .query_substances(Some("METH"), Some("gas"), Some("user_defined"))
        .expect("must query by combined search and filters");
    assert_eq!(filtered_results.len(), 1);
    assert_eq!(filtered_results[0].id, "substance-methane");

    let phase_source_results = repository
        .query_substances(None, Some("liquid"), Some("imported"))
        .expect("must query by source + phase");
    assert_eq!(phase_source_results.len(), 1);
    assert_eq!(phase_source_results[0].id, "substance-hydrogen-peroxide");

    let no_results = repository
        .query_substances(Some("chloride"), Some("gas"), None)
        .expect("must return empty result set when filters do not match");
    assert!(no_results.is_empty());
}
