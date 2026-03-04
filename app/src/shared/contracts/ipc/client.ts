import { invoke } from "@tauri-apps/api/core";
import {
  IPC_COMMANDS_V1,
  IPC_CONTRACT_VERSION_V1,
  type CommandErrorV1,
  type GreetV1Input,
  type GreetV1Output,
  type HealthV1Output,
} from "./v1";

function isCommandErrorV1(value: unknown): value is CommandErrorV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<CommandErrorV1>;
  return (
    candidate.version === IPC_CONTRACT_VERSION_V1 &&
    typeof candidate.category === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

function normalizeCommandErrorV1(error: unknown): CommandErrorV1 {
  if (isCommandErrorV1(error)) {
    return error;
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
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
