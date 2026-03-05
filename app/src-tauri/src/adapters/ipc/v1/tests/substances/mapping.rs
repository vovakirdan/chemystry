use super::super::*;
use crate::storage::Substance;

#[test]
fn maps_repository_substance_to_catalog_contract_shape() {
    let item = map_substance_to_catalog_item(Substance {
        id: "substance-1".to_string(),
        name: "Methane".to_string(),
        formula: "CH4".to_string(),
        smiles: Some("C".to_string()),
        molar_mass_g_mol: 16.0425,
        phase_default: "gas".to_string(),
        source_type: "user_defined".to_string(),
        created_at: "2026-03-04T00:00:00Z".to_string(),
    });

    assert_eq!(
        item,
        SubstanceCatalogItemV1 {
            id: "substance-1".to_string(),
            name: "Methane".to_string(),
            formula: "CH4".to_string(),
            smiles: Some("C".to_string()),
            molar_mass_g_mol: 16.0425,
            phase: "gas".to_string(),
            source: "user".to_string(),
        }
    );
}
