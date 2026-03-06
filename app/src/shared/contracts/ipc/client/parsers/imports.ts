import {
  IPC_CONTRACT_VERSION_V1,
  type ImportSdfMolV1Output,
  type ImportSmilesV1Output,
  type ImportXyzInferenceSummaryV1,
  type ImportXyzV1Output,
} from "../../v1";

import { createInvalidImportPayloadError } from "../errors";
import { isRecord, readFirstDefined } from "../guards";
import { nextClientRequestId } from "../requestId";
import { parseSubstanceEntryV1 } from "./substances";

export function parseImportSdfMolV1Output(payload: unknown): ImportSdfMolV1Output {
  if (!isRecord(payload)) {
    throw createInvalidImportPayloadError("Import payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidImportPayloadError("Import payload version is invalid.", requestId);
  }

  const importedCount = readFirstDefined(payload, ["importedCount", "imported_count"]);
  if (typeof importedCount !== "number" || !Number.isInteger(importedCount) || importedCount < 0) {
    throw createInvalidImportPayloadError(
      "Import payload is missing a valid importedCount value.",
      requestId,
    );
  }

  if (!Array.isArray(payload.substances)) {
    throw createInvalidImportPayloadError("Import payload is missing substances list.", requestId);
  }

  const substances = payload.substances.map((candidate, index) =>
    parseSubstanceEntryV1(candidate, requestId, index),
  );

  if (substances.length !== importedCount) {
    throw createInvalidImportPayloadError(
      "Import payload has inconsistent importedCount and substances length.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    importedCount,
    substances,
  };
}

export function parseImportSmilesV1Output(payload: unknown): ImportSmilesV1Output {
  return parseImportSdfMolV1Output(payload);
}

export function parseImportXyzInferenceSummaryV1(
  candidate: unknown,
  requestId: string,
  index: number,
): ImportXyzInferenceSummaryV1 {
  if (!isRecord(candidate)) {
    throw createInvalidImportPayloadError(
      `XYZ inference summary at index ${index.toString()} is not an object.`,
      requestId,
    );
  }

  const recordIndex = readFirstDefined(candidate, ["recordIndex", "record_index"]);
  const inferredBondCount = readFirstDefined(candidate, [
    "inferredBondCount",
    "inferred_bond_count",
  ]);
  const avgConfidence = readFirstDefined(candidate, ["avgConfidence", "avg_confidence"]);
  const minConfidence = readFirstDefined(candidate, ["minConfidence", "min_confidence"]);

  if (typeof recordIndex !== "number" || !Number.isInteger(recordIndex) || recordIndex <= 0) {
    throw createInvalidImportPayloadError(
      `XYZ inference summary at index ${index.toString()} has invalid recordIndex.`,
      requestId,
    );
  }
  if (
    typeof inferredBondCount !== "number" ||
    !Number.isInteger(inferredBondCount) ||
    inferredBondCount < 0
  ) {
    throw createInvalidImportPayloadError(
      `XYZ inference summary at index ${index.toString()} has invalid inferredBondCount.`,
      requestId,
    );
  }
  if (
    typeof avgConfidence !== "number" ||
    !Number.isFinite(avgConfidence) ||
    avgConfidence < 0 ||
    avgConfidence > 1
  ) {
    throw createInvalidImportPayloadError(
      `XYZ inference summary at index ${index.toString()} has invalid avgConfidence.`,
      requestId,
    );
  }
  if (
    typeof minConfidence !== "number" ||
    !Number.isFinite(minConfidence) ||
    minConfidence < 0 ||
    minConfidence > 1
  ) {
    throw createInvalidImportPayloadError(
      `XYZ inference summary at index ${index.toString()} has invalid minConfidence.`,
      requestId,
    );
  }

  return {
    recordIndex,
    inferredBondCount,
    avgConfidence,
    minConfidence,
  };
}

// Intent: XYZ imports parse the shared substance payload first so record-count validation stays identical across file formats before format-specific inference summaries are attached.
export function parseImportXyzV1Output(payload: unknown): ImportXyzV1Output {
  const parsedBase = parseImportSdfMolV1Output(payload);
  if (!isRecord(payload)) {
    throw createInvalidImportPayloadError("Import payload is not an object.");
  }

  const summariesCandidate = readFirstDefined(payload, [
    "inferenceSummaries",
    "inference_summaries",
  ]);
  if (!Array.isArray(summariesCandidate)) {
    throw createInvalidImportPayloadError(
      "XYZ import payload is missing inference summaries list.",
      parsedBase.requestId,
    );
  }

  if (parsedBase.importedCount !== parsedBase.substances.length) {
    throw createInvalidImportPayloadError(
      "XYZ import payload has inconsistent importedCount and substances length.",
      parsedBase.requestId,
    );
  }

  const inferenceSummaries = summariesCandidate.map((candidate, index) =>
    parseImportXyzInferenceSummaryV1(candidate, parsedBase.requestId, index),
  );
  if (inferenceSummaries.length !== parsedBase.importedCount) {
    throw createInvalidImportPayloadError(
      "XYZ import payload has inconsistent inferenceSummaries and importedCount.",
      parsedBase.requestId,
    );
  }

  return {
    version: parsedBase.version,
    requestId: parsedBase.requestId,
    importedCount: parsedBase.importedCount,
    substances: parsedBase.substances,
    inferenceSummaries,
  };
}
