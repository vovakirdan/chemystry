use crate::infra::errors::CommandResult;

use super::super::contracts::{ImportSdfMolV1Input, ImportSmilesV1Input, ImportXyzV1Input};
use super::super::{MAX_IMPORT_CONTENTS_LENGTH, MAX_IMPORT_FILE_NAME_LENGTH};
use super::common::validate_required_text_field;
use super::validation_error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedImportSdfMolV1Input {
    pub file_name: String,
    pub contents: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedImportSmilesV1Input {
    pub file_name: String,
    pub contents: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedImportXyzV1Input {
    pub file_name: String,
    pub contents: String,
}

fn validate_import_file_name_for_extensions(
    value: Option<&str>,
    request_id: &str,
    extensions: &[&str],
    extension_hint: &str,
) -> CommandResult<String> {
    let file_name = validate_required_text_field(
        value,
        request_id,
        "fileName",
        "IMPORT_FILE_NAME_REQUIRED",
        "IMPORT_FILE_NAME_TOO_LONG",
        MAX_IMPORT_FILE_NAME_LENGTH,
    )?;
    let normalized = file_name.to_ascii_lowercase();
    if !extensions
        .iter()
        .any(|extension| normalized.ends_with(extension))
    {
        return Err(validation_error(
            request_id,
            "IMPORT_FILE_TYPE_UNSUPPORTED",
            format!("`fileName` must end with {extension_hint}."),
        ));
    }

    Ok(file_name)
}

fn validate_import_sdf_mol_file_name(
    value: Option<&str>,
    request_id: &str,
) -> CommandResult<String> {
    validate_import_file_name_for_extensions(
        value,
        request_id,
        &[".sdf", ".mol"],
        "`.sdf` or `.mol`",
    )
}

fn validate_import_smiles_file_name(
    value: Option<&str>,
    request_id: &str,
) -> CommandResult<String> {
    validate_import_file_name_for_extensions(
        value,
        request_id,
        &[".smi", ".smiles", ".txt"],
        "`.smi`, `.smiles`, or `.txt`",
    )
}

fn validate_import_xyz_file_name(value: Option<&str>, request_id: &str) -> CommandResult<String> {
    validate_import_file_name_for_extensions(value, request_id, &[".xyz"], "`.xyz`")
}

fn validate_import_contents(value: Option<&str>, request_id: &str) -> CommandResult<String> {
    let Some(contents) = value else {
        return Err(validation_error(
            request_id,
            "IMPORT_CONTENTS_REQUIRED",
            "`contents` is required.",
        ));
    };

    if contents.trim().is_empty() {
        return Err(validation_error(
            request_id,
            "IMPORT_CONTENTS_EMPTY",
            "`contents` must not be empty.",
        ));
    }

    if contents.len() > MAX_IMPORT_CONTENTS_LENGTH {
        return Err(validation_error(
            request_id,
            "IMPORT_CONTENTS_TOO_LARGE",
            format!(
                "`contents` must be at most {MAX_IMPORT_CONTENTS_LENGTH} bytes for MVP import."
            ),
        ));
    }

    Ok(contents.to_string())
}

pub fn validate_import_sdf_mol_v1_input(
    input: &ImportSdfMolV1Input,
    request_id: &str,
) -> CommandResult<ValidatedImportSdfMolV1Input> {
    Ok(ValidatedImportSdfMolV1Input {
        file_name: validate_import_sdf_mol_file_name(input.file_name.as_deref(), request_id)?,
        contents: validate_import_contents(input.contents.as_deref(), request_id)?,
    })
}

pub fn validate_import_smiles_v1_input(
    input: &ImportSmilesV1Input,
    request_id: &str,
) -> CommandResult<ValidatedImportSmilesV1Input> {
    Ok(ValidatedImportSmilesV1Input {
        file_name: validate_import_smiles_file_name(input.file_name.as_deref(), request_id)?,
        contents: validate_import_contents(input.contents.as_deref(), request_id)?,
    })
}

pub fn validate_import_xyz_v1_input(
    input: &ImportXyzV1Input,
    request_id: &str,
) -> CommandResult<ValidatedImportXyzV1Input> {
    Ok(ValidatedImportXyzV1Input {
        file_name: validate_import_xyz_file_name(input.file_name.as_deref(), request_id)?,
        contents: validate_import_contents(input.contents.as_deref(), request_id)?,
    })
}
