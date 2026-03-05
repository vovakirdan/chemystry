use super::super::*;
use crate::infra::errors::ErrorCategory;

#[test]
fn validate_create_substance_v1_input_rejects_missing_required_fields() {
    let request_id = "req-create-missing";

    assert_eq!(
        validate_create_substance_v1_input(&CreateSubstanceV1Input::default(), request_id),
        Err(CommandErrorV1 {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.to_string(),
            category: ErrorCategory::Validation,
            code: "SUBSTANCE_NAME_REQUIRED",
            message: "`name` is required.".to_string(),
        })
    );
}

#[test]
fn validate_create_substance_v1_input_rejects_invalid_phase() {
    let request_id = "req-create-phase";
    let input = CreateSubstanceV1Input {
        name: Some("Acetone".to_string()),
        formula: Some("C3H6O".to_string()),
        smiles: Some("CC(=O)C".to_string()),
        molar_mass_g_mol: Some(58.08),
        phase: Some("plasma".to_string()),
    };

    assert_eq!(
        validate_create_substance_v1_input(&input, request_id),
        Err(CommandErrorV1 {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.to_string(),
            category: ErrorCategory::Validation,
            code: "SUBSTANCE_PHASE_INVALID",
            message: "`phase` must be one of: solid, liquid, gas, aqueous.".to_string(),
        })
    );
}

#[test]
fn validate_update_substance_v1_input_rejects_missing_id() {
    let request_id = "req-update-missing-id";
    let input = UpdateSubstanceV1Input {
        id: Some("  ".to_string()),
        name: Some("Acetone".to_string()),
        formula: Some("C3H6O".to_string()),
        smiles: None,
        molar_mass_g_mol: Some(58.08),
        phase: Some("liquid".to_string()),
    };

    assert_eq!(
        validate_update_substance_v1_input(&input, request_id),
        Err(CommandErrorV1 {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.to_string(),
            category: ErrorCategory::Validation,
            code: "SUBSTANCE_ID_REQUIRED",
            message: "`id` is required.".to_string(),
        })
    );
}

#[test]
fn validate_update_substance_v1_input_rejects_invalid_molar_mass() {
    let request_id = "req-update-mass";
    let input = UpdateSubstanceV1Input {
        id: Some("substance-1".to_string()),
        name: Some("Acetone".to_string()),
        formula: Some("C3H6O".to_string()),
        smiles: None,
        molar_mass_g_mol: Some(0.0),
        phase: Some("liquid".to_string()),
    };

    assert_eq!(
        validate_update_substance_v1_input(&input, request_id),
        Err(CommandErrorV1 {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.to_string(),
            category: ErrorCategory::Validation,
            code: "SUBSTANCE_MOLAR_MASS_INVALID",
            message: "`molarMassGMol` must be a positive number.".to_string(),
        })
    );
}
