use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use rusqlite::{params, OptionalExtension, Row, Transaction};

use super::{open_connection, run_migrations, StorageError};

const SQLITE_HEADER_MAGIC: &[u8; 16] = b"SQLite format 3\0";

#[derive(Debug, Clone, PartialEq)]
pub struct Substance {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase_default: String,
    pub source_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewSubstance {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase_default: String,
    pub source_type: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UpdateSubstance {
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase_default: String,
    pub source_type: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReactionTemplate {
    pub id: String,
    pub title: String,
    pub reaction_class: String,
    pub equation_balanced: String,
    pub description: String,
    pub is_preset: bool,
    pub version: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewReactionTemplate {
    pub id: String,
    pub title: String,
    pub reaction_class: String,
    pub equation_balanced: String,
    pub description: String,
    pub is_preset: bool,
    pub version: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UpdateReactionTemplate {
    pub title: String,
    pub reaction_class: String,
    pub equation_balanced: String,
    pub description: String,
    pub is_preset: bool,
    pub version: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ScenarioRun {
    pub id: String,
    pub reaction_template_id: Option<String>,
    pub name: String,
    pub temperature_k: f64,
    pub pressure_pa: f64,
    pub gas_medium: String,
    pub precision_profile: String,
    pub fps_limit: i64,
    pub particle_limit: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewScenarioRun {
    pub id: String,
    pub reaction_template_id: Option<String>,
    pub name: String,
    pub temperature_k: f64,
    pub pressure_pa: f64,
    pub gas_medium: String,
    pub precision_profile: String,
    pub fps_limit: i64,
    pub particle_limit: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UpdateScenarioRun {
    pub reaction_template_id: Option<String>,
    pub name: String,
    pub temperature_k: f64,
    pub pressure_pa: f64,
    pub gas_medium: String,
    pub precision_profile: String,
    pub fps_limit: i64,
    pub particle_limit: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeedReport {
    pub substances_processed: usize,
    pub reaction_templates_processed: usize,
    pub reaction_species_processed: usize,
}

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

    pub fn seed_baseline_data(&self) -> Result<SeedReport, StorageError> {
        let mut connection = self.open()?;
        let transaction = connection
            .transaction()
            .map_err(|error| self.sqlite_error("failed to begin seed transaction", error))?;

        let resolved_substance_ids = upsert_baseline_substances(&transaction, &self.database_path)?;
        let resolved_template_ids =
            upsert_baseline_reaction_templates(&transaction, &self.database_path)?;
        upsert_baseline_reaction_species(
            &transaction,
            &self.database_path,
            &resolved_template_ids,
            &resolved_substance_ids,
        )?;

        transaction
            .commit()
            .map_err(|error| self.sqlite_error("failed to commit seed transaction", error))?;

        Ok(SeedReport {
            substances_processed: BASELINE_SUBSTANCES.len(),
            reaction_templates_processed: BASELINE_REACTION_TEMPLATES.len(),
            reaction_species_processed: BASELINE_REACTION_SPECIES.len(),
        })
    }

    pub fn create_substance(&self, input: &NewSubstance) -> Result<Substance, StorageError> {
        let connection = self.open()?;
        connection
            .execute(
                "INSERT INTO substance(
                    id, name, formula, smiles, molar_mass_g_mol, phase_default, source_type
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    input.id,
                    input.name,
                    input.formula,
                    input.smiles,
                    input.molar_mass_g_mol,
                    input.phase_default,
                    input.source_type
                ],
            )
            .map_err(|error| self.sqlite_error("failed to insert substance", error))?;

        self.get_substance(&input.id)?.ok_or_else(|| {
            StorageError::DataInvariant(format!(
                "substance {} was not found after insert",
                input.id
            ))
        })
    }

    pub fn get_substance(&self, id: &str) -> Result<Option<Substance>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    name,
                    formula,
                    smiles,
                    molar_mass_g_mol,
                    phase_default,
                    source_type,
                    created_at
                FROM substance
                WHERE id = ?1",
            )
            .map_err(|error| self.sqlite_error("failed to prepare substance lookup", error))?;

        statement
            .query_row([id], row_to_substance)
            .optional()
            .map_err(|error| self.sqlite_error("failed to read substance", error))
    }

    pub fn list_substances(&self) -> Result<Vec<Substance>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    name,
                    formula,
                    smiles,
                    molar_mass_g_mol,
                    phase_default,
                    source_type,
                    created_at
                FROM substance
                ORDER BY name ASC, formula ASC",
            )
            .map_err(|error| self.sqlite_error("failed to prepare substance list query", error))?;

        let rows = statement
            .query_map([], row_to_substance)
            .map_err(|error| self.sqlite_error("failed to query substances", error))?;

        let mut substances = Vec::new();
        for row in rows {
            substances.push(
                row.map_err(|error| self.sqlite_error("failed to decode substance row", error))?,
            );
        }

        Ok(substances)
    }

    pub fn query_substances(
        &self,
        search: Option<&str>,
        phase_filter: Option<&str>,
        source_filter: Option<&str>,
    ) -> Result<Vec<Substance>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    name,
                    formula,
                    smiles,
                    molar_mass_g_mol,
                    phase_default,
                    source_type,
                    created_at
                FROM substance
                WHERE (
                    ?1 IS NULL
                    OR instr(lower(name), lower(?1)) > 0
                    OR instr(lower(formula), lower(?1)) > 0
                )
                AND (?2 IS NULL OR phase_default = ?2)
                AND (?3 IS NULL OR source_type = ?3)
                ORDER BY lower(name) ASC, lower(formula) ASC, id ASC",
            )
            .map_err(|error| self.sqlite_error("failed to prepare substance query", error))?;

        let rows = statement
            .query_map(
                params![search, phase_filter, source_filter],
                row_to_substance,
            )
            .map_err(|error| self.sqlite_error("failed to query substances", error))?;

        let mut substances = Vec::new();
        for row in rows {
            substances.push(
                row.map_err(|error| self.sqlite_error("failed to decode substance row", error))?,
            );
        }

        Ok(substances)
    }

    pub fn update_substance(
        &self,
        id: &str,
        input: &UpdateSubstance,
    ) -> Result<Option<Substance>, StorageError> {
        let connection = self.open()?;
        let affected_rows = connection
            .execute(
                "UPDATE substance
                SET name = ?1,
                    formula = ?2,
                    smiles = ?3,
                    molar_mass_g_mol = ?4,
                    phase_default = ?5,
                    source_type = ?6
                WHERE id = ?7",
                params![
                    input.name,
                    input.formula,
                    input.smiles,
                    input.molar_mass_g_mol,
                    input.phase_default,
                    input.source_type,
                    id
                ],
            )
            .map_err(|error| self.sqlite_error("failed to update substance", error))?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_substance(id)
    }

    pub fn delete_substance(&self, id: &str) -> Result<bool, StorageError> {
        let connection = self.open()?;
        let affected_rows = connection
            .execute("DELETE FROM substance WHERE id = ?1", [id])
            .map_err(|error| self.sqlite_error("failed to delete substance", error))?;

        Ok(affected_rows > 0)
    }

    pub fn count_substance_scenario_usage(&self, id: &str) -> Result<u64, StorageError> {
        let connection = self.open()?;
        let usage_count: i64 = connection
            .query_row(
                "SELECT COUNT(1) FROM scenario_amount WHERE substance_id = ?1",
                [id],
                |row| row.get(0),
            )
            .map_err(|error| self.sqlite_error("failed to count scenario_amount usage", error))?;

        Ok(usage_count.max(0) as u64)
    }

    pub fn create_reaction_template(
        &self,
        input: &NewReactionTemplate,
    ) -> Result<ReactionTemplate, StorageError> {
        let connection = self.open()?;
        connection
            .execute(
                "INSERT INTO reaction_template(
                    id, title, reaction_class, equation_balanced, description, is_preset, version
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    input.id,
                    input.title,
                    input.reaction_class,
                    input.equation_balanced,
                    input.description,
                    bool_to_sqlite_int(input.is_preset),
                    input.version
                ],
            )
            .map_err(|error| self.sqlite_error("failed to insert reaction template", error))?;

        self.get_reaction_template(&input.id)?.ok_or_else(|| {
            StorageError::DataInvariant(format!(
                "reaction template {} was not found after insert",
                input.id
            ))
        })
    }

