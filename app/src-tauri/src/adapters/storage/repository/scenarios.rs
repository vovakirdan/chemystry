use std::collections::BTreeMap;

use rusqlite::{params, OptionalExtension};
use serde_json::Value;

use crate::storage::StorageError;

use super::entities::ScenarioAmountRecord;
use super::parsers::{
    parse_calculation_result_records, parse_scenario_amount_records,
    scenario_amount_record_to_value,
};
use super::sqlite_helpers::row_to_scenario_run;
use super::{NewScenarioRun, ScenarioRun, StorageRepository, UpdateScenarioRun};

impl StorageRepository {
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

    pub fn upsert_simulation_frame_summary_json(
        &self,
        scenario_run_id: &str,
        t_sim_s: f64,
        key_metrics_json: &str,
    ) -> Result<(), StorageError> {
        if !t_sim_s.is_finite() || t_sim_s < 0.0 {
            return Err(StorageError::DataInvariant(format!(
                "simulation_frame_summary.t_sim_s must be finite and >= 0, got {t_sim_s}"
            )));
        }

        let normalized_payload = key_metrics_json.trim();
        if normalized_payload.is_empty() {
            return Err(StorageError::DataInvariant(
                "simulation_frame_summary.key_metrics_json must not be empty".to_string(),
            ));
        }

        let connection = self.open()?;
        let frame_id = format!(
            "simulation-frame-summary-{scenario_run_id}-{}",
            t_sim_s.to_bits()
        );
        connection
            .execute(
                "INSERT INTO simulation_frame_summary(
                    id,
                    scenario_run_id,
                    t_sim_s,
                    key_metrics_json
                ) VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(scenario_run_id, t_sim_s)
                DO UPDATE SET key_metrics_json = excluded.key_metrics_json",
                params![frame_id, scenario_run_id, t_sim_s, normalized_payload],
            )
            .map_err(|error| {
                self.sqlite_error("failed to upsert simulation_frame_summary row", error)
            })?;

        Ok(())
    }

    pub fn read_simulation_frame_summary_json(
        &self,
        scenario_run_id: &str,
        t_sim_s: f64,
    ) -> Result<Option<String>, StorageError> {
        if !t_sim_s.is_finite() || t_sim_s < 0.0 {
            return Err(StorageError::DataInvariant(format!(
                "simulation_frame_summary.t_sim_s must be finite and >= 0, got {t_sim_s}"
            )));
        }

        let connection = self.open()?;
        connection
            .query_row(
                "SELECT key_metrics_json
                FROM simulation_frame_summary
                WHERE scenario_run_id = ?1 AND t_sim_s = ?2
                LIMIT 1",
                params![scenario_run_id, t_sim_s],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| {
                self.sqlite_error("failed to read simulation_frame_summary payload", error)
            })
    }

    pub fn replace_scenario_amounts_from_value(
        &self,
        scenario_run_id: &str,
        amounts: &Value,
    ) -> Result<(), StorageError> {
        let amount_records = parse_scenario_amount_records(amounts)?;

        let mut deduplicated = BTreeMap::new();
        for record in amount_records {
            deduplicated.insert(record.substance_id.clone(), record);
        }

        let mut connection = self.open()?;
        let transaction = connection.transaction().map_err(|error| {
            self.sqlite_error("failed to begin scenario_amount transaction", error)
        })?;

        transaction
            .execute(
                "DELETE FROM scenario_amount WHERE scenario_run_id = ?1",
                params![scenario_run_id],
            )
            .map_err(|error| {
                self.sqlite_error("failed to clear previous scenario_amount rows", error)
            })?;

        for (index, record) in deduplicated.values().enumerate() {
            let substance_exists = transaction
                .query_row(
                    "SELECT 1 FROM substance WHERE id = ?1 LIMIT 1",
                    params![record.substance_id.as_str()],
                    |row| row.get::<usize, i64>(0),
                )
                .optional()
                .map_err(|error| {
                    self.sqlite_error("failed to verify scenario_amount substance", error)
                })?;
            if substance_exists.is_none() {
                continue;
            }

            let amount_id = format!("scenario-amount-{scenario_run_id}-{}", index + 1);
            transaction
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
                        amount_id,
                        scenario_run_id,
                        record.substance_id.as_str(),
                        record.amount_mol,
                        record.mass_g,
                        record.volume_l,
                        record.concentration_mol_l
                    ],
                )
                .map_err(|error| {
                    self.sqlite_error("failed to insert scenario_amount row", error)
                })?;
        }

        transaction.commit().map_err(|error| {
            self.sqlite_error("failed to commit scenario_amount transaction", error)
        })
    }

    pub fn replace_calculation_results_from_value(
        &self,
        scenario_run_id: &str,
        calculation_summary: Option<&Value>,
    ) -> Result<(), StorageError> {
        let calculation_records = parse_calculation_result_records(calculation_summary)?;
        let mut connection = self.open()?;
        let transaction = connection.transaction().map_err(|error| {
            self.sqlite_error("failed to begin calculation_result transaction", error)
        })?;

        transaction
            .execute(
                "DELETE FROM calculation_result WHERE scenario_run_id = ?1",
                params![scenario_run_id],
            )
            .map_err(|error| {
                self.sqlite_error("failed to clear previous calculation_result rows", error)
            })?;

        for (index, record) in calculation_records.iter().enumerate() {
            let result_id = format!("calculation-result-{scenario_run_id}-{}", index + 1);
            transaction
                .execute(
                    "INSERT INTO calculation_result(
                        id,
                        scenario_run_id,
                        result_type,
                        payload_json
                    ) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        result_id,
                        scenario_run_id,
                        record.result_type.as_str(),
                        record.payload_json.as_str()
                    ],
                )
                .map_err(|error| {
                    self.sqlite_error("failed to insert calculation_result row", error)
                })?;
        }

        transaction.commit().map_err(|error| {
            self.sqlite_error("failed to commit calculation_result transaction", error)
        })
    }

    pub fn read_scenario_amounts_as_value(
        &self,
        scenario_run_id: &str,
    ) -> Result<Value, StorageError> {
        let connection = self.open()?;
        let mut statement = connection
            .prepare(
                "SELECT
                    substance_id,
                    amount_mol,
                    mass_g,
                    volume_l,
                    concentration_mol_l
                FROM scenario_amount
                WHERE scenario_run_id = ?1
                ORDER BY substance_id ASC",
            )
            .map_err(|error| {
                self.sqlite_error("failed to prepare scenario_amount list query", error)
            })?;

        let rows = statement
            .query_map(params![scenario_run_id], |row| {
                Ok(ScenarioAmountRecord {
                    substance_id: row.get(0)?,
                    amount_mol: row.get(1)?,
                    mass_g: row.get(2)?,
                    volume_l: row.get(3)?,
                    concentration_mol_l: row.get(4)?,
                })
            })
            .map_err(|error| self.sqlite_error("failed to query scenario_amount rows", error))?;

        let mut amounts = Vec::new();
        for row in rows {
            let record = row.map_err(|error| {
                self.sqlite_error("failed to decode scenario_amount row", error)
            })?;
            amounts.push(scenario_amount_record_to_value(record));
        }

        Ok(Value::Array(amounts))
    }
}
