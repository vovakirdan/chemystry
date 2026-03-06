use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, OptionalExtension, Transaction};

use crate::storage::StorageError;

use super::super::sqlite_helpers::sqlite_error;

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

pub(super) fn upsert_baseline_substances(
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

pub(super) const fn baseline_substances_len() -> usize {
    BASELINE_SUBSTANCES.len()
}
