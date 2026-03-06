import type { ComponentProps, MutableRefObject } from "react";
import LeftPanelSkeleton from "../../features/left-panel/LeftPanelSkeleton";
import RightPanelSkeleton, {
  type RightPanelRuntimeSettings,
} from "../../features/right-panel/RightPanelSkeleton";
import type { AppNotification } from "../../shared/lib/notifications";
import type { useBuilderHandlers } from "./useBuilderHandlers";
import type { useFeatureActions } from "./useFeatureActions";
import type { useLibraryHandlers } from "./useLibraryHandlers";
import type { useOrchestratorViewModels } from "./buildViewModels";
import type { useScenarioHandlers } from "./useScenarioHandlers";
import type { useSimulationHandlers } from "./useSimulationHandlers";
import type AppOrchestratorLayout from "./AppOrchestratorLayout";

type LeftPanelProps = ComponentProps<typeof LeftPanelSkeleton>;
type RightPanelProps = ComponentProps<typeof RightPanelSkeleton>;
type LayoutProps = ComponentProps<typeof AppOrchestratorLayout>;

type BuildLayoutPropsParams = {
  importSdfMolFileInputRef: MutableRefObject<HTMLInputElement | null>;
  importSmilesFileInputRef: MutableRefObject<HTMLInputElement | null>;
  importXyzFileInputRef: MutableRefObject<HTMLInputElement | null>;
  notifications: ReadonlyArray<AppNotification>;
  dismissNotification: (id: number) => void;
  activeLeftPanelTab: LeftPanelProps["activeTab"];
  onLeftPanelTabChange: LeftPanelProps["onTabChange"];
  librarySearchQuery: LeftPanelProps["libraryViewModel"]["searchQuery"];
  onLibrarySearchQueryChange: LeftPanelProps["libraryViewModel"]["onSearchQueryChange"];
  selectedLibraryPhases: LeftPanelProps["libraryViewModel"]["selectedPhases"];
  selectedLibrarySources: LeftPanelProps["libraryViewModel"]["selectedSources"];
  onSelectLibrarySubstance: LeftPanelProps["libraryViewModel"]["onSelectSubstance"];
  createSubstanceDraft: LeftPanelProps["libraryViewModel"]["createDraft"];
  createSubstanceValidationErrors: LeftPanelProps["libraryViewModel"]["createValidationErrors"];
  editSubstanceDraft: LeftPanelProps["libraryViewModel"]["editDraft"];
  editSubstanceValidationErrors: LeftPanelProps["libraryViewModel"]["editValidationErrors"];
  libraryMutationState: "idle" | "creating" | "updating" | "deleting" | "importing";
  libraryMutationError: LeftPanelProps["libraryViewModel"]["mutationErrorMessage"];
  libraryLoadError: LeftPanelProps["libraryViewModel"]["errorMessage"];
  builderDraft: LeftPanelProps["builderViewModel"]["draft"];
  allSubstances: LeftPanelProps["builderViewModel"]["allSubstances"];
  builderCopyFeedbackMessage: LeftPanelProps["builderViewModel"]["copyFeedbackMessage"];
  scenarioNameInput: LeftPanelProps["builderViewModel"]["scenarioNameInput"];
  onScenarioNameInputChange: LeftPanelProps["builderViewModel"]["onScenarioNameInputChange"];
  savedScenarios: LeftPanelProps["builderViewModel"]["savedScenarios"];
  selectedScenarioId: LeftPanelProps["builderViewModel"]["selectedScenarioId"];
  onSelectScenarioId: LeftPanelProps["builderViewModel"]["onSelectScenario"];
  allPresets: LeftPanelProps["presetsViewModel"]["presets"];
  onSelectPresetId: LeftPanelProps["presetsViewModel"]["onSelectPreset"];
  presetsLoadError: LeftPanelProps["presetsViewModel"]["errorMessage"];
  rightPanelSyncRevision: number;
  healthMsg: LayoutProps["healthMsg"];
  scenarioHistory: NonNullable<RightPanelProps["scenarioHistory"]>;
  runtimeSettings: RightPanelRuntimeSettings;
  simulationControlState: LayoutProps["controlState"];
  simulationStateLabel: LayoutProps["sceneStateLabel"];
  baselineSnapshot: LayoutProps["baselineSnapshot"];
  featureFlagsMsg: LayoutProps["featureFlagsMsg"];
  featureFlags: LayoutProps["featureFlags"];
  featurePathMsg: LayoutProps["featurePathMsg"];
  viewModels: ReturnType<typeof useOrchestratorViewModels>;
  builderHandlers: ReturnType<typeof useBuilderHandlers>;
  libraryHandlers: ReturnType<typeof useLibraryHandlers>;
  scenarioHandlers: ReturnType<typeof useScenarioHandlers>;
  simulationHandlers: ReturnType<typeof useSimulationHandlers>;
  triggerFeaturePath: ReturnType<typeof useFeatureActions>["triggerFeaturePath"];
  rightPanelFeatureStatuses: ReturnType<typeof useFeatureActions>["rightPanelFeatureStatuses"];
};

