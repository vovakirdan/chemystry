use super::*;

#[test]
fn parse_scenario_amount_records_rejects_non_array_payload() {
    let error = parse_scenario_amount_records(&json!({
        "substanceId": "substance-a",
        "amountMol": 1.0
    }))
    .expect_err("non-array payload must fail");

    match error {
        StorageError::DataInvariant(message) => {
            assert!(message.contains("JSON array of amount records"));
        }
        other => panic!("expected data invariant error, got {other:?}"),
    }
}

#[test]
fn parse_calculation_result_records_orders_supported_result_types() {
    let summary = json!({
        "version": 1,
        "entries": [
            {
                "resultType": "yield",
                "inputs": {},
                "outputs": { "percentYield": 95.0 },
                "warnings": []
            },
            {
                "resultType": "stoichiometry",
                "inputs": { "participants": [] },
                "outputs": { "reactionExtentMol": 1.0 },
                "warnings": []
            }
        ]
    });

    let records = parse_calculation_result_records(Some(&summary))
        .expect("supported result types must parse");
    let ordered_types = records
        .iter()
        .map(|record| record.result_type.as_str())
        .collect::<Vec<_>>();

    assert_eq!(ordered_types, vec!["stoichiometry", "yield"]);
}

#[test]
fn parse_calculation_result_records_rejects_unknown_result_type() {
    let summary = json!({
        "version": 1,
        "entries": [
            {
                "resultType": "unknown",
                "inputs": {},
                "outputs": {},
                "warnings": []
            }
        ]
    });

    let error = parse_calculation_result_records(Some(&summary))
        .expect_err("unknown result type must fail");

    match error {
        StorageError::DataInvariant(message) => {
            assert!(message.contains("unsupported `resultType` `unknown`"));
        }
        other => panic!("expected data invariant error, got {other:?}"),
    }
}
