use std::path::PathBuf;

use super::*;

#[test]
fn bool_to_sqlite_int_maps_booleans() {
    assert_eq!(bool_to_sqlite_int(false), 0);
    assert_eq!(bool_to_sqlite_int(true), 1);
}

#[test]
fn sqlite_error_preserves_context_path_and_message() {
    let database_path = PathBuf::from("/tmp/chemystry-test.sqlite3");
    let error = sqlite_error(
        &database_path,
        "failed to query sqlite row",
        rusqlite::Error::InvalidQuery,
    );

    match error {
        StorageError::Sqlite {
            context,
            path,
            message,
        } => {
            assert_eq!(context, "failed to query sqlite row");
            assert_eq!(path, database_path);
            assert!(!message.is_empty());
        }
        other => panic!("expected sqlite error, got {other:?}"),
    }
}