    pub fn get_reaction_template(
        &self,
        id: &str,
    ) -> Result<Option<ReactionTemplate>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    title,
                    reaction_class,
                    equation_balanced,
                    description,
                    is_preset,
                    version
                FROM reaction_template
                WHERE id = ?1",
            )
            .map_err(|error| {
                self.sqlite_error("failed to prepare reaction template lookup", error)
            })?;

        statement
            .query_row([id], row_to_reaction_template)
            .optional()
            .map_err(|error| self.sqlite_error("failed to read reaction template", error))
    }

    pub fn list_reaction_templates(&self) -> Result<Vec<ReactionTemplate>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    title,
                    reaction_class,
                    equation_balanced,
                    description,
                    is_preset,
                    version
                FROM reaction_template
                ORDER BY title ASC, version ASC",
            )
            .map_err(|error| {
                self.sqlite_error("failed to prepare reaction template list query", error)
            })?;

        let rows = statement
            .query_map([], row_to_reaction_template)
            .map_err(|error| self.sqlite_error("failed to query reaction templates", error))?;

        let mut templates = Vec::new();
        for row in rows {
            templates.push(row.map_err(|error| {
                self.sqlite_error("failed to decode reaction template row", error)
            })?);
        }

        Ok(templates)
    }

    pub fn list_preset_reaction_templates(&self) -> Result<Vec<ReactionTemplate>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    title,
                    reaction_class,
                    equation_balanced,
                    description,
                    is_preset,
                    version
                FROM reaction_template
                WHERE is_preset = 1
                ORDER BY lower(title) ASC, version ASC, id ASC",
            )
            .map_err(|error| {
                self.sqlite_error(
                    "failed to prepare preset reaction template list query",
                    error,
                )
            })?;

        let rows = statement
            .query_map([], row_to_reaction_template)
            .map_err(|error| {
                self.sqlite_error("failed to query preset reaction templates", error)
            })?;

        let mut templates = Vec::new();
        for row in rows {
            templates.push(row.map_err(|error| {
                self.sqlite_error("failed to decode preset reaction template row", error)
            })?);
        }

        Ok(templates)
    }

    pub fn update_reaction_template(
        &self,
        id: &str,
        input: &UpdateReactionTemplate,
    ) -> Result<Option<ReactionTemplate>, StorageError> {
        let connection = self.open()?;
        let affected_rows = connection
            .execute(
                "UPDATE reaction_template
                SET title = ?1,
                    reaction_class = ?2,
                    equation_balanced = ?3,
                    description = ?4,
                    is_preset = ?5,
                    version = ?6
                WHERE id = ?7",
                params![
                    input.title,
                    input.reaction_class,
                    input.equation_balanced,
                    input.description,
                    bool_to_sqlite_int(input.is_preset),
                    input.version,
                    id
                ],
            )
            .map_err(|error| self.sqlite_error("failed to update reaction template", error))?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_reaction_template(id)
    }

    pub fn delete_reaction_template(&self, id: &str) -> Result<bool, StorageError> {
        let connection = self.open()?;
        let affected_rows = connection
            .execute("DELETE FROM reaction_template WHERE id = ?1", [id])
            .map_err(|error| self.sqlite_error("failed to delete reaction template", error))?;

        Ok(affected_rows > 0)
    }

    pub fn create_scenario_run(&self, input: &NewScenarioRun) -> Result<ScenarioRun, StorageError> {
        let connection = self.open()?;
        connection
            .execute(
                "INSERT INTO scenario_run(
                    id,
                    reaction_template_id,
                    name,
                    temperature_k,
                    pressure_pa,
                    gas_medium,
                    precision_profile,
                    fps_limit,
                    particle_limit
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    input.id,
                    input.reaction_template_id,
                    input.name,
                    input.temperature_k,
                    input.pressure_pa,
                    input.gas_medium,
                    input.precision_profile,
                    input.fps_limit,
                    input.particle_limit
                ],
            )
            .map_err(|error| self.sqlite_error("failed to insert scenario run", error))?;

        self.get_scenario_run(&input.id)?.ok_or_else(|| {
            StorageError::DataInvariant(format!(
                "scenario run {} was not found after insert",
                input.id
            ))
        })
    }

    pub fn get_scenario_run(&self, id: &str) -> Result<Option<ScenarioRun>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    reaction_template_id,
                    name,
                    temperature_k,
                    pressure_pa,
                    gas_medium,
                    precision_profile,
                    fps_limit,
                    particle_limit,
                    created_at
                FROM scenario_run
                WHERE id = ?1",
            )
            .map_err(|error| self.sqlite_error("failed to prepare scenario run lookup", error))?;

        statement
            .query_row([id], row_to_scenario_run)
            .optional()
            .map_err(|error| self.sqlite_error("failed to read scenario run", error))
    }

    pub fn list_scenario_runs(&self) -> Result<Vec<ScenarioRun>, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    id,
                    reaction_template_id,
                    name,
                    temperature_k,
                    pressure_pa,
                    gas_medium,
                    precision_profile,
                    fps_limit,
                    particle_limit,
                    created_at
                FROM scenario_run
                ORDER BY created_at DESC, id ASC",
            )
            .map_err(|error| {
                self.sqlite_error("failed to prepare scenario run list query", error)
            })?;

        let rows = statement
            .query_map([], row_to_scenario_run)
            .map_err(|error| self.sqlite_error("failed to query scenario runs", error))?;

        let mut scenarios = Vec::new();
        for row in rows {
            scenarios.push(
                row.map_err(|error| self.sqlite_error("failed to decode scenario run row", error))?,
            );
        }

        Ok(scenarios)
    }

    pub fn update_scenario_run(
        &self,
        id: &str,
        input: &UpdateScenarioRun,
    ) -> Result<Option<ScenarioRun>, StorageError> {
        let connection = self.open()?;
        let affected_rows = connection
            .execute(
                "UPDATE scenario_run
                SET reaction_template_id = ?1,
                    name = ?2,
                    temperature_k = ?3,
                    pressure_pa = ?4,
                    gas_medium = ?5,
                    precision_profile = ?6,
                    fps_limit = ?7,
                    particle_limit = ?8
                WHERE id = ?9",
                params![
                    input.reaction_template_id,
                    input.name,
                    input.temperature_k,
                    input.pressure_pa,
                    input.gas_medium,
                    input.precision_profile,
                    input.fps_limit,
                    input.particle_limit,
                    id
                ],
            )
            .map_err(|error| self.sqlite_error("failed to update scenario run", error))?;

        if affected_rows == 0 {
            return Ok(None);
        }

        self.get_scenario_run(id)
    }

    pub fn delete_scenario_run(&self, id: &str) -> Result<bool, StorageError> {
        let connection = self.open()?;
        let affected_rows = connection
            .execute("DELETE FROM scenario_run WHERE id = ?1", [id])
            .map_err(|error| self.sqlite_error("failed to delete scenario run", error))?;

        Ok(affected_rows > 0)
    }

    pub fn backup_database(&self, backup_path: &Path) -> Result<(), StorageError> {
        ensure_parent_directory(backup_path, "failed to create backup directory")?;
        validate_sqlite_file(&self.database_path)?;
        let connection = self.open()?;
        connection
            .execute_batch("PRAGMA wal_checkpoint(FULL);")
            .map_err(|error| {
                self.sqlite_error("failed to checkpoint sqlite database before backup", error)
            })?;
        drop(connection);

        fs::copy(&self.database_path, backup_path).map_err(|error| StorageError::Io {
            context: "failed to write database backup",
            path: backup_path.to_path_buf(),
            message: error.to_string(),
        })?;

        validate_sqlite_file(backup_path)
    }

    pub async fn backup_database_async(&self, backup_path: PathBuf) -> Result<(), StorageError> {
        let repository = self.clone();
        tauri::async_runtime::spawn_blocking(move || repository.backup_database(&backup_path))
            .await
            .map_err(|error| StorageError::AsyncTaskJoin(error.to_string()))?
    }

    pub fn restore_database(&self, backup_path: &Path) -> Result<(), StorageError> {
        validate_sqlite_file(backup_path)?;

        let database_parent = self
            .database_path
            .parent()
            .ok_or_else(|| StorageError::InvalidDatabasePath(self.database_path.clone()))?;
        fs::create_dir_all(database_parent).map_err(|error| StorageError::Io {
            context: "failed to create database directory for restore",
            path: database_parent.to_path_buf(),
            message: error.to_string(),
        })?;

        let restore_temp_path = self.database_path.with_extension("restore.tmp.sqlite3");
        fs::copy(backup_path, &restore_temp_path).map_err(|error| StorageError::Io {
            context: "failed to copy backup for restore",
            path: restore_temp_path.clone(),
            message: error.to_string(),
        })?;

        if let Err(validation_error) = validate_sqlite_file(&restore_temp_path) {
            let _ = fs::remove_file(&restore_temp_path);
            return Err(validation_error);
        }

        replace_database_file_atomically(&self.database_path, &restore_temp_path)?;

        run_migrations(&self.database_path)?;
        self.seed_baseline_data()?;
        Ok(())
    }

    pub async fn restore_database_async(&self, backup_path: PathBuf) -> Result<(), StorageError> {
        let repository = self.clone();
        tauri::async_runtime::spawn_blocking(move || repository.restore_database(&backup_path))
            .await
            .map_err(|error| StorageError::AsyncTaskJoin(error.to_string()))?
    }

    fn open(&self) -> Result<rusqlite::Connection, StorageError> {
        open_connection(&self.database_path)
    }

    fn sqlite_error(&self, context: &'static str, error: rusqlite::Error) -> StorageError {
        sqlite_error(&self.database_path, context, error)
    }
}

