use crate::infra::errors::CommandError;
use crate::io::sdf_mol::SdfMolParseError;
use crate::io::smiles::SmilesParseError;
use crate::io::xyz::XyzParseError;

use super::super::contracts::CommandErrorV1;
use super::super::CONTRACT_VERSION_V1;

pub(crate) fn map_import_sdf_mol_parse_error(
    request_id: &str,
    error: SdfMolParseError,
) -> CommandErrorV1 {
    CommandError::import(
        CONTRACT_VERSION_V1,
        request_id,
        error.code,
        error.with_context_message(),
    )
}

pub(crate) fn map_import_smiles_parse_error(
    request_id: &str,
    error: SmilesParseError,
) -> CommandErrorV1 {
    CommandError::import(
        CONTRACT_VERSION_V1,
        request_id,
        error.code,
        error.with_context_message(),
    )
}

pub(crate) fn map_import_xyz_parse_error(request_id: &str, error: XyzParseError) -> CommandErrorV1 {
    CommandError::import(
        CONTRACT_VERSION_V1,
        request_id,
        error.code,
        error.with_context_message(),
    )
}
