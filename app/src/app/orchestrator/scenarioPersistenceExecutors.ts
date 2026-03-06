import type { Dispatch, SetStateAction } from "react";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type {
  RightPanelRuntimeSettings,
  ScenarioHistoryEntry,
} from "../../features/right-panel/RightPanelSkeleton";
import type { CalculationSummaryV1, ScenarioSummaryV1 } from "../../shared/contracts/ipc/v1";
import {
  isCommandErrorV1,
  listScenariosV1,
  loadScenarioV1,
  saveScenarioV1,
} from "../../shared/contracts/ipc/client";
import type { NotificationLevel } from "../../shared/lib/notifications";
import {
  appendEnvironmentStepSnapshot,
  createEnvironmentStepSnapshot,
  type EnvironmentStepSnapshot,
} from "../environment/rewind";
import {
  appendScenarioHistoryEntry,
  stripGeneratedScenarioNameSuffix,
} from "../persistence/scenarioHistoryStorage";
import {
  createBuilderRuntimeSnapshot,
  createScenarioPayloadFromSnapshot,
  createSnapshotFromScenarioPayload,
  formatCommandError,
  sortScenariosByUpdatedAt,
  type BuilderRuntimeSnapshot,
} from "../simulation/lifecycle";

type ScenarioPersistenceDependencies = {
  saveScenarioV1: typeof saveScenarioV1;
  listScenariosV1: typeof listScenariosV1;
  loadScenarioV1: typeof loadScenarioV1;
  isCommandErrorV1: typeof isCommandErrorV1;
};

const DEFAULT_SCENARIO_PERSISTENCE_DEPENDENCIES: Readonly<ScenarioPersistenceDependencies> = {
  saveScenarioV1,
  listScenariosV1,
  loadScenarioV1,
  isCommandErrorV1,
};

export type ExecuteSaveScenarioParams = {
  builderDraft: BuilderDraft | null;
  runtimeSettings: RightPanelRuntimeSettings;
  simulationControlState: CenterPanelControlState;
  scenarioNameInput: string;
  calculationSummary: CalculationSummaryV1 | null;
  setScenarioActionState: Dispatch<SetStateAction<"idle" | "saving" | "loading">>;
  setSavedScenarios: Dispatch<SetStateAction<ReadonlyArray<ScenarioSummaryV1>>>;
  setSelectedScenarioId: Dispatch<SetStateAction<string | null>>;
  setScenarioNameInput: Dispatch<SetStateAction<string>>;
  setBaselineSnapshot: Dispatch<SetStateAction<BuilderRuntimeSnapshot | null>>;
  setLastPersistedCalculationInputSignature: Dispatch<SetStateAction<string | null>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

export type ExecuteLoadScenarioParams = {
  selectedScenarioId: string | null;
  setScenarioActionState: Dispatch<SetStateAction<"idle" | "saving" | "loading">>;
  setBuilderDraft: Dispatch<SetStateAction<BuilderDraft | null>>;
  setRuntimeSettings: Dispatch<SetStateAction<RightPanelRuntimeSettings>>;
  setSimulationControlState: Dispatch<SetStateAction<CenterPanelControlState>>;
  setRightPanelSyncRevision: Dispatch<SetStateAction<number>>;
  setScenarioNameInput: Dispatch<SetStateAction<string>>;
  setSelectedScenarioId: Dispatch<SetStateAction<string | null>>;
  setBaselineSnapshot: Dispatch<SetStateAction<BuilderRuntimeSnapshot | null>>;
  setEnvironmentRewindStack: Dispatch<SetStateAction<ReadonlyArray<EnvironmentStepSnapshot>>>;
  setLastPersistedCalculationInputSignature: Dispatch<SetStateAction<string | null>>;
  setScenarioHistory: Dispatch<SetStateAction<ReadonlyArray<ScenarioHistoryEntry>>>;
  setBuilderCopyFeedbackMessage: Dispatch<SetStateAction<string | null>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

export async function executeSaveScenario(
  {
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
  }: ExecuteSaveScenarioParams,
  dependencies: Readonly<ScenarioPersistenceDependencies> = DEFAULT_SCENARIO_PERSISTENCE_DEPENDENCIES,
): Promise<void> {
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
    const result = await dependencies.saveScenarioV1({
      name: normalizedScenarioName,
      payload: createScenarioPayloadFromSnapshot(snapshot, calculationSummary ?? undefined),
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
    setLastPersistedCalculationInputSignature(calculationSummary?.inputSignature ?? null);

    try {
      const scenariosResult = await dependencies.listScenariosV1();
      setSavedScenarios(sortScenariosByUpdatedAt(scenariosResult.scenarios));
    } catch (refreshError: unknown) {
      const refreshMessage = dependencies.isCommandErrorV1(refreshError)
        ? formatCommandError(refreshError)
        : String(refreshError);
      enqueueNotification("warn", `Scenario saved, but refresh failed: ${refreshMessage}`);
    }

    enqueueNotification(
      "info",
      `Scenario "${normalizedScenarioName}" saved. Baseline snapshot updated.`,
    );
  } catch (error: unknown) {
    const message = dependencies.isCommandErrorV1(error)
      ? `Save scenario error: ${formatCommandError(error)}`
      : `Save scenario error: ${String(error)}`;
    enqueueNotification("error", message);
  } finally {
    setScenarioActionState("idle");
  }
}

export async function executeLoadScenario(
  {
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
  }: ExecuteLoadScenarioParams,
  dependencies: Readonly<ScenarioPersistenceDependencies> = DEFAULT_SCENARIO_PERSISTENCE_DEPENDENCIES,
): Promise<void> {
  if (selectedScenarioId === null) {
    enqueueNotification("warn", "Choose a saved scenario before loading.");
    return;
  }

  setScenarioActionState("loading");

  try {
    const result = await dependencies.loadScenarioV1({ id: selectedScenarioId });
    const snapshot = createSnapshotFromScenarioPayload(result.payload);

    setBuilderDraft(snapshot.builderDraft);
    setRuntimeSettings(snapshot.runtimeSettings);
    setSimulationControlState(snapshot.simulationControlState);
    setRightPanelSyncRevision((current) => current + 1);
    setScenarioNameInput(stripGeneratedScenarioNameSuffix(result.scenarioName));
    setSelectedScenarioId(result.scenarioId);
    setBaselineSnapshot(snapshot);
    setEnvironmentRewindStack((currentStack) =>
      appendEnvironmentStepSnapshot(
        currentStack,
        createEnvironmentStepSnapshot(snapshot.runtimeSettings),
      ),
    );
    setLastPersistedCalculationInputSignature(
      result.payload.calculationSummary?.inputSignature ?? null,
    );
    setScenarioHistory((currentHistory) =>
      appendScenarioHistoryEntry(currentHistory, {
        timestampLabel: new Date().toLocaleTimeString(),
        category: "environment",
        message: "Scenario loaded. Environment controls synchronized with saved runtime settings.",
      }),
    );
    setBuilderCopyFeedbackMessage(null);
    enqueueNotification(
      "info",
      `Scenario "${result.scenarioName}" loaded into Builder and set as baseline snapshot.`,
    );
  } catch (error: unknown) {
    const message = dependencies.isCommandErrorV1(error)
      ? `Load scenario error: ${formatCommandError(error)}`
      : `Load scenario error: ${String(error)}`;
    enqueueNotification("error", message);
  } finally {
    setScenarioActionState("idle");
  }
}
