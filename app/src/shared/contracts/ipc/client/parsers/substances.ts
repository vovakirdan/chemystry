import {
  IPC_CONTRACT_VERSION_V1,
  type DeleteSubstanceV1Output,
  type ListSubstancesV1Output,
  type SubstanceCatalogEntryV1,
  type SubstanceMutationV1Output,
} from "../../v1";

import { createInvalidSubstancePayloadError } from "../errors";
import {
  isRecord,
  parseSubstanceMolarMassV1,
  parseSubstancePhaseV1,
  parseSubstanceSourceV1,
  readFirstDefined,
} from "../guards";
import { nextClientRequestId } from "../requestId";

// Intent: substance parsing accepts multiple historical field aliases from backend/storage migrations while enforcing a single normalized DTO shape for the UI.
export function parseSubstanceEntryV1(
  candidate: unknown,
  requestId: string,
  index: number,
): SubstanceCatalogEntryV1 {
  if (!isRecord(candidate)) {
    throw createInvalidSubstancePayloadError(
      `Substance at index ${index.toString()} is not an object.`,
      requestId,
    );
  }

  const id = candidate.id;
  const name = candidate.name;
  const formula = candidate.formula;
  const phase = parseSubstancePhaseV1(
    readFirstDefined(candidate, ["phase", "phaseDefault", "phase_default"]),
  );
  const source = parseSubstanceSourceV1(
    readFirstDefined(candidate, ["source", "sourceType", "source_type"]),
  );
  const molarMass = parseSubstanceMolarMassV1(
    readFirstDefined(candidate, [
      "molarMassGMol",
      "molarMassGmol",
      "molar_mass_g_mol",
      "molarMass",
    ]),
  );
  const smilesValue = readFirstDefined(candidate, ["smiles"]);

  if (typeof id !== "string" || id.length === 0) {
    throw createInvalidSubstancePayloadError(
      `Substance at index ${index.toString()} is missing a valid id.`,
      requestId,
    );
  }

  if (typeof name !== "string" || name.length === 0) {
    throw createInvalidSubstancePayloadError(
      `Substance "${id}" is missing a valid name.`,
      requestId,
    );
  }

  if (typeof formula !== "string" || formula.length === 0) {
    throw createInvalidSubstancePayloadError(
      `Substance "${id}" is missing a valid formula.`,
      requestId,
    );
  }

  if (phase === null) {
    throw createInvalidSubstancePayloadError(
      `Substance "${id}" has an unsupported phase value.`,
      requestId,
    );
  }

  if (source === null) {
    throw createInvalidSubstancePayloadError(
      `Substance "${id}" has an unsupported source value.`,
      requestId,
    );
  }

  const hasMolarMassField =
    readFirstDefined(candidate, [
      "molarMassGMol",
      "molarMassGmol",
      "molar_mass_g_mol",
      "molarMass",
    ]) !== undefined;

  if (hasMolarMassField && molarMass === null) {
    throw createInvalidSubstancePayloadError(
      `Substance "${id}" has an invalid molar mass value.`,
      requestId,
    );
  }

  if (smilesValue !== undefined && smilesValue !== null && typeof smilesValue !== "string") {
    throw createInvalidSubstancePayloadError(
      `Substance "${id}" has an invalid smiles value.`,
      requestId,
    );
  }

  const parsedSubstance: SubstanceCatalogEntryV1 = {
    id,
    name,
    formula,
    phase,
    source,
    molarMassGMol: molarMass,
  };

  if (smilesValue !== undefined) {
    parsedSubstance.smiles = smilesValue as string | null;
  }

  return parsedSubstance;
}

export function parseListSubstancesV1Output(payload: unknown): ListSubstancesV1Output {
  if (!isRecord(payload)) {
    throw createInvalidSubstancePayloadError("Substances payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidSubstancePayloadError("Substances payload version is invalid.", requestId);
  }

  if (!Array.isArray(payload.substances)) {
    throw createInvalidSubstancePayloadError(
      "Substances payload is missing the substances list.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    substances: payload.substances.map((candidate, index) =>
      parseSubstanceEntryV1(candidate, requestId, index),
    ),
  };
}

export function parseSubstanceMutationV1Output(payload: unknown): SubstanceMutationV1Output {
  if (!isRecord(payload)) {
    throw createInvalidSubstancePayloadError("Substance mutation payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidSubstancePayloadError(
      "Substance mutation payload version is invalid.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    substance: parseSubstanceEntryV1(payload.substance, requestId, 0),
  };
}

export function parseDeleteSubstanceV1Output(payload: unknown): DeleteSubstanceV1Output {
  if (!isRecord(payload)) {
    throw createInvalidSubstancePayloadError("Delete substance payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidSubstancePayloadError(
      "Delete substance payload version is invalid.",
      requestId,
    );
  }

  if (typeof payload.deleted !== "boolean") {
    throw createInvalidSubstancePayloadError(
      "Delete substance payload is missing the deleted flag.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    deleted: payload.deleted,
  };
}