#[derive(Debug, Clone, Copy)]
struct BaselineSubstanceSeed {
    id: &'static str,
    name: &'static str,
    formula: &'static str,
    smiles: Option<&'static str>,
    molar_mass_g_mol: f64,
    phase_default: &'static str,
    source_type: &'static str,
}

#[derive(Debug, Clone, Copy)]
struct BaselineReactionTemplateSeed {
    id: &'static str,
    title: &'static str,
    reaction_class: &'static str,
    equation_balanced: &'static str,
    description: &'static str,
    is_preset: bool,
    version: i64,
}

#[derive(Debug, Clone, Copy)]
struct BaselineReactionSpeciesSeed {
    id: &'static str,
    reaction_template_id: &'static str,
    substance_id: &'static str,
    role: &'static str,
    stoich_coeff: f64,
}

const BASELINE_SUBSTANCES: &[BaselineSubstanceSeed] = &[
    BaselineSubstanceSeed {
        id: "builtin-substance-hydrogen",
        name: "Hydrogen",
        formula: "H2",
        smiles: None,
        molar_mass_g_mol: 2.01588,
        phase_default: "gas",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-oxygen",
        name: "Oxygen",
        formula: "O2",
        smiles: None,
        molar_mass_g_mol: 31.9988,
        phase_default: "gas",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-water",
        name: "Water",
        formula: "H2O",
        smiles: Some("O"),
        molar_mass_g_mol: 18.01528,
        phase_default: "liquid",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-hydrochloric-acid",
        name: "Hydrochloric acid",
        formula: "HCl",
        smiles: Some("Cl"),
        molar_mass_g_mol: 36.46094,
        phase_default: "aqueous",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-sodium-hydroxide",
        name: "Sodium hydroxide",
        formula: "NaOH",
        smiles: Some("[Na+].[OH-]"),
        molar_mass_g_mol: 39.99711,
        phase_default: "aqueous",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-sodium-chloride",
        name: "Sodium chloride",
        formula: "NaCl",
        smiles: Some("[Na+].[Cl-]"),
        molar_mass_g_mol: 58.44277,
        phase_default: "aqueous",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-magnesium",
        name: "Magnesium",
        formula: "Mg",
        smiles: None,
        molar_mass_g_mol: 24.305,
        phase_default: "solid",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-magnesium-oxide",
        name: "Magnesium oxide",
        formula: "MgO",
        smiles: None,
        molar_mass_g_mol: 40.3044,
        phase_default: "solid",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-ethene",
        name: "Ethene",
        formula: "C2H4",
        smiles: Some("C=C"),
        molar_mass_g_mol: 28.05316,
        phase_default: "gas",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-ethanol",
        name: "Ethanol",
        formula: "C2H6O",
        smiles: Some("CCO"),
        molar_mass_g_mol: 46.06844,
        phase_default: "liquid",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-nitrogen",
        name: "Nitrogen",
        formula: "N2",
        smiles: None,
        molar_mass_g_mol: 28.0134,
        phase_default: "gas",
        source_type: "builtin",
    },
    BaselineSubstanceSeed {
        id: "builtin-substance-ammonia",
        name: "Ammonia",
        formula: "NH3",
        smiles: Some("N"),
        molar_mass_g_mol: 17.03052,
        phase_default: "gas",
        source_type: "builtin",
    },
];

