use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, OptionalExtension, Transaction};

use crate::storage::StorageError;

use super::super::sqlite_helpers::sqlite_error;

#[derive(Debug, Clone, Copy)]
struct BaselineReactionSpeciesSeed {
    id: &'static str,
    reaction_template_id: &'static str,
    substance_id: &'static str,
    role: &'static str,
    stoich_coeff: f64,
}

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

pub(super) fn upsert_baseline_reaction_species(
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

pub(super) const fn baseline_reaction_species_len() -> usize {
    BASELINE_REACTION_SPECIES.len()
}
