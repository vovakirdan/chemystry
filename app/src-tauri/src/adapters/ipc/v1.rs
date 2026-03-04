use serde::{Deserialize, Serialize};

pub const CONTRACT_VERSION_V1: &str = "v1";
const MAX_NAME_LENGTH: usize = 64;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GreetV1Input {
    pub name: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GreetV1Output {
    pub version: &'static str,
    pub message: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthV1Output {
    pub version: &'static str,
    pub status: &'static str,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorV1 {
    pub version: &'static str,
    pub category: &'static str,
    pub code: &'static str,
    pub message: String,
}

fn validation_error(code: &'static str, message: impl Into<String>) -> CommandErrorV1 {
    CommandErrorV1 {
        version: CONTRACT_VERSION_V1,
        category: "validation",
        code,
        message: message.into(),
    }
}

pub fn validate_greet_v1_input(input: &GreetV1Input) -> Result<(), CommandErrorV1> {
    let name = input.name.trim();

    if name.is_empty() {
        return Err(validation_error(
            "NAME_REQUIRED",
            "`name` must not be empty.",
        ));
    }

    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(validation_error(
            "NAME_TOO_LONG",
            format!("`name` must be at most {MAX_NAME_LENGTH} characters."),
        ));
    }

    Ok(())
}

#[tauri::command]
pub fn greet_v1(input: GreetV1Input) -> Result<GreetV1Output, CommandErrorV1> {
    validate_greet_v1_input(&input)?;

    Ok(GreetV1Output {
        version: CONTRACT_VERSION_V1,
        message: format!(
            "Hello, {}! You've been greeted from Rust!",
            input.name.trim()
        ),
    })
}

#[tauri::command]
pub fn health_v1() -> HealthV1Output {
    HealthV1Output {
        version: CONTRACT_VERSION_V1,
        status: "ok",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_greet_v1_input_accepts_valid_name() {
        let input = GreetV1Input {
            name: "Marie".to_string(),
        };

        assert_eq!(validate_greet_v1_input(&input), Ok(()));
    }

    #[test]
    fn validate_greet_v1_input_rejects_empty_name() {
        let input = GreetV1Input {
            name: "   ".to_string(),
        };

        assert_eq!(
            validate_greet_v1_input(&input),
            Err(CommandErrorV1 {
                version: CONTRACT_VERSION_V1,
                category: "validation",
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

        let error = validate_greet_v1_input(&input).expect_err("expected validation error");
        assert_eq!(error.version, CONTRACT_VERSION_V1);
        assert_eq!(error.category, "validation");
        assert_eq!(error.code, "NAME_TOO_LONG");
        assert_eq!(
            error.message,
            format!("`name` must be at most {MAX_NAME_LENGTH} characters.")
        );
    }
}
