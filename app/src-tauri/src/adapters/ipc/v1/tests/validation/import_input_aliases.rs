use serde_json::json;

use super::super::*;

#[test]
fn import_sdf_mol_input_accepts_file_name_alias() {
    let input: ImportSdfMolV1Input = serde_json::from_value(json!({
        "file_name": "water.mol",
        "contents": "MOL"
    }))
    .expect("`file_name` alias must deserialize for SDF/MOL import input");

    assert_eq!(input.file_name.as_deref(), Some("water.mol"));
    assert_eq!(input.contents.as_deref(), Some("MOL"));
}

#[test]
fn import_smiles_input_accepts_file_name_alias() {
    let input: ImportSmilesV1Input = serde_json::from_value(json!({
        "file_name": "bundle.smi",
        "contents": "CC"
    }))
    .expect("`file_name` alias must deserialize for SMILES import input");

    assert_eq!(input.file_name.as_deref(), Some("bundle.smi"));
    assert_eq!(input.contents.as_deref(), Some("CC"));
}

#[test]
fn import_xyz_input_accepts_file_name_alias() {
    let input: ImportXyzV1Input = serde_json::from_value(json!({
        "file_name": "bundle.xyz",
        "contents": "3\\nWater"
    }))
    .expect("`file_name` alias must deserialize for XYZ import input");

    assert_eq!(input.file_name.as_deref(), Some("bundle.xyz"));
    assert_eq!(input.contents.as_deref(), Some("3\\nWater"));
}
