use std::collections::HashMap;

use serde_json::Value;

use crate::storage::StorageError;

use super::entities::{CalculationResultRecord, ScenarioAmountRecord};

const CALCULATION_RESULT_TYPE_ORDER: &[&str] = &[
    "stoichiometry",
    "limiting_reagent",
    "yield",
    "conversion",
    "concentration",
];

// Intent: scenario amount parsing tolerates sparse optional quantity fields
// but rejects malformed identifiers and non-positive numeric values before any transactional write occurs.
pub(super) fn parse_scenario_amount_records(
    amounts: &Value,
) -> Result<Vec<ScenarioAmountRecord>, StorageError> {
    let entries = amounts.as_array().ok_or_else(|| {
        StorageError::DataInvariant(
            "scenario amount payload must be a JSON array of amount records".to_string(),
        )
    })?;

    let mut records = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        let entry_object = entry.as_object().ok_or_else(|| {
            StorageError::DataInvariant(format!(
                "scenario amount entry at index {index} must be a JSON object"
            ))
        })?;
        let substance_id = parse_required_non_empty_string(entry_object, "substanceId", index)?;
        let amount_mol = parse_optional_positive_number(entry_object, "amountMol", index)?;
        let mass_g = parse_optional_positive_number(entry_object, "massG", index)?;
        let volume_l = parse_optional_positive_number(entry_object, "volumeL", index)?;
        let concentration_mol_l =
            parse_optional_positive_number(entry_object, "concentrationMolL", index)?;

        if amount_mol.is_none()
            && mass_g.is_none()
            && volume_l.is_none()
            && concentration_mol_l.is_none()
        {
            continue;
        }

        records.push(ScenarioAmountRecord {
            substance_id,
            amount_mol,
            mass_g,
            volume_l,
            concentration_mol_l,
        });
    }

    Ok(records)
}

// Intent: calculation summary parsing normalizes multiple result entries into
// a deterministic result_type order so persistence remains stable across repeated exports/imports.
pub(super) fn parse_calculation_result_records(
    calculation_summary: Option<&Value>,
) -> Result<Vec<CalculationResultRecord>, StorageError> {
    let Some(summary) = calculation_summary else {
        return Ok(Vec::new());
    };
    if summary.is_null() {
        return Ok(Vec::new());
    }

    let summary_object = summary.as_object().ok_or_else(|| {
        StorageError::DataInvariant("calculation summary payload must be a JSON object".to_string())
    })?;
    let summary_version =
        parse_required_positive_integer_field(summary_object, "version", "calculation summary")?;
    let entries = summary_object
        .get("entries")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            StorageError::DataInvariant(
                "calculation summary payload must contain `entries` array".to_string(),
            )
        })?;

    let generated_at = parse_optional_non_empty_string_field(summary_object, "generatedAt")?;
    let input_signature = parse_optional_non_empty_string_field(summary_object, "inputSignature")?;
    let scenario_metadata = parse_optional_object_field(summary_object, "scenarioMetadata")?;
    let mut payload_by_type: HashMap<String, Value> = HashMap::new();

    for (index, entry) in entries.iter().enumerate() {
        let entry_object = entry.as_object().ok_or_else(|| {
            StorageError::DataInvariant(format!(
                "calculation summary entry at index {index} must be a JSON object"
            ))
        })?;
        let result_type = parse_calculation_result_type(entry_object, index)?;
        let inputs = parse_required_object_entry_field(entry_object, "inputs", index)?;
        let outputs = parse_required_object_entry_field(entry_object, "outputs", index)?;
        let warnings = parse_string_array_entry_field(entry_object, "warnings", index)?;
        let entry_metadata = parse_optional_object_entry_field(entry_object, "metadata", index)?;

        let mut payload_object = serde_json::Map::new();
        payload_object.insert("version".to_string(), Value::from(summary_version));
        payload_object.insert("inputs".to_string(), Value::Object(inputs));
        payload_object.insert("outputs".to_string(), Value::Object(outputs));
        payload_object.insert(
            "warnings".to_string(),
            Value::Array(warnings.into_iter().map(Value::String).collect()),
        );

        let mut metadata = serde_json::Map::new();
        if let Some(generated_at) = generated_at.as_ref() {
            metadata.insert(
                "generatedAt".to_string(),
                Value::String(generated_at.clone()),
            );
        }
        if let Some(input_signature) = input_signature.as_ref() {
            metadata.insert(
                "inputSignature".to_string(),
                Value::String(input_signature.clone()),
            );
        }
        if let Some(scenario_metadata) = scenario_metadata.as_ref() {
            metadata.insert(
                "scenario".to_string(),
                Value::Object(scenario_metadata.clone()),
            );
        }
        if let Some(entry_metadata) = entry_metadata {
            metadata.insert("entry".to_string(), Value::Object(entry_metadata));
        }
        if !metadata.is_empty() {
            payload_object.insert("metadata".to_string(), Value::Object(metadata));
        }

        payload_by_type.insert(result_type, Value::Object(payload_object));
    }

    let mut records = Vec::new();
    for result_type in CALCULATION_RESULT_TYPE_ORDER {
        let Some(payload) = payload_by_type.get(*result_type) else {
            continue;
        };
        let payload_json = serde_json::to_string(payload).map_err(|error| {
            StorageError::DataInvariant(format!(
                "failed to encode calculation payload for result_type `{result_type}`: {error}"
            ))
        })?;
        records.push(CalculationResultRecord {
            result_type: (*result_type).to_string(),
            payload_json,
        });
    }

    Ok(records)
}

