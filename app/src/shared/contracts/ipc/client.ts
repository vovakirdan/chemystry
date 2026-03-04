import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlags,
  withFeatureFlagDefaults,
} from "../../config/featureFlags";
import {
  IPC_COMMANDS_V1,
  IPC_CONTRACT_VERSION_V1,
  type CommandErrorCategoryV1,
  type CommandErrorV1,
  type GetFeatureFlagsV1Output,
  type GreetV1Input,
  type GreetV1Output,
  type HealthV1Output,
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
