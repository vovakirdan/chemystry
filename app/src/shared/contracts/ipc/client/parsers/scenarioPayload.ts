import {
  type CalculationResultTypeV1,
  type CalculationSummaryV1,
  type ScenarioBuilderSnapshotV1,
  type ScenarioParticipantSnapshotV1,
  type ScenarioPayloadV1,
  type ScenarioRuntimeSettingsV1,
} from "../../v1";

import { createInvalidScenarioPayloadError } from "../errors";
import {
  CALCULATION_RESULT_TYPE_SET_V1,
  isRecord,
  parseBuilderParticipantRoleV1,
  parseGasMediumV1,
  parsePrecisionProfileV1,
  parseReactionClassV1,
  parseSubstancePhaseV1,
  readFirstDefined,
} from "../guards";

function parseScenarioNullableNumber(
  value: unknown,
  fieldLabel: string,
  requestId: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw createInvalidScenarioPayloadError(
    `Scenario runtime setting "${fieldLabel}" must be a finite number or null.`,
    requestId,
  );
}

function parseScenarioParticipantSnapshotV1(
  candidate: unknown,
  requestId: string,
  index: number,
): ScenarioParticipantSnapshotV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError(
      `Scenario participant at index ${index.toString()} is not an object.`,
      requestId,
    );
  }

  const id = candidate.id;
  const substanceId = readFirstDefined(candidate, ["substanceId", "substance_id"]);
  const role = parseBuilderParticipantRoleV1(candidate.role);
  const phase = parseSubstancePhaseV1(candidate.phase);
  const stoichCoeffInput = readFirstDefined(candidate, ["stoichCoeffInput", "stoich_coeff_input"]);
  const amountMolInput = readFirstDefined(candidate, ["amountMolInput", "amount_mol_input"]);
  const massGInput = readFirstDefined(candidate, ["massGInput", "mass_g_input"]);
  const volumeLInput = readFirstDefined(candidate, ["volumeLInput", "volume_l_input"]);

  if (typeof id !== "string" || id.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario participant at index ${index.toString()} is missing a valid id.`,
      requestId,
    );
  }

  if (typeof substanceId !== "string" || substanceId.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario participant "${id}" is missing a valid substanceId.`,
      requestId,
    );
  }

  if (role === null) {
    throw createInvalidScenarioPayloadError(
      `Scenario participant "${id}" has an unsupported role.`,
      requestId,
    );
  }

  if (phase === null) {
    throw createInvalidScenarioPayloadError(
      `Scenario participant "${id}" has an unsupported phase.`,
      requestId,
    );
  }

  if (typeof stoichCoeffInput !== "string") {
    throw createInvalidScenarioPayloadError(
      `Scenario participant "${id}" has an invalid stoichCoeffInput value.`,
      requestId,
    );
  }

  return {
    id: id.trim(),
    substanceId: substanceId.trim(),
    role,
    stoichCoeffInput,
    phase,
    amountMolInput: typeof amountMolInput === "string" ? amountMolInput : "",
    massGInput: typeof massGInput === "string" ? massGInput : "",
    volumeLInput: typeof volumeLInput === "string" ? volumeLInput : "",
  };
}

function parseScenarioBuilderSnapshotV1(
  candidate: unknown,
  requestId: string,
): ScenarioBuilderSnapshotV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError(
      "Scenario builder snapshot is not an object.",
      requestId,
    );
  }

  const title = candidate.title;
  const reactionClass = parseReactionClassV1(
    readFirstDefined(candidate, ["reactionClass", "reaction_class", "class"]),
  );
  const equation = candidate.equation;
  const description = candidate.description;
  const participants = candidate.participants;

  if (typeof title !== "string") {
    throw createInvalidScenarioPayloadError(
      "Scenario builder snapshot is missing a valid title.",
      requestId,
    );
  }

  if (reactionClass === null) {
    throw createInvalidScenarioPayloadError(
      "Scenario builder snapshot has an unsupported reactionClass.",
      requestId,
    );
  }

  if (typeof equation !== "string" || typeof description !== "string") {
    throw createInvalidScenarioPayloadError(
      "Scenario builder snapshot has invalid equation or description.",
      requestId,
    );
  }

  if (!Array.isArray(participants)) {
    throw createInvalidScenarioPayloadError(
      "Scenario builder snapshot is missing participants list.",
      requestId,
    );
  }

  return {
    title,
    reactionClass,
    equation,
    description,
    participants: participants.map((participant, index) =>
      parseScenarioParticipantSnapshotV1(participant, requestId, index),
    ),
  };
}

