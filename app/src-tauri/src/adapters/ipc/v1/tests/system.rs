use super::*;
use crate::infra::config::feature_flags::FeatureFlags as ConfigFeatureFlags;
use crate::infra::errors::ErrorCategory;

#[test]
fn validate_greet_v1_input_accepts_valid_name() {
    let input = GreetV1Input {
        name: "Marie".to_string(),
    };

    assert_eq!(validate_greet_v1_input(&input, "req-test-1"), Ok(()));
}

#[test]
fn validate_greet_v1_input_rejects_empty_name() {
    let input = GreetV1Input {
        name: "   ".to_string(),
    };
    let request_id = "req-empty";

    assert_eq!(
        validate_greet_v1_input(&input, request_id),
        Err(CommandErrorV1 {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.to_string(),
            category: ErrorCategory::Validation,
            code: "NAME_REQUIRED",
            message: "`name` must not be empty.".to_string(),
        })
    );
}

#[test]
fn validate_greet_v1_input_rejects_too_long_name() {
    let input = GreetV1Input {
        name: "x".repeat(MAX_NAME_LENGTH + 1),
    };
    let request_id = "req-too-long";

    let error = validate_greet_v1_input(&input, request_id).expect_err("expected validation error");
    assert_eq!(error.version, CONTRACT_VERSION_V1);
    assert_eq!(error.request_id, request_id);
    assert_eq!(error.category, ErrorCategory::Validation);
    assert_eq!(error.code, "NAME_TOO_LONG");
    assert_eq!(
        error.message,
        format!("`name` must be at most {MAX_NAME_LENGTH} characters.")
    );
}

#[test]
fn maps_config_feature_flags_to_contract_payload() {
    let flags = FeatureFlagsV1::from(ConfigFeatureFlags {
        simulation: false,
        import_export: true,
        advanced_precision: false,
    });

    assert_eq!(
        flags,
        FeatureFlagsV1 {
            simulation: false,
            import_export: true,
            advanced_precision: false,
        }
    );
}

#[test]
fn v1_command_registry_is_complete_and_wired() {
    let expected = [
        "greet_v1",
        "health_v1",
        "get_feature_flags_v1",
        "list_presets_v1",
        "create_substance_v1",
        "update_substance_v1",
        "delete_substance_v1",
        "save_scenario_draft_v1",
        "list_saved_scenarios_v1",
        "load_scenario_draft_v1",
        "query_substances_v1",
        "import_sdf_mol_v1",
        "import_smiles_v1",
        "import_xyz_v1",
    ];

    assert_eq!(IPC_V1_COMMAND_NAMES, expected);
    assert_eq!(IPC_V1_REGISTERED_HANDLER_COUNT, IPC_V1_COMMAND_NAMES.len());
}

#[test]
fn invoke_handler_keeps_legacy_greet_plus_all_v1_commands() {
    assert_eq!(IPC_INVOKE_HANDLER_COMMAND_NAMES[0], "greet");
    assert_eq!(
        IPC_INVOKE_HANDLER_REGISTERED_COUNT,
        IPC_V1_REGISTERED_HANDLER_COUNT + 1
    );
    assert!(IPC_INVOKE_HANDLER_COMMAND_NAMES.contains(&"greet"));
    assert_eq!(
        IPC_INVOKE_HANDLER_COMMAND_NAMES.len(),
        IPC_INVOKE_HANDLER_REGISTERED_COUNT
    );
}
