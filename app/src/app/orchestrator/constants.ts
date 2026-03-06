import type { FeatureFlagKey } from "../../shared/config/featureFlags";
import type { ImportXyzInferenceSummaryV1 } from "../../shared/contracts/ipc/v1";

export const FEATURE_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Simulation",
  importExport: "Import/export",
  advancedPrecision: "Advanced precision",
};

export const FEATURE_ACTION_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Try simulation path",
  importExport: "Try import/export path",
  advancedPrecision: "Try advanced precision path",
};

export const FEATURE_KEYS: ReadonlyArray<FeatureFlagKey> = [
  "simulation",
  "importExport",
  "advancedPrecision",
];

export function formatXyzInferenceNotificationSummary(
  summaries: ReadonlyArray<ImportXyzInferenceSummaryV1>,
): string {
  if (summaries.length === 0) {
    return (
      "No inferred bonds were detected in the imported records " +
      "(possible for isolated atoms or large inter-atom distances)."
    );
  }

  const preview = summaries
    .slice(0, 3)
    .map(
      (summary) =>
        `record ${summary.recordIndex}: bonds=${summary.inferredBondCount}, avg=${summary.avgConfidence.toFixed(2)}, min=${summary.minConfidence.toFixed(2)}`,
    )
    .join("; ");
  const suffix = summaries.length > 3 ? `; +${(summaries.length - 3).toString()} more` : "";

  return `XYZ bond confidence (heuristic): ${preview}${suffix}.`;
}
