use crate::storage::StorageError;

use super::{SeedReport, StorageRepository};

mod species;
mod substances;
mod templates;

pub(super) fn baseline_reaction_species_len() -> usize {
    species::baseline_reaction_species_len()
}

pub(super) fn baseline_substances_len() -> usize {
    substances::baseline_substances_len()
}

fn baseline_reaction_templates_len() -> usize {
    templates::baseline_reaction_templates_len()
}

impl StorageRepository {
    pub fn seed_baseline_data(&self) -> Result<SeedReport, StorageError> {
        let mut connection = self.open()?;
        let transaction = connection
            .transaction()
            .map_err(|error| self.sqlite_error("failed to begin seed transaction", error))?;

        let resolved_substance_ids =
            substances::upsert_baseline_substances(&transaction, &self.database_path)?;
        let resolved_template_ids =
            templates::upsert_baseline_reaction_templates(&transaction, &self.database_path)?;
        species::upsert_baseline_reaction_species(
            &transaction,
            &self.database_path,
            &resolved_template_ids,
            &resolved_substance_ids,
        )?;

        transaction
            .commit()
            .map_err(|error| self.sqlite_error("failed to commit seed transaction", error))?;

        Ok(SeedReport {
            substances_processed: baseline_substances_len(),
            reaction_templates_processed: baseline_reaction_templates_len(),
            reaction_species_processed: baseline_reaction_species_len(),
        })
    }
}