const BASELINE_REACTION_TEMPLATES: &[BaselineReactionTemplateSeed] = &[
    BaselineReactionTemplateSeed {
        id: "builtin-preset-hydrogen-combustion-v1",
        title: "Hydrogen combustion",
        reaction_class: "redox",
        equation_balanced: "2H2 + O2 -> 2H2O",
        description: "Educational note: Hydrogen combustion demonstrates a classic exothermic redox process where oxygen is reduced and hydrogen is oxidized.",
        is_preset: true,
        version: 1,
    },
    BaselineReactionTemplateSeed {
        id: "builtin-preset-acid-base-neutralization-v1",
        title: "Strong acid/base neutralization",
        reaction_class: "acid_base",
        equation_balanced: "HCl + NaOH -> NaCl + H2O",
        description: "Educational note: Strong acid/base neutralization highlights proton transfer and the formation of water with a salt in aqueous solution.",
        is_preset: true,
        version: 1,
    },
    BaselineReactionTemplateSeed {
        id: "builtin-preset-magnesium-oxidation-v1",
        title: "Magnesium oxidation",
        reaction_class: "inorganic",
        equation_balanced: "2Mg + O2 -> 2MgO",
        description: "Educational note: Magnesium oxidation illustrates inorganic synthesis and stoichiometric balancing in metal-oxygen reactions.",
        is_preset: true,
        version: 1,
    },
    BaselineReactionTemplateSeed {
        id: "builtin-preset-ethene-hydration-v1",
        title: "Ethene hydration",
        reaction_class: "organic_basic",
        equation_balanced: "C2H4 + H2O -> C2H5OH",
        description: "Educational note: Ethene hydration introduces a foundational organic addition reaction used to form alcohols from alkenes.",
        is_preset: true,
        version: 1,
    },
    BaselineReactionTemplateSeed {
        id: "builtin-preset-haber-process-v1",
        title: "Haber process equilibrium",
        reaction_class: "equilibrium",
        equation_balanced: "N2 + 3H2 <-> 2NH3",
        description: "Educational note: The Haber process demonstrates reversible reactions and how equilibrium position responds to reaction conditions.",
        is_preset: true,
        version: 1,
    },
];

const BASELINE_REACTION_SPECIES: &[BaselineReactionSpeciesSeed] = &[
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-hydrogen-combustion-v1-reactant-h2",
        reaction_template_id: "builtin-preset-hydrogen-combustion-v1",
        substance_id: "builtin-substance-hydrogen",
        role: "reactant",
        stoich_coeff: 2.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-hydrogen-combustion-v1-reactant-o2",
        reaction_template_id: "builtin-preset-hydrogen-combustion-v1",
        substance_id: "builtin-substance-oxygen",
        role: "reactant",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-hydrogen-combustion-v1-product-h2o",
        reaction_template_id: "builtin-preset-hydrogen-combustion-v1",
        substance_id: "builtin-substance-water",
        role: "product",
        stoich_coeff: 2.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-acid-base-neutralization-v1-reactant-hcl",
        reaction_template_id: "builtin-preset-acid-base-neutralization-v1",
        substance_id: "builtin-substance-hydrochloric-acid",
        role: "reactant",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-acid-base-neutralization-v1-reactant-naoh",
        reaction_template_id: "builtin-preset-acid-base-neutralization-v1",
        substance_id: "builtin-substance-sodium-hydroxide",
        role: "reactant",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-acid-base-neutralization-v1-product-nacl",
        reaction_template_id: "builtin-preset-acid-base-neutralization-v1",
        substance_id: "builtin-substance-sodium-chloride",
        role: "product",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-acid-base-neutralization-v1-product-h2o",
        reaction_template_id: "builtin-preset-acid-base-neutralization-v1",
        substance_id: "builtin-substance-water",
        role: "product",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-magnesium-oxidation-v1-reactant-mg",
        reaction_template_id: "builtin-preset-magnesium-oxidation-v1",
        substance_id: "builtin-substance-magnesium",
        role: "reactant",
        stoich_coeff: 2.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-magnesium-oxidation-v1-reactant-o2",
        reaction_template_id: "builtin-preset-magnesium-oxidation-v1",
        substance_id: "builtin-substance-oxygen",
        role: "reactant",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-magnesium-oxidation-v1-product-mgo",
        reaction_template_id: "builtin-preset-magnesium-oxidation-v1",
        substance_id: "builtin-substance-magnesium-oxide",
        role: "product",
        stoich_coeff: 2.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-ethene-hydration-v1-reactant-c2h4",
        reaction_template_id: "builtin-preset-ethene-hydration-v1",
        substance_id: "builtin-substance-ethene",
        role: "reactant",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-ethene-hydration-v1-reactant-h2o",
        reaction_template_id: "builtin-preset-ethene-hydration-v1",
        substance_id: "builtin-substance-water",
        role: "reactant",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-ethene-hydration-v1-product-c2h5oh",
        reaction_template_id: "builtin-preset-ethene-hydration-v1",
        substance_id: "builtin-substance-ethanol",
        role: "product",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-haber-process-v1-reactant-n2",
        reaction_template_id: "builtin-preset-haber-process-v1",
        substance_id: "builtin-substance-nitrogen",
        role: "reactant",
        stoich_coeff: 1.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-haber-process-v1-reactant-h2",
        reaction_template_id: "builtin-preset-haber-process-v1",
        substance_id: "builtin-substance-hydrogen",
        role: "reactant",
        stoich_coeff: 3.0,
    },
    BaselineReactionSpeciesSeed {
        id: "builtin-preset-haber-process-v1-product-nh3",
        reaction_template_id: "builtin-preset-haber-process-v1",
        substance_id: "builtin-substance-ammonia",
        role: "product",
        stoich_coeff: 2.0,
    },
];

