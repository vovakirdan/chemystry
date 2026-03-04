import type { FeatureFlags } from "../../config/featureFlags";

export const IPC_CONTRACT_VERSION_V1 = "v1" as const;

export const IPC_COMMANDS_V1 = {
  greet: "greet_v1",
  health: "health_v1",
  getFeatureFlags: "get_feature_flags_v1",
  listSubstances: "query_substances_v1",
} as const;

export type IpcVersionV1 = typeof IPC_CONTRACT_VERSION_V1;

export interface RequestScopedPayloadV1 {
  version: IpcVersionV1;
  requestId: string;
}

export interface GreetV1Input {
  name: string;
}

export interface GreetV1Output extends RequestScopedPayloadV1 {
  message: string;
}

export interface HealthV1Output extends RequestScopedPayloadV1 {
  status: "ok";
}

export interface GetFeatureFlagsV1Output extends RequestScopedPayloadV1 {
  featureFlags: FeatureFlags;
}

export const SUBSTANCE_PHASES_V1 = ["solid", "liquid", "gas", "aqueous"] as const;
export type SubstancePhaseV1 = (typeof SUBSTANCE_PHASES_V1)[number];

export const SUBSTANCE_SOURCES_V1 = ["builtin", "imported", "user"] as const;
export type SubstanceSourceV1 = (typeof SUBSTANCE_SOURCES_V1)[number];

export interface SubstanceCatalogEntryV1 {
  id: string;
  name: string;
  formula: string;
  phase: SubstancePhaseV1;
  source: SubstanceSourceV1;
  molarMassGMol: number | null;
}

export interface ListSubstancesV1Output extends RequestScopedPayloadV1 {
  substances: ReadonlyArray<SubstanceCatalogEntryV1>;
}

export type CommandErrorCategoryV1 = "validation" | "io" | "simulation" | "import" | "internal";

export interface CommandErrorV1 extends RequestScopedPayloadV1 {
  category: CommandErrorCategoryV1;
  code: string;
  message: string;
}
