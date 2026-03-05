pub(crate) mod commands_imports;
pub(crate) mod commands_scenarios;
pub(crate) mod commands_substances;
pub(crate) mod commands_system;
pub(crate) mod contracts;
pub(crate) mod mappers;
pub(crate) mod validation;

pub(crate) use commands_system::greet_v1 as greet_v1_command;
pub(crate) use contracts::GreetV1Input;

#[macro_export]
macro_rules! ipc_v1_commands {
    ($callback:ident) => {
        $callback!(
            "greet_v1" => $crate::ipc_v1::commands_system::greet_v1,
            "health_v1" => $crate::ipc_v1::commands_system::health_v1,
            "get_feature_flags_v1" => $crate::ipc_v1::commands_system::get_feature_flags_v1,
            "list_presets_v1" => $crate::ipc_v1::commands_substances::list_presets_v1,
            "create_substance_v1" => $crate::ipc_v1::commands_substances::create_substance_v1,
            "update_substance_v1" => $crate::ipc_v1::commands_substances::update_substance_v1,
            "delete_substance_v1" => $crate::ipc_v1::commands_substances::delete_substance_v1,
            "save_scenario_draft_v1" => $crate::ipc_v1::commands_scenarios::save_scenario_draft_v1,
            "list_saved_scenarios_v1" => $crate::ipc_v1::commands_scenarios::list_saved_scenarios_v1,
            "load_scenario_draft_v1" => $crate::ipc_v1::commands_scenarios::load_scenario_draft_v1,
            "query_substances_v1" => $crate::ipc_v1::commands_substances::query_substances_v1,
            "import_sdf_mol_v1" => $crate::ipc_v1::commands_imports::import_sdf_mol_v1,
            "import_smiles_v1" => $crate::ipc_v1::commands_imports::import_smiles_v1,
            "import_xyz_v1" => $crate::ipc_v1::commands_imports::import_xyz_v1
        )
    };
}

macro_rules! ipc_v1_command_names {
    ($($name:literal => $handler:path),+ $(,)?) => {
        &[$($name),+]
    };
}

#[cfg(test)]
macro_rules! ipc_v1_command_count {
    ($($name:literal => $handler:path),+ $(,)?) => {
        0usize $(+ { let _ = $name; 1usize })+
    };
}

macro_rules! ipc_v1_handler_with_legacy_greet {
    ($($name:literal => $handler:path),+ $(,)?) => {
        tauri::generate_handler![$crate::greet, $($handler),+]
    };
}

#[cfg(test)]
macro_rules! ipc_v1_invoke_handler_command_names {
    ($($name:literal => $handler:path),+ $(,)?) => {
        &["greet", $($name),+]
    };
}

#[cfg(test)]
macro_rules! ipc_v1_invoke_handler_command_count {
    ($($name:literal => $handler:path),+ $(,)?) => {
        1usize $(+ { let _ = $name; 1usize })+
    };
}

pub(crate) const IPC_V1_COMMAND_NAMES: &[&str] = crate::ipc_v1_commands!(ipc_v1_command_names);

#[cfg(test)]
pub(crate) const IPC_V1_REGISTERED_HANDLER_COUNT: usize =
    crate::ipc_v1_commands!(ipc_v1_command_count);

#[cfg(test)]
pub(crate) const IPC_INVOKE_HANDLER_COMMAND_NAMES: &[&str] =
    crate::ipc_v1_commands!(ipc_v1_invoke_handler_command_names);

#[cfg(test)]
pub(crate) const IPC_INVOKE_HANDLER_REGISTERED_COUNT: usize =
    crate::ipc_v1_commands!(ipc_v1_invoke_handler_command_count);

pub(crate) fn invoke_handler<R: tauri::Runtime>(
) -> impl Fn(tauri::ipc::Invoke<R>) -> bool + Send + Sync + 'static {
    let _ = IPC_V1_COMMAND_NAMES;
    crate::ipc_v1_commands!(ipc_v1_handler_with_legacy_greet)
}

#[cfg(test)]
pub(crate) use contracts::*;
#[cfg(test)]
pub(crate) use validation::*;

#[cfg(test)]
pub(crate) use commands_imports::{
    import_sdf_mol_v1_with_repository, import_smiles_v1_with_repository,
    import_xyz_v1_with_repository,
};
#[cfg(test)]
pub(crate) use commands_scenarios::{
    list_saved_scenarios_v1_with_repository, load_scenario_draft_v1_with_repository,
    save_scenario_draft_v1_with_repository,
};
#[cfg(test)]
pub(crate) use commands_substances::{
    create_substance_v1_with_repository, delete_substance_v1_with_repository,
    list_presets_v1_with_repository, update_substance_v1_with_repository,
};
#[cfg(test)]
pub(crate) use mappers::{map_substance_to_catalog_item, map_template_to_preset_item};

pub const CONTRACT_VERSION_V1: &str = "v1";
const MAX_NAME_LENGTH: usize = 64;
const MAX_SUBSTANCE_SEARCH_LENGTH: usize = 128;
const MAX_SUBSTANCE_ID_LENGTH: usize = 128;
const MAX_SCENARIO_ID_LENGTH: usize = 128;
const MAX_SCENARIO_NAME_LENGTH: usize = 160;
const MAX_SUBSTANCE_NAME_LENGTH: usize = 128;
const MAX_SUBSTANCE_FORMULA_LENGTH: usize = 64;
const MAX_SUBSTANCE_SMILES_LENGTH: usize = 512;
const MAX_IMPORT_FILE_NAME_LENGTH: usize = 260;
const MAX_IMPORT_CONTENTS_LENGTH: usize = 8 * 1024 * 1024;
const SCENARIO_SNAPSHOT_T_SIM_S: f64 = 0.0;
const SCENARIO_SNAPSHOT_VERSION: i64 = 1;
const DEFAULT_SCENARIO_TEMPERATURE_K: f64 = 298.15;
const DEFAULT_SCENARIO_PRESSURE_PA: f64 = 101_325.0;
const DEFAULT_SCENARIO_GAS_MEDIUM: &str = "air";
const DEFAULT_SCENARIO_PRECISION_PROFILE: &str = "balanced";
const DEFAULT_SCENARIO_FPS_LIMIT: i64 = 60;
const DEFAULT_SCENARIO_PARTICLE_LIMIT: i64 = 10_000;
const CALCULATION_SUMMARY_ALLOWED_RESULT_TYPES: &[&str] = &[
    "stoichiometry",
    "limiting_reagent",
    "yield",
    "conversion",
    "concentration",
];

#[cfg(test)]
mod tests;
