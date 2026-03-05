use tauri::Manager;

pub mod infra {
    pub mod config;
    pub mod errors;
    pub mod logging;
}

#[path = "adapters/io/mod.rs"]
pub mod io;
#[path = "adapters/ipc/v1/mod.rs"]
mod ipc_v1;
#[path = "adapters/storage/mod.rs"]
pub mod storage;

// Legacy command kept for demo compatibility while `greet_v1` is introduced.
#[tauri::command]
fn greet(name: &str) -> String {
    match ipc_v1::greet_v1_command(ipc_v1::GreetV1Input {
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
        .invoke_handler(ipc_v1::invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
