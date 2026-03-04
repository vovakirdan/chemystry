use serde::{Deserialize, Serialize};

use crate::infra::errors::{CommandError, CommandResult};
use crate::infra::logging;

pub const CONTRACT_VERSION_V1: &str = "v1";
const MAX_NAME_LENGTH: usize = 64;
const GREET_COMMAND_NAME: &str = "greet_v1";
const HEALTH_COMMAND_NAME: &str = "health_v1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GreetV1Input {
    pub name: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GreetV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub message: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthV1Output {
    pub version: &'static str,
    pub request_id: String,
    pub status: &'static str,
}

pub type CommandErrorV1 = CommandError;

fn validation_error(
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

#[tauri::command]
pub fn greet_v1(input: GreetV1Input) -> CommandResult<GreetV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(GREET_COMMAND_NAME, &request_id);

    let result = validate_greet_v1_input(&input, &request_id).map(|_| GreetV1Output {
        version: CONTRACT_VERSION_V1,
        request_id: request_id.clone(),
        message: format!(
            "Hello, {}! You've been greeted from Rust!",
            input.name.trim()
        ),
    });

    match result {
        Ok(output) => {
            logging::log_command_success(GREET_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(GREET_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn health_v1() -> HealthV1Output {
    let request_id = logging::next_request_id();
    logging::log_command_start(HEALTH_COMMAND_NAME, &request_id);

    let output = HealthV1Output {
        version: CONTRACT_VERSION_V1,
        request_id,
        status: "ok",
    };

    logging::log_command_success(HEALTH_COMMAND_NAME, &output.request_id);
    output
}

#[cfg(test)]
mod tests {
    use super::*;
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

        let error =
            validate_greet_v1_input(&input, request_id).expect_err("expected validation error");
        assert_eq!(error.version, CONTRACT_VERSION_V1);
        assert_eq!(error.request_id, request_id);
        assert_eq!(error.category, ErrorCategory::Validation);
        assert_eq!(error.code, "NAME_TOO_LONG");
        assert_eq!(
            error.message,
            format!("`name` must be at most {MAX_NAME_LENGTH} characters.")
        );
    }
}
