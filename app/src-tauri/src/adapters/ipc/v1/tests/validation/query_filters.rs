use super::super::*;
use crate::infra::errors::ErrorCategory;

#[test]
fn validate_query_substances_v1_input_normalizes_filters() {
    let input = QuerySubstancesV1Input {
        search: Some("  H2  ".to_string()),
        phase: Some(" Gas ".to_string()),
        source: Some(" user ".to_string()),
    };

    let filters = validate_query_substances_v1_input(&input, "req-query-valid")
        .expect("filters should be accepted");
    assert_eq!(filters.search.as_deref(), Some("H2"));
    assert_eq!(filters.phase_filter.as_deref(), Some("gas"));
    assert_eq!(filters.source_filter.as_deref(), Some("user_defined"));
}

#[test]
fn validate_query_substances_v1_input_rejects_too_long_search() {
    let input = QuerySubstancesV1Input {
        search: Some("x".repeat(MAX_SUBSTANCE_SEARCH_LENGTH + 1)),
        phase: None,
        source: None,
    };
    let request_id = "req-search-too-long";

    let error = validate_query_substances_v1_input(&input, request_id)
        .expect_err("expected validation error");
    assert_eq!(error.version, CONTRACT_VERSION_V1);
    assert_eq!(error.request_id, request_id);
    assert_eq!(error.category, ErrorCategory::Validation);
    assert_eq!(error.code, "SEARCH_QUERY_TOO_LONG");
    assert_eq!(
        error.message,
        format!("`search` must be at most {MAX_SUBSTANCE_SEARCH_LENGTH} characters.")
    );
}

#[test]
fn validate_query_substances_v1_input_rejects_invalid_phase_filter() {
    let input = QuerySubstancesV1Input {
        search: None,
        phase: Some("plasma".to_string()),
        source: None,
    };
    let request_id = "req-phase-invalid";

    assert_eq!(
        validate_query_substances_v1_input(&input, request_id),
        Err(CommandErrorV1 {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.to_string(),
            category: ErrorCategory::Validation,
            code: "PHASE_FILTER_INVALID",
            message: "`phase` must be one of: solid, liquid, gas, aqueous.".to_string(),
        })
    );
}

#[test]
fn validate_query_substances_v1_input_rejects_invalid_source_filter() {
    let input = QuerySubstancesV1Input {
        search: None,
        phase: None,
        source: Some("api".to_string()),
    };
    let request_id = "req-source-invalid";

    assert_eq!(
        validate_query_substances_v1_input(&input, request_id),
        Err(CommandErrorV1 {
            version: CONTRACT_VERSION_V1,
            request_id: request_id.to_string(),
            category: ErrorCategory::Validation,
            code: "SOURCE_FILTER_INVALID",
            message: "`source` must be one of: builtin, imported, user.".to_string(),
        })
    );
}
