use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ErrorCategory {
    Validation,
    Io,
    Simulation,
    Import,
    Internal,
}

impl ErrorCategory {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Validation => "validation",
            Self::Io => "io",
            Self::Simulation => "simulation",
            Self::Import => "import",
            Self::Internal => "internal",
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub version: &'static str,
    pub request_id: String,
    pub category: ErrorCategory,
    pub code: &'static str,
    pub message: String,
}

impl CommandError {
    pub fn new(
        version: &'static str,
        request_id: impl Into<String>,
        category: ErrorCategory,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self {
            version,
            request_id: request_id.into(),
            category,
            code,
            message: message.into(),
        }
    }

    pub fn validation(
        version: &'static str,
        request_id: impl Into<String>,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::new(
            version,
            request_id,
            ErrorCategory::Validation,
            code,
            message,
        )
    }

    pub fn io(
        version: &'static str,
        request_id: impl Into<String>,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::new(version, request_id, ErrorCategory::Io, code, message)
    }

    pub fn simulation(
        version: &'static str,
        request_id: impl Into<String>,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::new(
            version,
            request_id,
            ErrorCategory::Simulation,
            code,
            message,
        )
    }

    pub fn import(
        version: &'static str,
        request_id: impl Into<String>,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::new(version, request_id, ErrorCategory::Import, code, message)
    }

    pub fn internal(
        version: &'static str,
        request_id: impl Into<String>,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::new(version, request_id, ErrorCategory::Internal, code, message)
    }
}

pub type CommandResult<T> = Result<T, CommandError>;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn category_strings_are_stable() {
        assert_eq!(ErrorCategory::Validation.as_str(), "validation");
        assert_eq!(ErrorCategory::Io.as_str(), "io");
        assert_eq!(ErrorCategory::Simulation.as_str(), "simulation");
        assert_eq!(ErrorCategory::Import.as_str(), "import");
        assert_eq!(ErrorCategory::Internal.as_str(), "internal");
    }

    #[test]
    fn serializes_command_error_as_contract_payload() {
        let error = CommandError::simulation(
            "v1",
            "req-42",
            "SIMULATION_FAILED",
            "Simulation diverged at step 12.",
        );

        let serialized = serde_json::to_value(error).expect("must serialize");

        assert_eq!(
            serialized,
            json!({
                "version": "v1",
                "requestId": "req-42",
                "category": "simulation",
                "code": "SIMULATION_FAILED",
                "message": "Simulation diverged at step 12."
            })
        );
    }
}
