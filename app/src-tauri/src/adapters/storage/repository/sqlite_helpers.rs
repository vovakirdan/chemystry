use std::path::Path;

use rusqlite::Row;

use crate::storage::StorageError;

use super::{ReactionTemplate, ScenarioRun, Substance};

pub(super) fn sqlite_error(
    database_path: &Path,
    context: &'static str,
    error: rusqlite::Error,
) -> StorageError {
    StorageError::Sqlite {
        context,
        path: database_path.to_path_buf(),
        message: error.to_string(),
    }
}

pub(super) fn bool_to_sqlite_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

pub(super) fn row_to_substance(row: &Row<'_>) -> rusqlite::Result<Substance> {
    Ok(Substance {
        id: row.get(0)?,
        name: row.get(1)?,
        formula: row.get(2)?,
        smiles: row.get(3)?,
        molar_mass_g_mol: row.get(4)?,
        phase_default: row.get(5)?,
        source_type: row.get(6)?,
        created_at: row.get(7)?,
    })
}

pub(super) fn row_to_reaction_template(row: &Row<'_>) -> rusqlite::Result<ReactionTemplate> {
    Ok(ReactionTemplate {
        id: row.get(0)?,
        title: row.get(1)?,
        reaction_class: row.get(2)?,
        equation_balanced: row.get(3)?,
        description: row.get(4)?,
        is_preset: row.get::<usize, i64>(5)? == 1,
        version: row.get(6)?,
    })
}

pub(super) fn row_to_scenario_run(row: &Row<'_>) -> rusqlite::Result<ScenarioRun> {
    Ok(ScenarioRun {
        id: row.get(0)?,
        reaction_template_id: row.get(1)?,
        name: row.get(2)?,
        temperature_k: row.get(3)?,
        pressure_pa: row.get(4)?,
        gas_medium: row.get(5)?,
        precision_profile: row.get(6)?,
        fps_limit: row.get(7)?,
        particle_limit: row.get(8)?,
        created_at: row.get(9)?,
    })
}