fn upsert_baseline_substances(
    transaction: &Transaction<'_>,
    database_path: &Path,
) -> Result<HashMap<&'static str, String>, StorageError> {
    let mut resolved_ids = HashMap::with_capacity(BASELINE_SUBSTANCES.len());

    for substance in BASELINE_SUBSTANCES {
        let natural_key_row = transaction
            .query_row(
                "SELECT id, source_type
                FROM substance
                WHERE name = ?1 AND formula = ?2
                LIMIT 1",
                params![substance.name, substance.formula],
                |row| Ok((row.get::<usize, String>(0)?, row.get::<usize, String>(1)?)),
            )
            .optional()
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to lookup baseline substance by natural key",
                    error,
                )
            })?;

        let id_key_id = transaction
            .query_row(
                "SELECT id FROM substance WHERE id = ?1 LIMIT 1",
                [substance.id],
                |row| row.get::<usize, String>(0),
            )
            .optional()
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to lookup baseline substance by id",
                    error,
                )
            })?;

        let target_id = if let Some((existing_id, _)) = natural_key_row.as_ref() {
            existing_id.clone()
        } else if let Some(existing_id) = id_key_id {
            existing_id
        } else {
            transaction
                .execute(
                    "INSERT INTO substance(
                        id,
                        name,
                        formula,
                        smiles,
                        molar_mass_g_mol,
                        phase_default,
                        source_type
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        substance.id,
                        substance.name,
                        substance.formula,
                        substance.smiles,
                        substance.molar_mass_g_mol,
                        substance.phase_default,
                        substance.source_type
                    ],
                )
                .map_err(|error| {
                    sqlite_error(database_path, "failed to insert baseline substance", error)
                })?;
            substance.id.to_string()
        };

        let preserve_existing_non_builtin = matches!(
            natural_key_row.as_ref(),
            Some((_, source_type)) if source_type != "builtin"
        );
        if !preserve_existing_non_builtin {
            transaction
                .execute(
                    "UPDATE substance
                    SET name = ?1,
                        formula = ?2,
                        smiles = ?3,
                        molar_mass_g_mol = ?4,
                        phase_default = ?5,
                        source_type = ?6
                    WHERE id = ?7",
                    params![
                        substance.name,
                        substance.formula,
                        substance.smiles,
                        substance.molar_mass_g_mol,
                        substance.phase_default,
                        substance.source_type,
                        target_id.as_str()
                    ],
                )
                .map_err(|error| {
                    sqlite_error(
                        database_path,
                        "failed to reconcile baseline substance",
                        error,
                    )
                })?;
        }

        resolved_ids.insert(substance.id, target_id);
    }

    Ok(resolved_ids)
}

fn upsert_baseline_reaction_templates(
    transaction: &Transaction<'_>,
    database_path: &Path,
) -> Result<HashMap<&'static str, String>, StorageError> {
    let mut resolved_ids = HashMap::with_capacity(BASELINE_REACTION_TEMPLATES.len());

    for template in BASELINE_REACTION_TEMPLATES {
        let natural_key_id = transaction
            .query_row(
                "SELECT id FROM reaction_template WHERE title = ?1 AND version = ?2 LIMIT 1",
                params![template.title, template.version],
                |row| row.get::<usize, String>(0),
            )
            .optional()
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to lookup baseline reaction template by natural key",
                    error,
                )
            })?;

        let id_key_id = transaction
            .query_row(
                "SELECT id FROM reaction_template WHERE id = ?1 LIMIT 1",
                [template.id],
                |row| row.get::<usize, String>(0),
            )
            .optional()
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to lookup baseline reaction template by id",
                    error,
                )
            })?;

        let target_id = if let Some(existing_id) = natural_key_id {
            existing_id
        } else if let Some(existing_id) = id_key_id {
            existing_id
        } else {
            transaction
                .execute(
                    "INSERT INTO reaction_template(
                        id,
                        title,
                        reaction_class,
                        equation_balanced,
                        description,
                        is_preset,
                        version
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        template.id,
                        template.title,
                        template.reaction_class,
                        template.equation_balanced,
                        template.description,
                        bool_to_sqlite_int(template.is_preset),
                        template.version
                    ],
                )
                .map_err(|error| {
                    sqlite_error(
                        database_path,
                        "failed to insert baseline reaction template",
                        error,
                    )
                })?;
            template.id.to_string()
        };

        transaction
            .execute(
                "UPDATE reaction_template
                SET title = ?1,
                    reaction_class = ?2,
                    equation_balanced = ?3,
                    description = ?4,
                    is_preset = ?5,
                    version = ?6
                WHERE id = ?7",
                params![
                    template.title,
                    template.reaction_class,
                    template.equation_balanced,
                    template.description,
                    bool_to_sqlite_int(template.is_preset),
                    template.version,
                    target_id.as_str()
                ],
            )
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to reconcile baseline reaction template",
                    error,
                )
            })?;

        resolved_ids.insert(template.id, target_id);
    }

    Ok(resolved_ids)
}

fn upsert_baseline_reaction_species(
    transaction: &Transaction<'_>,
    database_path: &Path,
    resolved_template_ids: &HashMap<&'static str, String>,
    resolved_substance_ids: &HashMap<&'static str, String>,
) -> Result<(), StorageError> {
    for species in BASELINE_REACTION_SPECIES {
        let reaction_template_id = resolved_template_ids
            .get(species.reaction_template_id)
            .ok_or_else(|| {
                StorageError::DataInvariant(format!(
                    "seed template mapping is missing for {}",
                    species.reaction_template_id
                ))
            })?;
        let substance_id = resolved_substance_ids
            .get(species.substance_id)
            .ok_or_else(|| {
                StorageError::DataInvariant(format!(
                    "seed substance mapping is missing for {}",
                    species.substance_id
                ))
            })?;

        let natural_key_id = transaction
            .query_row(
                "SELECT id FROM reaction_species
                WHERE reaction_template_id = ?1 AND substance_id = ?2 AND role = ?3
                LIMIT 1",
                params![reaction_template_id, substance_id, species.role],
                |row| row.get::<usize, String>(0),
            )
            .optional()
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to lookup baseline reaction species by natural key",
                    error,
                )
            })?;

        let id_key_id = transaction
            .query_row(
                "SELECT id FROM reaction_species WHERE id = ?1 LIMIT 1",
                [species.id],
                |row| row.get::<usize, String>(0),
            )
            .optional()
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to lookup baseline reaction species by id",
                    error,
                )
            })?;

        let target_id = if let Some(existing_id) = natural_key_id {
            existing_id
        } else if let Some(existing_id) = id_key_id.clone() {
            existing_id
        } else {
            transaction
                .execute(
                    "INSERT INTO reaction_species(
                        id,
                        reaction_template_id,
                        substance_id,
                        role,
                        stoich_coeff
                    ) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        species.id,
                        reaction_template_id,
                        substance_id,
                        species.role,
                        species.stoich_coeff
                    ],
                )
                .map_err(|error| {
                    sqlite_error(
                        database_path,
                        "failed to insert baseline reaction species",
                        error,
                    )
                })?;
            species.id.to_string()
        };

        transaction
            .execute(
                "UPDATE reaction_species
                SET reaction_template_id = ?1,
                    substance_id = ?2,
                    role = ?3,
                    stoich_coeff = ?4
                WHERE id = ?5",
                params![
                    reaction_template_id,
                    substance_id,
                    species.role,
                    species.stoich_coeff,
                    target_id.as_str()
                ],
            )
            .map_err(|error| {
                sqlite_error(
                    database_path,
                    "failed to reconcile baseline reaction species",
                    error,
                )
            })?;

        if let Some(id_for_seed_key) = id_key_id {
            if id_for_seed_key != target_id {
                transaction
                    .execute(
                        "DELETE FROM reaction_species WHERE id = ?1",
                        [id_for_seed_key],
                    )
                    .map_err(|error| {
                        sqlite_error(
                            database_path,
                            "failed to remove duplicate baseline reaction species id row",
                            error,
                        )
                    })?;
            }
        }
    }

    Ok(())
}

