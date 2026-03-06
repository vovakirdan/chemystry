import type { SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type {
  RightPanelRuntimeSettings,
  ScenarioHistoryEntry,
} from "../../features/right-panel/RightPanelSkeleton";
import type { CalculationSummaryV1, CommandErrorV1 } from "../../shared/contracts/ipc/v1";
import type { EnvironmentStepSnapshot } from "../environment/rewind";
import { formatCommandError } from "../simulation/lifecycle";
import {
  executeLoadScenario,
  type ExecuteLoadScenarioParams,
} from "./scenarioPersistenceExecutors";

type LoadDependencies = NonNullable<Parameters<typeof executeLoadScenario>[1]>;

const BUILDER_DRAFT: BuilderDraft = {
  title: "Water synthesis",
  reactionClass: "inorganic",
  equation: "2H2 + O2 -> 2H2O",
  description: "demo",
  participants: [
    {
      id: "p1",
      substanceId: "h2",
      role: "reactant",
      stoichCoeffInput: "2",
      phase: "gas",
      amountMolInput: "2",
      massGInput: "",
      volumeLInput: "",
    },
  ],
};

const RUNTIME_SETTINGS: RightPanelRuntimeSettings = {
  temperatureC: 42,
  pressureAtm: 1.5,
  gasMedium: "liquid",
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};

const CALCULATION_SUMMARY: CalculationSummaryV1 = {
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  inputSignature: "signature-1",
  entries: [],
};

function createStateSetter<T>(initialValue: T) {
  let value = initialValue;
  const setter = vi.fn((nextValue: SetStateAction<T>) => {
    value =
      typeof nextValue === "function" ? (nextValue as (currentValue: T) => T)(value) : nextValue;
  });

  return {
    getValue: (): T => value,
    setter,
  };
}

function createLoadParams(
  overrides?: Partial<ExecuteLoadScenarioParams>,
): ExecuteLoadScenarioParams {
  return {
    selectedScenarioId: "scenario-loaded",
    setScenarioActionState: vi.fn(),
    setBuilderDraft: vi.fn(),
    setRuntimeSettings: vi.fn(),
    setSimulationControlState: vi.fn(),
    setRightPanelSyncRevision: vi.fn(),
    setScenarioNameInput: vi.fn(),
    setSelectedScenarioId: vi.fn(),
    setBaselineSnapshot: vi.fn(),
    setEnvironmentRewindStack: vi.fn(),
    setLastPersistedCalculationInputSignature: vi.fn(),
    setScenarioHistory: vi.fn(),
    setBuilderCopyFeedbackMessage: vi.fn(),
    enqueueNotification: vi.fn(),
    ...overrides,
  };
}

describe("executeLoadScenario", () => {
  it("loads scenario and synchronizes builder/runtime state", async () => {
    const scenarioActionState = createStateSetter<"idle" | "saving" | "loading">("idle");
    const builderDraft = createStateSetter<BuilderDraft | null>(null);
    const runtimeSettings = createStateSetter<RightPanelRuntimeSettings>({
      ...RUNTIME_SETTINGS,
      temperatureC: 25,
      pressureAtm: 1,
      gasMedium: "gas",
    });
    const simulationControlState = createStateSetter<CenterPanelControlState>({
      isPlaying: false,
      timelinePosition: 37,
    });
    const rightPanelSyncRevision = createStateSetter<number>(3);
    const scenarioNameInput = createStateSetter<string>("before");
    const selectedScenarioId = createStateSetter<string | null>("scenario-before");
    const baselineSnapshot = createStateSetter<unknown>(null);
    const environmentRewindStack = createStateSetter<ReadonlyArray<EnvironmentStepSnapshot>>([]);
    const persistedSignature = createStateSetter<string | null>(null);
    const scenarioHistory = createStateSetter<ReadonlyArray<ScenarioHistoryEntry>>([]);
    const builderCopyFeedback = createStateSetter<string | null>("copied");
    const enqueueNotification = vi.fn();

    const dependencies: LoadDependencies = {
      saveScenarioV1: vi.fn(),
      listScenariosV1: vi.fn(),
      loadScenarioV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-load",
        scenarioId: "scenario-loaded",
        scenarioName: "Loaded scenario [1700000000000]",
        payload: {
          builderDraft: BUILDER_DRAFT,
          runtimeSettings: RUNTIME_SETTINGS,
          calculationSummary: CALCULATION_SUMMARY,
        },
      }),
      isCommandErrorV1: (_value: unknown): _value is CommandErrorV1 => false,
    };

    await executeLoadScenario(
      {
        selectedScenarioId: "scenario-loaded",
        setScenarioActionState: scenarioActionState.setter,
        setBuilderDraft: builderDraft.setter,
        setRuntimeSettings: runtimeSettings.setter,
        setSimulationControlState: simulationControlState.setter,
        setRightPanelSyncRevision: rightPanelSyncRevision.setter,
        setScenarioNameInput: scenarioNameInput.setter,
        setSelectedScenarioId: selectedScenarioId.setter,
        setBaselineSnapshot: baselineSnapshot.setter,
        setEnvironmentRewindStack: environmentRewindStack.setter,
        setLastPersistedCalculationInputSignature: persistedSignature.setter,
        setScenarioHistory: scenarioHistory.setter,
        setBuilderCopyFeedbackMessage: builderCopyFeedback.setter,
        enqueueNotification,
      },
      dependencies,
    );

    expect(scenarioActionState.setter.mock.calls.map((call) => call[0])).toEqual([
      "loading",
      "idle",
    ]);
    expect(builderDraft.getValue()).toEqual(BUILDER_DRAFT);
    expect(runtimeSettings.getValue()).toEqual(RUNTIME_SETTINGS);
    expect(simulationControlState.getValue()).toEqual({ isPlaying: false, timelinePosition: 0 });
    expect(rightPanelSyncRevision.getValue()).toBe(4);
    expect(scenarioNameInput.getValue()).toBe("Loaded scenario");
    expect(selectedScenarioId.getValue()).toBe("scenario-loaded");
    expect(baselineSnapshot.getValue()).not.toBeNull();
    expect(environmentRewindStack.getValue().length).toBe(1);
    expect(scenarioHistory.getValue().length).toBe(1);
    expect(persistedSignature.getValue()).toBe("signature-1");
    expect(builderCopyFeedback.getValue()).toBeNull();
    expect(enqueueNotification).toHaveBeenCalledWith(
      "info",
      'Scenario "Loaded scenario [1700000000000]" loaded into Builder and set as baseline snapshot.',
    );
  });

  it("maps load command errors into expected notification message", async () => {
    const scenarioActionState = createStateSetter<"idle" | "saving" | "loading">("idle");
    const enqueueNotification = vi.fn();
    const commandError: CommandErrorV1 = {
      version: "v1",
      requestId: "req-load-error",
      category: "simulation",
      code: "LOAD_FAILED",
      message: "load failed",
    };

    const dependencies: LoadDependencies = {
      saveScenarioV1: vi.fn(),
      listScenariosV1: vi.fn(),
      loadScenarioV1: vi.fn().mockRejectedValue(commandError),
      isCommandErrorV1: (error: unknown): error is CommandErrorV1 => error === commandError,
    };

    await executeLoadScenario(
      createLoadParams({
        setScenarioActionState: scenarioActionState.setter,
        enqueueNotification,
      }),
      dependencies,
    );

    expect(scenarioActionState.setter.mock.calls.map((call) => call[0])).toEqual([
      "loading",
      "idle",
    ]);
    expect(enqueueNotification).toHaveBeenCalledWith(
      "error",
      `Load scenario error: ${formatCommandError(commandError)}`,
    );
  });
});
