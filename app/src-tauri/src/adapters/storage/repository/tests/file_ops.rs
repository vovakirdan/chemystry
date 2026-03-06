use super::*;

#[test]
fn backup_and_restore_round_trip_database_state() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("roundtrip.sqlite3");
    let backup_path = temp_dir
        .path()
        .join("backups")
        .join("roundtrip.backup.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path);
    repository
        .seed_baseline_data()
        .expect("seed should succeed before backup");

    repository
        .create_substance(&NewSubstance {
            id: "custom-substance-before-backup".to_string(),
            name: "Custom before backup".to_string(),
            formula: "X1".to_string(),
            smiles: None,
            molar_mass_g_mol: 12.0,
            phase_default: "solid".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create pre-backup substance");

    repository
        .backup_database(&backup_path)
        .expect("backup should succeed");

    repository
        .create_substance(&NewSubstance {
            id: "custom-substance-after-backup".to_string(),
            name: "Custom after backup".to_string(),
            formula: "X2".to_string(),
            smiles: None,
            molar_mass_g_mol: 24.0,
            phase_default: "solid".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create post-backup substance");

    repository
        .restore_database(&backup_path)
        .expect("restore should succeed");

    assert!(repository
        .get_substance("custom-substance-before-backup")
        .expect("lookup for pre-backup substance must succeed")
        .is_some());
    assert!(repository
        .get_substance("custom-substance-after-backup")
        .expect("lookup for post-backup substance must succeed")
        .is_none());
    assert!(repository
        .get_substance("builtin-substance-hydrogen")
        .expect("lookup for seeded hydrogen must succeed")
        .is_some());
}

#[test]
fn restore_rejects_invalid_backup_format() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("invalid-restore.sqlite3");
    let invalid_backup_path = temp_dir.path().join("invalid-backup.bin");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path);

    fs::write(&invalid_backup_path, b"not-a-sqlite-file").expect("must write invalid backup file");

    let error = repository
        .restore_database(&invalid_backup_path)
        .expect_err("restore should fail for invalid backup");

    match error {
        StorageError::InvalidBackupFormat { .. } => {}
        other => panic!("expected invalid backup error, got {other:?}"),
    }
}

#[test]
fn validate_sqlite_file_rejects_non_sqlite_header() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let invalid_backup_path = temp_dir.path().join("invalid-header.sqlite3");

    fs::write(&invalid_backup_path, b"not-a-sqlite-file").expect("must write invalid backup file");

    let error = validate_sqlite_file(&invalid_backup_path)
        .expect_err("validate_sqlite_file should fail for invalid header");

    match error {
        StorageError::InvalidBackupFormat { path, message } => {
            assert_eq!(path, invalid_backup_path);
            assert!(
                message.contains("expected SQLite header")
                    || message.contains("unable to read sqlite header")
            );
        }
        other => panic!("expected invalid backup error, got {other:?}"),
    }
}

#[test]
fn restore_replace_strategy_rolls_back_current_database_when_promote_fails() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("restore-atomic-target.sqlite3");
    let restore_temp_path = temp_dir
        .path()
        .join("restore-atomic-target.restore.tmp.sqlite3");

    fs::write(&database_path, "current-db-state").expect("must write current db fixture");
    fs::write(&restore_temp_path, "restored-db-state").expect("must write restore db fixture");

    let mut rename_call_index = 0_u8;
    let replace_result = replace_database_file_atomically_with(
        &database_path,
        &restore_temp_path,
        |source, target| {
            rename_call_index += 1;
            match rename_call_index {
                1 => Err(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "simulated first promote failure",
                )),
                2 => fs::rename(source, target),
                3 => Err(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    "simulated second promote failure",
                )),
                4 => fs::rename(source, target),
                _ => panic!("unexpected rename call order"),
            }
        },
    );

    assert!(
        replace_result.is_err(),
        "replace helper should surface promote error after rollback"
    );
    assert_eq!(rename_call_index, 4);

    let current_contents =
        fs::read_to_string(&database_path).expect("must keep current db after rollback");
    assert_eq!(current_contents, "current-db-state");
    assert!(
        restore_temp_path.exists(),
        "failed promote should keep restore temp for diagnostics"
    );
}

#[test]
fn async_backup_restore_wrappers_work() {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join("async.sqlite3");
    let backup_path = temp_dir.path().join("async.backup.sqlite3");

    run_migrations(&database_path).expect("migrations should succeed");
    let repository = StorageRepository::new(database_path);
    repository
        .seed_baseline_data()
        .expect("seed should succeed");

    tauri::async_runtime::block_on(async {
        repository
            .backup_database_async(backup_path.clone())
            .await
            .expect("async backup should succeed");
        repository
            .restore_database_async(backup_path)
            .await
            .expect("async restore should succeed");
    });
}
