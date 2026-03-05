mod handlers;

use tauri::State;

use crate::infra::errors::CommandResult;
use crate::infra::logging;
use crate::storage::StorageRepository;

use super::contracts::{
    ImportSdfMolV1Input, ImportSdfMolV1Output, ImportSmilesV1Input, ImportSmilesV1Output,
    ImportXyzV1Input, ImportXyzV1Output,
};

pub(crate) use handlers::{
    import_sdf_mol_v1_with_repository, import_smiles_v1_with_repository,
    import_xyz_v1_with_repository,
};

pub(super) const IMPORT_SDF_MOL_COMMAND_NAME: &str = "import_sdf_mol_v1";
pub(super) const IMPORT_SMILES_COMMAND_NAME: &str = "import_smiles_v1";
pub(super) const IMPORT_XYZ_COMMAND_NAME: &str = "import_xyz_v1";

#[tauri::command]
pub fn import_sdf_mol_v1(
    input: ImportSdfMolV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<ImportSdfMolV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(IMPORT_SDF_MOL_COMMAND_NAME, &request_id);

    let result = import_sdf_mol_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(IMPORT_SDF_MOL_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(IMPORT_SDF_MOL_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn import_smiles_v1(
    input: ImportSmilesV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<ImportSmilesV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(IMPORT_SMILES_COMMAND_NAME, &request_id);

    let result = import_smiles_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(IMPORT_SMILES_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(IMPORT_SMILES_COMMAND_NAME, &error);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn import_xyz_v1(
    input: ImportXyzV1Input,
    repository: State<'_, StorageRepository>,
) -> CommandResult<ImportXyzV1Output> {
    let request_id = logging::next_request_id();
    logging::log_command_start(IMPORT_XYZ_COMMAND_NAME, &request_id);

    let result = import_xyz_v1_with_repository(&input, &repository, &request_id);
    match result {
        Ok(output) => {
            logging::log_command_success(IMPORT_XYZ_COMMAND_NAME, &request_id);
            Ok(output)
        }
        Err(error) => {
            logging::log_command_failure(IMPORT_XYZ_COMMAND_NAME, &error);
            Err(error)
        }
    }
}
