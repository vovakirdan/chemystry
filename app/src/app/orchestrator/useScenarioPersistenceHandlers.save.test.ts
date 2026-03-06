import type { SetStateAction } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import type {
  CalculationSummaryV1,
  CommandErrorV1,
  ScenarioSummaryV1,
} from "../../shared/contracts/ipc/v1";
import { formatCommandError } from "../simulation/lifecycle";
import { executeSaveScenario } from "./useScenarioPersistenceHandlers";

type SaveDependencies = NonNullable<Parameters<typeof executeSaveScenario>[1]>;

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
    {
      id: "p2",
      substanceId: "o2",
      role: "reactant",
      stoichCoeffInput: "1",
      phase: "gas",
      amountMolInput: "1",
      massGInput: "",
      volumeLInput: "",
    },
  ],
};

const RUNTIME_SETTINGS: RightPanelRuntimeSettings = {
  temperatureC: 25,
  pressureAtm: 1,
  gasMedium: "gas",
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};

const SIMULATION_CONTROL_STATE: CenterPanelControlState = {
  isPlaying: false,
  timelinePosition: 0,
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

describe("executeSaveScenario", () => {
  it("saves scenario and normalizes saved-state updates", async () => {
    const scenarioActionState = createStateSetter<"idle" | "saving" | "loading">("idle");
    const savedScenarios = createStateSetter<ReadonlyArray<ScenarioSummaryV1>>([
      {
        id: "existing",
        name: "Existing",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const selectedScenarioId = createStateSetter<string | null>(null);
    const scenarioNameInput = createStateSetter<string>("before");
    const capturedBaselineSnapshot = createStateSetter<unknown>(null);
    const persistedSignature = createStateSetter<string | null>(null);
    const enqueueNotification = vi.fn();

    const dependencies: SaveDependencies = {
      saveScenarioV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-save",
        updated: false,
        scenario: {
          id: "scenario-saved",
          name: "Lab run",
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
      }),
      listScenariosV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-list",
        scenarios: [
          {
            id: "scenario-old",
            name: "Old",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "scenario-new",
            name: "New",
            createdAt: "2026-01-04T00:00:00.000Z",
            updatedAt: "2026-01-04T00:00:00.000Z",
          },
        ],
      }),
      loadScenarioV1: vi.fn(),
      isCommandErrorV1: (_value: unknown): _value is CommandErrorV1 => false,
    };

    await executeSaveScenario(
      {
        builderDraft: BUILDER_DRAFT,
        runtimeSettings: RUNTIME_SETTINGS,
        simulationControlState: SIMULATION_CONTROL_STATE,
        scenarioNameInput: "Lab run [1700000000000]",
        calculationSummary: CALCULATION_SUMMARY,
        setScenarioActionState: scenarioActionState.setter,
        setSavedScenarios: savedScenarios.setter,
        setSelectedScenarioId: selectedScenarioId.setter,
        setScenarioNameInput: scenarioNameInput.setter,
        setBaselineSnapshot: vi.fn((value) => {
          if (typeof value !== "function") {
            capturedBaselineSnapshot.setter(value);
          }
        }),
        setLastPersistedCalculationInputSignature: persistedSignature.setter,
        enqueueNotification,
      },
      dependencies,
    );

    expect(dependencies.saveScenarioV1).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Lab run" }),
    );
    expect(scenarioActionState.setter.mock.calls.map((call) => call[0])).toEqual([
      "saving",
      "idle",
    ]);
    expect(selectedScenarioId.getValue()).toBe("scenario-saved");
    expect(scenarioNameInput.getValue()).toBe("Lab run");
    expect(capturedBaselineSnapshot.getValue()).not.toBeNull();
    expect(persistedSignature.getValue()).toBe("signature-1");
    expect(savedScenarios.getValue()).toEqual([
      {
        id: "scenario-new",
        name: "New",
        createdAt: "2026-01-04T00:00:00.000Z",
        updatedAt: "2026-01-04T00:00:00.000Z",
      },
      {
        id: "scenario-old",
        name: "Old",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(enqueueNotification).toHaveBeenCalledWith(
      "info",
      'Scenario "Lab run" saved. Baseline snapshot updated.',
    );
  });

  it("maps save command errors into expected notification message", async () => {
    const scenarioActionState = createStateSetter<"idle" | "saving" | "loading">("idle");
    const enqueueNotification = vi.fn();
    const commandError: CommandErrorV1 = {
      version: "v1",
      requestId: "req-save-error",
      category: "io",
      code: "SAVE_FAILED",
      message: "save failed",
    };

    const dependencies: SaveDependencies = {
      saveScenarioV1: vi.fn().mockRejectedValue(commandError),
      listScenariosV1: vi.fn(),
      loadScenarioV1: vi.fn(),
      isCommandErrorV1: (error: unknown): error is CommandErrorV1 => error === commandError,
    };

    await executeSaveScenario(
      {
        builderDraft: BUILDER_DRAFT,
        runtimeSettings: RUNTIME_SETTINGS,
        simulationControlState: SIMULATION_CONTROL_STATE,
        scenarioNameInput: "Lab run",
        calculationSummary: CALCULATION_SUMMARY,
        setScenarioActionState: scenarioActionState.setter,
        setSavedScenarios: vi.fn(),
        setSelectedScenarioId: vi.fn(),
        setScenarioNameInput: vi.fn(),
        setBaselineSnapshot: vi.fn(),
        setLastPersistedCalculationInputSignature: vi.fn(),
        enqueueNotification,
      },
      dependencies,
    );

    expect(scenarioActionState.setter.mock.calls.map((call) => call[0])).toEqual([
      "saving",
      "idle",
    ]);
    expect(enqueueNotification).toHaveBeenCalledWith(
      "error",
      `Save scenario error: ${formatCommandError(commandError)}`,
    );
  });
});
