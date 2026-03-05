use serde_json::{Map, Value};

use super::super::{
    DEFAULT_SCENARIO_FPS_LIMIT, DEFAULT_SCENARIO_GAS_MEDIUM, DEFAULT_SCENARIO_PARTICLE_LIMIT,
    DEFAULT_SCENARIO_PRECISION_PROFILE, DEFAULT_SCENARIO_PRESSURE_PA,
    DEFAULT_SCENARIO_TEMPERATURE_K,
};

#[derive(Debug, Clone, PartialEq)]
pub(super) struct ScenarioRunMetadata {
    pub(super) temperature_k: f64,
    pub(super) pressure_pa: f64,
    pub(super) gas_medium: String,
    pub(super) precision_profile: String,
    pub(super) fps_limit: i64,
    pub(super) particle_limit: i64,
}

fn parse_optional_number(value: Option<&Value>) -> Option<f64> {
    let value = value?;
    if let Some(number) = value.as_f64() {
        return Some(number);
    }

    value
        .as_str()
        .and_then(|text| text.trim().parse::<f64>().ok())
}

fn parse_optional_positive_integer(value: Option<&Value>) -> Option<i64> {
    let value = value?;
    if let Some(number) = value.as_i64() {
        return (number > 0).then_some(number);
    }

    if let Some(number) = value.as_u64() {
        if let Ok(number) = i64::try_from(number) {
            return (number > 0).then_some(number);
        }
    }

    if let Some(number) = value.as_f64() {
        // Intent: accept numeric JSON only when it is an exact positive integer value.
        if number.is_finite() && number > 0.0 {
            let rounded = number.round();
            if (rounded - number).abs() <= f64::EPSILON && rounded <= i64::MAX as f64 {
                return Some(rounded as i64);
            }
        }
    }

    value
        .as_str()
        .and_then(|text| text.trim().parse::<i64>().ok())
        .filter(|value| *value > 0)
}

fn normalize_precision_profile(value: Option<&Value>) -> String {
    let normalized = value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase());

    // Intent: keep compatibility with historical profile labels persisted by older UI builds.
    match normalized.as_deref() {
        Some("balanced") => "balanced".to_string(),
        Some("high_precision") | Some("high precision") => "high_precision".to_string(),
        Some("custom") => "custom".to_string(),
        _ => DEFAULT_SCENARIO_PRECISION_PROFILE.to_string(),
    }
}

pub(super) fn scenario_run_metadata_from_runtime(runtime: &Value) -> ScenarioRunMetadata {
    let runtime = runtime.as_object();
    let temperature_c = runtime
        .and_then(|object| parse_optional_number(object.get("temperatureC")))
        .filter(|value| value.is_finite() && *value > -273.15)
        .unwrap_or(DEFAULT_SCENARIO_TEMPERATURE_K - 273.15);
    let pressure_atm = runtime
        .and_then(|object| parse_optional_number(object.get("pressureAtm")))
        .filter(|value| value.is_finite() && *value > 0.0)
        .unwrap_or(DEFAULT_SCENARIO_PRESSURE_PA / 101_325.0);
    let gas_medium = runtime
        .and_then(|object| object.get("gasMedium"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| DEFAULT_SCENARIO_GAS_MEDIUM.to_string());
    let precision_profile = runtime
        .map(|object| normalize_precision_profile(object.get("precisionProfile")))
        .unwrap_or_else(|| DEFAULT_SCENARIO_PRECISION_PROFILE.to_string());
    let fps_limit = runtime
        .and_then(|object| parse_optional_positive_integer(object.get("fpsLimit")))
        .unwrap_or(DEFAULT_SCENARIO_FPS_LIMIT);
    let particle_limit = runtime
        .and_then(|object| parse_optional_positive_integer(object.get("particleLimit")))
        .or_else(|| {
            runtime
                .and_then(|object| parse_optional_positive_integer(object.get("calculationPasses")))
        })
        .unwrap_or(DEFAULT_SCENARIO_PARTICLE_LIMIT);

    ScenarioRunMetadata {
        temperature_k: temperature_c + 273.15,
        pressure_pa: pressure_atm * 101_325.0,
        gas_medium,
        precision_profile,
        fps_limit,
        particle_limit,
    }
}

fn parse_optional_positive_builder_number(value: Option<&Value>) -> Option<f64> {
    let parsed = parse_optional_number(value)?;
    if parsed.is_finite() && parsed > 0.0 {
        Some(parsed)
    } else {
        None
    }
}

pub(super) fn extract_scenario_amounts_from_builder(builder: &Value) -> Value {
    let mut amounts = Vec::new();
    let Some(builder_object) = builder.as_object() else {
        return Value::Array(amounts);
    };
    let Some(participants) = builder_object.get("participants").and_then(Value::as_array) else {
        return Value::Array(amounts);
    };

    for participant in participants {
        let Some(participant) = participant.as_object() else {
            continue;
        };
        let Some(substance_id) = participant
            .get("substanceId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
        else {
            continue;
        };

        let amount_mol = parse_optional_positive_builder_number(
            participant
                .get("amountMolInput")
                .or_else(|| participant.get("amountMol")),
        );
        let mass_g = parse_optional_positive_builder_number(
            participant
                .get("massGInput")
                .or_else(|| participant.get("massG")),
        );
        let volume_l = parse_optional_positive_builder_number(
            participant
                .get("volumeLInput")
                .or_else(|| participant.get("volumeL")),
        );
        let concentration_mol_l = parse_optional_positive_builder_number(
            participant
                .get("concentrationMolLInput")
                .or_else(|| participant.get("concentrationMolL")),
        );

        // Intent: persist only participants with at least one valid quantitative amount.
        if amount_mol.is_none()
            && mass_g.is_none()
            && volume_l.is_none()
            && concentration_mol_l.is_none()
        {
            continue;
        }

        let mut amount_object = Map::new();
        amount_object.insert("substanceId".to_string(), Value::String(substance_id));
        if let Some(value) = amount_mol {
            amount_object.insert("amountMol".to_string(), Value::from(value));
        }
        if let Some(value) = mass_g {
            amount_object.insert("massG".to_string(), Value::from(value));
        }
        if let Some(value) = volume_l {
            amount_object.insert("volumeL".to_string(), Value::from(value));
        }
        if let Some(value) = concentration_mol_l {
            amount_object.insert("concentrationMolL".to_string(), Value::from(value));
        }

        amounts.push(Value::Object(amount_object));
    }

    Value::Array(amounts)
}
