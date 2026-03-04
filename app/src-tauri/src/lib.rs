#[path = "adapters/ipc/v1.rs"]
mod ipc_v1;

// Legacy command kept for demo compatibility while `greet_v1` is introduced.
#[tauri::command]
fn greet(name: &str) -> String {
    match ipc_v1::greet_v1(ipc_v1::GreetV1Input {
        name: name.to_string(),
    }) {
        Ok(output) => output.message,
        Err(error) => format!("[{}:{}] {}", error.category, error.code, error.message),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            ipc_v1::greet_v1,
            ipc_v1::health_v1
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
