use super::super::*;
use crate::infra::errors::ErrorCategory;
use crate::storage::NewSubstance;

#[test]
fn import_smiles_v1_imports_records_into_library() {
    let (_temp_dir, repository) = setup_repository("import-smiles-success.sqlite3");
    let request_id = "req-import-smiles-success";
    let input = ImportSmilesV1Input {
        file_name: Some("bundle.smi".to_string()),
        contents: Some(sample_valid_smiles()),
    };

    let result = import_smiles_v1_with_repository(&input, &repository, request_id)
        .expect("valid SMILES should import");

    assert_eq!(result.version, CONTRACT_VERSION_V1);
    assert_eq!(result.request_id, request_id);
    assert_eq!(result.imported_count, 2);
    assert_eq!(result.substances.len(), 2);
    assert_eq!(result.substances[0].name, "Ethane");
    assert_eq!(result.substances[0].formula, "C2");
    assert_eq!(result.substances[0].smiles.as_deref(), Some("CC"));
    assert_eq!(result.substances[0].phase, "solid");
    assert_eq!(result.substances[0].source, "imported");
    assert_eq!(result.substances[1].name, "Imported SMILES 2");
    assert_eq!(result.substances[1].smiles.as_deref(), Some("O"));

    let stored = repository
        .list_substances()
        .expect("must list imported smiles rows");
    assert_eq!(stored.len(), 2);
    assert!(stored
        .iter()
        .all(|substance| substance.source_type == "imported"));
}

#[test]
fn import_smiles_v1_rolls_back_batch_when_second_insert_fails() {
    let (_temp_dir, repository) = setup_repository("import-smiles-rollback.sqlite3");
    let request_id = "req-import-smiles-rollback";
    repository
        .create_substance(&NewSubstance {
            id: format!("imported-substance-{request_id}-2"),
            name: "Preexisting".to_string(),
            formula: "Pz".to_string(),
            smiles: Some("P".to_string()),
            molar_mass_g_mol: 10.0,
            phase_default: "solid".to_string(),
            source_type: "imported".to_string(),
        })
        .expect("must create preexisting conflicting id row");

    let input = ImportSmilesV1Input {
        file_name: Some("bundle.smi".to_string()),
        contents: Some(sample_valid_smiles()),
    };

    let error = import_smiles_v1_with_repository(&input, &repository, request_id)
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
fn import_smiles_v1_returns_contextual_parse_error() {
    let (_temp_dir, repository) = setup_repository("import-smiles-invalid.sqlite3");
    let request_id = "req-import-smiles-invalid";
    let input = ImportSmilesV1Input {
        file_name: Some("broken.smi".to_string()),
        contents: Some(sample_invalid_unknown_element_smiles()),
    };

    let error = import_smiles_v1_with_repository(&input, &repository, request_id)
        .expect_err("unknown element should fail import");
    assert_eq!(error.category, ErrorCategory::Import);
    assert_eq!(error.code, "IMPORT_UNKNOWN_ELEMENT");
    assert!(error.message.contains("file=broken.smi"));
    assert!(error.message.contains("record=2"));
    assert!(error.message.contains("line=2"));

    let stored = repository
        .list_substances()
        .expect("must list rows after parse failure");
    assert!(stored.is_empty());
}

#[test]
fn import_xyz_v1_imports_records_with_inference_summary() {
    let (_temp_dir, repository) = setup_repository("import-xyz-success.sqlite3");
    let request_id = "req-import-xyz-success";
    let input = ImportXyzV1Input {
        file_name: Some("bundle.xyz".to_string()),
        contents: Some(sample_valid_xyz()),
    };

    let result = import_xyz_v1_with_repository(&input, &repository, request_id)
        .expect("valid XYZ should import");

    assert_eq!(result.version, CONTRACT_VERSION_V1);
    assert_eq!(result.request_id, request_id);
    assert_eq!(result.imported_count, 2);
    assert_eq!(result.substances.len(), 2);
    assert_eq!(result.inference_summaries.len(), 2);
    assert_eq!(result.substances[0].source, "imported");
    assert_eq!(result.substances[1].source, "imported");
    assert_eq!(result.inference_summaries[0].record_index, 1);
    assert!(result.inference_summaries[0].inferred_bond_count > 0);
    assert!((0.0..=1.0).contains(&result.inference_summaries[0].avg_confidence));
    assert!((0.0..=1.0).contains(&result.inference_summaries[0].min_confidence));

    let stored = repository
        .list_substances()
        .expect("must list imported xyz rows");
    assert_eq!(stored.len(), 2);
    assert!(stored
        .iter()
        .all(|substance| substance.source_type == "imported"));
}

#[test]
fn import_xyz_v1_returns_contextual_parse_error() {
    let (_temp_dir, repository) = setup_repository("import-xyz-invalid.sqlite3");
    let request_id = "req-import-xyz-invalid";
    let input = ImportXyzV1Input {
        file_name: Some("broken.xyz".to_string()),
        contents: Some(sample_invalid_xyz()),
    };

    let error = import_xyz_v1_with_repository(&input, &repository, request_id)
        .expect_err("invalid XYZ should fail import");
    assert_eq!(error.category, ErrorCategory::Import);
    assert_eq!(error.code, "IMPORT_XYZ_ATOM_LINE_INVALID");
    assert!(error.message.contains("file=broken.xyz"));
    assert!(error.message.contains("record=1"));
    assert!(error.message.contains("line=3"));
}

#[test]
fn import_xyz_v1_rolls_back_batch_when_second_insert_fails() {
    let (_temp_dir, repository) = setup_repository("import-xyz-rollback.sqlite3");
    let request_id = "req-import-xyz-rollback";
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

    let input = ImportXyzV1Input {
        file_name: Some("bundle.xyz".to_string()),
        contents: Some(sample_valid_xyz()),
    };

    let error = import_xyz_v1_with_repository(&input, &repository, request_id)
        .expect_err("second insert should fail on primary key conflict");
    assert_eq!(error.category, ErrorCategory::Internal);
    assert_eq!(error.code, "IMPORT_FAILED");

    let stored = repository
        .list_substances()
        .expect("must list rows after failed import");
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].id, format!("imported-substance-{request_id}-2"));
}
