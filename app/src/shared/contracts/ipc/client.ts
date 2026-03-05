import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlags,
  withFeatureFlagDefaults,
} from "../../config/featureFlags";
import {
  CALCULATION_RESULT_TYPES_V1,
  BUILDER_PARTICIPANT_ROLES_V1,
  GAS_MEDIA_V1,
  type CalculationResultTypeV1,
  type CalculationSummaryV1,
  type CreateSubstanceV1Input,
  type CreateSubstanceV1Output,
  type DeleteSubstanceV1Input,
  type DeleteSubstanceV1Output,
  type ImportSdfMolV1Input,
  type ImportSdfMolV1Output,
  IPC_COMMANDS_V1,
  IPC_CONTRACT_VERSION_V1,
  type ListScenariosV1Output,
  type LoadScenarioV1Input,
  type LoadScenarioV1Output,
  PRECISION_PROFILES_V1,
  REACTION_CLASSES_V1,
  type SaveScenarioV1Input,
  type SaveScenarioV1Output,
  type ScenarioBuilderSnapshotV1,
  type ScenarioParticipantSnapshotV1,
  type ScenarioPayloadV1,
  type ScenarioRuntimeSettingsV1,
  type ScenarioSummaryV1,
  SUBSTANCE_PHASES_V1,
  SUBSTANCE_SOURCES_V1,
  type BuilderParticipantRoleV1,
  type CommandErrorCategoryV1,
  type CommandErrorV1,
  type GasMediumV1,
  type GetFeatureFlagsV1Output,
  type GreetV1Input,
  type GreetV1Output,
  type HealthV1Output,
  type ListPresetsV1Output,
  type ListSubstancesV1Output,
  type PrecisionProfileV1,
  type PresetCatalogEntryV1,
  type ReactionClassV1,
  type SubstanceCatalogEntryV1,
  type SubstanceMutationV1Output,
  type SubstancePhaseV1,
  type SubstanceSourceV1,
  type UpdateSubstanceV1Input,
  type UpdateSubstanceV1Output,
} from "./v1";

const COMMAND_ERROR_CATEGORIES_V1: ReadonlySet<CommandErrorCategoryV1> = new Set([
  "validation",
  "io",
  "simulation",
  "import",
  "internal",
]);

const USER_MESSAGE_BY_CODE_V1: Record<string, string> = {
  NAME_REQUIRED: "Enter a name before greeting.",
  NAME_TOO_LONG: "Name must be 64 characters or fewer.",
  FEATURE_DISABLED: "This module is disabled by configuration.",
  INVALID_SUBSTANCE_PAYLOAD: "Substance catalog data is invalid. Please retry.",
  INVALID_PRESET_PAYLOAD: "Preset library data is invalid. Please retry.",
  INVALID_IMPORT_PAYLOAD: "Import payload is invalid. Please retry.",
  INVALID_SCENARIO_PAYLOAD: "Scenario data is invalid. Please retry.",
};

const USER_MESSAGE_BY_CATEGORY_V1: Record<CommandErrorCategoryV1, string> = {
  validation: "Please correct the input and try again.",
  io: "Could not access required files. Please retry.",
  simulation: "Simulation failed. Review inputs and retry.",
  import: "Import failed. Check the file format and try again.",
  internal: "Unexpected backend error. Please retry.",
};

let clientRequestSequence = 0;

export interface ResolvedFeatureFlagsV1 {
  flags: Readonly<FeatureFlags>;
  source: "backend" | "fallback";
  requestId: string;
  warning?: string;
}

const SUBSTANCE_PHASE_SET_V1: ReadonlySet<SubstancePhaseV1> = new Set(SUBSTANCE_PHASES_V1);
const SUBSTANCE_SOURCE_SET_V1: ReadonlySet<SubstanceSourceV1> = new Set(SUBSTANCE_SOURCES_V1);
const REACTION_CLASS_SET_V1: ReadonlySet<ReactionClassV1> = new Set(REACTION_CLASSES_V1);
const BUILDER_PARTICIPANT_ROLE_SET_V1: ReadonlySet<BuilderParticipantRoleV1> = new Set(
  BUILDER_PARTICIPANT_ROLES_V1,
);
const GAS_MEDIUM_SET_V1: ReadonlySet<GasMediumV1> = new Set(GAS_MEDIA_V1);
const PRECISION_PROFILE_SET_V1: ReadonlySet<PrecisionProfileV1> = new Set(PRECISION_PROFILES_V1);
const CALCULATION_RESULT_TYPE_SET_V1: ReadonlySet<CalculationResultTypeV1> = new Set(
  CALCULATION_RESULT_TYPES_V1,
);

