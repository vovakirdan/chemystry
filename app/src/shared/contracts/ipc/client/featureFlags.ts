import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlags,
  withFeatureFlagDefaults,
} from "../../../config/featureFlags";
import {
  IPC_COMMANDS_V1,
  IPC_CONTRACT_VERSION_V1,
  type CommandErrorV1,
  type GetFeatureFlagsV1Output,
} from "../v1";

import { normalizeCommandErrorV1, toUserFacingMessageV1 } from "./errors";
import { isFeatureFlags } from "./guards";
import { nextClientRequestId } from "./requestId";

export interface ResolvedFeatureFlagsV1 {
  flags: Readonly<FeatureFlags>;
  source: "backend" | "fallback";
  requestId: string;
  warning?: string;
}

export async function getFeatureFlagsV1(): Promise<GetFeatureFlagsV1Output> {
  try {
    return await invoke<GetFeatureFlagsV1Output>(IPC_COMMANDS_V1.getFeatureFlags);
  } catch (error) {
    throw normalizeCommandErrorV1(error);
  }
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

// Intent: resolveFeatureFlagsV1 keeps desktop boot resilient by falling back to local defaults whenever backend flags are unavailable or malformed, while still surfacing the backend requestId/warning for diagnostics.
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
