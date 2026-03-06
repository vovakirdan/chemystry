import type { BuilderDraft } from "./features/left-panel/model";
import { resolveSimulationState } from "./app/simulation/lifecycle";
import { useBootstrapData } from "./app/orchestrator/useBootstrapData";
import { useEnvironmentSyncEffects } from "./app/orchestrator/useEnvironmentSyncEffects";
import { useFeatureActions } from "./app/orchestrator/useFeatureActions";
import { useLibraryHandlers } from "./app/orchestrator/useLibraryHandlers";
import { useBuilderHandlers } from "./app/orchestrator/useBuilderHandlers";
import { useScenarioHandlers } from "./app/orchestrator/useScenarioHandlers";
import { useSimulationHandlers } from "./app/orchestrator/useSimulationHandlers";
import { useOrchestratorViewModels } from "./app/orchestrator/buildViewModels";
import { buildAppOrchestratorLayoutProps } from "./app/orchestrator/buildLayoutProps";
import { useOrchestratorState } from "./app/orchestrator/useOrchestratorState";
import AppOrchestratorLayout from "./app/orchestrator/AppOrchestratorLayout";
import LaunchValidationCard from "./app/orchestrator/LaunchValidationCard";
import "./App.css";

type AppProps = {
  initialBuilderDraft?: BuilderDraft | null;
};