fn parse_calculation_result_type(
    object: &serde_json::Map<String, Value>,
    index: usize,
) -> Result<String, StorageError> {
    let result_type =
        parse_required_non_empty_string_from_object(object, "resultType").map_err(|message| {
            StorageError::DataInvariant(format!(
                "calculation summary entry at index {index} {message}"
            ))
        })?;

    if !CALCULATION_RESULT_TYPE_ORDER.contains(&result_type.as_str()) {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary entry at index {index} has unsupported `resultType` `{result_type}`"
        )));
    }

    Ok(result_type)
}

fn parse_required_positive_integer_field(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    context: &str,
) -> Result<i64, StorageError> {
    let Some(raw_value) = object.get(field_name) else {
        return Err(StorageError::DataInvariant(format!(
            "{context} is missing `{field_name}`"
        )));
    };

    let parsed = if let Some(number) = raw_value.as_i64() {
        number
    } else if let Some(number) = raw_value.as_u64() {
        i64::try_from(number).map_err(|_| {
            StorageError::DataInvariant(format!("{context} has `{field_name}` outside i64 range"))
        })?
    } else {
        return Err(StorageError::DataInvariant(format!(
            "{context} has non-integer `{field_name}`"
        )));
    };

    if parsed <= 0 {
        return Err(StorageError::DataInvariant(format!(
            "{context} has non-positive `{field_name}`"
        )));
    }

    Ok(parsed)
}

fn parse_optional_non_empty_string_field(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
) -> Result<Option<String>, StorageError> {
    let Some(raw_value) = object.get(field_name) else {
        return Ok(None);
    };
    if raw_value.is_null() {
        return Ok(None);
    }

    let Some(value) = raw_value.as_str() else {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary `{field_name}` must be a string when provided"
        )));
    };
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary `{field_name}` must not be empty"
        )));
    }

    Ok(Some(normalized.to_string()))
}

fn parse_optional_object_field(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
) -> Result<Option<serde_json::Map<String, Value>>, StorageError> {
    let Some(raw_value) = object.get(field_name) else {
        return Ok(None);
    };
    if raw_value.is_null() {
        return Ok(None);
    }
    let Some(value) = raw_value.as_object() else {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary `{field_name}` must be a JSON object when provided"
        )));
    };

    Ok(Some(value.clone()))
}

fn parse_required_object_entry_field(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    index: usize,
) -> Result<serde_json::Map<String, Value>, StorageError> {
    let Some(raw_value) = object.get(field_name) else {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary entry at index {index} is missing `{field_name}`"
        )));
    };
    let Some(value) = raw_value.as_object() else {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary entry at index {index} has non-object `{field_name}`"
        )));
    };

    Ok(value.clone())
}

