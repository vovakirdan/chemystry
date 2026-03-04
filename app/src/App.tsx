import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app/layout/AppShell";
import CenterPanelSkeleton, {
  CENTER_TIMELINE_INITIAL,
  type CenterPanelControlState,
} from "./features/center-panel/CenterPanelSkeleton";
import LeftPanelSkeleton from "./features/left-panel/LeftPanelSkeleton";
import {
  addBuilderDraftParticipant,
  createBuilderDraftFromPreset,
  DEFAULT_LEFT_PANEL_TAB,
  DEFAULT_USER_SUBSTANCE_DRAFT,
  LIBRARY_PHASE_FILTER_OPTIONS,
  LIBRARY_SOURCE_FILTER_OPTIONS,
  parseBuilderDraftFromStorage,
  removeBuilderDraftParticipant,
  serializeBuilderDraftForStorage,
  createUserSubstanceDraftFromCatalogEntry,
  filterLibrarySubstances,
  isUserSubstanceEditable,
  isLeftPanelTabId,
  resolveSelectedPresetId,
  resolveSelectedLibrarySubstanceId,
  updateBuilderDraftField,
  updateBuilderDraftParticipantField,
  validateBuilderDraftForLaunch,
  validateUserSubstanceDraft,
  type BuilderDraft,
  type BuilderDraftField,
  type BuilderDraftParticipantField,
  type LeftPanelPlaceholderState,
  type LeftPanelTabId,
  type UserSubstanceDraft,
  type UserSubstanceDraftField,
} from "./features/left-panel/model";
import RightPanelSkeleton, {
  type RightPanelFeatureStatus,
  type RightPanelRuntimeSettings,
} from "./features/right-panel/RightPanelSkeleton";
import NotificationCenter from "./shared/components/NotificationCenter";
import StatusBar from "./shared/components/StatusBar";
import type { FeatureFlagKey, FeatureFlags } from "./shared/config/featureFlags";
import { DEFAULT_FEATURE_FLAGS } from "./shared/config/featureFlags";
import {
  createSubstanceV1,
  deleteSubstanceV1,
  ensureFeatureEnabledV1,
  healthV1,
  isCommandErrorV1,
  listPresetsV1,
  listScenariosV1,
  listSubstancesV1,
  loadScenarioV1,
  resolveFeatureFlagsV1,
  saveScenarioV1,
  toUserFacingMessageV1,
  updateSubstanceV1,
} from "./shared/contracts/ipc/client";
import type {
  CommandErrorV1,
  PresetCatalogEntryV1,
  ScenarioPayloadV1,
  ScenarioSummaryV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "./shared/contracts/ipc/v1";
import {
  appendNotification,
  type AppNotification,
  type NotificationLevel,
} from "./shared/lib/notifications";
import "./App.css";

const FEATURE_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Simulation",
  importExport: "Import/export",
  advancedPrecision: "Advanced precision",
};

const FEATURE_ACTION_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Try simulation path",
  importExport: "Try import/export path",
  advancedPrecision: "Try advanced precision path",
};

const FEATURE_KEYS: ReadonlyArray<FeatureFlagKey> = [
  "simulation",
  "importExport",
  "advancedPrecision",
];

const LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY = "chemystery.leftPanel.activeTab.v1";
const BUILDER_DRAFT_STORAGE_KEY = "chemystery.builder.draft.v1";

const DEFAULT_CENTER_PANEL_STATE: Readonly<CenterPanelControlState> = {
  isPlaying: false,
  timelinePosition: CENTER_TIMELINE_INITIAL,
};

const RESET_CENTER_PANEL_STATE: Readonly<CenterPanelControlState> = {
  isPlaying: false,
  timelinePosition: 0,
};

const DEFAULT_RUNTIME_SETTINGS: Readonly<RightPanelRuntimeSettings> = {
  temperatureC: 25,
  pressureAtm: 1,
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};
const GENERATED_SCENARIO_NAME_SUFFIX_PATTERN = /\s\[\d{10,}\]$/;

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

type LaunchValidationSectionId = "builder" | "environment" | "calculations";

type LaunchValidationSection = {
  id: LaunchValidationSectionId;
  title: string;
  errors: ReadonlyArray<string>;
};

type LaunchValidationModel = {
  sections: ReadonlyArray<LaunchValidationSection>;
  hasErrors: boolean;
  firstError: string | null;
};

type BuilderRuntimeSnapshot = {
  builderDraft: BuilderDraft;
  runtimeSettings: RightPanelRuntimeSettings;
  simulationControlState: CenterPanelControlState;
};

type SimulationLifecycleCommand = "start" | "pause" | "reset";

type SimulationLifecycleCommandInput = {
  command: SimulationLifecycleCommand;
  simulationControlState: CenterPanelControlState;
  runtimeSettings: RightPanelRuntimeSettings;
  builderDraft: BuilderDraft | null;
  launchBlocked: boolean;
  baselineSnapshot: BuilderRuntimeSnapshot | null;
};

type SimulationLifecycleCommandResult = {
  simulationControlState: CenterPanelControlState;
  runtimeSettings: RightPanelRuntimeSettings;
  builderDraft: BuilderDraft | null;
  runtimeSettingsChanged: boolean;
  builderDraftChanged: boolean;
};

function createBuilderParticipantLabelLookup(
  draft: BuilderDraft,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();

  draft.participants.forEach((participant, index) => {
    const baseLabel = `Participant ${(index + 1).toString()}`;
    const substanceName =
      substances.find((substance) => substance.id === participant.substanceId)?.name ?? null;
    const label = substanceName === null ? baseLabel : `${baseLabel} (${substanceName})`;

    labels.set(participant.id, label);
  });

  return labels;
}

function resolveBuilderParticipantLabel(
  participantId: string,
  fallbackIndex: number,
  labelsByParticipantId: ReadonlyMap<string, string>,
): string {
  return (
    labelsByParticipantId.get(participantId) ?? `Participant ${(fallbackIndex + 1).toString()}`
  );
}

