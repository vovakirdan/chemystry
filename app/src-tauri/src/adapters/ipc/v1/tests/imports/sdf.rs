use super::super::*;
use crate::infra::errors::ErrorCategory;
use crate::storage::NewSubstance;

#[test]
fn import_sdf_mol_v1_imports_single_mol_record() {
    let (_temp_dir, repository) = setup_repository("import-single-mol.sqlite3");
    let request_id = "req-import-single-mol";
    let input = ImportSdfMolV1Input {
        file_name: Some("water.mol".to_string()),
        contents: Some(sample_water_mol()),
    };

    let result = import_sdf_mol_v1_with_repository(&input, &repository, request_id)
        .expect("valid MOL should import");

    assert_eq!(result.version, CONTRACT_VERSION_V1);
    assert_eq!(result.request_id, request_id);
    assert_eq!(result.imported_count, 1);
    assert_eq!(result.substances.len(), 1);
    assert_eq!(result.substances[0].name, "Water");
    assert_eq!(result.substances[0].formula, "H2O");
    assert_eq!(result.substances[0].phase, "solid");
    assert_eq!(result.substances[0].source, "imported");
    assert!((result.substances[0].molar_mass_g_mol - 18.01528).abs() < 0.0001);

    let stored = repository
        .get_substance(&result.substances[0].id)
        .expect("must load imported substance")
        .expect("imported substance must exist");
    assert_eq!(stored.source_type, "imported");
    assert_eq!(stored.phase_default, "solid");
}

#[test]
fn import_sdf_mol_v1_imports_multiple_sdf_records() {
    let (_temp_dir, repository) = setup_repository("import-multi-sdf.sqlite3");
    let request_id = "req-import-multi-sdf";
    let input = ImportSdfMolV1Input {
        file_name: Some("bundle.sdf".to_string()),
        contents: Some(format!(
            "{}$$$$\n{}$$$$\n",
            sample_water_mol(),
            sample_methane_mol()
        )),
    };

    let result = import_sdf_mol_v1_with_repository(&input, &repository, request_id)
        .expect("valid SDF should import");

    assert_eq!(result.imported_count, 2);
    assert_eq!(result.substances.len(), 2);
    assert_eq!(result.substances[0].source, "imported");
    assert_eq!(result.substances[1].source, "imported");
    assert_eq!(
        result.substances[0].id,
        "imported-substance-req-import-multi-sdf-1"
    );
    assert_eq!(
        result.substances[1].id,
        "imported-substance-req-import-multi-sdf-2"
    );

    let stored = repository
        .list_substances()
        .expect("must list imported substances");
    assert_eq!(stored.len(), 2);
    assert!(stored
        .iter()
        .all(|substance| substance.source_type == "imported"));
}

#[test]
fn import_sdf_mol_v1_rolls_back_batch_when_second_insert_fails() {
    let (_temp_dir, repository) = setup_repository("import-rollback.sqlite3");
    let request_id = "req-import-rollback";
    repository
        .create_substance(&NewSubstance {
            id: format!("imported-substance-{request_id}-2"),
            name: "Preexisting".to_string(),
            formula: "Pz".to_string(),
            smiles: None,
            molar_mass_g_mol: 10.0,
            phase_default: "solid".to_string(),
            source_type: "imported".to_string(),
        })
        .expect("must create preexisting conflicting id row");

    let input = ImportSdfMolV1Input {
        file_name: Some("bundle.sdf".to_string()),
        contents: Some(format!(
            "{}$$$$\n{}$$$$\n",
            sample_water_mol(),
            sample_methane_mol()
        )),
    };

    let error = import_sdf_mol_v1_with_repository(&input, &repository, request_id)
        .expect_err("second insert should fail on primary key conflict");
    assert_eq!(error.category, ErrorCategory::Internal);
    assert_eq!(error.code, "IMPORT_FAILED");

    let stored = repository
        .list_substances()
        .expect("must list rows after failed import");
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].id, format!("imported-substance-{request_id}-2"));
}

#[test]
fn import_sdf_mol_v1_keeps_database_clean_when_second_record_is_invalid() {
    let (_temp_dir, repository) = setup_repository("import-invalid-second-record.sqlite3");
    let request_id = "req-import-invalid-second-record";
    let input = ImportSdfMolV1Input {
        file_name: Some("mixed.sdf".to_string()),
        contents: Some(format!(
            "{}$$$$\n{}$$$$\n",
            sample_water_mol(),
            sample_invalid_unknown_element_mol()
        )),
    };

    let error = import_sdf_mol_v1_with_repository(&input, &repository, request_id)
        .expect_err("second broken record should fail import");
    assert_eq!(error.category, ErrorCategory::Import);
    assert_eq!(error.code, "IMPORT_UNKNOWN_ELEMENT");

    let stored = repository
        .list_substances()
        .expect("must list rows after parse failure");
    assert!(stored.is_empty());
}

#[test]
fn import_sdf_mol_v1_returns_contextual_parse_error_for_invalid_file() {
    let (_temp_dir, repository) = setup_repository("import-invalid.sqlite3");
    let request_id = "req-import-invalid";
    let input = ImportSdfMolV1Input {
        file_name: Some("broken.mol".to_string()),
        contents: Some(sample_invalid_unknown_element_mol()),
    };

    let error = import_sdf_mol_v1_with_repository(&input, &repository, request_id)
        .expect_err("unknown elements must fail import");
    assert_eq!(error.category, ErrorCategory::Import);
    assert_eq!(error.code, "IMPORT_UNKNOWN_ELEMENT");
    assert!(error.message.contains("file=broken.mol"));
    assert!(error.message.contains("record=1"));
    assert!(error.message.contains("line=5"));
}

#[test]
fn import_sdf_mol_v1_rejects_malicious_atom_count_without_panic() {
    let (_temp_dir, repository) = setup_repository("import-malicious-counts.sqlite3");
    let request_id = "req-import-malicious-counts";
    let input = ImportSdfMolV1Input {
        file_name: Some("malicious.mol".to_string()),
        contents: Some(sample_malicious_atom_count_mol()),
    };

    let error = import_sdf_mol_v1_with_repository(&input, &repository, request_id)
        .expect_err("malicious atom count should return controlled error");
    assert_eq!(error.category, ErrorCategory::Import);
    assert_eq!(error.code, "IMPORT_MOL_ATOM_COUNT_TOO_LARGE");
}
