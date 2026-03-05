use tauri::Manager;

pub mod infra {
    pub mod config;
    pub mod errors;
    pub mod logging;
}

#[path = "adapters/io/mod.rs"]
pub mod io;
#[path = "adapters/ipc/v1.rs"]
mod ipc_v1;
#[path = "adapters/storage/mod.rs"]
pub mod storage;

// Legacy command kept for demo compatibility while `greet_v1` is introduced.
#[tauri::command]
fn greet(name: &str) -> String {
    match ipc_v1::greet_v1(ipc_v1::GreetV1Input {
        name: name.to_string(),
    }) {
        Ok(output) => output.message,
        Err(error) => format!(
            "[{}:{}] {} (request_id={})",
            error.category.as_str(),
            error.code,
            error.message,
            error.request_id
        ),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let database_path = storage::bootstrap_storage(app.handle())?;
            app.manage(storage::StorageRepository::new(database_path));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            ipc_v1::greet_v1,
            ipc_v1::health_v1,
            ipc_v1::get_feature_flags_v1,
            ipc_v1::list_presets_v1,
            ipc_v1::create_substance_v1,
            ipc_v1::update_substance_v1,
            ipc_v1::delete_substance_v1,
            ipc_v1::save_scenario_draft_v1,
            ipc_v1::list_saved_scenarios_v1,
            ipc_v1::load_scenario_draft_v1,
            ipc_v1::query_substances_v1,
            ipc_v1::import_sdf_mol_v1,
            ipc_v1::import_smiles_v1,
            ipc_v1::import_xyz_v1
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