export function buildAppOrchestratorLayoutProps({
  importSdfMolFileInputRef,
  importSmilesFileInputRef,
  importXyzFileInputRef,
  notifications,
  dismissNotification,
  activeLeftPanelTab,
  onLeftPanelTabChange,
  librarySearchQuery,
  onLibrarySearchQueryChange,
  selectedLibraryPhases,
  selectedLibrarySources,
  onSelectLibrarySubstance,
  createSubstanceDraft,
  createSubstanceValidationErrors,
  editSubstanceDraft,
  editSubstanceValidationErrors,
  libraryMutationState,
  libraryMutationError,
  libraryLoadError,
  builderDraft,
  allSubstances,
  builderCopyFeedbackMessage,
  scenarioNameInput,
  onScenarioNameInputChange,
  savedScenarios,
  selectedScenarioId,
  onSelectScenarioId,
  allPresets,
  onSelectPresetId,
  presetsLoadError,
  rightPanelSyncRevision,
  healthMsg,
  scenarioHistory,
  runtimeSettings,
  simulationControlState,
  simulationStateLabel,
  baselineSnapshot,
  featureFlagsMsg,
  featureFlags,
  featurePathMsg,
  viewModels,
  builderHandlers,
  libraryHandlers,
  scenarioHandlers,
  simulationHandlers,
  triggerFeaturePath,
  rightPanelFeatureStatuses,
}: BuildLayoutPropsParams): LayoutProps {
  const leftPanelProps: LeftPanelProps = {
    activeTab: activeLeftPanelTab,
    onTabChange: onLeftPanelTabChange,
    placeholderStateByTab: viewModels.placeholderStateByTab,
    libraryViewModel: {
      searchQuery: librarySearchQuery,
      onSearchQueryChange: onLibrarySearchQueryChange,
      selectedPhases: selectedLibraryPhases,
      selectedSources: selectedLibrarySources,
      onTogglePhase: libraryHandlers.handleLibraryPhaseToggle,
      onToggleSource: libraryHandlers.handleLibrarySourceToggle,
      onImportSdfMol: libraryHandlers.handleImportSdfMolClick,
      onImportSmiles: libraryHandlers.handleImportSmilesClick,
      onImportXyz: libraryHandlers.handleImportXyzClick,
      substances: viewModels.filteredLibrarySubstances,
      selectedSubstance: viewModels.selectedLibrarySubstance,
      onSelectSubstance: onSelectLibrarySubstance,
      createDraft: createSubstanceDraft,
      createValidationErrors: createSubstanceValidationErrors,
      onCreateDraftFieldChange: libraryHandlers.handleCreateSubstanceDraftFieldChange,
      onCreateSubmit: () => {
        void libraryHandlers.handleCreateSubstanceSubmit();
      },
      editDraft: editSubstanceDraft,
      editValidationErrors: editSubstanceValidationErrors,
      onEditDraftFieldChange: libraryHandlers.handleEditSubstanceDraftFieldChange,
      onEditSubmit: () => {
        void libraryHandlers.handleUpdateSubstanceSubmit();
      },
      onDeleteSelected: () => {
        void libraryHandlers.handleDeleteSelectedSubstance();
      },
      isMutating: libraryMutationState !== "idle",
      mutationErrorMessage: libraryMutationError,
      emptyMessage: viewModels.libraryEmptyMessage,
      errorMessage: libraryLoadError,
    },
    builderViewModel: {
      draft: builderDraft,
      onDraftFieldChange: builderHandlers.handleBuilderDraftFieldChange,
      allSubstances,
      onParticipantAdd: builderHandlers.handleBuilderParticipantAdd,
      onParticipantFieldChange: builderHandlers.handleBuilderParticipantFieldChange,
      onParticipantRemove: builderHandlers.handleBuilderParticipantRemove,
      onSaveDraft: builderHandlers.handleSaveBuilderDraft,
      copyFeedbackMessage: builderCopyFeedbackMessage,
      launchBlocked: viewModels.isBuilderLaunchBlocked,
      launchBlockReasons: viewModels.builderLaunchValidationErrors,
      scenarioNameInput,
      onScenarioNameInputChange,
      savedScenarios,
      selectedScenarioId,
      onSelectScenario: onSelectScenarioId,
      onSaveScenario: () => {
        void scenarioHandlers.handleSaveScenario();
      },
      onLoadScenario: () => {
        void scenarioHandlers.handleLoadScenario();
      },
      onSetBaselineSnapshot: scenarioHandlers.handleSetBaselineSnapshot,
      onRevertToBaseline: scenarioHandlers.handleRevertToBaseline,
      onRewindScenarioStep: scenarioHandlers.handleRewindScenarioStep,
      canSaveScenario: viewModels.canSaveScenario,
      canLoadScenario: viewModels.canLoadScenario,
      canSetBaselineSnapshot: viewModels.canSetBaselineSnapshot,
      canRevertToBaseline: viewModels.canRevertToBaseline,
      canRewindScenarioStep: viewModels.canRewindScenarioStep,
      isScenarioBusy: viewModels.isScenarioBusy,
      emptyMessage: viewModels.builderEmptyMessage,
    },
    presetsViewModel: {
      presets: allPresets,
      selectedPreset: viewModels.selectedPreset,
      onSelectPreset: onSelectPresetId,
      onUsePresetInBuilder: builderHandlers.handleUsePresetInBuilder,
      emptyMessage: viewModels.presetsEmptyMessage,
      errorMessage: presetsLoadError,
    },
  };

  const rightPanelProps: RightPanelProps = {
    healthMessage: healthMsg,
    featureStatuses: rightPanelFeatureStatuses,
    runtimeSettings,
    onRuntimeSettingsChange: simulationHandlers.handleRuntimeSettingsChange,
    stoichiometryResult: viewModels.stoichiometryResult,
    calculationSummary: viewModels.calculationSummary,
    calculationSummaryIsStale: viewModels.calculationSummaryIsStale,
    onExportCalculationSummary: simulationHandlers.handleExportCalculationSummary,
    scenarioHistory,
    environmentDerivedMetrics: viewModels.environmentDerivedMetrics,
  };

  return {
    importSdfMolFileInputRef,
    importSmilesFileInputRef,
    importXyzFileInputRef,
    onImportSdfMolFileChange: (event) => {
      void libraryHandlers.handleImportSdfMolFileChange(event);
    },
    onImportSmilesFileChange: (event) => {
      void libraryHandlers.handleImportSmilesFileChange(event);
    },
    onImportXyzFileChange: (event) => {
      void libraryHandlers.handleImportXyzFileChange(event);
    },
    notifications,
    onDismissNotification: dismissNotification,
    leftPanelProps,
    rightPanelKey: `right-panel-${rightPanelSyncRevision.toString()}`,
    rightPanelProps,
    controlState: simulationControlState,
    onSimulationStart: simulationHandlers.handleSimulationStart,
    onSimulationPause: simulationHandlers.handleSimulationPause,
    onSimulationReset: simulationHandlers.handleSimulationReset,
    onSimulationTimelinePositionChange: simulationHandlers.handleSimulationTimelinePositionChange,
    playBlocked: viewModels.isLaunchBlocked,
    playBlockedReason: viewModels.launchBlockedReason,
    sceneStateLabel: simulationStateLabel,
    sceneParticipants: viewModels.sceneParticipants,
    baselineSnapshot,
    particleModelEnvironment: viewModels.particleModelEnvironment,
    launchValidationModel: viewModels.launchValidationModel,
    healthMsg,
    featureFlagsMsg,
    featureFlags,
    featurePathMsg,
    onTriggerFeaturePath: triggerFeaturePath,
    statusBarFpsLimit: runtimeSettings.fpsLimit ?? 60,
    precisionProfile: runtimeSettings.precisionProfile,
  };
}
