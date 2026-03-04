import { invoke } from "@tauri-apps/api/core";
import {
  IPC_COMMANDS_V1,
  IPC_CONTRACT_VERSION_V1,
  type CommandErrorCategoryV1,
  type CommandErrorV1,
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
};

const USER_MESSAGE_BY_CATEGORY_V1: Record<CommandErrorCategoryV1, string> = {
  validation: "Please correct the input and try again.",
  io: "Could not access required files. Please retry.",
  simulation: "Simulation failed. Review inputs and retry.",
  import: "Import failed. Check the file format and try again.",
  internal: "Unexpected backend error. Please retry.",
};

let clientRequestSequence = 0;

function nextClientRequestId(): string {
  clientRequestSequence += 1;
  return `req-client-${Date.now().toString(36)}-${clientRequestSequence.toString(36)}`;
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
