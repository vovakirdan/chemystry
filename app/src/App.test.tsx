import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App, { applySimulationLifecycleCommand, buildLaunchValidationModel } from "./App";
import type { BuilderDraft } from "./features/left-panel/model";
import type { RightPanelRuntimeSettings } from "./features/right-panel/RightPanelSkeleton";
import type { SubstanceCatalogEntryV1 } from "./shared/contracts/ipc/v1";

const VALID_RUNTIME_SETTINGS: RightPanelRuntimeSettings = {
  temperatureC: 25,
  pressureAtm: 1,
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};

const SAMPLE_SUBSTANCES: ReadonlyArray<SubstanceCatalogEntryV1> = [
  {
    id: "builtin-substance-hydrogen",
    name: "Hydrogen",
    formula: "H2",
    phase: "gas",
    source: "builtin",
    molarMassGMol: 2.01588,
  },
];

function createBuilderDraftWithRawId(overrides: Partial<BuilderDraft> = {}): BuilderDraft {
  return {
    title: "Hydrogen setup",
    reactionClass: "inorganic",
    equation: "H2 -> H2",
    description: "Validation draft",
    participants: [
      {
        id: "participant-3b81de34-e5c9-4fc1-8fff-1234567890ab",
        substanceId: "builtin-substance-hydrogen",
        role: "reactant",
        stoichCoeffInput: "-1",
        phase: "gas",
        amountMolInput: "1",
        massGInput: "",
        volumeLInput: "22.4",
      },
      {
        id: "participant-2",
        substanceId: "builtin-substance-hydrogen",
        role: "product",
        stoichCoeffInput: "1",
        phase: "gas",
        amountMolInput: "1",
        massGInput: "2.01588",
        volumeLInput: "22.4",
      },
    ],
    ...overrides,
  };
}

describe("App pre-run validation", () => {
  it("renders grouped validation sections and blocks Play when checks fail", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('data-testid="launch-validation-card"');
    expect(html).toContain('data-testid="launch-validation-section-builder"');
    expect(html).toContain('data-testid="launch-validation-section-environment"');
    expect(html).toContain('data-testid="launch-validation-section-calculations"');
    expect(html).toContain(
      "Load a preset in Builder, then add participants before pressing &quot;Play&quot;.",
    );
    expect(html).toContain('data-testid="launch-validation-ok-environment"');
    expect(html).toContain('data-testid="launch-validation-ok-calculations"');
    expect(html).toContain('data-testid="center-control-play" disabled=""');
  });

  it("keeps validation text user-friendly and actionable", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Play is blocked until the issues below are fixed.");
    expect(html).toContain("Load a preset in Builder");
    expect(html).not.toContain("Stoich coeff");
  });

  it("removes greeting demo/template visuals from center panel", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).not.toContain("Welcome to Tauri + React");
    expect(html).not.toContain("Greeting demo");
    expect(html).not.toContain('id="greet-form"');
    expect(html).toContain("Simulation workspace");
    expect(html).toContain('data-testid="simulation-workspace-summary"');
  });

  it("uses human-friendly participant labels and does not leak raw participant ids", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const builderErrors =
      validation.sections.find((section) => section.id === "builder")?.errors ?? [];

    expect(builderErrors.length).toBeGreaterThan(0);
    expect(builderErrors.some((message) => message.includes("Participant 1 (Hydrogen):"))).toBe(
      true,
    );
    expect(
      builderErrors.some((message) => message.includes("participant-3b81de34-e5c9-4fc1-8fff")),
    ).toBe(false);
  });

  it("opens launch gate after fixing runtime and builder errors", () => {
    const invalidValidation = buildLaunchValidationModel(
      createBuilderDraftWithRawId(),
      {
        ...VALID_RUNTIME_SETTINGS,
        temperatureC: null,
      },
      SAMPLE_SUBSTANCES,
    );
    expect(invalidValidation.hasErrors).toBe(true);

    const validValidation = buildLaunchValidationModel(
      createBuilderDraftWithRawId({
        participants: [
          {
            id: "participant-raw-id-1",
            substanceId: "builtin-substance-hydrogen",
            role: "reactant",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "22.4",
          },
          {
            id: "participant-raw-id-2",
            substanceId: "builtin-substance-hydrogen",
            role: "product",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "22.4",
          },
        ],
      }),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );

    expect(validValidation.hasErrors).toBe(false);
    expect(validValidation.firstError).toBeNull();
  });
});

