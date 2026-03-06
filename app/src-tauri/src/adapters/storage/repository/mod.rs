use std::path::{Path, PathBuf};

use crate::storage::StorageError;

mod entities;
mod file_ops;
mod parsers;
mod presets;
mod scenarios;
mod seed;
mod sqlite_helpers;
mod substances;

pub use entities::{
    NewReactionTemplate, NewScenarioRun, NewSubstance, ReactionTemplate, ScenarioRun, SeedReport,
    Substance, UpdateReactionTemplate, UpdateScenarioRun, UpdateSubstance,
};

#[derive(Debug, Clone)]
pub struct StorageRepository {
    database_path: PathBuf,
}

impl StorageRepository {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }

    pub fn database_path(&self) -> &Path {
        &self.database_path
    }

    fn open(&self) -> Result<rusqlite::Connection, StorageError> {
        super::open_connection(&self.database_path)
    }

    fn sqlite_error(&self, context: &'static str, error: rusqlite::Error) -> StorageError {
        sqlite_helpers::sqlite_error(&self.database_path, context, error)
    }
}

#[cfg(test)]
mod tests;