fn replace_database_file_atomically(
    database_path: &Path,
    restore_temp_path: &Path,
) -> Result<(), StorageError> {
    replace_database_file_atomically_with(database_path, restore_temp_path, |source, target| {
        fs::rename(source, target)
    })
}

fn replace_database_file_atomically_with<F>(
    database_path: &Path,
    restore_temp_path: &Path,
    mut rename_path: F,
) -> Result<(), StorageError>
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    let first_promote_error = match rename_path(restore_temp_path, database_path) {
        Ok(()) => return Ok(()),
        Err(error) => error,
    };

    if !database_path.exists() {
        return Err(StorageError::Io {
            context: "failed to promote restored database file",
            path: database_path.to_path_buf(),
            message: first_promote_error.to_string(),
        });
    }

    let rollback_path = database_path.with_extension("restore.rollback.sqlite3");
    if rollback_path.exists() {
        fs::remove_file(&rollback_path).map_err(|error| StorageError::Io {
            context: "failed to clear stale restore rollback file",
            path: rollback_path.clone(),
            message: error.to_string(),
        })?;
    }

    rename_path(database_path, &rollback_path).map_err(|error| StorageError::Io {
        context: "failed to move current database into rollback file",
        path: rollback_path.clone(),
        message: error.to_string(),
    })?;

    match rename_path(restore_temp_path, database_path) {
        Ok(()) => {
            let _ = fs::remove_file(&rollback_path);
            Ok(())
        }
        Err(promote_error) => {
            let rollback_result = rename_path(&rollback_path, database_path);
            if let Err(rollback_error) = rollback_result {
                return Err(StorageError::Io {
                    context:
                        "failed to promote restored database file and rollback current database",
                    path: database_path.to_path_buf(),
                    message: format!(
                        "promote_error={promote_error}; rollback_error={rollback_error}"
                    ),
                });
            }

            Err(StorageError::Io {
                context: "failed to promote restored database file",
                path: database_path.to_path_buf(),
                message: promote_error.to_string(),
            })
        }
    }
}

