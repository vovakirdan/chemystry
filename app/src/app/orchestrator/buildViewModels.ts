import { useMemo } from "react";
import type {
  BuilderDraft,
  LeftPanelPlaceholderState,
  LeftPanelTabId,
} from "../../features/left-panel/model";
import {
  filterLibrarySubstances,
  isUserSubstanceEditable,
  resolveSelectedLibrarySubstanceId,
  resolveSelectedPresetId,
} from "../../features/left-panel/model";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import type {
  PresetCatalogEntryV1,
  ScenarioSummaryV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "../../shared/contracts/ipc/v1";
import { anchorEnvironmentRewindStack, type EnvironmentStepSnapshot } from "../environment/rewind";
import { buildCalculationSummary } from "../lib/exportCalculationSummary";
import {
  buildEnvironmentDerivedMetrics,
  buildSceneParticipants,
  buildStoichiometryResult,
  createCalculationInputSignature,
  deriveParticleModelEnvironment,
  isCalculationSummaryStale,
} from "../calculations/signature";
import type { BuilderRuntimeSnapshot } from "../simulation/lifecycle";
import { buildLaunchValidationModel } from "../validation/launchValidation";

type UseOrchestratorViewModelsParams = {
  allSubstances: ReadonlyArray<SubstanceCatalogEntryV1>;
  allPresets: ReadonlyArray<PresetCatalogEntryV1>;
  librarySearchQuery: string;
  selectedLibraryPhases: ReadonlySet<SubstancePhaseV1>;
  selectedLibrarySources: ReadonlySet<SubstanceSourceV1>;
  selectedLibrarySubstanceId: string | null;
  selectedPresetId: string | null;
  libraryLoadState: "loading" | "ready" | "error";
  presetsLoadState: "loading" | "ready" | "error";
  builderDraft: BuilderDraft | null;
  runtimeSettings: RightPanelRuntimeSettings;
  baselineSnapshot: BuilderRuntimeSnapshot | null;
  lastPersistedCalculationInputSignature: string | null;
  scenarioActionState: "idle" | "saving" | "loading";
  scenarioNameInput: string;
  selectedScenarioId: string | null;
  savedScenarios: ReadonlyArray<ScenarioSummaryV1>;
  environmentRewindStack: ReadonlyArray<EnvironmentStepSnapshot>;
};

export function useOrchestratorViewModels({
  allSubstances,
  allPresets,
  librarySearchQuery,
  selectedLibraryPhases,
  selectedLibrarySources,
  selectedLibrarySubstanceId,
  selectedPresetId,
  libraryLoadState,
  presetsLoadState,
  builderDraft,
  runtimeSettings,
  baselineSnapshot,
  lastPersistedCalculationInputSignature,
  scenarioActionState,
  scenarioNameInput,
  selectedScenarioId,
  savedScenarios,
  environmentRewindStack,
}: UseOrchestratorViewModelsParams) {
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

  const launchValidationModel = useMemo(
    () => buildLaunchValidationModel(builderDraft, runtimeSettings, allSubstances),
    [allSubstances, builderDraft, runtimeSettings],
  );
  const sceneParticipants = useMemo(
    () => buildSceneParticipants(builderDraft, allSubstances),
    [allSubstances, builderDraft],
  );
  const particleModelEnvironment = useMemo(
    () => deriveParticleModelEnvironment(runtimeSettings),
    [runtimeSettings],
  );
  const environmentDerivedMetrics = useMemo(
    () => buildEnvironmentDerivedMetrics(runtimeSettings, baselineSnapshot),
    [baselineSnapshot, runtimeSettings],
  );
  const calculationInputSignature = useMemo(
    () => createCalculationInputSignature(builderDraft, runtimeSettings, allSubstances),
    [allSubstances, builderDraft, runtimeSettings],
  );
  const stoichiometryResult = useMemo(
    () => buildStoichiometryResult(builderDraft, allSubstances, runtimeSettings),
    [allSubstances, builderDraft, runtimeSettings],
  );
  const calculationSummary = useMemo(
    () =>
      buildCalculationSummary(
        builderDraft,
        runtimeSettings,
        stoichiometryResult,
        calculationInputSignature,
      ),
    [builderDraft, calculationInputSignature, runtimeSettings, stoichiometryResult],
  );
  const calculationSummaryIsStale = isCalculationSummaryStale(
    calculationInputSignature,
    lastPersistedCalculationInputSignature,
  );

  const builderLaunchValidationErrors =
    launchValidationModel.sections.find((section) => section.id === "builder")?.errors ?? [];
  const isBuilderLaunchBlocked = builderLaunchValidationErrors.length > 0;
  const isLaunchBlocked = launchValidationModel.hasErrors;
  const launchBlockedReason = launchValidationModel.firstError;

  const libraryPlaceholderState: LeftPanelPlaceholderState =
    libraryLoadState === "loading"
      ? "loading"
      : libraryLoadState === "error"
        ? "error"
        : filteredLibrarySubstances.length === 0
          ? "empty"
          : "ready";

  const presetsPlaceholderState: LeftPanelPlaceholderState =
    presetsLoadState === "loading"
      ? "loading"
      : presetsLoadState === "error"
        ? "error"
        : allPresets.length === 0
          ? "empty"
          : "ready";

  const builderPlaceholderState: LeftPanelPlaceholderState =
    builderDraft === null ? "empty" : "ready";

  const placeholderStateByTab: Readonly<Record<LeftPanelTabId, LeftPanelPlaceholderState>> = {
    library: libraryPlaceholderState,
    builder: builderPlaceholderState,
    presets: presetsPlaceholderState,
  };

  const libraryEmptyMessage =
    allSubstances.length === 0
      ? "No substances are available in the local catalog."
      : "No substances match the current search and filters.";

  const presetsEmptyMessage = "No presets are available in the local preset library.";
  const builderEmptyMessage = 'Select a preset and click "Use in Builder" to start editing.';

  const isScenarioBusy = scenarioActionState !== "idle";
  const anchoredEnvironmentRewindStack = useMemo(
    () => anchorEnvironmentRewindStack(runtimeSettings, environmentRewindStack),
    [environmentRewindStack, runtimeSettings],
  );
  const canSaveScenario =
    builderDraft !== null && scenarioNameInput.trim().length > 0 && !isScenarioBusy;
  const canLoadScenario =
    selectedScenarioId !== null && savedScenarios.length > 0 && !isScenarioBusy;
  const canSetBaselineSnapshot = builderDraft !== null && !isScenarioBusy;
  const canRevertToBaseline = baselineSnapshot !== null && !isScenarioBusy;
  const canRewindScenarioStep = anchoredEnvironmentRewindStack.length > 1 && !isScenarioBusy;

  return {
    filteredLibrarySubstances,
    selectedLibrarySubstance,
    selectedEditableLibrarySubstance,
    resolvedSelectedPresetId,
    selectedPreset,
    launchValidationModel,
    sceneParticipants,
    particleModelEnvironment,
    environmentDerivedMetrics,
    calculationInputSignature,
    stoichiometryResult,
    calculationSummary,
    calculationSummaryIsStale,
    builderLaunchValidationErrors,
    isBuilderLaunchBlocked,
    isLaunchBlocked,
    launchBlockedReason,
    placeholderStateByTab,
    libraryEmptyMessage,
    presetsEmptyMessage,
    builderEmptyMessage,
    isScenarioBusy,
    anchoredEnvironmentRewindStack,
    canSaveScenario,
    canLoadScenario,
    canSetBaselineSnapshot,
    canRevertToBaseline,
    canRewindScenarioStep,
  };
}
