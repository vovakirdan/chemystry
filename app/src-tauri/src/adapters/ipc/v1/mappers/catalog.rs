use crate::storage::{ReactionTemplate, Substance};

use super::super::contracts::{PresetCatalogItemV1, SubstanceCatalogItemV1};

fn source_type_for_contract(source_type: &str) -> String {
    match source_type {
        "user_defined" => "user".to_string(),
        _ => source_type.to_string(),
    }
}

pub(crate) fn map_substance_to_catalog_item(substance: Substance) -> SubstanceCatalogItemV1 {
    SubstanceCatalogItemV1 {
        id: substance.id,
        name: substance.name,
        formula: substance.formula,
        smiles: substance.smiles,
        molar_mass_g_mol: substance.molar_mass_g_mol,
        phase: substance.phase_default,
        source: source_type_for_contract(&substance.source_type),
    }
}

fn complexity_label_for_reaction_class(reaction_class: &str) -> &'static str {
    match reaction_class {
        "inorganic" | "acid_base" => "beginner",
        "redox" | "organic_basic" => "intermediate",
        "equilibrium" => "advanced",
        _ => "intermediate",
    }
}

pub(crate) fn map_template_to_preset_item(template: ReactionTemplate) -> PresetCatalogItemV1 {
    let complexity = complexity_label_for_reaction_class(&template.reaction_class).to_string();

    PresetCatalogItemV1 {
        id: template.id,
        title: template.title,
        reaction_class: template.reaction_class,
        complexity,
        description: template.description,
        equation_balanced: template.equation_balanced,
    }
}