function nextClientRequestId(): string {
  clientRequestSequence += 1;
  return `req-client-${Date.now().toString(36)}-${clientRequestSequence.toString(36)}`;
}

function isFeatureFlags(value: unknown): value is FeatureFlags {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FeatureFlags>;
  return (
    typeof candidate.simulation === "boolean" &&
    typeof candidate.importExport === "boolean" &&
    typeof candidate.advancedPrecision === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createInvalidSubstancePayloadError(
  message: string,
  requestId: string = nextClientRequestId(),
): CommandErrorV1 {
  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    category: "internal",
    code: "INVALID_SUBSTANCE_PAYLOAD",
    message,
  };
}

function createInvalidPresetPayloadError(
  message: string,
  requestId: string = nextClientRequestId(),
): CommandErrorV1 {
  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    category: "internal",
    code: "INVALID_PRESET_PAYLOAD",
    message,
  };
}

function createInvalidImportPayloadError(
  message: string,
  requestId: string = nextClientRequestId(),
): CommandErrorV1 {
  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    category: "internal",
    code: "INVALID_IMPORT_PAYLOAD",
    message,
  };
}

function createInvalidScenarioPayloadError(
  message: string,
  requestId: string = nextClientRequestId(),
): CommandErrorV1 {
  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    category: "internal",
    code: "INVALID_SCENARIO_PAYLOAD",
    message,
  };
}

function readFirstDefined(
  candidate: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): unknown {
  for (const key of keys) {
    if (candidate[key] !== undefined) {
      return candidate[key];
    }
  }

  return undefined;
}

function parseSubstancePhaseV1(value: unknown): SubstancePhaseV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return SUBSTANCE_PHASE_SET_V1.has(value as SubstancePhaseV1) ? (value as SubstancePhaseV1) : null;
}

function parseSubstanceSourceV1(value: unknown): SubstanceSourceV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedSource = value === "user_defined" ? "user" : value;
  return SUBSTANCE_SOURCE_SET_V1.has(normalizedSource as SubstanceSourceV1)
    ? (normalizedSource as SubstanceSourceV1)
    : null;
}

function parseSubstanceMolarMassV1(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseReactionClassV1(value: unknown): ReactionClassV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return REACTION_CLASS_SET_V1.has(value as ReactionClassV1) ? (value as ReactionClassV1) : null;
}

function parseBuilderParticipantRoleV1(value: unknown): BuilderParticipantRoleV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return BUILDER_PARTICIPANT_ROLE_SET_V1.has(value as BuilderParticipantRoleV1)
    ? (value as BuilderParticipantRoleV1)
    : null;
}

function parsePrecisionProfileV1(value: unknown): PrecisionProfileV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return PRECISION_PROFILE_SET_V1.has(value as PrecisionProfileV1)
    ? (value as PrecisionProfileV1)
    : null;
}

function parseGasMediumV1(value: unknown): GasMediumV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return GAS_MEDIUM_SET_V1.has(value as GasMediumV1) ? (value as GasMediumV1) : null;
}