function AppOrchestrator({ initialBuilderDraft = null }: AppProps) {
  const orchestrator = useOrchestratorState({ initialBuilderDraft });
  const simulationStateLabel = resolveSimulationState(orchestrator.simulationControlState);

  useBootstrapData({
    enqueueNotification: orchestrator.enqueueNotification,
    setHealthMsg: orchestrator.setHealthMsg,
    setFeatureFlags: orchestrator.setFeatureFlags,
    setFeatureFlagsMsg: orchestrator.setFeatureFlagsMsg,
    setAllSubstances: orchestrator.setAllSubstances,
    setAllPresets: orchestrator.setAllPresets,
    setSavedScenarios: orchestrator.setSavedScenarios,
    setLibraryLoadState: orchestrator.setLibraryLoadState,
    setLibraryLoadError: orchestrator.setLibraryLoadError,
    setPresetsLoadState: orchestrator.setPresetsLoadState,
    setPresetsLoadError: orchestrator.setPresetsLoadError,
  });

  const viewModels = useOrchestratorViewModels({
    allSubstances: orchestrator.allSubstances,
    allPresets: orchestrator.allPresets,
    librarySearchQuery: orchestrator.librarySearchQuery,
    selectedLibraryPhases: orchestrator.selectedLibraryPhases,
    selectedLibrarySources: orchestrator.selectedLibrarySources,
    selectedLibrarySubstanceId: orchestrator.selectedLibrarySubstanceId,
    selectedPresetId: orchestrator.selectedPresetId,
    libraryLoadState: orchestrator.libraryLoadState,
    presetsLoadState: orchestrator.presetsLoadState,
    builderDraft: orchestrator.builderDraft,
    runtimeSettings: orchestrator.runtimeSettings,
    baselineSnapshot: orchestrator.baselineSnapshot,
    lastPersistedCalculationInputSignature: orchestrator.lastPersistedCalculationInputSignature,
    scenarioActionState: orchestrator.scenarioActionState,
    scenarioNameInput: orchestrator.scenarioNameInput,
    selectedScenarioId: orchestrator.selectedScenarioId,
    savedScenarios: orchestrator.savedScenarios,
    environmentRewindStack: orchestrator.environmentRewindStack,
  });

  useEnvironmentSyncEffects({
    activeLeftPanelTab: orchestrator.activeLeftPanelTab,
    scenarioHistory: orchestrator.scenarioHistory,
    environmentRewindStack: orchestrator.environmentRewindStack,
    runtimeSettings: orchestrator.runtimeSettings,
    simulationStateLabel,
    isLaunchBlocked: viewModels.isLaunchBlocked,
    libraryLoadState: orchestrator.libraryLoadState,
    allSubstances: orchestrator.allSubstances,
    builderDraft: orchestrator.builderDraft,
    selectedEditableLibrarySubstance: viewModels.selectedEditableLibrarySubstance,
    selectedPresetId: orchestrator.selectedPresetId,
    resolvedSelectedPresetId: viewModels.resolvedSelectedPresetId,
    savedScenarios: orchestrator.savedScenarios,
    selectedScenarioId: orchestrator.selectedScenarioId,
    setBuilderDraft: orchestrator.setBuilderDraft,
    setEditSubstanceDraft: orchestrator.setEditSubstanceDraft,
    setEditSubstanceValidationErrors: orchestrator.setEditSubstanceValidationErrors,
    setSelectedPresetId: orchestrator.setSelectedPresetId,
    setSelectedScenarioId: orchestrator.setSelectedScenarioId,
    setScenarioHistory: orchestrator.setScenarioHistory,
    setEnvironmentRewindStack: orchestrator.setEnvironmentRewindStack,
    setSimulationControlState: orchestrator.setSimulationControlState,
    enqueueNotification: orchestrator.enqueueNotification,
    builderDraftHydratedRef: orchestrator.builderDraftHydratedRef,
    previousSimulationStateRef: orchestrator.previousSimulationStateRef,
    previousRuntimeSettingsRef: orchestrator.previousRuntimeSettingsRef,
    suppressEnvironmentHistoryRef: orchestrator.suppressEnvironmentHistoryRef,
    environmentStackInitializedRef: orchestrator.environmentStackInitializedRef,
  });

  const { triggerFeaturePath, rightPanelFeatureStatuses } = useFeatureActions({
    featureFlags: orchestrator.featureFlags,
    setFeaturePathMsg: orchestrator.setFeaturePathMsg,
    enqueueNotification: orchestrator.enqueueNotification,
  });

  const builderHandlers = useBuilderHandlers({
    allSubstances: orchestrator.allSubstances,
    allPresets: orchestrator.allPresets,
    builderDraft: orchestrator.builderDraft,
    setBuilderDraft: orchestrator.setBuilderDraft,
    setPresetsLoadError: orchestrator.setPresetsLoadError,
    setSelectedPresetId: orchestrator.setSelectedPresetId,
    setBuilderCopyFeedbackMessage: orchestrator.setBuilderCopyFeedbackMessage,
    setScenarioNameInput: orchestrator.setScenarioNameInput,
    setActiveLeftPanelTab: orchestrator.setActiveLeftPanelTab,
    enqueueNotification: orchestrator.enqueueNotification,
  });

  const libraryHandlers = useLibraryHandlers({
    setSelectedLibraryPhases: orchestrator.setSelectedLibraryPhases,
    setSelectedLibrarySources: orchestrator.setSelectedLibrarySources,
    createSubstanceDraft: orchestrator.createSubstanceDraft,
    setCreateSubstanceDraft: orchestrator.setCreateSubstanceDraft,
    setCreateSubstanceValidationErrors: orchestrator.setCreateSubstanceValidationErrors,
    editSubstanceDraft: orchestrator.editSubstanceDraft,
    setEditSubstanceDraft: orchestrator.setEditSubstanceDraft,
    setEditSubstanceValidationErrors: orchestrator.setEditSubstanceValidationErrors,
    selectedEditableLibrarySubstance: viewModels.selectedEditableLibrarySubstance,
    libraryMutationState: orchestrator.libraryMutationState,
    setLibraryMutationState: orchestrator.setLibraryMutationState,
    setLibraryMutationError: orchestrator.setLibraryMutationError,
    featureFlags: orchestrator.featureFlags,
    importSdfMolFileInputRef: orchestrator.importSdfMolFileInputRef,
    importSmilesFileInputRef: orchestrator.importSmilesFileInputRef,
    importXyzFileInputRef: orchestrator.importXyzFileInputRef,
    setAllSubstances: orchestrator.setAllSubstances,
    setSelectedLibrarySubstanceId: orchestrator.setSelectedLibrarySubstanceId,
    setLibraryLoadState: orchestrator.setLibraryLoadState,
    setLibraryLoadError: orchestrator.setLibraryLoadError,
    enqueueNotification: orchestrator.enqueueNotification,
  });

  const scenarioHandlers = useScenarioHandlers({
    builderDraft: orchestrator.builderDraft,
    runtimeSettings: orchestrator.runtimeSettings,
    simulationControlState: orchestrator.simulationControlState,
    scenarioNameInput: orchestrator.scenarioNameInput,
    selectedScenarioId: orchestrator.selectedScenarioId,
    baselineSnapshot: orchestrator.baselineSnapshot,
    isLaunchBlocked: viewModels.isLaunchBlocked,
    calculationSummary: viewModels.calculationSummary,
    anchoredEnvironmentRewindStack: viewModels.anchoredEnvironmentRewindStack,
    setBuilderDraft: orchestrator.setBuilderDraft,
    setRuntimeSettings: orchestrator.setRuntimeSettings,
    setSimulationControlState: orchestrator.setSimulationControlState,
    setRightPanelSyncRevision: orchestrator.setRightPanelSyncRevision,
    setScenarioNameInput: orchestrator.setScenarioNameInput,
    setScenarioActionState: orchestrator.setScenarioActionState,
    setSavedScenarios: orchestrator.setSavedScenarios,
    setSelectedScenarioId: orchestrator.setSelectedScenarioId,
    setBaselineSnapshot: orchestrator.setBaselineSnapshot,
    setLastPersistedCalculationInputSignature:
      orchestrator.setLastPersistedCalculationInputSignature,
    setEnvironmentRewindStack: orchestrator.setEnvironmentRewindStack,
    setScenarioHistory: orchestrator.setScenarioHistory,
    setBuilderCopyFeedbackMessage: orchestrator.setBuilderCopyFeedbackMessage,
    suppressEnvironmentHistoryRef: orchestrator.suppressEnvironmentHistoryRef,
    enqueueNotification: orchestrator.enqueueNotification,
  });

  const simulationHandlers = useSimulationHandlers({
    simulationControlState: orchestrator.simulationControlState,
    runtimeSettings: orchestrator.runtimeSettings,
    builderDraft: orchestrator.builderDraft,
    isLaunchBlocked: viewModels.isLaunchBlocked,
    baselineSnapshot: orchestrator.baselineSnapshot,
    scenarioNameInput: orchestrator.scenarioNameInput,
    calculationSummary: viewModels.calculationSummary,
    setSimulationControlState: orchestrator.setSimulationControlState,
    setRuntimeSettings: orchestrator.setRuntimeSettings,
    setBuilderDraft: orchestrator.setBuilderDraft,
    setRightPanelSyncRevision: orchestrator.setRightPanelSyncRevision,
    setLastPersistedCalculationInputSignature:
      orchestrator.setLastPersistedCalculationInputSignature,
    enqueueNotification: orchestrator.enqueueNotification,
  });

  const layoutProps = buildAppOrchestratorLayoutProps({
    importSdfMolFileInputRef: orchestrator.importSdfMolFileInputRef,
    importSmilesFileInputRef: orchestrator.importSmilesFileInputRef,
    importXyzFileInputRef: orchestrator.importXyzFileInputRef,
    notifications: orchestrator.notifications,
    dismissNotification: orchestrator.dismissNotification,
    activeLeftPanelTab: orchestrator.activeLeftPanelTab,
    onLeftPanelTabChange: orchestrator.setActiveLeftPanelTab,
    librarySearchQuery: orchestrator.librarySearchQuery,
    onLibrarySearchQueryChange: orchestrator.setLibrarySearchQuery,
    selectedLibraryPhases: orchestrator.selectedLibraryPhases,
    selectedLibrarySources: orchestrator.selectedLibrarySources,
    onSelectLibrarySubstance: orchestrator.setSelectedLibrarySubstanceId,
    createSubstanceDraft: orchestrator.createSubstanceDraft,
    createSubstanceValidationErrors: orchestrator.createSubstanceValidationErrors,
    editSubstanceDraft: orchestrator.editSubstanceDraft,
    editSubstanceValidationErrors: orchestrator.editSubstanceValidationErrors,
    libraryMutationState: orchestrator.libraryMutationState,
    libraryMutationError: orchestrator.libraryMutationError,
    libraryLoadError: orchestrator.libraryLoadError,
    builderDraft: orchestrator.builderDraft,
    allSubstances: orchestrator.allSubstances,
    builderCopyFeedbackMessage: orchestrator.builderCopyFeedbackMessage,
    scenarioNameInput: orchestrator.scenarioNameInput,
    onScenarioNameInputChange: orchestrator.setScenarioNameInput,
    savedScenarios: orchestrator.savedScenarios,
    selectedScenarioId: orchestrator.selectedScenarioId,
    onSelectScenarioId: orchestrator.setSelectedScenarioId,
    allPresets: orchestrator.allPresets,
    onSelectPresetId: orchestrator.setSelectedPresetId,
    presetsLoadError: orchestrator.presetsLoadError,
    rightPanelSyncRevision: orchestrator.rightPanelSyncRevision,
    healthMsg: orchestrator.healthMsg,
    scenarioHistory: orchestrator.scenarioHistory,
    runtimeSettings: orchestrator.runtimeSettings,
    simulationControlState: orchestrator.simulationControlState,
    simulationStateLabel,
    baselineSnapshot: orchestrator.baselineSnapshot,
    featureFlagsMsg: orchestrator.featureFlagsMsg,
    featureFlags: orchestrator.featureFlags,
    featurePathMsg: orchestrator.featurePathMsg,
    viewModels,
    builderHandlers,
    libraryHandlers,
    scenarioHandlers,
    simulationHandlers,
    triggerFeaturePath,
    rightPanelFeatureStatuses,
  });

  return <AppOrchestratorLayout {...layoutProps} />;
}

export { LaunchValidationCard };
export default AppOrchestrator;