// Intent: runtime settings parsing keeps legacy snake_case aliases and current camelCase fields in lockstep so saved drafts stay loadable across contract revisions.
function parseScenarioRuntimeSettingsV1(
  candidate: unknown,
  requestId: string,
): ScenarioRuntimeSettingsV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError(
      "Scenario runtime settings are not an object.",
      requestId,
    );
  }

  const temperatureC = parseScenarioNullableNumber(
    readFirstDefined(candidate, ["temperatureC", "temperature_c"]),
    "temperatureC",
    requestId,
  );
  const pressureAtm = parseScenarioNullableNumber(
    readFirstDefined(candidate, ["pressureAtm", "pressure_atm"]),
    "pressureAtm",
    requestId,
  );
  const calculationPasses = parseScenarioNullableNumber(
    readFirstDefined(candidate, ["calculationPasses", "calculation_passes"]),
    "calculationPasses",
    requestId,
  );
  const rawGasMedium = readFirstDefined(candidate, ["gasMedium", "gas_medium"]);
  const gasMedium = parseGasMediumV1(rawGasMedium);
  const resolvedGasMedium = gasMedium ?? "gas";
  if (gasMedium === null && rawGasMedium !== undefined && rawGasMedium !== null) {
    throw createInvalidScenarioPayloadError(
      "Scenario runtime settings have an unsupported gasMedium.",
      requestId,
    );
  }

  const fpsLimit = parseScenarioNullableNumber(
    readFirstDefined(candidate, ["fpsLimit", "fps_limit"]),
    "fpsLimit",
    requestId,
  );
  const rawPrecisionProfile = readFirstDefined(candidate, [
    "precisionProfile",
    "precision_profile",
  ]);
  const precisionProfile = parsePrecisionProfileV1(rawPrecisionProfile);
  const resolvedPrecisionProfile = precisionProfile ?? "Balanced";
  if (
    precisionProfile === null &&
    rawPrecisionProfile !== undefined &&
    rawPrecisionProfile !== null
  ) {
    throw createInvalidScenarioPayloadError(
      "Scenario runtime settings have an unsupported precisionProfile.",
      requestId,
    );
  }

  return {
    temperatureC,
    pressureAtm,
    gasMedium: resolvedGasMedium,
    calculationPasses,
    precisionProfile: resolvedPrecisionProfile,
    fpsLimit,
  };
}

function parseCalculationResultTypeV1(
  value: unknown,
  requestId: string,
  entryIndex: number,
): CalculationResultTypeV1 {
  if (typeof value !== "string") {
    throw createInvalidScenarioPayloadError(
      `Scenario calculation summary entry at index ${entryIndex.toString()} is missing resultType.`,
      requestId,
    );
  }

  if (!CALCULATION_RESULT_TYPE_SET_V1.has(value as CalculationResultTypeV1)) {
    throw createInvalidScenarioPayloadError(
      `Scenario calculation summary entry at index ${entryIndex.toString()} has unsupported resultType "${value}".`,
      requestId,
    );
  }

  return value as CalculationResultTypeV1;
}

function parseScenarioCalculationSummaryEntryV1(
  candidate: unknown,
  requestId: string,
  entryIndex: number,
): CalculationSummaryV1["entries"][number] {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError(
      `Scenario calculation summary entry at index ${entryIndex.toString()} is not an object.`,
      requestId,
    );
  }

  const inputs = candidate.inputs;
  const outputs = candidate.outputs;
  const warnings = candidate.warnings;
  if (!isRecord(inputs)) {
    throw createInvalidScenarioPayloadError(
      `Scenario calculation summary entry at index ${entryIndex.toString()} is missing object inputs.`,
      requestId,
    );
  }

  if (!isRecord(outputs)) {
    throw createInvalidScenarioPayloadError(
      `Scenario calculation summary entry at index ${entryIndex.toString()} is missing object outputs.`,
      requestId,
    );
  }

  if (!Array.isArray(warnings) || warnings.some((warning) => typeof warning !== "string")) {
    throw createInvalidScenarioPayloadError(
      `Scenario calculation summary entry at index ${entryIndex.toString()} has invalid warnings.`,
      requestId,
    );
  }

  return {
    resultType: parseCalculationResultTypeV1(candidate.resultType, requestId, entryIndex),
    inputs,
    outputs,
    warnings,
  };
}

function parseScenarioCalculationSummaryV1(
  candidate: unknown,
  requestId: string,
): CalculationSummaryV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError(
      "Scenario calculation summary is not an object.",
      requestId,
    );
  }

  const { version, generatedAt, inputSignature, entries } = candidate;
  if (typeof version !== "number" || !Number.isInteger(version) || version <= 0) {
    throw createInvalidScenarioPayloadError(
      "Scenario calculation summary has invalid version.",
      requestId,
    );
  }

  if (typeof generatedAt !== "string" || generatedAt.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      "Scenario calculation summary is missing generatedAt.",
      requestId,
    );
  }

  if (typeof inputSignature !== "string" || inputSignature.length === 0) {
    throw createInvalidScenarioPayloadError(
      "Scenario calculation summary is missing inputSignature.",
      requestId,
    );
  }

  if (!Array.isArray(entries)) {
    throw createInvalidScenarioPayloadError(
      "Scenario calculation summary is missing entries list.",
      requestId,
    );
  }

  return {
    version,
    generatedAt,
    inputSignature,
    entries: entries.map((entry, entryIndex) =>
      parseScenarioCalculationSummaryEntryV1(entry, requestId, entryIndex),
    ),
  };
}

export function parseScenarioPayloadV1(candidate: unknown, requestId: string): ScenarioPayloadV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError("Scenario payload is not an object.", requestId);
  }

  // Intent: load/save payloads still arrive with both camelCase and legacy snake_case/top-level alias shapes, so payload parsing normalizes them into the current builder/runtime/calculation contract before the UI consumes the draft.
  const builderDraft = parseScenarioBuilderSnapshotV1(
    readFirstDefined(candidate, ["builderDraft", "builder_draft", "builder"]),
    requestId,
  );
  const runtimeSettings = parseScenarioRuntimeSettingsV1(
    readFirstDefined(candidate, ["runtimeSettings", "runtime_settings", "runtime"]),
    requestId,
  );
  const calculationSummaryCandidate = readFirstDefined(candidate, [
    "calculationSummary",
    "calculation_summary",
  ]);

  return {
    builderDraft,
    runtimeSettings,
    calculationSummary:
      calculationSummaryCandidate === undefined || calculationSummaryCandidate === null
        ? undefined
        : parseScenarioCalculationSummaryV1(calculationSummaryCandidate, requestId),
  };
}
