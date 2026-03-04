import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlags,
  withFeatureFlagDefaults,
} from "../../config/featureFlags";
import {
  type CreateSubstanceV1Input,
  type CreateSubstanceV1Output,
  type DeleteSubstanceV1Input,
  type DeleteSubstanceV1Output,
  IPC_COMMANDS_V1,
  IPC_CONTRACT_VERSION_V1,
  SUBSTANCE_PHASES_V1,
  SUBSTANCE_SOURCES_V1,
  type CommandErrorCategoryV1,
  type CommandErrorV1,
  type GetFeatureFlagsV1Output,
  type GreetV1Input,
  type GreetV1Output,
  type HealthV1Output,
  type ListSubstancesV1Output,
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
