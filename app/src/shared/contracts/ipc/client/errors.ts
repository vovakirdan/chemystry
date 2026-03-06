import { IPC_CONTRACT_VERSION_V1, type CommandErrorCategoryV1, type CommandErrorV1 } from "../v1";

import { nextClientRequestId } from "./requestId";

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

export function createInvalidSubstancePayloadError(
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

export function createInvalidPresetPayloadError(
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

export function createInvalidImportPayloadError(
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

export function createInvalidScenarioPayloadError(
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

// Intent: normalizeCommandErrorV1 preserves backend-provided typed errors as-is and only synthesizes the generic fallback when transport/runtime failures escape invoke.
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
