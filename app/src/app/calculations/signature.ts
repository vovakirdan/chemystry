import type { SceneParticipantVisual } from "../../features/center-panel/sceneLifecycle";
import type { BuilderDraft } from "../../features/left-panel/model";
import type {
  EnvironmentDerivedMetrics,
  RightPanelRuntimeSettings,
} from "../../features/right-panel/RightPanelSkeleton";
import type { ParticleModelEnvironment } from "../../features/simulation/particleModel";
import type { SubstanceCatalogEntryV1, SubstancePhaseV1 } from "../../shared/contracts/ipc/v1";
import {
  calculateStoichiometry,
  type StoichiometryCalculationResult,
} from "../../shared/lib/stoichiometry";
import type { BuilderRuntimeSnapshot } from "../simulation/lifecycle";
import {
  createBuilderParticipantLabelLookup,
  resolveBuilderParticipantLabel,
} from "../validation/launchValidation";

const MIN_TEMPERATURE_C = -273.15;
const MAX_TEMPERATURE_C = 1000;
const MIN_PRESSURE_ATM = 0.1;
const MAX_PRESSURE_ATM = 50;
const IDEAL_GAS_CONSTANT_L_ATM_PER_MOL_K = 0.082057338;
const CELSIUS_TO_KELVIN_OFFSET = 273.15;

type CalculationCatalogSignatureItem = {
  participantId: string;
  substanceId: string;
  name: string | null;
  formula: string | null;
  phase: SubstancePhaseV1 | null;
  molarMassGMol: number | null;
};

function createCalculationCatalogSignatureContext(
  draft: BuilderDraft | null,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): ReadonlyArray<CalculationCatalogSignatureItem> {
  if (draft === null) {
    return [];
  }

  return draft.participants.map((participant) => {
    const substance =
      substances.find((candidate) => candidate.id === participant.substanceId) ?? null;
    return {
      participantId: participant.id,
      substanceId: participant.substanceId,
      name: substance?.name ?? null,
      formula: substance?.formula ?? null,
      phase: substance?.phase ?? null,
      molarMassGMol: substance?.molarMassGMol ?? null,
    };
  });
}

export function createCalculationInputSignature(
  draft: BuilderDraft | null,
  runtimeSettings: RightPanelRuntimeSettings,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): string {
  const calculationCatalogContext = createCalculationCatalogSignatureContext(draft, substances);
  return JSON.stringify({
    builder:
      draft === null
        ? null
        : {
            title: draft.title,
            reactionClass: draft.reactionClass,
            equation: draft.equation,
            description: draft.description,
            participants: draft.participants.map((participant) => ({
              id: participant.id,
              substanceId: participant.substanceId,
              role: participant.role,
              phase: participant.phase,
              stoichCoeffInput: participant.stoichCoeffInput,
              amountMolInput: participant.amountMolInput,
              massGInput: participant.massGInput,
              volumeLInput: participant.volumeLInput,
            })),
          },
    runtimeSettings: {
      temperatureC: runtimeSettings.temperatureC,
      pressureAtm: runtimeSettings.pressureAtm,
      gasMedium: runtimeSettings.gasMedium,
      calculationPasses: runtimeSettings.calculationPasses,
      precisionProfile: runtimeSettings.precisionProfile,
      fpsLimit: runtimeSettings.fpsLimit,
    },
    catalogContext: calculationCatalogContext,
  });
}

export function isCalculationSummaryStale(
  currentInputSignature: string,
  persistedInputSignature: string | null,
): boolean {
  return persistedInputSignature !== null && persistedInputSignature !== currentInputSignature;
}

export function buildSceneParticipants(
  builderDraft: BuilderDraft | null,
  allSubstances: ReadonlyArray<SubstanceCatalogEntryV1>,
): ReadonlyArray<SceneParticipantVisual> {
  if (builderDraft === null) {
    return [];
  }

  const labelsByParticipantId = createBuilderParticipantLabelLookup(builderDraft, allSubstances);
  return builderDraft.participants.map((participant, index) => {
    const substance = allSubstances.find((entry) => entry.id === participant.substanceId);
    return {
      id: participant.id,
      label: resolveBuilderParticipantLabel(participant.id, index, labelsByParticipantId),
      formula: substance?.formula ?? "Unknown",
      role: participant.role,
      phase: participant.phase,
    };
  });
}

export function buildStoichiometryResult(
  draft: BuilderDraft | null,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
  runtimeSettings: RightPanelRuntimeSettings,
): StoichiometryCalculationResult {
  if (draft === null) {
    return calculateStoichiometry({
      participants: [],
      runtimeSettings: {
        temperatureC: runtimeSettings.temperatureC,
        pressureAtm: runtimeSettings.pressureAtm,
      },
    });
  }

  const labelsByParticipantId = createBuilderParticipantLabelLookup(draft, substances);

  return calculateStoichiometry({
    participants: draft.participants.map((participant, participantIndex) => ({
      id: participant.id,
      label: resolveBuilderParticipantLabel(
        participant.id,
        participantIndex,
        labelsByParticipantId,
      ),
      role: participant.role,
      stoichCoeffInput: participant.stoichCoeffInput,
      amountMolInput: participant.amountMolInput,
      phase: participant.phase,
      volumeLInput: participant.volumeLInput,
      actualYieldMolInput: participant.role === "product" ? participant.amountMolInput : undefined,
    })),
    runtimeSettings: {
      temperatureC: runtimeSettings.temperatureC,
      pressureAtm: runtimeSettings.pressureAtm,
    },
  });
}

