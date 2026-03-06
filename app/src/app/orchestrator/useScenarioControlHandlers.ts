import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type {
  RightPanelRuntimeSettings,
  ScenarioHistoryEntry,
} from "../../features/right-panel/RightPanelSkeleton";
import type { NotificationLevel } from "../../shared/lib/notifications";
import {
  appendEnvironmentStepSnapshot,
  createEnvironmentStepSnapshot,
  rewindEnvironmentStep,
  type EnvironmentStepSnapshot,
} from "../environment/rewind";
import { appendScenarioHistoryEntry } from "../persistence/scenarioHistoryStorage";
import {
  applySimulationLifecycleCommand,
  createBuilderRuntimeSnapshot,
  type BuilderRuntimeSnapshot,
  type SimulationLifecycleCommandResult,
} from "../simulation/lifecycle";

type UseScenarioControlHandlersParams = {
  builderDraft: BuilderDraft | null;
  runtimeSettings: RightPanelRuntimeSettings;
  simulationControlState: CenterPanelControlState;
  baselineSnapshot: BuilderRuntimeSnapshot | null;
  isLaunchBlocked: boolean;
  anchoredEnvironmentRewindStack: ReadonlyArray<EnvironmentStepSnapshot>;
  setBuilderDraft: Dispatch<SetStateAction<BuilderDraft | null>>;
  setRuntimeSettings: Dispatch<SetStateAction<RightPanelRuntimeSettings>>;
  setSimulationControlState: Dispatch<SetStateAction<CenterPanelControlState>>;
  setRightPanelSyncRevision: Dispatch<SetStateAction<number>>;
  setBaselineSnapshot: Dispatch<SetStateAction<BuilderRuntimeSnapshot | null>>;
  setEnvironmentRewindStack: Dispatch<SetStateAction<ReadonlyArray<EnvironmentStepSnapshot>>>;
  setScenarioHistory: Dispatch<SetStateAction<ReadonlyArray<ScenarioHistoryEntry>>>;
  suppressEnvironmentHistoryRef: MutableRefObject<boolean>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

function applyResetResult(
  result: SimulationLifecycleCommandResult,
  simulationControlState: CenterPanelControlState,
  setSimulationControlState: Dispatch<SetStateAction<CenterPanelControlState>>,
  setRuntimeSettings: Dispatch<SetStateAction<RightPanelRuntimeSettings>>,
  setRightPanelSyncRevision: Dispatch<SetStateAction<number>>,
  setBuilderDraft: Dispatch<SetStateAction<BuilderDraft | null>>,
): void {
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
}

export function useScenarioControlHandlers({
  builderDraft,
  runtimeSettings,
  simulationControlState,
  baselineSnapshot,
  isLaunchBlocked,
  anchoredEnvironmentRewindStack,
  setBuilderDraft,
  setRuntimeSettings,
  setSimulationControlState,
  setRightPanelSyncRevision,
  setBaselineSnapshot,
  setEnvironmentRewindStack,
  setScenarioHistory,
  suppressEnvironmentHistoryRef,
  enqueueNotification,
}: UseScenarioControlHandlersParams) {
  const handleSetBaselineSnapshot = useCallback((): void => {
    if (builderDraft === null) {
      enqueueNotification("warn", "Builder draft is empty. Cannot set baseline snapshot.");
      return;
    }

    setBaselineSnapshot(
      createBuilderRuntimeSnapshot(builderDraft, runtimeSettings, simulationControlState),
    );
    enqueueNotification("info", "Baseline snapshot updated.");
  }, [
    builderDraft,
    enqueueNotification,
    runtimeSettings,
    setBaselineSnapshot,
    simulationControlState,
  ]);

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

    applyResetResult(
      result,
      simulationControlState,
      setSimulationControlState,
      setRuntimeSettings,
      setRightPanelSyncRevision,
      setBuilderDraft,
    );

    if (result.runtimeSettingsChanged) {
      setEnvironmentRewindStack((currentStack) =>
        appendEnvironmentStepSnapshot(
          currentStack,
          createEnvironmentStepSnapshot(result.runtimeSettings),
        ),
      );
      setScenarioHistory((currentHistory) =>
        appendScenarioHistoryEntry(currentHistory, {
          timestampLabel: new Date().toLocaleTimeString(),
          category: "environment",
          message: "Baseline reset applied to environment controls.",
        }),
      );
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
    setBuilderDraft,
    setEnvironmentRewindStack,
    setRightPanelSyncRevision,
    setRuntimeSettings,
    setScenarioHistory,
    setSimulationControlState,
    simulationControlState,
  ]);

  const handleRewindScenarioStep = useCallback((): void => {
    const rewindResult = rewindEnvironmentStep(runtimeSettings, anchoredEnvironmentRewindStack);
    if (rewindResult.status === "unavailable") {
      enqueueNotification("warn", rewindResult.message);
      return;
    }

    setEnvironmentRewindStack(rewindResult.nextStack);
    if (rewindResult.status === "no_change") {
      enqueueNotification("info", rewindResult.message);
      return;
    }

    suppressEnvironmentHistoryRef.current = true;
    setRuntimeSettings(rewindResult.nextSettings);
    setRightPanelSyncRevision((current) => current + 1);
    setScenarioHistory((currentHistory) =>
      appendScenarioHistoryEntry(currentHistory, {
        timestampLabel: new Date().toLocaleTimeString(),
        category: "environment",
        message: rewindResult.message,
      }),
    );
    enqueueNotification("info", rewindResult.message);
  }, [
    anchoredEnvironmentRewindStack,
    enqueueNotification,
    runtimeSettings,
    setEnvironmentRewindStack,
    setRightPanelSyncRevision,
    setRuntimeSettings,
    setScenarioHistory,
    suppressEnvironmentHistoryRef,
  ]);

  return {
    handleSetBaselineSnapshot,
    handleRevertToBaseline,
    handleRewindScenarioStep,
  };
}
