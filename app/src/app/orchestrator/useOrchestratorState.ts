import { useCallback, useRef, useState } from "react";
import type {
  BuilderDraft,
  LeftPanelTabId,
  UserSubstanceDraft,
} from "../../features/left-panel/model";
import {
  LIBRARY_PHASE_FILTER_OPTIONS,
  LIBRARY_SOURCE_FILTER_OPTIONS,
} from "../../features/left-panel/model";
import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type {
  RightPanelRuntimeSettings,
  ScenarioHistoryEntry,
} from "../../features/right-panel/RightPanelSkeleton";
import type { FeatureFlags } from "../../shared/config/featureFlags";
import { DEFAULT_FEATURE_FLAGS } from "../../shared/config/featureFlags";
import type {
  PresetCatalogEntryV1,
  ScenarioSummaryV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "../../shared/contracts/ipc/v1";
import {
  appendNotification,
  type AppNotification,
  type NotificationLevel,
} from "../../shared/lib/notifications";
import type { EnvironmentStepSnapshot } from "../environment/rewind";
import { readStoredEnvironmentRewindStack } from "../persistence/environmentRewindStorage";
import { readStoredScenarioHistory } from "../persistence/scenarioHistoryStorage";
import {
  createDefaultUserSubstanceDraft,
  readStoredLeftPanelTab,
} from "../persistence/leftPanelStorage";
import {
  DEFAULT_CENTER_PANEL_STATE,
  DEFAULT_RUNTIME_SETTINGS,
  type BuilderRuntimeSnapshot,
} from "../simulation/lifecycle";

type UseOrchestratorStateParams = {
  initialBuilderDraft: BuilderDraft | null;
};

export function useOrchestratorState({ initialBuilderDraft }: UseOrchestratorStateParams) {
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
  const [builderDraft, setBuilderDraft] = useState<BuilderDraft | null>(initialBuilderDraft);
  const [builderCopyFeedbackMessage, setBuilderCopyFeedbackMessage] = useState<string | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<ReadonlyArray<ScenarioSummaryV1>>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioNameInput, setScenarioNameInput] = useState("");
  const [scenarioHistory, setScenarioHistory] =
    useState<ReadonlyArray<ScenarioHistoryEntry>>(readStoredScenarioHistory);
  const [environmentRewindStack, setEnvironmentRewindStack] = useState<
    ReadonlyArray<EnvironmentStepSnapshot>
  >(readStoredEnvironmentRewindStack);
  const [scenarioActionState, setScenarioActionState] = useState<"idle" | "saving" | "loading">(
    "idle",
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState<BuilderRuntimeSnapshot | null>(null);
  const [lastPersistedCalculationInputSignature, setLastPersistedCalculationInputSignature] =
    useState<string | null>(null);
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
    "idle" | "creating" | "updating" | "deleting" | "importing"
  >("idle");
  const [libraryMutationError, setLibraryMutationError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ReadonlyArray<AppNotification>>([]);

  const notificationIdRef = useRef(0);
  const importSdfMolFileInputRef = useRef<HTMLInputElement | null>(null);
  const importSmilesFileInputRef = useRef<HTMLInputElement | null>(null);
  const importXyzFileInputRef = useRef<HTMLInputElement | null>(null);
  const builderDraftHydratedRef = useRef(false);
  const previousSimulationStateRef = useRef<string | null>(null);
  const previousRuntimeSettingsRef = useRef<RightPanelRuntimeSettings | null>(null);
  const suppressEnvironmentHistoryRef = useRef(false);
  const environmentStackInitializedRef = useRef(false);

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

  return {
    activeLeftPanelTab,
    setActiveLeftPanelTab,
    healthMsg,
    setHealthMsg,
    featureFlags,
    setFeatureFlags,
    featureFlagsMsg,
    setFeatureFlagsMsg,
    featurePathMsg,
    setFeaturePathMsg,
    simulationControlState,
    setSimulationControlState,
    runtimeSettings,
    setRuntimeSettings,
    rightPanelSyncRevision,
    setRightPanelSyncRevision,
    allSubstances,
    setAllSubstances,
    allPresets,
    setAllPresets,
    librarySearchQuery,
    setLibrarySearchQuery,
    selectedLibraryPhases,
    setSelectedLibraryPhases,
    selectedLibrarySources,
    setSelectedLibrarySources,
    selectedLibrarySubstanceId,
    setSelectedLibrarySubstanceId,
    selectedPresetId,
    setSelectedPresetId,
    libraryLoadState,
    setLibraryLoadState,
    libraryLoadError,
    setLibraryLoadError,
    presetsLoadState,
    setPresetsLoadState,
    presetsLoadError,
    setPresetsLoadError,
    builderDraft,
    setBuilderDraft,
    builderCopyFeedbackMessage,
    setBuilderCopyFeedbackMessage,
    savedScenarios,
    setSavedScenarios,
    selectedScenarioId,
    setSelectedScenarioId,
    scenarioNameInput,
    setScenarioNameInput,
    scenarioHistory,
    setScenarioHistory,
    environmentRewindStack,
    setEnvironmentRewindStack,
    scenarioActionState,
    setScenarioActionState,
    baselineSnapshot,
    setBaselineSnapshot,
    lastPersistedCalculationInputSignature,
    setLastPersistedCalculationInputSignature,
    createSubstanceDraft,
    setCreateSubstanceDraft,
    createSubstanceValidationErrors,
    setCreateSubstanceValidationErrors,
    editSubstanceDraft,
    setEditSubstanceDraft,
    editSubstanceValidationErrors,
    setEditSubstanceValidationErrors,
    libraryMutationState,
    setLibraryMutationState,
    libraryMutationError,
    setLibraryMutationError,
    notifications,
    enqueueNotification,
    dismissNotification,
    importSdfMolFileInputRef,
    importSmilesFileInputRef,
    importXyzFileInputRef,
    builderDraftHydratedRef,
    previousSimulationStateRef,
    previousRuntimeSettingsRef,
    suppressEnvironmentHistoryRef,
    environmentStackInitializedRef,
  };
}
