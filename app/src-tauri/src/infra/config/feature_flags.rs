use std::env;

pub const FEATURE_SIMULATION_ENV: &str = "CHEMYSTRY_FEATURE_SIMULATION";
pub const FEATURE_IMPORT_EXPORT_ENV: &str = "CHEMYSTRY_FEATURE_IMPORT_EXPORT";
pub const FEATURE_ADVANCED_PRECISION_ENV: &str = "CHEMYSTRY_FEATURE_ADVANCED_PRECISION";

pub const DEFAULT_SIMULATION: bool = true;
pub const DEFAULT_IMPORT_EXPORT: bool = true;
pub const DEFAULT_ADVANCED_PRECISION: bool = true;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FeatureFlags {
    pub simulation: bool,
    pub import_export: bool,
    pub advanced_precision: bool,
}

impl Default for FeatureFlags {
    fn default() -> Self {
        Self {
            simulation: DEFAULT_SIMULATION,
            import_export: DEFAULT_IMPORT_EXPORT,
            advanced_precision: DEFAULT_ADVANCED_PRECISION,
        }
    }
}

impl FeatureFlags {
    pub fn from_env() -> Self {
        feature_flags_from_lookup(|key| env::var(key).ok())
    }
}

pub fn feature_flags_from_lookup<F>(mut lookup: F) -> FeatureFlags
where
    F: FnMut(&str) -> Option<String>,
{
    FeatureFlags {
        simulation: read_bool_flag(&mut lookup, FEATURE_SIMULATION_ENV, DEFAULT_SIMULATION),
        import_export: read_bool_flag(
            &mut lookup,
            FEATURE_IMPORT_EXPORT_ENV,
            DEFAULT_IMPORT_EXPORT,
        ),
        advanced_precision: read_bool_flag(
            &mut lookup,
            FEATURE_ADVANCED_PRECISION_ENV,
            DEFAULT_ADVANCED_PRECISION,
        ),
    }
}

fn read_bool_flag<F>(lookup: &mut F, key: &str, default: bool) -> bool
where
    F: FnMut(&str) -> Option<String>,
{
    lookup(key)
        .as_deref()
        .and_then(parse_bool_like_value)
        .unwrap_or(default)
}

fn parse_bool_like_value(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    #[test]
    fn uses_defaults_when_values_are_missing() {
        let flags = feature_flags_from_lookup(|_| None);

        assert_eq!(flags, FeatureFlags::default());
    }

    #[test]
    fn parses_truthy_and_falsy_values_case_insensitively() {
        let values = HashMap::from([
            (FEATURE_SIMULATION_ENV.to_string(), "YeS".to_string()),
            (FEATURE_IMPORT_EXPORT_ENV.to_string(), "0".to_string()),
            (
                FEATURE_ADVANCED_PRECISION_ENV.to_string(),
                "off".to_string(),
            ),
        ]);

        let flags = feature_flags_from_lookup(|key| values.get(key).cloned());

        assert_eq!(
            flags,
            FeatureFlags {
                simulation: true,
                import_export: false,
                advanced_precision: false,
            }
        );
    }

    #[test]
    fn falls_back_to_defaults_on_invalid_values() {
        let values = HashMap::from([
            (FEATURE_SIMULATION_ENV.to_string(), "enabled".to_string()),
            (FEATURE_IMPORT_EXPORT_ENV.to_string(), "".to_string()),
            (
                FEATURE_ADVANCED_PRECISION_ENV.to_string(),
                "definitely".to_string(),
            ),
        ]);

        let flags = feature_flags_from_lookup(|key| values.get(key).cloned());

        assert_eq!(flags, FeatureFlags::default());
    }
}