function toActionableBuilderValidationError(
  error: string,
  labelsByParticipantId: ReadonlyMap<string, string>,
): string {
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
): ReadonlyArray<string> {
  if (draft === null) {
    return ['Load a preset in Builder, then add participants before pressing "Play".'];
  }

  const errors = new Set<string>();
  const labelsByParticipantId = createBuilderParticipantLabelLookup(draft, substances);
  const participants = draft.participants;
  if (participants.length === 0) {
    errors.add("Add at least one participant in Builder.");
  }

  const hasReactant = participants.some((participant) => participant.role === "reactant");
  const hasProduct = participants.some((participant) => participant.role === "product");
  if (!hasReactant) {
    errors.add("Mark at least one participant as a reactant.");
  }
  if (!hasProduct) {
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

    const parsedCoeff = Number(normalizedCoeff);
    if (Number.isFinite(parsedCoeff) && parsedCoeff <= 0) {
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

  for (const error of validateBuilderDraftForLaunch(draft)) {
    errors.add(toActionableBuilderValidationError(error, labelsByParticipantId));
  }

  return Array.from(errors);
}

function collectEnvironmentValidationErrors(
  settings: RightPanelRuntimeSettings,
): ReadonlyArray<string> {
  const errors: string[] = [];

  if (settings.temperatureC === null) {
    errors.push("Enter temperature in Environment.");
  } else if (
    settings.temperatureC < MIN_TEMPERATURE_C ||
    settings.temperatureC > MAX_TEMPERATURE_C
  ) {
    errors.push(`Set temperature between ${MIN_TEMPERATURE_C}°C and ${MAX_TEMPERATURE_C}°C.`);
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

  if (settings.precisionProfile === "High Precision" && settings.fpsLimit !== null) {
    if (settings.fpsLimit > HIGH_PRECISION_MAX_FPS) {
      errors.push(
        `High Precision works best at ${HIGH_PRECISION_MAX_FPS} FPS or lower. Lower FPS limit or choose another profile.`,
      );
    }
  }

  if (settings.precisionProfile === "Custom" && settings.calculationPasses !== null) {
    if (settings.calculationPasses < CUSTOM_PRECISION_MIN_PASSES) {
      errors.push(
        `Custom precision needs at least ${CUSTOM_PRECISION_MIN_PASSES} iteration passes.`,
      );
    }
  }

  return errors;
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildLaunchValidationModel(
  builderDraft: BuilderDraft | null,
  runtimeSettings: RightPanelRuntimeSettings,
  substances: ReadonlyArray<SubstanceCatalogEntryV1> = [],
): LaunchValidationModel {
  const sections: ReadonlyArray<LaunchValidationSection> = [
    {
      id: "builder",
      title: "Builder",
      errors: collectBuilderValidationErrors(builderDraft, substances),
    },
    {
      id: "environment",
      title: "Environment",
      errors: collectEnvironmentValidationErrors(runtimeSettings),
    },
    {
      id: "calculations",
      title: "Calculations",
      errors: collectCalculationsValidationErrors(runtimeSettings),
    },
  ];

  for (const section of sections) {
    if (section.errors.length > 0) {
      return {
        sections,
        hasErrors: true,
        firstError: section.errors[0] ?? null,
      };
    }
  }

  return {
    sections,
    hasErrors: false,
    firstError: null,
  };
}

function readStoredLeftPanelTab(): LeftPanelTabId {
  if (typeof window === "undefined") {
    return DEFAULT_LEFT_PANEL_TAB;
  }

  try {
    const storedTab = window.localStorage.getItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY);

    if (storedTab && isLeftPanelTabId(storedTab)) {
      return storedTab;
    }
  } catch {
    // Ignore localStorage failures and use the default tab.
  }

  return DEFAULT_LEFT_PANEL_TAB;
}

function persistLeftPanelTab(tab: LeftPanelTabId): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY, tab);
  } catch {
    // Ignore localStorage failures to keep the shell interactive.
  }
}

function readStoredBuilderDraft(
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): BuilderDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseBuilderDraftFromStorage(
      window.localStorage.getItem(BUILDER_DRAFT_STORAGE_KEY),
      substances,
    );
  } catch {
    return null;
  }
}

function persistBuilderDraft(draft: BuilderDraft): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(BUILDER_DRAFT_STORAGE_KEY, serializeBuilderDraftForStorage(draft));
    return true;
  } catch {
    return false;
  }
}

function formatCommandError(error: CommandErrorV1): string {
  return `${toUserFacingMessageV1(error)} [${error.code}] (ref: ${error.requestId})`;
}

function resolveSimulationState(state: CenterPanelControlState): string {
  if (state.isPlaying) {
    return "Running";
  }

  if (state.timelinePosition <= 0) {
    return "Reset";
  }

  if (state.timelinePosition >= 100) {
    return "Completed";
  }

  return "Paused";
}

function toggleFilterValue<T extends string>(
  currentSelection: ReadonlySet<T>,
  value: T,
): ReadonlySet<T> {
  const nextSelection = new Set(currentSelection);

  if (nextSelection.has(value)) {
    nextSelection.delete(value);
  } else {
    nextSelection.add(value);
  }

  return nextSelection;
}

function createDefaultUserSubstanceDraft(): UserSubstanceDraft {
  return {
    ...DEFAULT_USER_SUBSTANCE_DRAFT,
  };
}

function createBuilderCopyFeedbackMessage(presetTitle: string): string {
  return `You are editing copy of preset "${presetTitle}". Original preset remains unchanged.`;
}

