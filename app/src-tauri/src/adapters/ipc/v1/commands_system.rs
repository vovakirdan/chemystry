use crate::infra::config::feature_flags::FeatureFlags as ConfigFeatureFlags;
use crate::infra::errors::CommandResult;
use crate::infra::logging;

use super::contracts::{GetFeatureFlagsV1Output, GreetV1Input, GreetV1Output, HealthV1Output};
use super::validation::validate_greet_v1_input;
use super::CONTRACT_VERSION_V1;

const GREET_COMMAND_NAME: &str = "greet_v1";
const HEALTH_COMMAND_NAME: &str = "health_v1";
const GET_FEATURE_FLAGS_COMMAND_NAME: &str = "get_feature_flags_v1";

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

#[tauri::command]
pub fn get_feature_flags_v1() -> GetFeatureFlagsV1Output {
    let request_id = logging::next_request_id();
    logging::log_command_start(GET_FEATURE_FLAGS_COMMAND_NAME, &request_id);

    let output = GetFeatureFlagsV1Output {
        version: CONTRACT_VERSION_V1,
        request_id,
        feature_flags: ConfigFeatureFlags::from_env().into(),
    };

    logging::log_command_success(GET_FEATURE_FLAGS_COMMAND_NAME, &output.request_id);
    output
}
