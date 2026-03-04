export const IPC_CONTRACT_VERSION_V1 = "v1" as const;

export const IPC_COMMANDS_V1 = {
  greet: "greet_v1",
  health: "health_v1",
} as const;

export type IpcVersionV1 = typeof IPC_CONTRACT_VERSION_V1;

export interface GreetV1Input {
  name: string;
}

export interface GreetV1Output {
  version: IpcVersionV1;
  message: string;
}

export interface HealthV1Output {
  version: IpcVersionV1;
  status: "ok";
}

export interface CommandErrorV1 {
  version: IpcVersionV1;
  category: "validation" | "internal";
  code: string;
  message: string;
}
