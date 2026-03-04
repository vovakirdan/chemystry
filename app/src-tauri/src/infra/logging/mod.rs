use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::infra::errors::CommandError;

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn next_request_id() -> String {
    let sequence = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    let unix_millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    format!("req-{unix_millis}-{sequence}")
}

pub fn log_command_start(command: &str, request_id: &str) {
    println!("[ipc] start command={command} request_id={request_id}");
}

pub fn log_command_success(command: &str, request_id: &str) {
    println!("[ipc] success command={command} request_id={request_id}");
}

pub fn log_command_failure(command: &str, error: &CommandError) {
    eprintln!(
        "[ipc] failure command={command} request_id={} category={} code={} message={}",
        error.request_id,
        error.category.as_str(),
        error.code,
        error.message
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_request_ids_are_non_empty_and_unique() {
        let first = next_request_id();
        let second = next_request_id();

        assert!(first.starts_with("req-"));
        assert!(second.starts_with("req-"));
        assert_ne!(first, second);
    }
}