describe("App simulation lifecycle commands", () => {
  it("keeps start and pause idempotent while preserving timeline progress", () => {
    const initialState = {
      isPlaying: false,
      timelinePosition: 42,
    };
    const started = applySimulationLifecycleCommand({
      command: "start",
      simulationControlState: initialState,
      runtimeSettings: VALID_RUNTIME_SETTINGS,
      builderDraft: null,
      launchBlocked: false,
      baselineSnapshot: null,
    });

    expect(started.simulationControlState).toEqual({
      isPlaying: true,
      timelinePosition: 42,
    });

    const startedAgain = applySimulationLifecycleCommand({
      command: "start",
      simulationControlState: started.simulationControlState,
      runtimeSettings: started.runtimeSettings,
      builderDraft: started.builderDraft,
      launchBlocked: false,
      baselineSnapshot: null,
    });

    expect(startedAgain.simulationControlState).toBe(started.simulationControlState);

    const paused = applySimulationLifecycleCommand({
      command: "pause",
      simulationControlState: started.simulationControlState,
      runtimeSettings: started.runtimeSettings,
      builderDraft: started.builderDraft,
      launchBlocked: false,
      baselineSnapshot: null,
    });

    expect(paused.simulationControlState).toEqual({
      isPlaying: false,
      timelinePosition: 42,
    });

    const pausedAgain = applySimulationLifecycleCommand({
      command: "pause",
      simulationControlState: paused.simulationControlState,
      runtimeSettings: paused.runtimeSettings,
      builderDraft: paused.builderDraft,
      launchBlocked: false,
      baselineSnapshot: null,
    });

    expect(pausedAgain.simulationControlState).toBe(paused.simulationControlState);
  });

  it("resets to baseline snapshot for timeline, runtime settings, and builder draft", () => {
    const baselineDraft = createBuilderDraftWithRawId({
      title: "Baseline draft",
      participants: [
        {
          id: "baseline-participant",
          substanceId: "builtin-substance-hydrogen",
          role: "reactant",
          stoichCoeffInput: "1",
          phase: "gas",
          amountMolInput: "2",
          massGInput: "4.03176",
          volumeLInput: "44.8",
        },
      ],
    });
    const baselineRuntime: RightPanelRuntimeSettings = {
      ...VALID_RUNTIME_SETTINGS,
      temperatureC: 120,
      pressureAtm: 2,
      calculationPasses: 500,
      precisionProfile: "High Precision",
      fpsLimit: 90,
    };
    const resetResult = applySimulationLifecycleCommand({
      command: "reset",
      simulationControlState: {
        isPlaying: true,
        timelinePosition: 9,
      },
      runtimeSettings: VALID_RUNTIME_SETTINGS,
      builderDraft: createBuilderDraftWithRawId({
        title: "Working draft",
        participants: [],
      }),
      launchBlocked: false,
      baselineSnapshot: {
        builderDraft: baselineDraft,
        runtimeSettings: baselineRuntime,
        simulationControlState: {
          isPlaying: false,
          timelinePosition: 73,
        },
      },
    });

    expect(resetResult.simulationControlState).toEqual({
      isPlaying: false,
      timelinePosition: 73,
    });
    expect(resetResult.runtimeSettings).toEqual(baselineRuntime);
    expect(resetResult.builderDraft).toEqual(baselineDraft);
    expect(resetResult.runtimeSettingsChanged).toBe(true);
    expect(resetResult.builderDraftChanged).toBe(true);

    const resetAgain = applySimulationLifecycleCommand({
      command: "reset",
      simulationControlState: resetResult.simulationControlState,
      runtimeSettings: resetResult.runtimeSettings,
      builderDraft: resetResult.builderDraft,
      launchBlocked: false,
      baselineSnapshot: {
        builderDraft: baselineDraft,
        runtimeSettings: baselineRuntime,
        simulationControlState: {
          isPlaying: false,
          timelinePosition: 73,
        },
      },
    });

    expect(resetAgain.simulationControlState).toBe(resetResult.simulationControlState);
    expect(resetAgain.runtimeSettings).toBe(resetResult.runtimeSettings);
    expect(resetAgain.builderDraft).toBe(resetResult.builderDraft);
    expect(resetAgain.runtimeSettingsChanged).toBe(false);
    expect(resetAgain.builderDraftChanged).toBe(false);
  });
});
