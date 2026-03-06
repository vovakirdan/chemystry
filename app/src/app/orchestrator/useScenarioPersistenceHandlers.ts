import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type {
  RightPanelRuntimeSettings,
  ScenarioHistoryEntry,
} from "../../features/right-panel/RightPanelSkeleton";
import type { CalculationSummaryV1, ScenarioSummaryV1 } from "../../shared/contracts/ipc/v1";
import type { NotificationLevel } from "../../shared/lib/notifications";
import type { EnvironmentStepSnapshot } from "../environment/rewind";
import type { BuilderRuntimeSnapshot } from "../simulation/lifecycle";
import { executeLoadScenario, executeSaveScenario } from "./scenarioPersistenceExecutors";

export type UseScenarioPersistenceHandlersParams = {
  builderDraft: BuilderDraft | null;
  runtimeSettings: RightPanelRuntimeSettings;
  simulationControlState: CenterPanelControlState;
  scenarioNameInput: string;
  selectedScenarioId: string | null;
  calculationSummary: CalculationSummaryV1 | null;
  setBuilderDraft: Dispatch<SetStateAction<BuilderDraft | null>>;
  setRuntimeSettings: Dispatch<SetStateAction<RightPanelRuntimeSettings>>;
  setSimulationControlState: Dispatch<SetStateAction<CenterPanelControlState>>;
  setRightPanelSyncRevision: Dispatch<SetStateAction<number>>;
  setScenarioNameInput: Dispatch<SetStateAction<string>>;
  setScenarioActionState: Dispatch<SetStateAction<"idle" | "saving" | "loading">>;
  setSavedScenarios: Dispatch<SetStateAction<ReadonlyArray<ScenarioSummaryV1>>>;
  setSelectedScenarioId: Dispatch<SetStateAction<string | null>>;
  setBaselineSnapshot: Dispatch<SetStateAction<BuilderRuntimeSnapshot | null>>;
  setLastPersistedCalculationInputSignature: Dispatch<SetStateAction<string | null>>;
  setEnvironmentRewindStack: Dispatch<SetStateAction<ReadonlyArray<EnvironmentStepSnapshot>>>;
  setScenarioHistory: Dispatch<SetStateAction<ReadonlyArray<ScenarioHistoryEntry>>>;
  setBuilderCopyFeedbackMessage: Dispatch<SetStateAction<string | null>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

export { executeLoadScenario, executeSaveScenario } from "./scenarioPersistenceExecutors";

export function useScenarioPersistenceHandlers({
  builderDraft,
  runtimeSettings,
  simulationControlState,
  scenarioNameInput,
  selectedScenarioId,
  calculationSummary,
  setBuilderDraft,
  setRuntimeSettings,
  setSimulationControlState,
  setRightPanelSyncRevision,
  setScenarioNameInput,
  setScenarioActionState,
  setSavedScenarios,
  setSelectedScenarioId,
  setBaselineSnapshot,
  setLastPersistedCalculationInputSignature,
  setEnvironmentRewindStack,
  setScenarioHistory,
  setBuilderCopyFeedbackMessage,
  enqueueNotification,
}: UseScenarioPersistenceHandlersParams) {
  const handleSaveScenario = useCallback(async (): Promise<void> => {
    await executeSaveScenario({
      builderDraft,
      runtimeSettings,
      simulationControlState,
      scenarioNameInput,
      calculationSummary,
      setScenarioActionState,
      setSavedScenarios,
      setSelectedScenarioId,
      setScenarioNameInput,
      setBaselineSnapshot,
      setLastPersistedCalculationInputSignature,
      enqueueNotification,
    });
  }, [
    builderDraft,
    calculationSummary,
    enqueueNotification,
    runtimeSettings,
    scenarioNameInput,
    setBaselineSnapshot,
    setLastPersistedCalculationInputSignature,
    setSavedScenarios,
    setScenarioActionState,
    setScenarioNameInput,
    setSelectedScenarioId,
    simulationControlState,
  ]);

  const handleLoadScenario = useCallback(async (): Promise<void> => {
    await executeLoadScenario({
      selectedScenarioId,
      setScenarioActionState,
      setBuilderDraft,
      setRuntimeSettings,
      setSimulationControlState,
      setRightPanelSyncRevision,
      setScenarioNameInput,
      setSelectedScenarioId,
      setBaselineSnapshot,
      setEnvironmentRewindStack,
      setLastPersistedCalculationInputSignature,
      setScenarioHistory,
      setBuilderCopyFeedbackMessage,
      enqueueNotification,
    });
  }, [
    enqueueNotification,
    selectedScenarioId,
    setBaselineSnapshot,
    setBuilderCopyFeedbackMessage,
    setBuilderDraft,
    setEnvironmentRewindStack,
    setLastPersistedCalculationInputSignature,
    setRightPanelSyncRevision,
    setRuntimeSettings,
    setScenarioActionState,
    setScenarioHistory,
    setScenarioNameInput,
    setSelectedScenarioId,
    setSimulationControlState,
  ]);

  return {
    handleSaveScenario,
    handleLoadScenario,
  };
}