fn sqlite_error(
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

fn bool_to_sqlite_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn row_to_substance(row: &Row<'_>) -> rusqlite::Result<Substance> {
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

fn row_to_reaction_template(row: &Row<'_>) -> rusqlite::Result<ReactionTemplate> {
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

fn row_to_scenario_run(row: &Row<'_>) -> rusqlite::Result<ScenarioRun> {
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

fn ensure_parent_directory(path: &Path, error_context: &'static str) -> Result<(), StorageError> {
    if let Some(parent) = path.parent().filter(|entry| !entry.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|error| StorageError::Io {
            context: error_context,
            path: parent.to_path_buf(),
            message: error.to_string(),
        })?;
    }

    Ok(())
}

fn validate_sqlite_file(path: &Path) -> Result<(), StorageError> {
    let mut file = File::open(path).map_err(|error| StorageError::Io {
        context: "failed to open sqlite file",
        path: path.to_path_buf(),
        message: error.to_string(),
    })?;

    let mut header = [0_u8; SQLITE_HEADER_MAGIC.len()];
    file.read_exact(&mut header)
        .map_err(|error| StorageError::InvalidBackupFormat {
            path: path.to_path_buf(),
            message: format!("unable to read sqlite header: {error}"),
        })?;

    if &header != SQLITE_HEADER_MAGIC {
        return Err(StorageError::InvalidBackupFormat {
            path: path.to_path_buf(),
            message: "expected SQLite header 'SQLite format 3\\0'".to_string(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    use tempfile::TempDir;

    use super::*;

    #[test]
    fn supports_crud_for_critical_entities() {
        let temp_dir = TempDir::new().expect("must create temp directory");
        let database_path = temp_dir.path().join("repo.sqlite3");

        run_migrations(&database_path).expect("migrations should succeed");
        let repository = StorageRepository::new(database_path);

        let inserted_substance = repository
            .create_substance(&NewSubstance {
                id: "substance-test-1".to_string(),
                name: "Methane".to_string(),
                formula: "CH4".to_string(),
                smiles: Some("C".to_string()),
                molar_mass_g_mol: 16.0425,
                phase_default: "gas".to_string(),
                source_type: "user_defined".to_string(),
            })
            .expect("must create substance");
        assert_eq!(inserted_substance.name, "Methane");

        let updated_substance = repository
            .update_substance(
                "substance-test-1",
                &UpdateSubstance {
                    name: "Methane (updated)".to_string(),
                    formula: "CH4".to_string(),
                    smiles: Some("C".to_string()),
                    molar_mass_g_mol: 16.043,
                    phase_default: "gas".to_string(),
                    source_type: "user_defined".to_string(),
                },
            )
            .expect("update should succeed")
            .expect("substance should exist");
        assert_eq!(updated_substance.name, "Methane (updated)");

        let inserted_template = repository
            .create_reaction_template(&NewReactionTemplate {
                id: "reaction-template-test-1".to_string(),
                title: "Methane oxidation".to_string(),
                reaction_class: "redox".to_string(),
                equation_balanced: "CH4 + 2O2 -> CO2 + 2H2O".to_string(),
                description: "Unit test template".to_string(),
                is_preset: false,
                version: 1,
            })
            .expect("must create reaction template");
        assert_eq!(inserted_template.version, 1);

        let updated_template = repository
            .update_reaction_template(
                "reaction-template-test-1",
                &UpdateReactionTemplate {
                    title: "Methane oxidation (updated)".to_string(),
                    reaction_class: "redox".to_string(),
                    equation_balanced: "CH4 + 2O2 -> CO2 + 2H2O".to_string(),
                    description: "Updated template".to_string(),
                    is_preset: false,
                    version: 2,
                },
            )
            .expect("template update should succeed")
            .expect("template should exist");
        assert_eq!(updated_template.version, 2);

        let inserted_run = repository
            .create_scenario_run(&NewScenarioRun {
                id: "scenario-run-test-1".to_string(),
                reaction_template_id: Some("reaction-template-test-1".to_string()),
                name: "Methane run".to_string(),
                temperature_k: 298.15,
                pressure_pa: 101_325.0,
                gas_medium: "air".to_string(),
                precision_profile: "balanced".to_string(),
                fps_limit: 60,
                particle_limit: 10_000,
            })
            .expect("must create scenario run");
        assert_eq!(inserted_run.name, "Methane run");

        let updated_run = repository
            .update_scenario_run(
                "scenario-run-test-1",
                &UpdateScenarioRun {
                    reaction_template_id: None,
                    name: "Methane run (updated)".to_string(),
                    temperature_k: 320.0,
                    pressure_pa: 95_000.0,
                    gas_medium: "nitrogen".to_string(),
                    precision_profile: "high_precision".to_string(),
                    fps_limit: 120,
                    particle_limit: 50_000,
                },
            )
            .expect("scenario run update should succeed")
            .expect("scenario run should exist");
        assert_eq!(updated_run.reaction_template_id, None);
        assert_eq!(updated_run.precision_profile, "high_precision");

        let all_substances = repository.list_substances().expect("must list substances");
        assert_eq!(all_substances.len(), 1);

        let all_templates = repository
            .list_reaction_templates()
            .expect("must list templates");
        assert_eq!(all_templates.len(), 1);

        let all_runs = repository
            .list_scenario_runs()
            .expect("must list scenario runs");
        assert_eq!(all_runs.len(), 1);

        assert!(repository
            .delete_scenario_run("scenario-run-test-1")
            .expect("scenario run delete should succeed"));
        assert!(repository
            .delete_reaction_template("reaction-template-test-1")
            .expect("template delete should succeed"));
        assert!(repository
            .delete_substance("substance-test-1")
            .expect("substance delete should succeed"));
    }

    #[test]
    fn count_substance_scenario_usage_tracks_references() {
        let temp_dir = TempDir::new().expect("must create temp directory");
        let database_path = temp_dir.path().join("scenario-usage.sqlite3");

        run_migrations(&database_path).expect("migrations should succeed");
        let repository = StorageRepository::new(database_path.clone());

        repository
            .create_substance(&NewSubstance {
                id: "substance-usage-target".to_string(),
                name: "Usage target".to_string(),
                formula: "U1".to_string(),
                smiles: None,
                molar_mass_g_mol: 11.0,
                phase_default: "solid".to_string(),
                source_type: "user_defined".to_string(),
            })
            .expect("must create usage target substance");

        repository
            .create_scenario_run(&NewScenarioRun {
                id: "scenario-run-usage-1".to_string(),
                reaction_template_id: None,
                name: "Usage scenario".to_string(),
                temperature_k: 298.15,
                pressure_pa: 101_325.0,
                gas_medium: "air".to_string(),
                precision_profile: "balanced".to_string(),
                fps_limit: 60,
                particle_limit: 10_000,
            })
            .expect("must create scenario run");

        let connection = Connection::open(database_path).expect("must open sqlite database");
        connection
            .execute(
                "INSERT INTO scenario_amount(
                    id,
                    scenario_run_id,
                    substance_id,
                    amount_mol,
                    mass_g,
                    volume_l,
                    concentration_mol_l
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "scenario-amount-usage-1",
                    "scenario-run-usage-1",
                    "substance-usage-target",
                    0.25_f64,
                    Option::<f64>::None,
                    Option::<f64>::None,
                    Option::<f64>::None
                ],
            )
            .expect("must insert scenario amount");

        let usage_count = repository
            .count_substance_scenario_usage("substance-usage-target")
            .expect("must count scenario usage");
        assert_eq!(usage_count, 1);
        assert_eq!(
            repository
                .count_substance_scenario_usage("substance-usage-missing")
                .expect("must count missing scenario usage"),
            0
        );
    }

    #[test]
    fn query_substances_supports_search_and_filters() {
        let temp_dir = TempDir::new().expect("must create temp directory");
        let database_path = temp_dir.path().join("query-substances.sqlite3");

        run_migrations(&database_path).expect("migrations should succeed");
        let repository = StorageRepository::new(database_path);

        repository
            .create_substance(&NewSubstance {
                id: "substance-methane".to_string(),
                name: "Methane".to_string(),
                formula: "CH4".to_string(),
                smiles: Some("C".to_string()),
                molar_mass_g_mol: 16.0425,
                phase_default: "gas".to_string(),
                source_type: "user_defined".to_string(),
            })
            .expect("must create methane");
        repository
            .create_substance(&NewSubstance {
                id: "substance-hydrogen-peroxide".to_string(),
                name: "Hydrogen peroxide".to_string(),
                formula: "H2O2".to_string(),
                smiles: Some("OO".to_string()),
                molar_mass_g_mol: 34.0147,
                phase_default: "liquid".to_string(),
                source_type: "imported".to_string(),
            })
            .expect("must create hydrogen peroxide");
        repository
            .create_substance(&NewSubstance {
                id: "substance-hydrogen".to_string(),
                name: "Hydrogen".to_string(),
                formula: "H2".to_string(),
                smiles: None,
                molar_mass_g_mol: 2.01588,
                phase_default: "gas".to_string(),
                source_type: "builtin".to_string(),
            })
            .expect("must create hydrogen");

        let all_results = repository
            .query_substances(None, None, None)
            .expect("must query all substances");
        let all_ids = all_results
            .iter()
            .map(|substance| substance.id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            all_ids,
            vec![
                "substance-hydrogen",
                "substance-hydrogen-peroxide",
                "substance-methane"
            ]
        );

        let search_results = repository
            .query_substances(Some("h2"), None, None)
            .expect("must query by case-insensitive formula search");
        let search_ids = search_results
            .iter()
            .map(|substance| substance.id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            search_ids,
            vec!["substance-hydrogen", "substance-hydrogen-peroxide"]
        );

        let filtered_results = repository
            .query_substances(Some("METH"), Some("gas"), Some("user_defined"))
            .expect("must query by combined search and filters");
        assert_eq!(filtered_results.len(), 1);
        assert_eq!(filtered_results[0].id, "substance-methane");

        let phase_source_results = repository
            .query_substances(None, Some("liquid"), Some("imported"))
            .expect("must query by source + phase");
        assert_eq!(phase_source_results.len(), 1);
        assert_eq!(phase_source_results[0].id, "substance-hydrogen-peroxide");

        let no_results = repository
            .query_substances(Some("chloride"), Some("gas"), None)
            .expect("must return empty result set when filters do not match");
        assert!(no_results.is_empty());
    }

    #[test]
    fn baseline_seed_is_idempotent() {
        let temp_dir = TempDir::new().expect("must create temp directory");
        let database_path = temp_dir.path().join("seed.sqlite3");

        run_migrations(&database_path).expect("migrations should succeed");
        let repository = StorageRepository::new(database_path.clone());

        let first_seed_report = repository
            .seed_baseline_data()
            .expect("first seed should succeed");
        assert_eq!(
            first_seed_report.substances_processed,
            BASELINE_SUBSTANCES.len()
        );

        let count_after_first_seed = repository
            .list_substances()
            .expect("must list substances after first seed")
            .len();

        repository
            .seed_baseline_data()
            .expect("second seed should succeed");

        let count_after_second_seed = repository
            .list_substances()
            .expect("must list substances after second seed")
            .len();

        assert_eq!(count_after_first_seed, BASELINE_SUBSTANCES.len());
        assert_eq!(count_after_second_seed, BASELINE_SUBSTANCES.len());

        let preset = repository
            .get_reaction_template("builtin-preset-hydrogen-combustion-v1")
            .expect("preset lookup should succeed")
            .expect("preset should exist");
        assert!(preset.is_preset);

        let connection = Connection::open(database_path).expect("must open seeded database");
        let species_count: i64 = connection
            .query_row("SELECT COUNT(1) FROM reaction_species", [], |row| {
                row.get(0)
            })
            .expect("must query species count");
        assert_eq!(species_count as usize, BASELINE_REACTION_SPECIES.len());
    }

    #[test]
    fn seed_reconciles_natural_key_conflicts_without_failing() {
        let temp_dir = TempDir::new().expect("must create temp directory");
        let database_path = temp_dir.path().join("seed-reconcile.sqlite3");

        run_migrations(&database_path).expect("migrations should succeed");

        let connection = Connection::open(&database_path).expect("must open database");
        connection
            .execute(
                "INSERT INTO substance(
                    id,
                    name,
                    formula,
                    smiles,
                    molar_mass_g_mol,
                    phase_default,
                    source_type
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "legacy-substance-hydrogen",
                    "Hydrogen",
                    "H2",
                    Some("[H][H]".to_string()),
                    9.999_f64,
                    "liquid",
                    "user_defined"
                ],
            )
            .expect("must insert legacy substance");
        connection
            .execute(
                "INSERT INTO reaction_template(
                    id,
                    title,
                    reaction_class,
                    equation_balanced,
                    description,
                    is_preset,
                    version
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "legacy-template-hydrogen-combustion-v1",
                    "Hydrogen combustion",
                    "redox",
                    "H2 + O2 -> H2O",
                    "Legacy preset from old app version",
                    0_i64,
                    1_i64
                ],
            )
            .expect("must insert legacy template");
        connection
            .execute(
                "INSERT INTO reaction_species(
                    id,
                    reaction_template_id,
                    substance_id,
                    role,
                    stoich_coeff
                ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "legacy-species-hydrogen-reactant",
                    "legacy-template-hydrogen-combustion-v1",
                    "legacy-substance-hydrogen",
                    "reactant",
                    0.5_f64
                ],
            )
            .expect("must insert legacy species");
        drop(connection);

        let repository = StorageRepository::new(database_path.clone());
        repository
            .seed_baseline_data()
            .expect("seed should reconcile legacy natural-key rows");

        let connection = Connection::open(database_path).expect("must reopen seeded database");

        let hydrogen_rows: i64 = connection
            .query_row(
                "SELECT COUNT(1) FROM substance WHERE name = 'Hydrogen' AND formula = 'H2'",
                [],
                |row| row.get(0),
            )
            .expect("must query hydrogen row count");
        assert_eq!(hydrogen_rows, 1);

        let (hydrogen_id, source_type, molar_mass, phase_default, smiles): (
            String,
            String,
            f64,
            String,
            Option<String>,
        ) = connection
            .query_row(
                "SELECT id, source_type, molar_mass_g_mol, phase_default, smiles
                FROM substance
                WHERE name = 'Hydrogen' AND formula = 'H2'",
                [],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
            .expect("must read reconciled hydrogen row");
        assert_eq!(hydrogen_id, "legacy-substance-hydrogen");
        assert_eq!(source_type, "user_defined");
        assert!((molar_mass - 9.999_f64).abs() < 1e-9_f64);
        assert_eq!(phase_default, "liquid");
        assert_eq!(smiles, Some("[H][H]".to_string()));

        let template_rows: i64 = connection
            .query_row(
                "SELECT COUNT(1) FROM reaction_template
                WHERE title = 'Hydrogen combustion' AND version = 1",
                [],
                |row| row.get(0),
            )
            .expect("must query template row count");
        assert_eq!(template_rows, 1);

        let (template_id, is_preset, equation): (String, i64, String) = connection
            .query_row(
                "SELECT id, is_preset, equation_balanced
                FROM reaction_template
                WHERE title = 'Hydrogen combustion' AND version = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("must read reconciled template row");
        assert_eq!(template_id, "legacy-template-hydrogen-combustion-v1");
        assert_eq!(is_preset, 1);
        assert_eq!(equation, "2H2 + O2 -> 2H2O");

        let species_rows: i64 = connection
            .query_row(
                "SELECT COUNT(1) FROM reaction_species
                WHERE reaction_template_id = ?1 AND substance_id = ?2 AND role = 'reactant'",
                params![template_id.as_str(), hydrogen_id.as_str()],
                |row| row.get(0),
            )
            .expect("must query reconciled species row count");
        assert_eq!(species_rows, 1);

        let species_stoich: f64 = connection
            .query_row(
                "SELECT stoich_coeff FROM reaction_species
                WHERE reaction_template_id = ?1 AND substance_id = ?2 AND role = 'reactant'",
                params![template_id.as_str(), hydrogen_id.as_str()],
                |row| row.get(0),
            )
            .expect("must read reconciled species row");
        assert!((species_stoich - 2.0_f64).abs() < 1e-9_f64);
    }

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

        fs::write(&invalid_backup_path, b"not-a-sqlite-file")
            .expect("must write invalid backup file");

        let error = repository
            .restore_database(&invalid_backup_path)
            .expect_err("restore should fail for invalid backup");

        match error {
            StorageError::InvalidBackupFormat { .. } => {}
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
}