export function deriveParticleModelEnvironment(
  settings: RightPanelRuntimeSettings,
): ParticleModelEnvironment {
  const temperatureK =
    settings.temperatureC === null || !Number.isFinite(settings.temperatureC)
      ? 298.15
      : Math.max(0.01, settings.temperatureC + CELSIUS_TO_KELVIN_OFFSET);
  const pressureAtm =
    settings.pressureAtm === null || !Number.isFinite(settings.pressureAtm)
      ? 1
      : Math.max(0.0001, settings.pressureAtm);

  return {
    temperatureK,
    pressureAtm,
    medium: settings.gasMedium,
  };
}

function resolveCollisionMediumFactor(medium: ParticleModelEnvironment["medium"]): number {
  switch (medium) {
    case "liquid":
      return 0.82;
    case "vacuum":
      return 0.3;
    case "gas":
    default:
      return 1;
  }
}

export function buildEnvironmentDerivedMetrics(
  runtimeSettings: RightPanelRuntimeSettings,
  baselineSnapshot: BuilderRuntimeSnapshot | null,
): EnvironmentDerivedMetrics {
  const currentEnvironment = deriveParticleModelEnvironment(runtimeSettings);
  const currentGasMolarVolumeLPerMol =
    currentEnvironment.pressureAtm <= 0
      ? null
      : (IDEAL_GAS_CONSTANT_L_ATM_PER_MOL_K * currentEnvironment.temperatureK) /
        currentEnvironment.pressureAtm;
  const currentCollisionRateIndex =
    currentEnvironment.pressureAtm *
    Math.sqrt(Math.max(currentEnvironment.temperatureK, 0.01) / 298.15) *
    resolveCollisionMediumFactor(currentEnvironment.medium);

  const baselineEnvironment =
    baselineSnapshot === null
      ? null
      : deriveParticleModelEnvironment(baselineSnapshot.runtimeSettings);
  const baselineGasMolarVolumeLPerMol =
    baselineEnvironment === null || baselineEnvironment.pressureAtm <= 0
      ? null
      : (IDEAL_GAS_CONSTANT_L_ATM_PER_MOL_K * baselineEnvironment.temperatureK) /
        baselineEnvironment.pressureAtm;
  const baselineCollisionRateIndex =
    baselineEnvironment === null
      ? null
      : baselineEnvironment.pressureAtm *
        Math.sqrt(Math.max(baselineEnvironment.temperatureK, 0.01) / 298.15) *
        resolveCollisionMediumFactor(baselineEnvironment.medium);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (runtimeSettings.temperatureC === null) {
    errors.push("Temperature is missing. Derived metrics may be incomplete.");
  } else if (
    runtimeSettings.temperatureC <= MIN_TEMPERATURE_C ||
    runtimeSettings.temperatureC > MAX_TEMPERATURE_C
  ) {
    errors.push(
      `Temperature is out of supported range (${MIN_TEMPERATURE_C}°C to ${MAX_TEMPERATURE_C}°C).`,
    );
  }

  if (runtimeSettings.pressureAtm === null) {
    errors.push("Pressure is missing. Derived metrics may be incomplete.");
  } else if (
    runtimeSettings.pressureAtm < MIN_PRESSURE_ATM ||
    runtimeSettings.pressureAtm > MAX_PRESSURE_ATM
  ) {
    errors.push(
      `Pressure is out of supported range (${MIN_PRESSURE_ATM} to ${MAX_PRESSURE_ATM} atm).`,
    );
  }

  if (
    runtimeSettings.gasMedium === "vacuum" &&
    runtimeSettings.pressureAtm !== null &&
    runtimeSettings.pressureAtm > 0.2
  ) {
    warnings.push(
      "Vacuum medium is selected while pressure is relatively high; results may be inconsistent.",
    );
  }

  if (
    runtimeSettings.gasMedium === "liquid" &&
    runtimeSettings.pressureAtm !== null &&
    runtimeSettings.pressureAtm < 0.5
  ) {
    warnings.push(
      "Liquid aerosol medium with very low pressure can produce unstable approximation metrics.",
    );
  }

  if (currentGasMolarVolumeLPerMol !== null && currentGasMolarVolumeLPerMol > 120) {
    warnings.push(
      "Ideal-gas molar volume is very high; validate assumptions for sparse gas regime.",
    );
  }

  return {
    current: {
      temperatureK: currentEnvironment.temperatureK,
      pressureAtm: currentEnvironment.pressureAtm,
      gasMedium: currentEnvironment.medium,
      gasMolarVolumeLPerMol: currentGasMolarVolumeLPerMol,
      collisionRateIndex: currentCollisionRateIndex,
    },
    baseline:
      baselineEnvironment === null
        ? null
        : {
            temperatureK: baselineEnvironment.temperatureK,
            pressureAtm: baselineEnvironment.pressureAtm,
            gasMedium: baselineEnvironment.medium,
            gasMolarVolumeLPerMol: baselineGasMolarVolumeLPerMol,
            collisionRateIndex: baselineCollisionRateIndex,
          },
    warnings,
    errors,
    updatedAtLabel: new Date().toLocaleTimeString(),
  };
}