fn parse_optional_object_entry_field(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    index: usize,
) -> Result<Option<serde_json::Map<String, Value>>, StorageError> {
    let Some(raw_value) = object.get(field_name) else {
        return Ok(None);
    };
    if raw_value.is_null() {
        return Ok(None);
    }
    let Some(value) = raw_value.as_object() else {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary entry at index {index} has non-object `{field_name}`"
        )));
    };

    Ok(Some(value.clone()))
}

fn parse_string_array_entry_field(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    index: usize,
) -> Result<Vec<String>, StorageError> {
    let Some(raw_value) = object.get(field_name) else {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary entry at index {index} is missing `{field_name}`"
        )));
    };
    let Some(values) = raw_value.as_array() else {
        return Err(StorageError::DataInvariant(format!(
            "calculation summary entry at index {index} has non-array `{field_name}`"
        )));
    };

    let mut warnings = Vec::new();
    for (warning_index, warning) in values.iter().enumerate() {
        let Some(warning_text) = warning.as_str() else {
            return Err(StorageError::DataInvariant(format!(
                "calculation summary entry at index {index} has non-string warning at index {warning_index}"
            )));
        };
        warnings.push(warning_text.to_string());
    }

    Ok(warnings)
}

fn parse_required_non_empty_string_from_object(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
) -> Result<String, String> {
    let Some(raw_value) = object.get(field_name) else {
        return Err(format!("is missing `{field_name}`"));
    };
    let Some(value) = raw_value.as_str() else {
        return Err(format!("has non-string `{field_name}`"));
    };
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("has empty `{field_name}`"));
    }
    Ok(value.to_string())
}

fn parse_required_non_empty_string(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    index: usize,
) -> Result<String, StorageError> {
    let value = object.get(field_name).ok_or_else(|| {
        StorageError::DataInvariant(format!(
            "scenario amount entry at index {index} is missing `{field_name}`"
        ))
    })?;
    let value = value.as_str().ok_or_else(|| {
        StorageError::DataInvariant(format!(
            "scenario amount entry at index {index} has non-string `{field_name}`"
        ))
    })?;
    let value = value.trim();
    if value.is_empty() {
        return Err(StorageError::DataInvariant(format!(
            "scenario amount entry at index {index} has empty `{field_name}`"
        )));
    }

    Ok(value.to_string())
}

fn parse_optional_positive_number(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    index: usize,
) -> Result<Option<f64>, StorageError> {
    let Some(raw_value) = object.get(field_name) else {
        return Ok(None);
    };
    if raw_value.is_null() {
        return Ok(None);
    }

    let parsed_value = if let Some(number) = raw_value.as_f64() {
        number
    } else if let Some(text) = raw_value.as_str() {
        let normalized = text.trim();
        if normalized.is_empty() {
            return Ok(None);
        }
        normalized.parse::<f64>().map_err(|_| {
            StorageError::DataInvariant(format!(
                "scenario amount entry at index {index} has non-numeric `{field_name}`"
            ))
        })?
    } else {
        return Err(StorageError::DataInvariant(format!(
            "scenario amount entry at index {index} has invalid `{field_name}` type"
        )));
    };

    if !parsed_value.is_finite() || parsed_value <= 0.0 {
        return Err(StorageError::DataInvariant(format!(
            "scenario amount entry at index {index} has non-positive `{field_name}`"
        )));
    }

    Ok(Some(parsed_value))
}

pub(super) fn scenario_amount_record_to_value(record: ScenarioAmountRecord) -> Value {
    let mut object = serde_json::Map::new();
    object.insert(
        "substanceId".to_string(),
        Value::String(record.substance_id),
    );
    if let Some(value) = record.amount_mol {
        object.insert("amountMol".to_string(), Value::from(value));
    }
    if let Some(value) = record.mass_g {
        object.insert("massG".to_string(), Value::from(value));
    }
    if let Some(value) = record.volume_l {
        object.insert("volumeL".to_string(), Value::from(value));
    }
    if let Some(value) = record.concentration_mol_l {
        object.insert("concentrationMolL".to_string(), Value::from(value));
    }

    Value::Object(object)
}