function parsePresetEntryV1(
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

function parseSubstanceEntryV1(
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

  return {
    id,
    name,
    formula,
    phase,
    source,
    molarMassGMol: molarMass,
  };
}

function parseScenarioSummaryV1(
  candidate: unknown,
  requestId: string,
  context: string,
): ScenarioSummaryV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary ${context} is not an object.`,
      requestId,
    );
  }

  const id = candidate.id;
  const name = candidate.name;
  const createdAt = readFirstDefined(candidate, ["createdAt", "created_at"]);
  const updatedAt = readFirstDefined(candidate, ["updatedAt", "updated_at"]);

  if (typeof id !== "string" || id.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary ${context} is missing a valid id.`,
      requestId,
    );
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary "${id}" is missing a valid name.`,
      requestId,
    );
  }

  if (typeof createdAt !== "string" || createdAt.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary "${id}" is missing a valid createdAt.`,
      requestId,
    );
  }

  const resolvedUpdatedAt = updatedAt === undefined || updatedAt === null ? createdAt : updatedAt;
  if (typeof resolvedUpdatedAt !== "string" || resolvedUpdatedAt.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary "${id}" is missing a valid updatedAt.`,
      requestId,
    );
  }

  return {
    id: id.trim(),
    name: name.trim(),
    createdAt: createdAt.trim(),
    updatedAt: resolvedUpdatedAt.trim(),
  };
}

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

function parseScenarioPayloadV1(candidate: unknown, requestId: string): ScenarioPayloadV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError("Scenario payload is not an object.", requestId);
  }

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

function parseListSubstancesV1Output(payload: unknown): ListSubstancesV1Output {
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

function parseListPresetsV1Output(payload: unknown): ListPresetsV1Output {
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

function parseSubstanceMutationV1Output(payload: unknown): SubstanceMutationV1Output {
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

function parseDeleteSubstanceV1Output(payload: unknown): DeleteSubstanceV1Output {
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

function parseImportSdfMolV1Output(payload: unknown): ImportSdfMolV1Output {
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

function parseListScenariosV1Output(payload: unknown): ListScenariosV1Output {
  if (!isRecord(payload)) {
    throw createInvalidScenarioPayloadError("Scenario list payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidScenarioPayloadError("Scenario list payload version is invalid.", requestId);
  }

  if (!Array.isArray(payload.scenarios)) {
    throw createInvalidScenarioPayloadError(
      "Scenario list payload is missing scenarios list.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    scenarios: payload.scenarios.map((scenario, index) =>
      parseScenarioSummaryV1(scenario, requestId, `at index ${index.toString()}`),
    ),
  };
}

function parseSaveScenarioV1Output(payload: unknown): SaveScenarioV1Output {
  if (!isRecord(payload)) {
    throw createInvalidScenarioPayloadError("Save scenario payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidScenarioPayloadError("Save scenario payload version is invalid.", requestId);
  }

  const scenarioId = readFirstDefined(payload, ["scenarioId", "scenario_id", "id"]);
  const scenarioName = readFirstDefined(payload, ["scenarioName", "scenario_name", "name"]);
  const createdAt = readFirstDefined(payload, ["createdAt", "created_at"]);
  const updatedAt = readFirstDefined(payload, ["updatedAt", "updated_at"]);

  if (typeof payload.updated !== "boolean") {
    throw createInvalidScenarioPayloadError(
      "Save scenario payload is missing updated flag.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    scenario: parseScenarioSummaryV1(
      {
        id: scenarioId,
        name: scenarioName,
        createdAt,
        updatedAt: updatedAt ?? createdAt,
      },
      requestId,
      "in save output",
    ),
    updated: payload.updated,
  };
}

function parseLoadScenarioV1Output(payload: unknown): LoadScenarioV1Output {
  if (!isRecord(payload)) {
    throw createInvalidScenarioPayloadError("Load scenario payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidScenarioPayloadError("Load scenario payload version is invalid.", requestId);
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    scenarioId: (() => {
      const scenarioId = readFirstDefined(payload, ["scenarioId", "scenario_id", "id"]);
      if (typeof scenarioId !== "string" || scenarioId.trim().length === 0) {
        throw createInvalidScenarioPayloadError(
          "Load scenario payload is missing a valid scenarioId.",
          requestId,
        );
      }
      return scenarioId.trim();
    })(),
    scenarioName: (() => {
      const scenarioName = readFirstDefined(payload, ["scenarioName", "scenario_name", "name"]);
      if (typeof scenarioName !== "string" || scenarioName.trim().length === 0) {
        throw createInvalidScenarioPayloadError(
          "Load scenario payload is missing a valid scenarioName.",
          requestId,
        );
      }
      return scenarioName.trim();
    })(),
    payload: parseScenarioPayloadV1(payload, requestId),
  };
}

function isCommandErrorCategoryV1(value: unknown): value is CommandErrorCategoryV1 {
  return (
    typeof value === "string" && COMMAND_ERROR_CATEGORIES_V1.has(value as CommandErrorCategoryV1)
  );
}

export function isCommandErrorV1(value: unknown): value is CommandErrorV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<CommandErrorV1>;
  return (
    candidate.version === IPC_CONTRACT_VERSION_V1 &&
    typeof candidate.requestId === "string" &&
    isCommandErrorCategoryV1(candidate.category) &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

export function toUserFacingMessageV1(error: CommandErrorV1): string {
  return USER_MESSAGE_BY_CODE_V1[error.code] ?? USER_MESSAGE_BY_CATEGORY_V1[error.category];
}

export function normalizeCommandErrorV1(error: unknown): CommandErrorV1 {
  if (isCommandErrorV1(error)) {
    return error;
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId: nextClientRequestId(),
    category: "internal",
    code: "IPC_INVOKE_FAILED",
    message: error instanceof Error ? error.message : String(error),
  };
}

export function ensureFeatureEnabledV1(
  featureFlags: Readonly<FeatureFlags>,
  feature: FeatureFlagKey,
  requestId: string = nextClientRequestId(),
): void {
  if (featureFlags[feature]) {
    return;
  }

  throw {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    category: "internal",
    code: "FEATURE_DISABLED",
    message: `Feature "${feature}" is disabled by configuration.`,
  } satisfies CommandErrorV1;
}

export async function greetV1(input: GreetV1Input): Promise<GreetV1Output> {
  try {
    return await invoke<GreetV1Output>(IPC_COMMANDS_V1.greet, { input });
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function healthV1(): Promise<HealthV1Output> {
  try {
    return await invoke<HealthV1Output>(IPC_COMMANDS_V1.health);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function getFeatureFlagsV1(): Promise<GetFeatureFlagsV1Output> {
  try {
    return await invoke<GetFeatureFlagsV1Output>(IPC_COMMANDS_V1.getFeatureFlags);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function listSubstancesV1(): Promise<ListSubstancesV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.listSubstances, {
      input: {},
    });
    return parseListSubstancesV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function listPresetsV1(): Promise<ListPresetsV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.listPresets, {
      input: {},
    });
    return parseListPresetsV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function listScenariosV1(): Promise<ListScenariosV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.listScenarios, {
      input: {},
    });
    return parseListScenariosV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function createSubstanceV1(
  input: CreateSubstanceV1Input,
): Promise<CreateSubstanceV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.createSubstance, { input });
    return parseSubstanceMutationV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function updateSubstanceV1(
  input: UpdateSubstanceV1Input,
): Promise<UpdateSubstanceV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.updateSubstance, { input });
    return parseSubstanceMutationV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function deleteSubstanceV1(
  input: DeleteSubstanceV1Input,
): Promise<DeleteSubstanceV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.deleteSubstance, { input });
    return parseDeleteSubstanceV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function importSdfMolV1(input: ImportSdfMolV1Input): Promise<ImportSdfMolV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.importSdfMol, { input });
    return parseImportSdfMolV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function saveScenarioV1(input: SaveScenarioV1Input): Promise<SaveScenarioV1Output> {
  try {
    const commandInput: {
      scenarioId?: string;
      scenarioName: string;
      builder: ScenarioBuilderSnapshotV1;
      runtime: ScenarioRuntimeSettingsV1;
      calculationSummary?: CalculationSummaryV1;
    } = {
      scenarioName: input.name,
      builder: input.payload.builderDraft,
      runtime: input.payload.runtimeSettings,
    };

    if (input.payload.calculationSummary !== undefined) {
      commandInput.calculationSummary = input.payload.calculationSummary;
    }

    if (input.scenarioId !== undefined) {
      commandInput.scenarioId = input.scenarioId;
    }

    const payload = await invoke<unknown>(IPC_COMMANDS_V1.saveScenario, {
      input: commandInput,
    });
    return parseSaveScenarioV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function loadScenarioV1(input: LoadScenarioV1Input): Promise<LoadScenarioV1Output> {
  try {
    const payload = await invoke<unknown>(IPC_COMMANDS_V1.loadScenario, {
      input: {
        scenarioId: input.id,
      },
    });
    return parseLoadScenarioV1Output(payload);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
}

export async function resolveFeatureFlagsV1(): Promise<ResolvedFeatureFlagsV1> {
  try {
    const result = await getFeatureFlagsV1();

    if (!isFeatureFlags(result.featureFlags)) {
      return {
        flags: DEFAULT_FEATURE_FLAGS,
        source: "fallback",
        requestId: result.requestId,
        warning: "Feature flags payload from backend is invalid. Fallback defaults were applied.",
      };
    }

    return {
      flags: withFeatureFlagDefaults(result.featureFlags),
      source: "backend",
      requestId: result.requestId,
    };
  } catch (error) {
    const normalizedError = normalizeCommandErrorV1(error);

    return {
      flags: DEFAULT_FEATURE_FLAGS,
      source: "fallback",
      requestId: normalizedError.requestId,
      warning: `${toUserFacingMessageV1(normalizedError)} [${normalizedError.code}]`,
    };
  }
}
