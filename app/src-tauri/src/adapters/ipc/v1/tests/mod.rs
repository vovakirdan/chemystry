use serde_json::{json, Value};
use tempfile::TempDir;

use super::*;
use crate::storage::{run_migrations, NewSubstance, StorageRepository};

mod imports;
mod scenarios;
mod substances;
mod system;
mod validation;

pub(super) fn setup_repository(file_name: &str) -> (TempDir, StorageRepository) {
    let temp_dir = TempDir::new().expect("must create temp directory");
    let database_path = temp_dir.path().join(file_name);
    run_migrations(&database_path).expect("migrations should succeed");
    (temp_dir, StorageRepository::new(database_path))
}

pub(super) fn create_builder_test_substance(repository: &StorageRepository, id: &str) {
    repository
        .create_substance(&NewSubstance {
            id: id.to_string(),
            name: format!("Draft {id}"),
            formula: format!("F-{id}"),
            smiles: None,
            molar_mass_g_mol: 10.0,
            phase_default: "solid".to_string(),
            source_type: "user_defined".to_string(),
        })
        .expect("must create builder draft test substance");
}

pub(super) fn sample_builder_payload(substance_id: &str) -> Value {
    json!({
        "title": "Builder scenario",
        "reactionClass": "inorganic",
        "equation": "A + B -> AB",
        "description": "Draft payload",
        "participants": [
            {
                "id": "participant-1",
                "substanceId": substance_id,
                "role": "reactant",
                "stoichCoeffInput": "1",
                "phase": "solid",
                "amountMolInput": "1.5",
                "massGInput": "",
                "volumeLInput": ""
            }
        ]
    })
}

pub(super) fn sample_runtime_payload() -> Value {
    json!({
        "temperatureC": 20.0,
        "pressureAtm": 1.0,
        "calculationPasses": 500,
        "precisionProfile": "Balanced",
        "fpsLimit": 90
    })
}

pub(super) fn sample_calculation_summary_payload(signature: &str) -> Value {
    json!({
        "version": 1,
        "generatedAt": "2026-03-04T09:00:00.000Z",
        "inputSignature": signature,
        "entries": [
            {
                "resultType": "stoichiometry",
                "inputs": {},
                "outputs": {
                    "reactionExtentMol": 1.0
                },
                "warnings": []
            },
            {
                "resultType": "limiting_reagent",
                "inputs": {},
                "outputs": {
                    "limitingReactants": ["participant-1"]
                },
                "warnings": []
            },
            {
                "resultType": "yield",
                "inputs": {},
                "outputs": {
                    "percentYield": 95.0
                },
                "warnings": []
            },
            {
                "resultType": "conversion",
                "inputs": {},
                "outputs": {},
                "warnings": ["Ideal-gas approximation"]
            },
            {
                "resultType": "concentration",
                "inputs": {},
                "outputs": {},
                "warnings": []
            }
        ]
    })
}

pub(super) fn sample_save_input(substance_id: &str) -> SaveScenarioDraftV1Input {
    SaveScenarioDraftV1Input {
        scenario_id: None,
        scenario_name: Some("Saved Draft".to_string()),
        builder: Some(sample_builder_payload(substance_id)),
        runtime: Some(sample_runtime_payload()),
        calculation_summary: None,
    }
}

pub(super) fn sample_water_mol() -> String {
    "Water
  ChemYstry

  3  2  0  0  0  0            999 V2000
    0.0000    0.0000    0.0000 O   0  0  0  0  0  0
    0.7570    0.5860    0.0000 H   0  0  0  0  0  0
   -0.7570    0.5860    0.0000 H   0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
M  END
"
    .to_string()
}

pub(super) fn sample_methane_mol() -> String {
    "Methane
  ChemYstry

  5  4  0  0  0  0            999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0
    0.6291    0.6291    0.6291 H   0  0  0  0  0  0
   -0.6291   -0.6291    0.6291 H   0  0  0  0  0  0
   -0.6291    0.6291   -0.6291 H   0  0  0  0  0  0
    0.6291   -0.6291   -0.6291 H   0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
  1  4  1  0  0  0  0
  1  5  1  0  0  0  0
M  END
"
    .to_string()
}

pub(super) fn sample_invalid_unknown_element_mol() -> String {
    "UnknownElement
  ChemYstry

  1  0  0  0  0  0            999 V2000
    0.0000    0.0000    0.0000 Qx  0  0  0  0  0  0
M  END
"
    .to_string()
}

pub(super) fn sample_malicious_atom_count_mol() -> String {
    "MaliciousCounts
  ChemYstry

   18446744073709551615  0  0  0  0  0            999 V2000
M  END
"
    .to_string()
}

pub(super) fn sample_valid_smiles() -> String {
    "# Example lines
CC Ethane
O
"
    .to_string()
}

pub(super) fn sample_invalid_unknown_element_smiles() -> String {
    "CC Ethane
Qq Unknownium
"
    .to_string()
}

pub(super) fn sample_valid_xyz() -> String {
    "3
Water
O 0.0000 0.0000 0.0000
H 0.7570 0.5860 0.0000
H -0.7570 0.5860 0.0000
2
Hydrogen
H 0.0000 0.0000 0.0000
H 0.7400 0.0000 0.0000
"
    .to_string()
}

pub(super) fn sample_invalid_xyz() -> String {
    "2
Broken
C 0.0000 0.0000
H 0.0000 0.0000 1.0000
"
    .to_string()
}
