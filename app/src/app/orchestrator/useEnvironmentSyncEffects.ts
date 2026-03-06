import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  createUserSubstanceDraftFromCatalogEntry,
  type BuilderDraft,
  type LeftPanelTabId,
  type UserSubstanceDraft,
} from "../../features/left-panel/model";
import type {
  RightPanelRuntimeSettings,
  ScenarioHistoryEntry,
} from "../../features/right-panel/RightPanelSkeleton";
import type { SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";
import type { NotificationLevel } from "../../shared/lib/notifications";
import {
  appendEnvironmentStepSnapshot,
  anchorEnvironmentRewindStack,
  createEnvironmentStepSnapshot,
  type EnvironmentStepSnapshot,
} from "../environment/rewind";
import {
  decideRuntimeSettingsSyncEffects,
  resolveSimulationControlStateOnLaunchBlock,
} from "./environmentSyncDecisions";
import {
  appendScenarioHistoryEntry,
  persistScenarioHistory,
} from "../persistence/scenarioHistoryStorage";
import { persistEnvironmentRewindStack } from "../persistence/environmentRewindStorage";
import { persistLeftPanelTab, readStoredBuilderDraft } from "../persistence/leftPanelStorage";

export {
  decideRuntimeSettingsSyncEffects,
  resolveSimulationControlStateOnLaunchBlock,
} from "./environmentSyncDecisions";

type UseEnvironmentSyncEffectsParams = {
  activeLeftPanelTab: LeftPanelTabId;
  scenarioHistory: ReadonlyArray<ScenarioHistoryEntry>;
  environmentRewindStack: ReadonlyArray<EnvironmentStepSnapshot>;
  runtimeSettings: RightPanelRuntimeSettings;
  simulationStateLabel: string;
  isLaunchBlocked: boolean;
  libraryLoadState: "loading" | "ready" | "error";
  allSubstances: ReadonlyArray<SubstanceCatalogEntryV1>;
  builderDraft: BuilderDraft | null;
  selectedEditableLibrarySubstance: SubstanceCatalogEntryV1 | null;
  selectedPresetId: string | null;
  resolvedSelectedPresetId: string | null;
  savedScenarios: ReadonlyArray<{ id: string }>;
  selectedScenarioId: string | null;
  setBuilderDraft: Dispatch<SetStateAction<BuilderDraft | null>>;
  setEditSubstanceDraft: Dispatch<SetStateAction<UserSubstanceDraft | null>>;
  setEditSubstanceValidationErrors: Dispatch<SetStateAction<ReadonlyArray<string>>>;
  setSelectedPresetId: Dispatch<SetStateAction<string | null>>;
  setSelectedScenarioId: Dispatch<SetStateAction<string | null>>;
  setScenarioHistory: Dispatch<SetStateAction<ReadonlyArray<ScenarioHistoryEntry>>>;
  setEnvironmentRewindStack: Dispatch<SetStateAction<ReadonlyArray<EnvironmentStepSnapshot>>>;
  setSimulationControlState: Dispatch<
    SetStateAction<{ isPlaying: boolean; timelinePosition: number }>
  >;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
  builderDraftHydratedRef: MutableRefObject<boolean>;
  previousSimulationStateRef: MutableRefObject<string | null>;
  previousRuntimeSettingsRef: MutableRefObject<RightPanelRuntimeSettings | null>;
  suppressEnvironmentHistoryRef: MutableRefObject<boolean>;
  environmentStackInitializedRef: MutableRefObject<boolean>;
};

export function useEnvironmentSyncEffects({
  activeLeftPanelTab,
  scenarioHistory,
  environmentRewindStack,
  runtimeSettings,
  simulationStateLabel,
  isLaunchBlocked,
  libraryLoadState,
  allSubstances,
  builderDraft,
  selectedEditableLibrarySubstance,
  selectedPresetId,
  resolvedSelectedPresetId,
  savedScenarios,
  selectedScenarioId,
  setBuilderDraft,
  setEditSubstanceDraft,
  setEditSubstanceValidationErrors,
  setSelectedPresetId,
  setSelectedScenarioId,
  setScenarioHistory,
  setEnvironmentRewindStack,
  setSimulationControlState,
  enqueueNotification,
  builderDraftHydratedRef,
  previousSimulationStateRef,
  previousRuntimeSettingsRef,
  suppressEnvironmentHistoryRef,
  environmentStackInitializedRef,
}: UseEnvironmentSyncEffectsParams): void {
  useEffect(() => {
    persistLeftPanelTab(activeLeftPanelTab);
  }, [activeLeftPanelTab]);

  useEffect(() => {
    persistScenarioHistory(scenarioHistory);
  }, [scenarioHistory]);

  useEffect(() => {
    persistEnvironmentRewindStack(environmentRewindStack);
  }, [environmentRewindStack]);

  useEffect(() => {
    if (environmentStackInitializedRef.current) {
      return;
    }

    environmentStackInitializedRef.current = true;
    setEnvironmentRewindStack((currentStack) =>
      anchorEnvironmentRewindStack(runtimeSettings, currentStack),
    );
  }, [environmentStackInitializedRef, runtimeSettings, setEnvironmentRewindStack]);

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
  }, [enqueueNotification, previousSimulationStateRef, simulationStateLabel]);

  useEffect(() => {
    const previousRuntimeSettings = previousRuntimeSettingsRef.current;

    if (previousRuntimeSettings === null) {
      previousRuntimeSettingsRef.current = runtimeSettings;
      return;
    }

    if (suppressEnvironmentHistoryRef.current) {
      suppressEnvironmentHistoryRef.current = false;
      previousRuntimeSettingsRef.current = runtimeSettings;
      return;
    }

    const timestampLabel = new Date().toLocaleTimeString();
    const syncDecision = decideRuntimeSettingsSyncEffects(previousRuntimeSettings, runtimeSettings);

    for (const notification of syncDecision.notifications) {
      enqueueNotification(notification.level, notification.message);
    }

    for (const message of syncDecision.historyMessages) {
      setScenarioHistory((currentHistory) =>
        appendScenarioHistoryEntry(currentHistory, {
          timestampLabel,
          category: "environment",
          message,
        }),
      );
    }

    if (syncDecision.environmentChanged) {
      setEnvironmentRewindStack((currentStack) =>
        appendEnvironmentStepSnapshot(currentStack, createEnvironmentStepSnapshot(runtimeSettings)),
      );
    }

    previousRuntimeSettingsRef.current = runtimeSettings;
  }, [
    enqueueNotification,
    previousRuntimeSettingsRef,
    runtimeSettings,
    setScenarioHistory,
    setEnvironmentRewindStack,
    suppressEnvironmentHistoryRef,
  ]);

  useEffect(() => {
    if (!isLaunchBlocked) {
      return;
    }

    setSimulationControlState((currentState) => {
      return resolveSimulationControlStateOnLaunchBlock(currentState);
    });
  }, [isLaunchBlocked, setSimulationControlState]);

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
  }, [selectedEditableLibrarySubstance, setEditSubstanceDraft, setEditSubstanceValidationErrors]);

  useEffect(() => {
    if (selectedPresetId !== resolvedSelectedPresetId) {
      setSelectedPresetId(resolvedSelectedPresetId);
    }
  }, [resolvedSelectedPresetId, selectedPresetId, setSelectedPresetId]);

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
  }, [savedScenarios, selectedScenarioId, setSelectedScenarioId]);

  useEffect(() => {
    if (builderDraftHydratedRef.current || libraryLoadState !== "ready") {
      return;
    }

    if (builderDraft !== null) {
      builderDraftHydratedRef.current = true;
      return;
    }

    setBuilderDraft(readStoredBuilderDraft(allSubstances));
    builderDraftHydratedRef.current = true;
  }, [allSubstances, builderDraft, builderDraftHydratedRef, libraryLoadState, setBuilderDraft]);
}
