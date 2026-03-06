import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type { NotificationLevel } from "../../shared/lib/notifications";
import {
  applySimulationLifecycleCommand,
  type BuilderRuntimeSnapshot,
  type SimulationLifecycleCommand,
} from "../simulation/lifecycle";
import { exportCalculationSummary } from "../lib/exportCalculationSummary";
import { stripGeneratedScenarioNameSuffix } from "../persistence/scenarioHistoryStorage";
import type { CalculationSummaryV1 } from "../../shared/contracts/ipc/v1";

type UseSimulationHandlersParams = {
  simulationControlState: CenterPanelControlState;
  runtimeSettings: RightPanelRuntimeSettings;
  builderDraft: BuilderDraft | null;
  isLaunchBlocked: boolean;
  baselineSnapshot: BuilderRuntimeSnapshot | null;
  scenarioNameInput: string;
  calculationSummary: CalculationSummaryV1 | null;
  setSimulationControlState: Dispatch<SetStateAction<CenterPanelControlState>>;
  setRuntimeSettings: Dispatch<SetStateAction<RightPanelRuntimeSettings>>;
  setBuilderDraft: Dispatch<SetStateAction<BuilderDraft | null>>;
  setRightPanelSyncRevision: Dispatch<SetStateAction<number>>;
  setLastPersistedCalculationInputSignature: Dispatch<SetStateAction<string | null>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

type SimulationExportDependencies = {
  exportCalculationSummary: typeof exportCalculationSummary;
  stripGeneratedScenarioNameSuffix: typeof stripGeneratedScenarioNameSuffix;
};

const DEFAULT_SIMULATION_EXPORT_DEPENDENCIES: Readonly<SimulationExportDependencies> = {
  exportCalculationSummary,
  stripGeneratedScenarioNameSuffix,
};

export function resolveCalculationExportBaseName(
  scenarioNameInput: string,
  builderDraft: BuilderDraft | null,
  dependencies: Readonly<SimulationExportDependencies> = DEFAULT_SIMULATION_EXPORT_DEPENDENCIES,
): string {
  const normalizedScenarioName = dependencies.stripGeneratedScenarioNameSuffix(scenarioNameInput);
  const normalizedBuilderTitle = builderDraft?.title.trim() ?? "";

  return normalizedScenarioName.length > 0
    ? normalizedScenarioName
    : normalizedBuilderTitle.length > 0
      ? normalizedBuilderTitle
      : "scenario";
}

export function executeCalculationSummaryExport(
  params: {
    calculationSummary: CalculationSummaryV1 | null;
    scenarioNameInput: string;
    builderDraft: BuilderDraft | null;
    setLastPersistedCalculationInputSignature: Dispatch<SetStateAction<string | null>>;
    enqueueNotification: (level: NotificationLevel, message: string) => void;
  },
  dependencies: Readonly<SimulationExportDependencies> = DEFAULT_SIMULATION_EXPORT_DEPENDENCIES,
): void {
  if (params.calculationSummary === null) {
    params.enqueueNotification(
      "warn",
      "Calculation summary is unavailable. Complete required inputs before exporting.",
    );
    return;
  }

  const exportBaseName = resolveCalculationExportBaseName(
    params.scenarioNameInput,
    params.builderDraft,
    dependencies,
  );

  try {
    dependencies.exportCalculationSummary(params.calculationSummary, exportBaseName);
    params.setLastPersistedCalculationInputSignature(params.calculationSummary.inputSignature);
    params.enqueueNotification("info", `Calculation summary exported for "${exportBaseName}".`);
  } catch (error: unknown) {
    params.enqueueNotification("error", `Calculation summary export failed: ${String(error)}`);
  }
}

export function useSimulationHandlers({
  simulationControlState,
  runtimeSettings,
  builderDraft,
  isLaunchBlocked,
  baselineSnapshot,
  scenarioNameInput,
  calculationSummary,
  setSimulationControlState,
  setRuntimeSettings,
  setBuilderDraft,
  setRightPanelSyncRevision,
  setLastPersistedCalculationInputSignature,
  enqueueNotification,
}: UseSimulationHandlersParams) {
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
    [
      baselineSnapshot,
      builderDraft,
      isLaunchBlocked,
      runtimeSettings,
      setBuilderDraft,
      setRightPanelSyncRevision,
      setRuntimeSettings,
      setSimulationControlState,
      simulationControlState,
    ],
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

  const handleSimulationTimelinePositionChange = useCallback(
    (timelinePosition: number): void => {
      setSimulationControlState((currentState) => {
        if (currentState.timelinePosition === timelinePosition) {
          return currentState;
        }

        return {
          ...currentState,
          timelinePosition,
        };
      });
    },
    [setSimulationControlState],
  );

  const handleRuntimeSettingsChange = useCallback(
    (state: RightPanelRuntimeSettings): void => {
      setRuntimeSettings(state);
    },
    [setRuntimeSettings],
  );

  const handleExportCalculationSummary = useCallback((): void => {
    executeCalculationSummaryExport({
      calculationSummary,
      scenarioNameInput,
      builderDraft,
      setLastPersistedCalculationInputSignature,
      enqueueNotification,
    });
  }, [
    builderDraft,
    calculationSummary,
    enqueueNotification,
    scenarioNameInput,
    setLastPersistedCalculationInputSignature,
  ]);

  return {
    handleSimulationStart,
    handleSimulationPause,
    handleSimulationReset,
    handleSimulationTimelinePositionChange,
    handleRuntimeSettingsChange,
    handleExportCalculationSummary,
  };
}
