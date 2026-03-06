import {
  IPC_CONTRACT_VERSION_V1,
  type ListPresetsV1Output,
  type PresetCatalogEntryV1,
} from "../../v1";

import { createInvalidPresetPayloadError } from "../errors";
import { isRecord, parseReactionClassV1, readFirstDefined } from "../guards";
import { nextClientRequestId } from "../requestId";

// Intent: preset parsing accepts legacy alias fields from older IPC payloads, but the returned DTO is normalized to the current contract names.
export function parsePresetEntryV1(
  candidate: unknown,
  requestId: string,
  index: number,
): PresetCatalogEntryV1 {
  if (!isRecord(candidate)) {
    throw createInvalidPresetPayloadError(
      `Preset at index ${index.toString()} is not an object.`,
      requestId,
    );
  }

  const id = candidate.id;
  const title = candidate.title;
  const reactionClass = parseReactionClassV1(
    readFirstDefined(candidate, ["reactionClass", "reaction_class", "class"]),
  );
  const equation = readFirstDefined(candidate, [
    "equation",
    "equationBalanced",
    "equation_balanced",
  ]);
  const complexity = readFirstDefined(candidate, ["complexity", "difficulty"]);
  const description = candidate.description;

  if (typeof id !== "string" || id.length === 0) {
    throw createInvalidPresetPayloadError(
      `Preset at index ${index.toString()} is missing a valid id.`,
      requestId,
    );
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    throw createInvalidPresetPayloadError(`Preset "${id}" is missing a valid title.`, requestId);
  }

  if (reactionClass === null) {
    throw createInvalidPresetPayloadError(
      `Preset "${id}" has an unsupported reaction class.`,
      requestId,
    );
  }

  if (typeof equation !== "string" || equation.trim().length === 0) {
    throw createInvalidPresetPayloadError(`Preset "${id}" is missing a valid equation.`, requestId);
  }

  if (typeof complexity !== "string" || complexity.trim().length === 0) {
    throw createInvalidPresetPayloadError(
      `Preset "${id}" is missing a valid complexity value.`,
      requestId,
    );
  }

  if (typeof description !== "string") {
    throw createInvalidPresetPayloadError(
      `Preset "${id}" is missing a valid description.`,
      requestId,
    );
  }

  return {
    id,
    title: title.trim(),
    reactionClass,
    equation: equation.trim(),
    complexity: complexity.trim(),
    description: description.trim(),
  };
}

export function parseListPresetsV1Output(payload: unknown): ListPresetsV1Output {
  if (!isRecord(payload)) {
    throw createInvalidPresetPayloadError("Presets payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidPresetPayloadError("Presets payload version is invalid.", requestId);
  }

  if (!Array.isArray(payload.presets)) {
    throw createInvalidPresetPayloadError(
      "Presets payload is missing the presets list.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    presets: payload.presets.map((candidate, index) =>
      parsePresetEntryV1(candidate, requestId, index),
    ),
  };
}
