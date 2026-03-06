use super::*;

#[test]
fn baseline_seed_is_idempotent() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("seed.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path.clone());

    let first_seed_report = repository
        .seed_baseline_data()
        .expect("first seed should succeed");
    assert_eq!(
        first_seed_report.substances_processed,
        baseline_substances_len()
    );

    let count_after_first_seed = repository
        .list_substances()
        .expect("must list substances after first seed")
        .len();

    repository
        .seed_baseline_data()
        .expect("second seed should succeed");

    let count_after_second_seed = repository
        .list_substances()
        .expect("must list substances after second seed")
        .len();

    assert_eq!(count_after_first_seed, baseline_substances_len());
    assert_eq!(count_after_second_seed, baseline_substances_len());

    let preset = repository
        .get_reaction_template("builtin-preset-hydrogen-combustion-v1")
        .expect("preset lookup should succeed")
        .expect("preset should exist");
    assert!(preset.is_preset);

    let connection = Connection::open(database_path).expect("must open seeded database");
    let species_count: i64 = connection
        .query_row("SELECT COUNT(1) FROM reaction_species", [], |row| {
            row.get(0)
        })
        .expect("must query species count");
    assert_eq!(species_count as usize, baseline_reaction_species_len());
}

#[test]
fn seed_reconciles_natural_key_conflicts_without_failing() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("seed-reconcile.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");

    let connection = Connection::open(&database_path).expect("must open database");
    connection
        .execute(
            "INSERT INTO substance(
                id,
                name,
                formula,
                smiles,
                molar_mass_g_mol,
                phase_default,
                source_type
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "legacy-substance-hydrogen",
                "Hydrogen",
                "H2",
                Some("[H][H]".to_string()),
                9.999_f64,
                "liquid",
                "user_defined"
            ],
        )
        .expect("must insert legacy substance");
    connection
        .execute(
            "INSERT INTO reaction_template(
                id,
                title,
                reaction_class,
                equation_balanced,
                description,
                is_preset,
                version
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "legacy-template-hydrogen-combustion-v1",
                "Hydrogen combustion",
                "redox",
                "H2 + O2 -> H2O",
                "Legacy preset from old app version",
                0_i64,
                1_i64
            ],
        )
        .expect("must insert legacy template");
    connection
        .execute(
            "INSERT INTO reaction_species(
                id,
                reaction_template_id,
                substance_id,
                role,
                stoich_coeff
            ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                "legacy-species-hydrogen-reactant",
                "legacy-template-hydrogen-combustion-v1",
                "legacy-substance-hydrogen",
                "reactant",
                0.5_f64
            ],
        )
        .expect("must insert legacy species");
    drop(connection);

    let repository = StorageRepository::new(database_path.clone());
    repository
        .seed_baseline_data()
        .expect("seed should reconcile legacy natural-key rows");

    let connection = Connection::open(database_path).expect("must reopen seeded database");

    let hydrogen_rows: i64 = connection
        .query_row(
            "SELECT COUNT(1) FROM substance WHERE name = 'Hydrogen' AND formula = 'H2'",
            [],
            |row| row.get(0),
        )
        .expect("must query hydrogen row count");
    assert_eq!(hydrogen_rows, 1);

    let (hydrogen_id, source_type, molar_mass, phase_default, smiles): (
        String,
        String,
        f64,
        String,
        Option<String>,
    ) = connection
        .query_row(
            "SELECT id, source_type, molar_mass_g_mol, phase_default, smiles
            FROM substance
            WHERE name = 'Hydrogen' AND formula = 'H2'",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .expect("must read reconciled hydrogen row");
    assert_eq!(hydrogen_id, "legacy-substance-hydrogen");
    assert_eq!(source_type, "user_defined");
    assert!((molar_mass - 9.999_f64).abs() < 1e-9_f64);
    assert_eq!(phase_default, "liquid");
    assert_eq!(smiles, Some("[H][H]".to_string()));

    let template_rows: i64 = connection
        .query_row(
            "SELECT COUNT(1) FROM reaction_template
            WHERE title = 'Hydrogen combustion' AND version = 1",
            [],
            |row| row.get(0),
        )
        .expect("must query template row count");
    assert_eq!(template_rows, 1);

    let (template_id, is_preset, equation): (String, i64, String) = connection
        .query_row(
            "SELECT id, is_preset, equation_balanced
            FROM reaction_template
            WHERE title = 'Hydrogen combustion' AND version = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("must read reconciled template row");
    assert_eq!(template_id, "legacy-template-hydrogen-combustion-v1");
    assert_eq!(is_preset, 1);
    assert_eq!(equation, "2H2 + O2 -> 2H2O");

    let species_rows: i64 = connection
        .query_row(
            "SELECT COUNT(1) FROM reaction_species
            WHERE reaction_template_id = ?1 AND substance_id = ?2 AND role = 'reactant'",
            params![template_id.as_str(), hydrogen_id.as_str()],
            |row| row.get(0),
        )
        .expect("must query reconciled species row count");
    assert_eq!(species_rows, 1);

    let species_stoich: f64 = connection
        .query_row(
            "SELECT stoich_coeff FROM reaction_species
            WHERE reaction_template_id = ?1 AND substance_id = ?2 AND role = 'reactant'",
            params![template_id.as_str(), hydrogen_id.as_str()],
            |row| row.get(0),
        )
        .expect("must read reconciled species row");
    assert!((species_stoich - 2.0_f64).abs() < 1e-9_f64);
}
