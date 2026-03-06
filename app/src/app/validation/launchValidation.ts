import type { BuilderDraft } from "../../features/left-panel/model";
import { parseNormalizedNumberInput } from "../../shared/lib/units";
import { validateBuilderDraftForLaunch } from "../../features/left-panel/model";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import type { SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";

const MIN_TEMPERATURE_C = -273.15;
const MAX_TEMPERATURE_C = 1000;
const MIN_PRESSURE_ATM = 0.1;
const MAX_PRESSURE_ATM = 50;
const MIN_CALCULATION_PASSES = 1;
const MAX_CALCULATION_PASSES = 10_000;
const MIN_FPS_LIMIT = 15;
const MAX_FPS_LIMIT = 240;
const HIGH_PRECISION_MAX_FPS = 120;
const CUSTOM_PRECISION_MIN_PASSES = 50;
const IDEAL_GAS_CONSTANT_L_ATM_PER_MOL_K = 0.082057338;
const CELSIUS_TO_KELVIN_OFFSET = 273.15;
const IDEAL_GAS_APPROXIMATION_WARNING_MESSAGE =
  "Model confidence / approximation limit: gas amount-volume checks use an ideal-gas baseline in MVP.";
const IDEAL_GAS_APPROXIMATION_WARNING_HINT =
  "Checks use ideal-gas molar volume from runtime temperature/pressure when valid, otherwise fallback to 22.4 L/mol; non-ideal behavior is not modeled in MVP.";

export type LaunchValidationSectionId = "builder" | "environment" | "calculations";
export type LaunchValidationSeverity = "error" | "warning";

export type LaunchValidationWarningItem = {
  message: string;
  explainHint: string | null;
};

export type LaunchValidationItem = {
  severity: LaunchValidationSeverity;
  message: string;
  explainHint: string | null;
};

export type LaunchValidationSection = {
  id: LaunchValidationSectionId;
  title: string;
  errors: ReadonlyArray<string>;
  warnings: ReadonlyArray<LaunchValidationWarningItem>;
  items: ReadonlyArray<LaunchValidationItem>;
};

export type LaunchValidationModel = {
  sections: ReadonlyArray<LaunchValidationSection>;
  hasErrors: boolean;
  hasWarnings: boolean;
  firstError: string | null;
};

export function createBuilderParticipantLabelLookup(
  draft: BuilderDraft,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  draft.participants.forEach((participant, index) => {
    const baseLabel = `Participant ${(index + 1).toString()}`;
    const substanceName =
      substances.find((substance) => substance.id === participant.substanceId)?.name ?? null;
    labels.set(
      participant.id,
      substanceName === null ? baseLabel : `${baseLabel} (${substanceName})`,
    );
  });
  return labels;
}

export function resolveBuilderParticipantLabel(
  participantId: string,
  fallbackIndex: number,
  labelsByParticipantId: ReadonlyMap<string, string>,
): string {
  return (
    labelsByParticipantId.get(participantId) ?? `Participant ${(fallbackIndex + 1).toString()}`
  );
}

export function resolveRuntimeGasMolarVolumeLPerMol(
  settings: RightPanelRuntimeSettings,
): number | null {
  if (settings.temperatureC === null || settings.pressureAtm === null) {
    return null;
  }
  if (!Number.isFinite(settings.temperatureC) || !Number.isFinite(settings.pressureAtm)) {
    return null;
  }
  if (settings.pressureAtm <= 0) {
    return null;
  }
  const temperatureK = settings.temperatureC + CELSIUS_TO_KELVIN_OFFSET;
  if (temperatureK <= 0) {
    return null;
  }
  return (IDEAL_GAS_CONSTANT_L_ATM_PER_MOL_K * temperatureK) / settings.pressureAtm;
}

function toActionableBuilderValidationError(
  error: string,
  labelsByParticipantId: ReadonlyMap<string, string>,
): string {
  // Intent: map backend-centric validation text into stable, user-actionable launch gate messages.
  const phaseMatch = /^Participant "(.+)" has unsupported phase value\.$/u.exec(error);
  if (phaseMatch) {
    const participantLabel = labelsByParticipantId.get(phaseMatch[1]) ?? "Selected participant";
    return `${participantLabel}: choose a valid phase.`;
  }

  const fieldPatterns: ReadonlyArray<{
    sourceLabel: string;
    targetLabel: string;
    suffix: string;
    messageSuffix: string;
  }> = [
    {
      sourceLabel: "Stoich coeff",
      targetLabel: "reaction coefficient",
      suffix: "must be a number.",
      messageSuffix: "must be a number.",
    },
    {
      sourceLabel: "Stoich coeff",
      targetLabel: "reaction coefficient",
      suffix: "cannot be negative.",
      messageSuffix: "must be greater than 0.",
    },
    {
      sourceLabel: "Amount (mol)",
      targetLabel: "amount in mol",
      suffix: "must be a number.",
      messageSuffix: "must be a number.",
    },
    {
      sourceLabel: "Amount (mol)",
      targetLabel: "amount in mol",
      suffix: "cannot be negative.",
      messageSuffix: "cannot be negative.",
    },
    {
      sourceLabel: "Mass (g)",
      targetLabel: "mass in grams",
      suffix: "must be a number.",
      messageSuffix: "must be a number.",
    },
    {
      sourceLabel: "Mass (g)",
      targetLabel: "mass in grams",
      suffix: "cannot be negative.",
      messageSuffix: "cannot be negative.",
    },
    {
      sourceLabel: "Volume (L)",
      targetLabel: "volume in liters",
      suffix: "must be a number.",
      messageSuffix: "must be a number.",
    },
    {
      sourceLabel: "Volume (L)",
      targetLabel: "volume in liters",
      suffix: "cannot be negative.",
      messageSuffix: "cannot be negative.",
    },
    {
      sourceLabel: "Mass (g)",
      targetLabel: "mass in grams",
      suffix: "cannot be checked against Amount (mol) because molar mass is missing.",
      messageSuffix: "cannot be validated without molar mass for selected substance.",
    },
    {
      sourceLabel: "Mass (g)",
      targetLabel: "mass in grams",
      suffix: "is inconsistent with Amount (mol) for selected molar mass.",
      messageSuffix: "is inconsistent with amount in mol for selected substance.",
    },
    {
      sourceLabel: "Volume (L)",
      targetLabel: "volume in liters",
      suffix: "is inconsistent with Amount (mol) for gas molar volume.",
      messageSuffix: "is inconsistent with amount in mol for gas phase.",
    },
  ];

  for (const pattern of fieldPatterns) {
    const fieldMatch = new RegExp(
      `^${pattern.sourceLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")} for participant "(.+)" ${pattern.suffix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`,
      "u",
    ).exec(error);
    if (fieldMatch) {
      const participantLabel = labelsByParticipantId.get(fieldMatch[1]) ?? "Selected participant";
      return `${participantLabel}: ${pattern.targetLabel} ${pattern.messageSuffix}`;
    }
  }

  return "Check Builder participant values before starting.";
}

function collectBuilderValidationErrors(
  draft: BuilderDraft | null,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
  runtimeSettings: RightPanelRuntimeSettings,
): ReadonlyArray<string> {
  // Intent: gate launch only on deterministic Builder invalid states and produce stable per-participant messaging.
  if (draft === null) {
    return ['Load a preset in Builder, then add participants before pressing "Play".'];
  }

  const errors = new Set<string>();
  const labelsByParticipantId = createBuilderParticipantLabelLookup(draft, substances);
  const participants = draft.participants;
  if (participants.length === 0) {
    errors.add("Add at least one participant in Builder.");
  }

  if (!participants.some((participant) => participant.role === "reactant")) {
    errors.add("Mark at least one participant as a reactant.");
  }
  if (!participants.some((participant) => participant.role === "product")) {
    errors.add("Mark at least one participant as a product.");
  }

  for (const [participantIndex, participant] of participants.entries()) {
    const participantLabel = resolveBuilderParticipantLabel(
      participant.id,
      participantIndex,
      labelsByParticipantId,
    );
    const normalizedCoeff = participant.stoichCoeffInput.trim();
    if (normalizedCoeff.length === 0) {
      errors.add(`${participantLabel}: enter a reaction coefficient.`);
      continue;
    }

    const parsedCoeff = parseNormalizedNumberInput(normalizedCoeff, { allowNegative: true });
    if (parsedCoeff.ok && parsedCoeff.value <= 0) {
      errors.add(`${participantLabel}: reaction coefficient must be greater than 0.`);
    }

    if (participant.amountMolInput.trim().length === 0) {
      errors.add(`${participantLabel}: enter amount in mol.`);
    }
    if (participant.massGInput.trim().length === 0) {
      errors.add(`${participantLabel}: enter mass in grams.`);
    }
    if (participant.volumeLInput.trim().length === 0) {
      errors.add(`${participantLabel}: enter volume in liters.`);
    }
  }

  for (const error of validateBuilderDraftForLaunch(draft, substances, {
    gasMolarVolumeLPerMol: resolveRuntimeGasMolarVolumeLPerMol(runtimeSettings),
  })) {
    errors.add(toActionableBuilderValidationError(error, labelsByParticipantId));
  }

  return Array.from(errors);
}

function collectBuilderValidationWarnings(
  draft: BuilderDraft | null,
): ReadonlyArray<LaunchValidationWarningItem> {
  // Intent: keep approximation-limit warnings visible without blocking launch.
  if (draft === null) {
    return [];
  }

  const warnings: LaunchValidationWarningItem[] = [];
  for (const participant of draft.participants) {
    if (participant.phase !== "gas") {
      continue;
    }
    const parsedAmountMol = parseNormalizedNumberInput(participant.amountMolInput);
    const parsedVolumeL = parseNormalizedNumberInput(participant.volumeLInput);
    if (parsedAmountMol.ok && parsedVolumeL.ok) {
      warnings.push({
        message: IDEAL_GAS_APPROXIMATION_WARNING_MESSAGE,
        explainHint: IDEAL_GAS_APPROXIMATION_WARNING_HINT,
      });
    }
  }
  return warnings;
}

function collectEnvironmentValidationErrors(
  settings: RightPanelRuntimeSettings,
): ReadonlyArray<string> {
  const errors: string[] = [];
  if (settings.temperatureC === null) {
    errors.push("Enter temperature in Environment.");
  } else if (
    settings.temperatureC <= MIN_TEMPERATURE_C ||
    settings.temperatureC > MAX_TEMPERATURE_C
  ) {
    errors.push(`Set temperature above ${MIN_TEMPERATURE_C}°C and up to ${MAX_TEMPERATURE_C}°C.`);
  }
  if (settings.pressureAtm === null) {
    errors.push("Enter pressure in Environment.");
  } else if (settings.pressureAtm < MIN_PRESSURE_ATM || settings.pressureAtm > MAX_PRESSURE_ATM) {
    errors.push(`Set pressure between ${MIN_PRESSURE_ATM} atm and ${MAX_PRESSURE_ATM} atm.`);
  }
  return errors;
}

function collectCalculationsValidationErrors(
  settings: RightPanelRuntimeSettings,
): ReadonlyArray<string> {
  const errors: string[] = [];
  if (settings.calculationPasses === null) {
    errors.push("Enter iteration passes in Calculations.");
  } else if (!Number.isInteger(settings.calculationPasses)) {
    errors.push("Iteration passes must be a whole number.");
  } else if (
    settings.calculationPasses < MIN_CALCULATION_PASSES ||
    settings.calculationPasses > MAX_CALCULATION_PASSES
  ) {
    errors.push(
      `Set iteration passes between ${MIN_CALCULATION_PASSES} and ${MAX_CALCULATION_PASSES}.`,
    );
  }
  if (settings.fpsLimit === null) {
    errors.push("Enter FPS limit in Calculations.");
  } else if (!Number.isInteger(settings.fpsLimit)) {
    errors.push("FPS limit must be a whole number.");
  } else if (settings.fpsLimit < MIN_FPS_LIMIT || settings.fpsLimit > MAX_FPS_LIMIT) {
    errors.push(`Set FPS limit between ${MIN_FPS_LIMIT} and ${MAX_FPS_LIMIT}.`);
  }
  if (
    settings.precisionProfile === "High Precision" &&
    settings.fpsLimit !== null &&
    settings.fpsLimit > HIGH_PRECISION_MAX_FPS
  ) {
    errors.push(
      `High Precision works best at ${HIGH_PRECISION_MAX_FPS} FPS or lower. Lower FPS limit or choose another profile.`,
    );
  }
  if (
    settings.precisionProfile === "Custom" &&
    settings.calculationPasses !== null &&
    settings.calculationPasses < CUSTOM_PRECISION_MIN_PASSES
  ) {
    errors.push(`Custom precision needs at least ${CUSTOM_PRECISION_MIN_PASSES} iteration passes.`);
  }
  return errors;
}

function dedupeLaunchValidationItems(
  items: ReadonlyArray<LaunchValidationItem>,
): ReadonlyArray<LaunchValidationItem> {
  const seen = new Set<string>();
  const deduped: LaunchValidationItem[] = [];
  for (const item of items) {
    const key = `${item.severity}\u0000${item.message}\u0000${item.explainHint ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function buildLaunchValidationSection(
  id: LaunchValidationSectionId,
  title: string,
  errors: ReadonlyArray<string>,
  warnings: ReadonlyArray<LaunchValidationWarningItem>,
): LaunchValidationSection {
  const dedupedItems = dedupeLaunchValidationItems([
    ...errors.map(
      (message): LaunchValidationItem => ({ severity: "error", message, explainHint: null }),
    ),
    ...warnings.map(
      (warning): LaunchValidationItem => ({
        severity: "warning",
        message: warning.message,
        explainHint: warning.explainHint,
      }),
    ),
  ]);
  return {
    id,
    title,
    errors: dedupedItems.filter((item) => item.severity === "error").map((item) => item.message),
    warnings: dedupedItems
      .filter((item) => item.severity === "warning")
      .map((item) => ({ message: item.message, explainHint: item.explainHint })),
    items: dedupedItems,
  };
}

export function buildLaunchValidationModel(
  builderDraft: BuilderDraft | null,
  runtimeSettings: RightPanelRuntimeSettings,
  substances: ReadonlyArray<SubstanceCatalogEntryV1> = [],
): LaunchValidationModel {
  const sections: ReadonlyArray<LaunchValidationSection> = [
    buildLaunchValidationSection(
      "builder",
      "Builder",
      collectBuilderValidationErrors(builderDraft, substances, runtimeSettings),
      collectBuilderValidationWarnings(builderDraft),
    ),
    buildLaunchValidationSection(
      "environment",
      "Environment",
      collectEnvironmentValidationErrors(runtimeSettings),
      [],
    ),
    buildLaunchValidationSection(
      "calculations",
      "Calculations",
      collectCalculationsValidationErrors(runtimeSettings),
      [],
    ),
  ];
  const firstError =
    sections.flatMap((section) => section.errors).find((error) => error.length > 0) ?? null;
  return {
    sections,
    hasErrors: firstError !== null,
    hasWarnings: sections.some((section) => section.warnings.length > 0),
    firstError,
  };
}
