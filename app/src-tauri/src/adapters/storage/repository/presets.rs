use rusqlite::{params, OptionalExtension};

use crate::storage::StorageError;

use super::sqlite_helpers::{bool_to_sqlite_int, row_to_reaction_template};
use super::{NewReactionTemplate, ReactionTemplate, StorageRepository, UpdateReactionTemplate};

impl StorageRepository {
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
}