function createBuilderParticipantId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `participant-${crypto.randomUUID()}`;
  }

  return `participant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveBuilderParticipantPhase(
  substanceId: string,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): SubstancePhaseV1 {
  return substances.find((substance) => substance.id === substanceId)?.phase ?? "solid";
}

function updateUserSubstanceDraftField(
  draft: UserSubstanceDraft,
  field: UserSubstanceDraftField,
  value: string,
): UserSubstanceDraft {
  switch (field) {
    case "name":
      return {
        ...draft,
        name: value,
      };
    case "formula":
      return {
        ...draft,
        formula: value,
      };
    case "phase":
      if (LIBRARY_PHASE_FILTER_OPTIONS.includes(value as SubstancePhaseV1)) {
        return {
          ...draft,
          phase: value as SubstancePhaseV1,
        };
      }
      return draft;
    case "molarMassInput":
      return {
        ...draft,
        molarMassInput: value,
      };
    default:
      return draft;
  }
}

function sortSubstancesByName(
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): ReadonlyArray<SubstanceCatalogEntryV1> {
  return [...substances].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameOrder !== 0) {
      return nameOrder;
    }

    const formulaOrder = left.formula.localeCompare(right.formula, undefined, {
      sensitivity: "base",
    });
    if (formulaOrder !== 0) {
      return formulaOrder;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}

function sortPresetsByTitle(
  presets: ReadonlyArray<PresetCatalogEntryV1>,
): ReadonlyArray<PresetCatalogEntryV1> {
  return [...presets].sort((left, right) => {
    const titleOrder = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    if (titleOrder !== 0) {
      return titleOrder;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}

function parseScenarioTimestamp(value: string): number {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return 0;
  }

  if (/^\d+$/.test(normalized)) {
    const unixMillis = Number(normalized);
    return Number.isFinite(unixMillis) ? unixMillis : 0;
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function stripGeneratedScenarioNameSuffix(name: string): string {
  let normalized = name.trim();
  while (GENERATED_SCENARIO_NAME_SUFFIX_PATTERN.test(normalized)) {
    normalized = normalized.replace(GENERATED_SCENARIO_NAME_SUFFIX_PATTERN, "").trim();
  }

  return normalized;
}

function cloneBuilderDraft(draft: BuilderDraft): BuilderDraft {
  return {
    ...draft,
    participants: draft.participants.map((participant) => ({
      ...participant,
    })),
  };
}

function cloneRuntimeSettings(settings: RightPanelRuntimeSettings): RightPanelRuntimeSettings {
  return {
    ...settings,
  };
}

function cloneSimulationControlState(state: CenterPanelControlState): CenterPanelControlState {
  return {
    ...state,
  };
}

function createPausedSimulationControlState(
  state: CenterPanelControlState,
): CenterPanelControlState {
  return {
    ...cloneSimulationControlState(state),
    isPlaying: false,
  };
}

function areSimulationControlStatesEqual(
  left: CenterPanelControlState,
  right: CenterPanelControlState,
): boolean {
  return left.isPlaying === right.isPlaying && left.timelinePosition === right.timelinePosition;
}

function areRuntimeSettingsEqual(
  left: RightPanelRuntimeSettings,
  right: RightPanelRuntimeSettings,
): boolean {
  return (
    left.temperatureC === right.temperatureC &&
    left.pressureAtm === right.pressureAtm &&
    left.calculationPasses === right.calculationPasses &&
    left.precisionProfile === right.precisionProfile &&
    left.fpsLimit === right.fpsLimit
  );
}

function areBuilderDraftsEqual(left: BuilderDraft | null, right: BuilderDraft | null): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (
    left.title !== right.title ||
    left.reactionClass !== right.reactionClass ||
    left.equation !== right.equation ||
    left.description !== right.description ||
    left.participants.length !== right.participants.length
  ) {
    return false;
  }

  return left.participants.every((participant, index) => {
    const candidate = right.participants[index];
    if (candidate === undefined) {
      return false;
    }

    return (
      participant.id === candidate.id &&
      participant.substanceId === candidate.substanceId &&
      participant.role === candidate.role &&
      participant.stoichCoeffInput === candidate.stoichCoeffInput &&
      participant.phase === candidate.phase &&
      participant.amountMolInput === candidate.amountMolInput &&
      participant.massGInput === candidate.massGInput &&
      participant.volumeLInput === candidate.volumeLInput
    );
  });
}

// eslint-disable-next-line react-refresh/only-export-components
export function applySimulationLifecycleCommand(
  input: SimulationLifecycleCommandInput,
): SimulationLifecycleCommandResult {
  if (input.command === "start") {
    if (input.launchBlocked || input.simulationControlState.isPlaying) {
      return {
        simulationControlState: input.simulationControlState,
        runtimeSettings: input.runtimeSettings,
        builderDraft: input.builderDraft,
        runtimeSettingsChanged: false,
        builderDraftChanged: false,
      };
    }

    return {
      simulationControlState: {
        ...input.simulationControlState,
        isPlaying: true,
      },
      runtimeSettings: input.runtimeSettings,
      builderDraft: input.builderDraft,
      runtimeSettingsChanged: false,
      builderDraftChanged: false,
    };
  }

  if (input.command === "pause") {
    if (!input.simulationControlState.isPlaying) {
      return {
        simulationControlState: input.simulationControlState,
        runtimeSettings: input.runtimeSettings,
        builderDraft: input.builderDraft,
        runtimeSettingsChanged: false,
        builderDraftChanged: false,
      };
    }

    return {
      simulationControlState: {
        ...input.simulationControlState,
        isPlaying: false,
      },
      runtimeSettings: input.runtimeSettings,
      builderDraft: input.builderDraft,
      runtimeSettingsChanged: false,
      builderDraftChanged: false,
    };
  }

  const resetSimulationTarget =
    input.baselineSnapshot === null
      ? RESET_CENTER_PANEL_STATE
      : input.baselineSnapshot.simulationControlState;
  const resetRuntimeTarget =
    input.baselineSnapshot === null
      ? DEFAULT_RUNTIME_SETTINGS
      : input.baselineSnapshot.runtimeSettings;
  const resetBuilderTarget =
    input.baselineSnapshot === null ? input.builderDraft : input.baselineSnapshot.builderDraft;

  const simulationControlState = areSimulationControlStatesEqual(
    input.simulationControlState,
    createPausedSimulationControlState(resetSimulationTarget),
  )
    ? input.simulationControlState
    : createPausedSimulationControlState(resetSimulationTarget);

  const runtimeSettings = areRuntimeSettingsEqual(input.runtimeSettings, resetRuntimeTarget)
    ? input.runtimeSettings
    : cloneRuntimeSettings(resetRuntimeTarget);

  const builderDraft = areBuilderDraftsEqual(input.builderDraft, resetBuilderTarget)
    ? input.builderDraft
    : resetBuilderTarget === null
      ? null
      : cloneBuilderDraft(resetBuilderTarget);

  return {
    simulationControlState,
    runtimeSettings,
    builderDraft,
    runtimeSettingsChanged: runtimeSettings !== input.runtimeSettings,
    builderDraftChanged: builderDraft !== input.builderDraft,
  };
}

function createBuilderRuntimeSnapshot(
  draft: BuilderDraft,
  runtimeSettings: RightPanelRuntimeSettings,
  simulationControlState: CenterPanelControlState,
): BuilderRuntimeSnapshot {
  return {
    builderDraft: cloneBuilderDraft(draft),
    runtimeSettings: cloneRuntimeSettings(runtimeSettings),
    simulationControlState: createPausedSimulationControlState(simulationControlState),
  };
}

function createScenarioPayloadFromSnapshot(snapshot: BuilderRuntimeSnapshot): ScenarioPayloadV1 {
  return {
    builderDraft: cloneBuilderDraft(snapshot.builderDraft),
    runtimeSettings: cloneRuntimeSettings(snapshot.runtimeSettings),
  };
}

function createSnapshotFromScenarioPayload(payload: ScenarioPayloadV1): BuilderRuntimeSnapshot {
  return {
    builderDraft: cloneBuilderDraft(payload.builderDraft),
    runtimeSettings: cloneRuntimeSettings(payload.runtimeSettings),
    simulationControlState: cloneSimulationControlState(RESET_CENTER_PANEL_STATE),
  };
}

function sortScenariosByUpdatedAt(
  scenarios: ReadonlyArray<ScenarioSummaryV1>,
): ReadonlyArray<ScenarioSummaryV1> {
  return [...scenarios].sort((left, right) => {
    const updatedOrder =
      parseScenarioTimestamp(right.updatedAt) - parseScenarioTimestamp(left.updatedAt);
    if (updatedOrder !== 0) {
      return updatedOrder;
    }

    const nameOrder = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameOrder !== 0) {
      return nameOrder;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}

function App() {
  const [activeLeftPanelTab, setActiveLeftPanelTab] =
    useState<LeftPanelTabId>(readStoredLeftPanelTab);
  const [healthMsg, setHealthMsg] = useState("Checking backend health...");
  const [featureFlags, setFeatureFlags] = useState<Readonly<FeatureFlags>>(DEFAULT_FEATURE_FLAGS);
  const [featureFlagsMsg, setFeatureFlagsMsg] = useState("Loading feature flags...");
  const [featurePathMsg, setFeaturePathMsg] = useState("");
  const [simulationControlState, setSimulationControlState] = useState<CenterPanelControlState>(
    DEFAULT_CENTER_PANEL_STATE,
  );
  const [runtimeSettings, setRuntimeSettings] =
    useState<RightPanelRuntimeSettings>(DEFAULT_RUNTIME_SETTINGS);
  const [rightPanelSyncRevision, setRightPanelSyncRevision] = useState(0);
  const [allSubstances, setAllSubstances] = useState<ReadonlyArray<SubstanceCatalogEntryV1>>([]);
  const [allPresets, setAllPresets] = useState<ReadonlyArray<PresetCatalogEntryV1>>([]);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [selectedLibraryPhases, setSelectedLibraryPhases] = useState<ReadonlySet<SubstancePhaseV1>>(
    () => new Set(LIBRARY_PHASE_FILTER_OPTIONS),
  );
  const [selectedLibrarySources, setSelectedLibrarySources] = useState<
    ReadonlySet<SubstanceSourceV1>
  >(() => new Set(LIBRARY_SOURCE_FILTER_OPTIONS));
  const [selectedLibrarySubstanceId, setSelectedLibrarySubstanceId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [libraryLoadState, setLibraryLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [libraryLoadError, setLibraryLoadError] = useState<string | null>(null);
  const [presetsLoadState, setPresetsLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [presetsLoadError, setPresetsLoadError] = useState<string | null>(null);
  const [builderDraft, setBuilderDraft] = useState<BuilderDraft | null>(null);
  const [builderCopyFeedbackMessage, setBuilderCopyFeedbackMessage] = useState<string | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<ReadonlyArray<ScenarioSummaryV1>>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioNameInput, setScenarioNameInput] = useState("");
  const [scenarioActionState, setScenarioActionState] = useState<"idle" | "saving" | "loading">(
    "idle",
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState<BuilderRuntimeSnapshot | null>(null);
  const [createSubstanceDraft, setCreateSubstanceDraft] = useState<UserSubstanceDraft>(
    createDefaultUserSubstanceDraft,
  );
  const [createSubstanceValidationErrors, setCreateSubstanceValidationErrors] = useState<
    ReadonlyArray<string>
  >([]);
  const [editSubstanceDraft, setEditSubstanceDraft] = useState<UserSubstanceDraft | null>(null);
  const [editSubstanceValidationErrors, setEditSubstanceValidationErrors] = useState<
    ReadonlyArray<string>
  >([]);
  const [libraryMutationState, setLibraryMutationState] = useState<
    "idle" | "creating" | "updating" | "deleting"
  >("idle");
  const [libraryMutationError, setLibraryMutationError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ReadonlyArray<AppNotification>>([]);
  const notificationIdRef = useRef(0);
  const builderDraftHydratedRef = useRef(false);
  const previousSimulationStateRef = useRef<string | null>(null);
  const previousRuntimeSettingsRef = useRef<RightPanelRuntimeSettings | null>(null);

  const enqueueNotification = useCallback((level: NotificationLevel, message: string): void => {
    notificationIdRef.current += 1;
    const nextNotification: AppNotification = {
      id: notificationIdRef.current,
      level,
      message,
    };

    setNotifications((queue) => appendNotification(queue, nextNotification));
  }, []);

  const dismissNotification = useCallback((id: number): void => {
    setNotifications((queue) => queue.filter((notification) => notification.id !== id));
  }, []);

  const simulationStateLabel = resolveSimulationState(simulationControlState);

  useEffect(() => {
    persistLeftPanelTab(activeLeftPanelTab);
  }, [activeLeftPanelTab]);

  useEffect(() => {
    let disposed = false;

    healthV1()
      .then((result) => {
        if (!disposed) {
          setHealthMsg(`Backend ${result.status} (${result.version}, ref: ${result.requestId})`);
          enqueueNotification("info", `Backend status: ${result.status}.`);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          if (isCommandErrorV1(error)) {
            const message = `Backend error: ${formatCommandError(error)}`;
            setHealthMsg(message);
            enqueueNotification("error", message);
            return;
          }

          const message = `Backend error: ${String(error)}`;
          setHealthMsg(message);
          enqueueNotification("error", message);
        }
      });

    resolveFeatureFlagsV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setFeatureFlags(result.flags);
        setFeatureFlagsMsg(
          result.warning
            ? `Feature flags: ${result.source} (ref: ${result.requestId}) - ${result.warning}`
            : `Feature flags: ${result.source} (ref: ${result.requestId})`,
        );
        if (result.warning) {
          enqueueNotification("warn", `Feature flag warning: ${result.warning}`);
        }
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          const message = `Feature flag error: ${formatCommandError(error)}`;
          setFeatureFlagsMsg(message);
          enqueueNotification("error", message);
          return;
        }

        const message = `Feature flag error: ${String(error)}`;
        setFeatureFlagsMsg(message);
        enqueueNotification("error", message);
      });

    listSubstancesV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setAllSubstances(result.substances);
        setLibraryLoadState("ready");
        setLibraryLoadError(null);
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          const message = `Library error: ${formatCommandError(error)}`;
          setLibraryLoadError(message);
          setLibraryLoadState("error");
          enqueueNotification("error", message);
          return;
        }

        const message = `Library error: ${String(error)}`;
        setLibraryLoadError(message);
        setLibraryLoadState("error");
        enqueueNotification("error", message);
      });

    listPresetsV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setAllPresets(sortPresetsByTitle(result.presets));
        setPresetsLoadState("ready");
        setPresetsLoadError(null);
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          const message = `Preset library error: ${formatCommandError(error)}`;
          setPresetsLoadError(message);
          setPresetsLoadState("error");
          enqueueNotification("error", message);
          return;
        }

        const message = `Preset library error: ${String(error)}`;
        setPresetsLoadError(message);
        setPresetsLoadState("error");
        enqueueNotification("error", message);
      });

    listScenariosV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setSavedScenarios(sortScenariosByUpdatedAt(result.scenarios));
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          enqueueNotification("error", `Scenario list error: ${formatCommandError(error)}`);
          return;
        }

        enqueueNotification("error", `Scenario list error: ${String(error)}`);
      });

    return () => {
      disposed = true;
    };
  }, [enqueueNotification]);

  useEffect(() => {
    const previousSimulationState = previousSimulationStateRef.current;

    if (previousSimulationState === null) {
      previousSimulationStateRef.current = simulationStateLabel;
      return;
    }

    if (previousSimulationState !== simulationStateLabel) {
      enqueueNotification("info", `Simulation state changed: ${simulationStateLabel}.`);
      previousSimulationStateRef.current = simulationStateLabel;
    }
  }, [enqueueNotification, simulationStateLabel]);

  useEffect(() => {
    const previousRuntimeSettings = previousRuntimeSettingsRef.current;

    if (previousRuntimeSettings === null) {
      previousRuntimeSettingsRef.current = runtimeSettings;
      return;
    }

    if (previousRuntimeSettings.precisionProfile !== runtimeSettings.precisionProfile) {
      enqueueNotification("info", `Precision profile set to ${runtimeSettings.precisionProfile}.`);
    }

    if (previousRuntimeSettings.fpsLimit !== runtimeSettings.fpsLimit) {
      if (runtimeSettings.fpsLimit === null) {
        // Skip notifications while the value is incomplete.
      } else if (runtimeSettings.fpsLimit > 120) {
        enqueueNotification(
          "warn",
          `FPS limit ${runtimeSettings.fpsLimit} may reduce stability on low-end hardware.`,
        );
      } else {
        enqueueNotification("info", `FPS limit set to ${runtimeSettings.fpsLimit}.`);
      }
    }

    previousRuntimeSettingsRef.current = runtimeSettings;
  }, [enqueueNotification, runtimeSettings]);

  function triggerFeaturePath(feature: FeatureFlagKey) {
    try {
      ensureFeatureEnabledV1(featureFlags, feature);
      const message = `${FEATURE_LABEL_BY_KEY[feature]} path is available.`;
      setFeaturePathMsg(message);
      enqueueNotification("info", message);
    } catch (error: unknown) {
      if (isCommandErrorV1(error)) {
        const message = formatCommandError(error);
        setFeaturePathMsg(message);
        enqueueNotification("warn", message);
        return;
      }

      const message = `Unexpected error: ${String(error)}`;
      setFeaturePathMsg(message);
      enqueueNotification("error", message);
    }
  }

  function availabilityLabel(enabled: boolean): string {
    return enabled ? "available" : "unavailable";
  }

  const filteredLibrarySubstances = useMemo(
    () =>
      filterLibrarySubstances(
        allSubstances,
        librarySearchQuery,
        selectedLibraryPhases,
        selectedLibrarySources,
      ),
    [allSubstances, librarySearchQuery, selectedLibraryPhases, selectedLibrarySources],
  );

  const resolvedSelectedLibrarySubstanceId = useMemo(
    () => resolveSelectedLibrarySubstanceId(selectedLibrarySubstanceId, filteredLibrarySubstances),
    [filteredLibrarySubstances, selectedLibrarySubstanceId],
  );

  const selectedLibrarySubstance = useMemo(
    () =>
      filteredLibrarySubstances.find(
        (substance) => substance.id === resolvedSelectedLibrarySubstanceId,
      ) ?? null,
    [filteredLibrarySubstances, resolvedSelectedLibrarySubstanceId],
  );

  const selectedEditableLibrarySubstance = useMemo(
    () => (isUserSubstanceEditable(selectedLibrarySubstance) ? selectedLibrarySubstance : null),
    [selectedLibrarySubstance],
  );

  const resolvedSelectedPresetId = useMemo(
    () => resolveSelectedPresetId(selectedPresetId, allPresets),
    [allPresets, selectedPresetId],
  );

  const selectedPreset = useMemo(
    () => allPresets.find((preset) => preset.id === resolvedSelectedPresetId) ?? null,
    [allPresets, resolvedSelectedPresetId],
  );

  useEffect(() => {
    if (selectedEditableLibrarySubstance === null) {
      setEditSubstanceDraft(null);
      setEditSubstanceValidationErrors([]);
      return;
    }

    setEditSubstanceDraft(
      createUserSubstanceDraftFromCatalogEntry(selectedEditableLibrarySubstance),
    );
    setEditSubstanceValidationErrors([]);
  }, [selectedEditableLibrarySubstance]);

  useEffect(() => {
    if (selectedPresetId === resolvedSelectedPresetId) {
      return;
    }

    setSelectedPresetId(resolvedSelectedPresetId);
  }, [resolvedSelectedPresetId, selectedPresetId]);

  useEffect(() => {
    if (savedScenarios.length === 0) {
      if (selectedScenarioId !== null) {
        setSelectedScenarioId(null);
      }
      return;
    }

    if (
      selectedScenarioId !== null &&
      savedScenarios.some((scenario) => scenario.id === selectedScenarioId)
    ) {
      return;
    }

    setSelectedScenarioId(savedScenarios[0]?.id ?? null);
  }, [savedScenarios, selectedScenarioId]);

  useEffect(() => {
    if (builderDraftHydratedRef.current) {
      return;
    }

    if (libraryLoadState !== "ready") {
      return;
    }

    if (builderDraft !== null) {
      builderDraftHydratedRef.current = true;
      return;
    }

    setBuilderDraft(readStoredBuilderDraft(allSubstances));
    builderDraftHydratedRef.current = true;
  }, [allSubstances, builderDraft, libraryLoadState]);

  const libraryPlaceholderState: LeftPanelPlaceholderState = useMemo(() => {
    if (libraryLoadState === "loading") {
      return "loading";
    }

    if (libraryLoadState === "error") {
      return "error";
    }

    return filteredLibrarySubstances.length === 0 ? "empty" : "ready";
  }, [filteredLibrarySubstances.length, libraryLoadState]);

  const presetsPlaceholderState: LeftPanelPlaceholderState = useMemo(() => {
    if (presetsLoadState === "loading") {
      return "loading";
    }

    if (presetsLoadState === "error") {
      return "error";
    }

    return allPresets.length === 0 ? "empty" : "ready";
  }, [allPresets.length, presetsLoadState]);

  const builderPlaceholderState: LeftPanelPlaceholderState = useMemo(
    () => (builderDraft === null ? "empty" : "ready"),
    [builderDraft],
  );

  const launchValidationModel = useMemo(
    () => buildLaunchValidationModel(builderDraft, runtimeSettings, allSubstances),
    [allSubstances, builderDraft, runtimeSettings],
  );

  const builderLaunchValidationErrors =
    launchValidationModel.sections.find((section) => section.id === "builder")?.errors ?? [];

  const isBuilderLaunchBlocked = builderLaunchValidationErrors.length > 0;
  const isLaunchBlocked = launchValidationModel.hasErrors;
  const launchBlockedReason = launchValidationModel.firstError;

  useEffect(() => {
    if (!isLaunchBlocked) {
      return;
    }

    setSimulationControlState((currentState) => {
      if (!currentState.isPlaying) {
        return currentState;
      }

      return {
        ...currentState,
        isPlaying: false,
      };
    });
  }, [isLaunchBlocked]);

  const placeholderStateByTab: Readonly<Record<LeftPanelTabId, LeftPanelPlaceholderState>> =
    useMemo(
      () => ({
        library: libraryPlaceholderState,
        builder: builderPlaceholderState,
        presets: presetsPlaceholderState,
      }),
      [builderPlaceholderState, libraryPlaceholderState, presetsPlaceholderState],
    );

  const libraryEmptyMessage =
    allSubstances.length === 0
      ? "No substances are available in the local catalog."
      : "No substances match the current search and filters.";

  const presetsEmptyMessage = "No presets are available in the local preset library.";

  const builderEmptyMessage = 'Select a preset and click "Use in Builder" to start editing.';
  const isScenarioBusy = scenarioActionState !== "idle";
  const canSaveScenario =
    builderDraft !== null && scenarioNameInput.trim().length > 0 && !isScenarioBusy;
  const canLoadScenario =
    selectedScenarioId !== null && savedScenarios.length > 0 && !isScenarioBusy;
  const canSetBaselineSnapshot = builderDraft !== null && !isScenarioBusy;
  const canRevertToBaseline = baselineSnapshot !== null && !isScenarioBusy;

  const handleLibraryPhaseToggle = useCallback((phase: SubstancePhaseV1): void => {
    setSelectedLibraryPhases((currentSelection) => toggleFilterValue(currentSelection, phase));
  }, []);

  const handleLibrarySourceToggle = useCallback((source: SubstanceSourceV1): void => {
    setSelectedLibrarySources((currentSelection) => toggleFilterValue(currentSelection, source));
  }, []);

  const handleBuilderDraftFieldChange = useCallback(
    (field: BuilderDraftField, value: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return updateBuilderDraftField(currentDraft, field, value);
      });
    },
    [],
  );

  const handleBuilderParticipantAdd = useCallback(
    (substanceId: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return addBuilderDraftParticipant(currentDraft, {
          id: createBuilderParticipantId(),
          substanceId,
          role: "reactant",
          stoichCoeffInput: "1",
          phase: resolveBuilderParticipantPhase(substanceId, allSubstances),
          amountMolInput: "",
          massGInput: "",
          volumeLInput: "",
        });
      });
    },
    [allSubstances],
  );

  const handleBuilderParticipantFieldChange = useCallback(
    (participantId: string, field: BuilderDraftParticipantField, value: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return updateBuilderDraftParticipantField(
          currentDraft,
          participantId,
          field,
          value,
          allSubstances,
        );
      });
    },
    [allSubstances],
  );

  const handleBuilderParticipantRemove = useCallback((participantId: string): void => {
    setBuilderDraft((currentDraft) => {
      if (currentDraft === null) {
        return currentDraft;
      }

      return removeBuilderDraftParticipant(currentDraft, participantId);
    });
  }, []);

  const handleSaveBuilderDraft = useCallback((): void => {
    if (builderDraft === null) {
      enqueueNotification("warn", "Builder draft is empty. Nothing to save.");
      return;
    }

    if (!persistBuilderDraft(builderDraft)) {
      enqueueNotification("error", "Unable to save builder draft to local storage.");
      return;
    }

    enqueueNotification("info", "Builder draft saved to local storage.");
  }, [builderDraft, enqueueNotification]);

  const handleSaveScenario = useCallback(async (): Promise<void> => {
    if (builderDraft === null) {
      enqueueNotification("warn", "Builder draft is empty. Add data before saving a scenario.");
      return;
    }

    const normalizedScenarioName = stripGeneratedScenarioNameSuffix(scenarioNameInput);
    if (normalizedScenarioName.length === 0) {
      enqueueNotification("warn", "Enter a scenario name before saving.");
      return;
    }

    const snapshot = createBuilderRuntimeSnapshot(
      builderDraft,
      runtimeSettings,
      simulationControlState,
    );
    setScenarioActionState("saving");

    try {
      const result = await saveScenarioV1({
        name: normalizedScenarioName,
        payload: createScenarioPayloadFromSnapshot(snapshot),
      });

      setSavedScenarios((currentScenarios) =>
        sortScenariosByUpdatedAt([
          ...currentScenarios.filter((scenario) => scenario.id !== result.scenario.id),
          result.scenario,
        ]),
      );
      setSelectedScenarioId(result.scenario.id);
      setScenarioNameInput(normalizedScenarioName);
      setBaselineSnapshot(snapshot);

      try {
        const scenariosResult = await listScenariosV1();
        setSavedScenarios(sortScenariosByUpdatedAt(scenariosResult.scenarios));
      } catch (refreshError: unknown) {
        const refreshMessage = isCommandErrorV1(refreshError)
          ? formatCommandError(refreshError)
          : String(refreshError);
        enqueueNotification("warn", `Scenario saved, but refresh failed: ${refreshMessage}`);
      }

      enqueueNotification(
        "info",
        `Scenario "${normalizedScenarioName}" saved. Baseline snapshot updated.`,
      );
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Save scenario error: ${formatCommandError(error)}`
        : `Save scenario error: ${String(error)}`;
      enqueueNotification("error", message);
    } finally {
      setScenarioActionState("idle");
    }
  }, [
    builderDraft,
    enqueueNotification,
    runtimeSettings,
    scenarioNameInput,
    simulationControlState,
  ]);

  const handleLoadScenario = useCallback(async (): Promise<void> => {
    if (selectedScenarioId === null) {
      enqueueNotification("warn", "Choose a saved scenario before loading.");
      return;
    }

    setScenarioActionState("loading");

    try {
      const result = await loadScenarioV1({
        id: selectedScenarioId,
      });
      const snapshot = createSnapshotFromScenarioPayload(result.payload);

      setBuilderDraft(snapshot.builderDraft);
      setRuntimeSettings(snapshot.runtimeSettings);
      setSimulationControlState(snapshot.simulationControlState);
      setRightPanelSyncRevision((current) => current + 1);
      setScenarioNameInput(stripGeneratedScenarioNameSuffix(result.scenarioName));
      setSelectedScenarioId(result.scenarioId);
      setBaselineSnapshot(snapshot);
      setBuilderCopyFeedbackMessage(null);
      enqueueNotification(
        "info",
        `Scenario "${result.scenarioName}" loaded into Builder and set as baseline snapshot.`,
      );
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Load scenario error: ${formatCommandError(error)}`
        : `Load scenario error: ${String(error)}`;
      enqueueNotification("error", message);
    } finally {
      setScenarioActionState("idle");
    }
  }, [enqueueNotification, selectedScenarioId]);

  const handleSetBaselineSnapshot = useCallback((): void => {
    if (builderDraft === null) {
      enqueueNotification("warn", "Builder draft is empty. Cannot set baseline snapshot.");
      return;
    }

    setBaselineSnapshot(
      createBuilderRuntimeSnapshot(builderDraft, runtimeSettings, simulationControlState),
    );
    enqueueNotification("info", "Baseline snapshot updated.");
  }, [builderDraft, enqueueNotification, runtimeSettings, simulationControlState]);

  const handleRevertToBaseline = useCallback((): void => {
    if (baselineSnapshot === null) {
      enqueueNotification("warn", "Baseline snapshot is not set yet.");
      return;
    }

    const result = applySimulationLifecycleCommand({
      command: "reset",
      simulationControlState,
      runtimeSettings,
      builderDraft,
      launchBlocked: isLaunchBlocked,
      baselineSnapshot,
    });

    if (result.simulationControlState !== simulationControlState) {
      setSimulationControlState(result.simulationControlState);
    }
    if (result.runtimeSettingsChanged) {
      setRuntimeSettings(result.runtimeSettings);
      setRightPanelSyncRevision((current) => current + 1);
    }
    if (result.builderDraftChanged) {
      setBuilderDraft(result.builderDraft);
    }

    enqueueNotification(
      "info",
      "Reverted Builder, runtime settings, and timeline to baseline snapshot.",
    );
  }, [
    baselineSnapshot,
    builderDraft,
    enqueueNotification,
    isLaunchBlocked,
    runtimeSettings,
    simulationControlState,
  ]);

  const handleUsePresetInBuilder = useCallback(
    (presetId: string): void => {
      const preset = allPresets.find((candidate) => candidate.id === presetId);
      if (preset === undefined) {
        const message = "Preset was not found. Reload preset library and try again.";
        setPresetsLoadError(message);
        enqueueNotification("error", message);
        return;
      }

      setSelectedPresetId(preset.id);
      setBuilderDraft(createBuilderDraftFromPreset(preset));
      setBuilderCopyFeedbackMessage(createBuilderCopyFeedbackMessage(preset.title));
      setScenarioNameInput(preset.title);
      setActiveLeftPanelTab("builder");
      enqueueNotification("info", `Preset "${preset.title}" loaded into Builder as editable copy.`);
    },
    [allPresets, enqueueNotification],
  );

  const handleCreateSubstanceDraftFieldChange = useCallback(
    (field: UserSubstanceDraftField, value: string): void => {
      setCreateSubstanceDraft((currentDraft) =>
        updateUserSubstanceDraftField(currentDraft, field, value),
      );
      setCreateSubstanceValidationErrors((currentErrors) =>
        currentErrors.length === 0 ? currentErrors : [],
      );
      setLibraryMutationError((currentError) => (currentError === null ? currentError : null));
    },
    [],
  );

  const handleEditSubstanceDraftFieldChange = useCallback(
    (field: UserSubstanceDraftField, value: string): void => {
      setEditSubstanceDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return updateUserSubstanceDraftField(currentDraft, field, value);
      });
      setEditSubstanceValidationErrors((currentErrors) =>
        currentErrors.length === 0 ? currentErrors : [],
      );
      setLibraryMutationError((currentError) => (currentError === null ? currentError : null));
    },
    [],
  );

  const handleCreateSubstanceSubmit = useCallback(async (): Promise<void> => {
    const validationResult = validateUserSubstanceDraft(createSubstanceDraft);
    if (validationResult.input === null) {
      setCreateSubstanceValidationErrors(validationResult.errors);
      return;
    }

    setCreateSubstanceValidationErrors([]);
    setLibraryMutationError(null);
    setLibraryMutationState("creating");

    try {
      const result = await createSubstanceV1(validationResult.input);
      setAllSubstances((currentSubstances) =>
        sortSubstancesByName([
          ...currentSubstances.filter((substance) => substance.id !== result.substance.id),
          result.substance,
        ]),
      );
      setCreateSubstanceDraft(createDefaultUserSubstanceDraft());
      setSelectedLibrarySubstanceId(result.substance.id);
      enqueueNotification("info", `Substance "${result.substance.name}" was created.`);
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Create substance error: ${formatCommandError(error)}`
        : `Create substance error: ${String(error)}`;
      setLibraryMutationError(message);
      enqueueNotification("error", message);
    } finally {
      setLibraryMutationState("idle");
    }
  }, [createSubstanceDraft, enqueueNotification]);

  const handleUpdateSubstanceSubmit = useCallback(async (): Promise<void> => {
    if (selectedEditableLibrarySubstance === null || editSubstanceDraft === null) {
      setLibraryMutationError("Select a user substance before saving edits.");
      return;
    }

    const validationResult = validateUserSubstanceDraft(editSubstanceDraft);
    if (validationResult.input === null) {
      setEditSubstanceValidationErrors(validationResult.errors);
      return;
    }

    setEditSubstanceValidationErrors([]);
    setLibraryMutationError(null);
    setLibraryMutationState("updating");

    try {
      const result = await updateSubstanceV1({
        id: selectedEditableLibrarySubstance.id,
        ...validationResult.input,
      });
      setAllSubstances((currentSubstances) =>
        sortSubstancesByName(
          currentSubstances.map((substance) =>
            substance.id === result.substance.id ? result.substance : substance,
          ),
        ),
      );
      setEditSubstanceDraft(createUserSubstanceDraftFromCatalogEntry(result.substance));
      setSelectedLibrarySubstanceId(result.substance.id);
      enqueueNotification("info", `Substance "${result.substance.name}" was updated.`);
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Update substance error: ${formatCommandError(error)}`
        : `Update substance error: ${String(error)}`;
      setLibraryMutationError(message);
      enqueueNotification("error", message);
    } finally {
      setLibraryMutationState("idle");
    }
  }, [editSubstanceDraft, enqueueNotification, selectedEditableLibrarySubstance]);

  const handleDeleteSelectedSubstance = useCallback(async (): Promise<void> => {
    if (selectedEditableLibrarySubstance === null) {
      setLibraryMutationError("Select a user substance before deleting.");
      return;
    }

    setLibraryMutationError(null);
    setLibraryMutationState("deleting");

    try {
      const result = await deleteSubstanceV1({ id: selectedEditableLibrarySubstance.id });
      if (!result.deleted) {
        const message = `Substance "${selectedEditableLibrarySubstance.name}" was not deleted.`;
        setLibraryMutationError(message);
        enqueueNotification("warn", message);
        return;
      }

      setAllSubstances((currentSubstances) =>
        currentSubstances.filter(
          (substance) => substance.id !== selectedEditableLibrarySubstance.id,
        ),
      );
      setSelectedLibrarySubstanceId(null);
      setEditSubstanceValidationErrors([]);
      setEditSubstanceDraft(null);
      enqueueNotification(
        "info",
        `Substance "${selectedEditableLibrarySubstance.name}" was deleted.`,
      );
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Delete substance error: ${formatCommandError(error)}`
        : `Delete substance error: ${String(error)}`;
      setLibraryMutationError(message);
      enqueueNotification("error", message);
    } finally {
      setLibraryMutationState("idle");
    }
  }, [enqueueNotification, selectedEditableLibrarySubstance]);

  const rightPanelFeatureStatuses: ReadonlyArray<RightPanelFeatureStatus> = FEATURE_KEYS.map(
    (feature) => ({
      id: feature,
      label: FEATURE_LABEL_BY_KEY[feature],
      availability: availabilityLabel(featureFlags[feature]),
    }),
  );

  const executeSimulationLifecycleCommand = useCallback(
    (command: SimulationLifecycleCommand): void => {
      const result = applySimulationLifecycleCommand({
        command,
        simulationControlState,
        runtimeSettings,
        builderDraft,
        launchBlocked: isLaunchBlocked,
        baselineSnapshot,
      });

      if (result.simulationControlState !== simulationControlState) {
        setSimulationControlState(result.simulationControlState);
      }
      if (result.runtimeSettingsChanged) {
        setRuntimeSettings(result.runtimeSettings);
        setRightPanelSyncRevision((current) => current + 1);
      }
      if (result.builderDraftChanged) {
        setBuilderDraft(result.builderDraft);
      }
    },
    [baselineSnapshot, builderDraft, isLaunchBlocked, runtimeSettings, simulationControlState],
  );

  const handleSimulationStart = useCallback((): void => {
    executeSimulationLifecycleCommand("start");
  }, [executeSimulationLifecycleCommand]);

  const handleSimulationPause = useCallback((): void => {
    executeSimulationLifecycleCommand("pause");
  }, [executeSimulationLifecycleCommand]);

  const handleSimulationReset = useCallback((): void => {
    executeSimulationLifecycleCommand("reset");
  }, [executeSimulationLifecycleCommand]);

  const handleSimulationTimelinePositionChange = useCallback((timelinePosition: number): void => {
    setSimulationControlState((currentState) => {
      if (currentState.timelinePosition === timelinePosition) {
        return currentState;
      }

      return {
        ...currentState,
        timelinePosition,
      };
    });
  }, []);

  const handleRuntimeSettingsChange = useCallback((state: RightPanelRuntimeSettings): void => {
    setRuntimeSettings(state);
  }, []);

  const statusBarFpsLimit = runtimeSettings.fpsLimit ?? 60;

  return (
    <div className="app-root">
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      <AppShell
        leftPanel={
          <LeftPanelSkeleton
            activeTab={activeLeftPanelTab}
            onTabChange={setActiveLeftPanelTab}
            placeholderStateByTab={placeholderStateByTab}
            libraryViewModel={{
              searchQuery: librarySearchQuery,
              onSearchQueryChange: setLibrarySearchQuery,
              selectedPhases: selectedLibraryPhases,
              selectedSources: selectedLibrarySources,
              onTogglePhase: handleLibraryPhaseToggle,
              onToggleSource: handleLibrarySourceToggle,
              substances: filteredLibrarySubstances,
              selectedSubstance: selectedLibrarySubstance,
              onSelectSubstance: setSelectedLibrarySubstanceId,
              createDraft: createSubstanceDraft,
              createValidationErrors: createSubstanceValidationErrors,
              onCreateDraftFieldChange: handleCreateSubstanceDraftFieldChange,
              onCreateSubmit: () => {
                void handleCreateSubstanceSubmit();
              },
              editDraft: editSubstanceDraft,
              editValidationErrors: editSubstanceValidationErrors,
              onEditDraftFieldChange: handleEditSubstanceDraftFieldChange,
              onEditSubmit: () => {
                void handleUpdateSubstanceSubmit();
              },
              onDeleteSelected: () => {
                void handleDeleteSelectedSubstance();
              },
              isMutating: libraryMutationState !== "idle",
              mutationErrorMessage: libraryMutationError,
              emptyMessage: libraryEmptyMessage,
              errorMessage: libraryLoadError,
            }}
            builderViewModel={{
              draft: builderDraft,
              onDraftFieldChange: handleBuilderDraftFieldChange,
              allSubstances,
              onParticipantAdd: handleBuilderParticipantAdd,
              onParticipantFieldChange: handleBuilderParticipantFieldChange,
              onParticipantRemove: handleBuilderParticipantRemove,
              onSaveDraft: handleSaveBuilderDraft,
              copyFeedbackMessage: builderCopyFeedbackMessage,
              launchBlocked: isBuilderLaunchBlocked,
              launchBlockReasons: builderLaunchValidationErrors,
              scenarioNameInput,
              onScenarioNameInputChange: setScenarioNameInput,
              savedScenarios,
              selectedScenarioId,
              onSelectScenario: setSelectedScenarioId,
              onSaveScenario: () => {
                void handleSaveScenario();
              },
              onLoadScenario: () => {
                void handleLoadScenario();
              },
              onSetBaselineSnapshot: handleSetBaselineSnapshot,
              onRevertToBaseline: handleRevertToBaseline,
              canSaveScenario,
              canLoadScenario,
              canSetBaselineSnapshot,
              canRevertToBaseline,
              isScenarioBusy,
              emptyMessage: builderEmptyMessage,
            }}
            presetsViewModel={{
              presets: allPresets,
              selectedPreset,
              onSelectPreset: setSelectedPresetId,
              onUsePresetInBuilder: handleUsePresetInBuilder,
              emptyMessage: presetsEmptyMessage,
              errorMessage: presetsLoadError,
            }}
          />
        }
        centerPanel={
          <CenterPanelSkeleton
            controlState={simulationControlState}
            onSimulationStart={handleSimulationStart}
            onSimulationPause={handleSimulationPause}
            onSimulationReset={handleSimulationReset}
            onSimulationTimelinePositionChange={handleSimulationTimelinePositionChange}
            playBlocked={isLaunchBlocked}
            playBlockedReason={launchBlockedReason}
          >
            <header className="center-header">
              <h1>Simulation workspace</h1>
              <p>
                Validate launch readiness, control simulation lifecycle, and monitor session state
                from a single control surface.
              </p>
            </header>

            <section
              id="simulation-workspace-summary"
              className="content-card"
              aria-label="Simulation session summary card"
              data-testid="simulation-workspace-summary"
            >
              <h2>Simulation session</h2>
              <p data-testid="simulation-workspace-state">State: {simulationStateLabel}</p>
              <p data-testid="simulation-workspace-timeline">
                Timeline: {simulationControlState.timelinePosition}%
              </p>
              <p data-testid="simulation-workspace-baseline">
                {baselineSnapshot === null
                  ? "Baseline snapshot is not set. Reset returns timeline and runtime controls to defaults."
                  : "Baseline snapshot is set. Reset restores Builder draft, timeline, and runtime controls."}
              </p>
            </section>

            <section
              id="pre-run-validation"
              className={`content-card launch-validation-card${launchValidationModel.hasErrors ? " launch-validation-card--blocked" : " launch-validation-card--ready"}`}
              aria-label="Pre-run validation card"
              data-testid="launch-validation-card"
            >
              <h2>Pre-run checks</h2>
              <p data-testid="launch-validation-status">
                {launchValidationModel.hasErrors
                  ? "Play is blocked until the issues below are fixed."
                  : "All checks passed. Play is ready."}
              </p>
              <div className="launch-validation-groups" data-testid="launch-validation-groups">
                {launchValidationModel.sections.map((section) => (
                  <section
                    key={section.id}
                    className="launch-validation-section"
                    data-testid={`launch-validation-section-${section.id}`}
                  >
                    <h3>{section.title}</h3>
                    {section.errors.length === 0 ? (
                      <p data-testid={`launch-validation-ok-${section.id}`}>No issues.</p>
                    ) : (
                      <ul data-testid={`launch-validation-errors-${section.id}`}>
                        {section.errors.map((error, index) => (
                          <li key={`${section.id}-validation-error-${index.toString()}`}>
                            {error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </section>

            <section id="backend-health" className="content-card" aria-label="Backend health card">
              <h2>Backend health</h2>
              <p>{healthMsg}</p>
              <p>{featureFlagsMsg}</p>
            </section>

            <section
              id="feature-flags"
              className="content-card"
              aria-label="Capability checks card"
            >
              <h2>Capability checks</h2>
              <ul className="status-list">
                {FEATURE_KEYS.map((feature) => (
                  <li key={feature}>
                    {FEATURE_LABEL_BY_KEY[feature]}: {availabilityLabel(featureFlags[feature])}
                  </li>
                ))}
              </ul>

              <div className="action-row">
                {FEATURE_KEYS.map((feature) => (
                  <button type="button" key={feature} onClick={() => triggerFeaturePath(feature)}>
                    {FEATURE_ACTION_LABEL_BY_KEY[feature]}
                  </button>
                ))}
              </div>

              <p>{featurePathMsg}</p>
            </section>
          </CenterPanelSkeleton>
        }
        rightPanel={
          <RightPanelSkeleton
            key={`right-panel-${rightPanelSyncRevision.toString()}`}
            healthMessage={healthMsg}
            featureStatuses={rightPanelFeatureStatuses}
            runtimeSettings={runtimeSettings}
            onRuntimeSettingsChange={handleRuntimeSettingsChange}
          />
        }
      />
      <StatusBar
        simulationState={simulationStateLabel}
        precisionProfile={runtimeSettings.precisionProfile}
        fpsLimit={statusBarFpsLimit}
      />
    </div>
  );
}

export default App;
