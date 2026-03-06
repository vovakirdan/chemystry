use rusqlite::{params, OptionalExtension};

use crate::storage::StorageError;

use super::sqlite_helpers::row_to_substance;
use super::{NewSubstance, StorageRepository, Substance, UpdateSubstance};

impl StorageRepository {
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

    pub fn create_substances_batch(&self, inputs: &[NewSubstance]) -> Result<(), StorageError> {
        if inputs.is_empty() {
            return Ok(());
        }

        let mut connection = self.open()?;
        let transaction = connection.transaction().map_err(|error| {
            self.sqlite_error("failed to begin substance batch transaction", error)
        })?;

        for input in inputs {
            transaction
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
                .map_err(|error| self.sqlite_error("failed to insert batched substance", error))?;
        }

        transaction.commit().map_err(|error| {
            self.sqlite_error("failed to commit substance batch transaction", error)
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
}
