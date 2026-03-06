import type { BuilderDraft } from "../../features/left-panel/model";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import type {
  CalculationResultTypeV1,
  CalculationSummaryEntryV1,
  CalculationSummaryV1,
} from "../../shared/contracts/ipc/v1";
import type { StoichiometryCalculationResult } from "../../shared/lib/stoichiometry";

const CALCULATION_SUMMARY_VERSION = 1;
const CALCULATION_EXPORT_FILENAME_PREFIX = "chemystery-calculation-summary";
const CALCULATION_RESULT_TYPE_ORDER: ReadonlyArray<CalculationResultTypeV1> = [
  "stoichiometry",
  "limiting_reagent",
  "yield",
  "conversion",
  "concentration",
];

function buildCalculationSummaryEntries(
  draft: BuilderDraft,
  runtimeSettings: RightPanelRuntimeSettings,
  stoichiometryResult: Extract<StoichiometryCalculationResult, { ok: true }>,
): ReadonlyArray<CalculationSummaryEntryV1> {
  const stoichiometryWarnings: string[] = [];
  const conversionWarnings = stoichiometryResult.derivedCalculations.gasCalculations
    .filter(
      (gasCalculation) => !gasCalculation.isAmountConsistent || !gasCalculation.isVolumeConsistent,
    )
    .map(
      (gasCalculation) =>
        `${gasCalculation.participantLabel}: gas amount/volume inputs are inconsistent with ideal-gas runtime assumptions.`,
    );

  const entriesByType: Record<CalculationResultTypeV1, CalculationSummaryEntryV1> = {
    stoichiometry: {
      resultType: "stoichiometry",
      inputs: {
        participants: draft.participants.map((participant) => ({
          id: participant.id,
          role: participant.role,
          phase: participant.phase,
          stoichCoeffInput: participant.stoichCoeffInput,
          amountMolInput: participant.amountMolInput,
        })),
      },
      outputs: {
        reactionExtentMol: stoichiometryResult.reactionExtentMol,
        participants: stoichiometryResult.participants.map((participant) => ({
          id: participant.id,
          role: participant.role,
          coefficient: participant.coefficient,
          initialAmountMol: participant.initialAmountMol,
          theoreticalAmountMol: participant.theoreticalAmountMol,
          consumedAmountMol: participant.consumedAmountMol,
          producedAmountMol: participant.producedAmountMol,
          remainingAmountMol: participant.remainingAmountMol,
        })),
      },
      warnings: stoichiometryWarnings,
    },
    limiting_reagent: {
      resultType: "limiting_reagent",
      inputs: {
        reactants: stoichiometryResult.participants
          .filter((participant) => participant.role === "reactant")
          .map((participant) => ({
            id: participant.id,
            coefficient: participant.coefficient,
            initialAmountMol: participant.initialAmountMol,
          })),
      },
      outputs: {
        limitingReactants: stoichiometryResult.limitingReactants.map((reactant) => ({
          id: reactant.id,
          label: reactant.label,
          coefficient: reactant.coefficient,
          availableAmountMol: reactant.availableAmountMol,
          maxReactionExtentMol: reactant.maxReactionExtentMol,
        })),
      },
      warnings: [],
    },
    yield: {
      resultType: "yield",
      inputs: {
        products: stoichiometryResult.participants
          .filter((participant) => participant.role === "product")
          .map((participant) => ({
            id: participant.id,
            theoreticalAmountMol: participant.theoreticalAmountMol,
            actualYieldAmountMol: participant.actualYieldAmountMol,
          })),
      },
      outputs: {
        products: stoichiometryResult.participants
          .filter((participant) => participant.role === "product")
          .map((participant) => ({
            id: participant.id,
            label: participant.label,
            percentYield: participant.percentYield,
          })),
      },
      warnings: [],
    },
    conversion: {
      resultType: "conversion",
      inputs: {
        runtime: {
          temperatureC: runtimeSettings.temperatureC,
          pressureAtm: runtimeSettings.pressureAtm,
          gasMedium: runtimeSettings.gasMedium,
        },
        gasParticipants: draft.participants
          .filter((participant) => participant.phase === "gas")
          .map((participant) => ({
            id: participant.id,
            amountMolInput: participant.amountMolInput,
            volumeLInput: participant.volumeLInput,
          })),
      },
      outputs: {
        gasRuntime: stoichiometryResult.derivedCalculations.gasRuntime,
        gasCalculations: stoichiometryResult.derivedCalculations.gasCalculations,
      },
      warnings: conversionWarnings,
    },
    concentration: {
      resultType: "concentration",
      inputs: {
        participants: draft.participants.map((participant) => ({
          id: participant.id,
          phase: participant.phase,
          amountMolInput: participant.amountMolInput,
          volumeLInput: participant.volumeLInput,
        })),
      },
      outputs: {
        concentrations: stoichiometryResult.derivedCalculations.concentrations,
      },
      warnings: [],
    },
  };

  return CALCULATION_RESULT_TYPE_ORDER.map((resultType) => entriesByType[resultType]);
}

export function buildCalculationSummary(
  draft: BuilderDraft | null,
  runtimeSettings: RightPanelRuntimeSettings,
  stoichiometryResult: StoichiometryCalculationResult,
  inputSignature: string,
): CalculationSummaryV1 | null {
  if (draft === null || !stoichiometryResult.ok) {
    return null;
  }

  return {
    version: CALCULATION_SUMMARY_VERSION,
    generatedAt: new Date().toISOString(),
    inputSignature,
    entries: buildCalculationSummaryEntries(draft, runtimeSettings, stoichiometryResult),
  };
}

export function toSafeCalculationExportFileNameSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/gu, "-");
  const sanitized = normalized.replace(/[^a-z0-9-_]/gu, "");
  return sanitized.length > 0 ? sanitized : "scenario";
}

export function createCalculationExportFileName(baseName: string): string {
  const now = new Date();
  const pad = (value: number): string => value.toString().padStart(2, "0");
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${CALCULATION_EXPORT_FILENAME_PREFIX}-${toSafeCalculationExportFileNameSegment(baseName)}-${timestamp}.json`;
}

function exportJsonToLocalFile(fileName: string, payload: unknown): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Local export is unavailable in the current environment.");
  }

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function exportCalculationSummary(
  summary: CalculationSummaryV1,
  exportBaseName: string,
): void {
  const exportPayload = {
    version: summary.version,
    exportedAt: new Date().toISOString(),
    scenario: {
      name: exportBaseName,
      inputSignature: summary.inputSignature,
    },
    entries: summary.entries,
  };

  exportJsonToLocalFile(createCalculationExportFileName(exportBaseName), exportPayload);
}
