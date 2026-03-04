export const FEATURE_FLAG_KEYS = ["simulation", "importExport", "advancedPrecision"] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export interface FeatureFlags {
  simulation: boolean;
  importExport: boolean;
  advancedPrecision: boolean;
}

export const DEFAULT_FEATURE_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  simulation: true,
  importExport: true,
  advancedPrecision: true,
});

export function withFeatureFlagDefaults(
  candidate: Partial<FeatureFlags> | undefined,
): Readonly<FeatureFlags> {
  if (!candidate) {
    return DEFAULT_FEATURE_FLAGS;
  }

  return {
    simulation: candidate.simulation ?? DEFAULT_FEATURE_FLAGS.simulation,
    importExport: candidate.importExport ?? DEFAULT_FEATURE_FLAGS.importExport,
    advancedPrecision: candidate.advancedPrecision ?? DEFAULT_FEATURE_FLAGS.advancedPrecision,
  };
}
