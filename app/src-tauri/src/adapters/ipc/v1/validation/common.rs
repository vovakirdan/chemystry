use crate::infra::errors::{CommandError, CommandResult};

use super::super::contracts::{CommandErrorV1, GreetV1Input};
use super::super::{CONTRACT_VERSION_V1, MAX_NAME_LENGTH};

pub(crate) fn validation_error(
    request_id: impl Into<String>,
    code: &'static str,
    message: impl Into<String>,
) -> CommandErrorV1 {
    CommandError::validation(CONTRACT_VERSION_V1, request_id, code, message)
}

pub fn validate_greet_v1_input(input: &GreetV1Input, request_id: &str) -> CommandResult<()> {
    let name = input.name.trim();

    if name.is_empty() {
        return Err(validation_error(
            request_id,
            "NAME_REQUIRED",
            "`name` must not be empty.",
        ));
    }

    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(validation_error(
            request_id,
            "NAME_TOO_LONG",
            format!("`name` must be at most {MAX_NAME_LENGTH} characters."),
        ));
    }

    Ok(())
}

pub(super) fn normalize_optional_filter(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| entry.to_lowercase())
}

pub(super) fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
}

pub(super) fn validate_required_text_field(
    value: Option<&str>,
    request_id: &str,
    field_name: &'static str,
    required_code: &'static str,
    too_long_code: &'static str,
    max_length: usize,
) -> CommandResult<String> {
    let Some(normalized) = normalize_optional_text(value) else {
        return Err(validation_error(
            request_id,
            required_code,
            format!("`{field_name}` is required."),
        ));
    };

    if normalized.chars().count() > max_length {
        return Err(validation_error(
            request_id,
            too_long_code,
            format!("`{field_name}` must be at most {max_length} characters."),
        ));
    }

    Ok(normalized)
}
