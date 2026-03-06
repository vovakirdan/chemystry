use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, OptionalExtension, Transaction};

use crate::storage::StorageError;

use super::super::sqlite_helpers::{bool_to_sqlite_int, sqlite_error};

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

pub(super) fn upsert_baseline_reaction_templates(
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

pub(super) const fn baseline_reaction_templates_len() -> usize {
    BASELINE_REACTION_TEMPLATES.len()
}
