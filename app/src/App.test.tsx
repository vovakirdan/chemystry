import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import App, {
  LaunchValidationCard,
  anchorEnvironmentRewindStack,
  applySimulationLifecycleCommand,
  buildLaunchValidationModel,
  createCalculationInputSignature,
  isCalculationSummaryStale,
  parseEnvironmentRewindStackFromStorageValue,
  parseScenarioHistoryFromStorageValue,
  rewindEnvironmentStep,
} from "./App";
import type { BuilderDraft } from "./features/left-panel/model";
import type { RightPanelRuntimeSettings } from "./features/right-panel/RightPanelSkeleton";
import type { SubstanceCatalogEntryV1 } from "./shared/contracts/ipc/v1";

const VALID_RUNTIME_SETTINGS: RightPanelRuntimeSettings = {
  temperatureC: 25,
  pressureAtm: 1,
  gasMedium: "gas",
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};
const RUNTIME_IDEAL_GAS_MOLAR_VOLUME_L_PER_MOL = "24.4653953247";
const SCENARIO_HISTORY_STORAGE_KEY = "chemystery.scenario.history.v1";
const ENVIRONMENT_REWIND_STACK_STORAGE_KEY = "chemystery.environment.rewind.v1";

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

function createMemoryStorage(initialEntries: Record<string, string> = {}): Storage {
  const entries = new Map<string, string>(Object.entries(initialEntries));

  return {
    get length(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
    getItem(key: string): string | null {
      return entries.has(key) ? (entries.get(key) ?? null) : null;
    },
    key(index: number): string | null {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      entries.delete(key);
    },
    setItem(key: string, value: string): void {
      entries.set(key, value);
    },
  };
}

function withMockWindowLocalStorage(
  initialEntries: Record<string, string>,
  run: (storage: Storage) => void,
): void {
  const storage = createMemoryStorage(initialEntries);
  vi.stubGlobal("window", { localStorage: storage });

  try {
    run(storage);
  } finally {
    vi.unstubAllGlobals();
  }
}

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

function createValidBuilderDraft(overrides: Partial<BuilderDraft> = {}): BuilderDraft {
  return createBuilderDraftWithRawId({
    participants: [
      {
        id: "participant-valid-1",
        substanceId: "builtin-substance-hydrogen",
        role: "reactant",
        stoichCoeffInput: "1",
        phase: "gas",
        amountMolInput: "1",
        massGInput: "2.01588",
        volumeLInput: RUNTIME_IDEAL_GAS_MOLAR_VOLUME_L_PER_MOL,
      },
      {
        id: "participant-valid-2",
        substanceId: "builtin-substance-hydrogen",
        role: "product",
        stoichCoeffInput: "1",
        phase: "gas",
        amountMolInput: "1",
        massGInput: "2.01588",
        volumeLInput: RUNTIME_IDEAL_GAS_MOLAR_VOLUME_L_PER_MOL,
      },
    ],
    ...overrides,
  });
}

function createBuilderDraftWithNonNumericGasInputs(
  overrides: Partial<BuilderDraft> = {},
): BuilderDraft {
  return createBuilderDraftWithRawId({
    participants: [
      {
        id: "participant-nonnumeric-gas",
        substanceId: "builtin-substance-hydrogen",
        role: "reactant",
        stoichCoeffInput: "1",
        phase: "gas",
        amountMolInput: "abc",
        massGInput: "2.01588",
        volumeLInput: "def",
      },
      {
        id: "participant-liquid-product",
        substanceId: "builtin-substance-hydrogen",
        role: "product",
        stoichCoeffInput: "1",
        phase: "liquid",
        amountMolInput: "1",
        massGInput: "2.01588",
        volumeLInput: "1",
      },
    ],
    ...overrides,
  });
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

  it("shows stoichiometry calculation error state in right-panel summary for missing builder data", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-error"');
    expect(html).toContain("Stoichiometry is blocked until required Builder inputs are complete.");
    expect(html).toContain(
      "Add participants in Builder to calculate stoichiometry and limiting reactant.",
    );
  });

  it("renders stoichiometry success summary in App when builder has valid participants", () => {
    const html = renderToStaticMarkup(<App initialBuilderDraft={createValidBuilderDraft()} />);

    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-limiting"');
    expect(html).toContain("Limiting reactant:");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-products"');
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-yields"');
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-concentrations"');
    expect(html).toContain("Concentrations from entered amount/volume:");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-gas-runtime"');
    expect(html).toContain("Gas calculations at 25");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-gas"');
    expect(html).toContain("% yield");
    expect(html).toContain("% yield 100");
    expect(html).not.toContain(
      "Stoichiometry is blocked until required Builder inputs are complete.",
    );
  });

  it("keeps validation text user-friendly and actionable", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Play is blocked until the issues below are fixed.");
    expect(html).toContain("Load a preset in Builder");
    expect(html).not.toContain("Stoich coeff");
    expect(html).toContain("Error");
  });

  it("removes greeting demo/template visuals from center panel", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).not.toContain("Welcome to Tauri + React");
    expect(html).not.toContain("Greeting demo");
    expect(html).not.toContain('id="greet-form"');
    expect(html).toContain("Simulation workspace");
    expect(html).toContain('data-testid="simulation-workspace-summary"');
    expect(html).toContain('data-testid="simulation-workspace-environment-sync"');
    expect(html).toContain("Engine environment sync:");
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

  it("blocks launch for non-positive stoich coeff entered with comma decimal format", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId({
        participants: [
          {
            id: "participant-comma",
            substanceId: "builtin-substance-hydrogen",
            role: "reactant",
            stoichCoeffInput: "0,0",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "22.4",
          },
          {
            id: "participant-comma-2",
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

    const builderErrors =
      validation.sections.find((section) => section.id === "builder")?.errors ?? [];

    expect(validation.hasErrors).toBe(true);
    expect(
      builderErrors.some((message) =>
        message.includes("reaction coefficient must be greater than 0."),
      ),
    ).toBe(true);
  });

  it("shows actionable dimensional consistency errors in builder pre-run checks", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId({
        participants: [
          {
            id: "participant-dimension-mismatch",
            substanceId: "builtin-substance-hydrogen",
            role: "reactant",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "3",
            volumeLInput: "22.4",
          },
          {
            id: "participant-dimension-mismatch-2",
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

    const builderErrors =
      validation.sections.find((section) => section.id === "builder")?.errors ?? [];

    expect(validation.hasErrors).toBe(true);
    expect(
      builderErrors.some((message) =>
        message.includes(
          "Participant 1 (Hydrogen): mass in grams is inconsistent with amount in mol for selected substance.",
        ),
      ),
    ).toBe(true);
  });

  it("shows actionable missing molar-mass message in builder pre-run checks", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId({
        participants: [
          {
            id: "participant-missing-molar-mass",
            substanceId: "builtin-substance-hydrogen",
            role: "reactant",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2",
            volumeLInput: "22.4",
          },
        ],
      }),
      VALID_RUNTIME_SETTINGS,
      [
        {
          ...SAMPLE_SUBSTANCES[0],
          molarMassGMol: null,
        },
      ],
    );
    const builderErrors =
      validation.sections.find((section) => section.id === "builder")?.errors ?? [];

    expect(validation.hasErrors).toBe(true);
    expect(
      builderErrors.some((message) =>
        message.includes(
          "Participant 1 (Hydrogen): mass in grams cannot be validated without molar mass for selected substance.",
        ),
      ),
    ).toBe(true);
  });

  it("shows actionable gas volume mismatch message in builder pre-run checks", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId({
        participants: [
          {
            id: "participant-gas-volume-mismatch",
            substanceId: "builtin-substance-hydrogen",
            role: "reactant",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "30",
          },
        ],
      }),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const builderErrors =
      validation.sections.find((section) => section.id === "builder")?.errors ?? [];

    expect(validation.hasErrors).toBe(true);
    expect(
      builderErrors.some((message) =>
        message.includes(
          "Participant 1 (Hydrogen): volume in liters is inconsistent with amount in mol for gas phase.",
        ),
      ),
    ).toBe(true);
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
      createValidBuilderDraft(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );

    expect(validValidation.hasErrors).toBe(false);
    expect(validValidation.firstError).toBeNull();
  });

  it("keeps launch unblocked for gas values consistent with runtime-aware ideal gas molar volume", () => {
    const validation = buildLaunchValidationModel(
      createValidBuilderDraft({
        participants: [
          {
            id: "participant-runtime-reactant",
            substanceId: "builtin-substance-hydrogen",
            role: "reactant",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "24.4653953247",
          },
          {
            id: "participant-runtime-product",
            substanceId: "builtin-substance-hydrogen",
            role: "product",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "24.4653953247",
          },
        ],
      }),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const builderErrors =
      validation.sections.find((section) => section.id === "builder")?.errors ?? [];

    expect(validation.hasErrors).toBe(false);
    expect(
      builderErrors.some((message) => message.includes("volume in liters is inconsistent")),
    ).toBe(false);
  });

  it("enforces absolute-zero boundary with strict parity to gas calculation constraints", () => {
    const nonGasValidDraft = createValidBuilderDraft({
      participants: [
        {
          id: "participant-abszero-reactant",
          substanceId: "builtin-substance-hydrogen",
          role: "reactant",
          stoichCoeffInput: "1",
          phase: "liquid",
          amountMolInput: "1",
          massGInput: "2.01588",
          volumeLInput: "1",
        },
        {
          id: "participant-abszero-product",
          substanceId: "builtin-substance-hydrogen",
          role: "product",
          stoichCoeffInput: "1",
          phase: "liquid",
          amountMolInput: "1",
          massGInput: "2.01588",
          volumeLInput: "1",
        },
      ],
    });
    const atAbsoluteZero = buildLaunchValidationModel(
      nonGasValidDraft,
      {
        ...VALID_RUNTIME_SETTINGS,
        temperatureC: -273.15,
      },
      SAMPLE_SUBSTANCES,
    );
    const justAboveAbsoluteZero = buildLaunchValidationModel(
      nonGasValidDraft,
      {
        ...VALID_RUNTIME_SETTINGS,
        temperatureC: -273.14,
      },
      SAMPLE_SUBSTANCES,
    );

    expect(atAbsoluteZero.hasErrors).toBe(true);
    expect(
      atAbsoluteZero.sections.find((section) => section.id === "environment")?.errors,
    ).toContain("Set temperature above -273.15°C and up to 1000°C.");
    expect(justAboveAbsoluteZero.hasErrors).toBe(false);
  });

  it("shows model-limitation warning with explain hint and keeps Play unblocked", () => {
    const validation = buildLaunchValidationModel(
      createValidBuilderDraft(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const builderSection = validation.sections.find((section) => section.id === "builder");
    const warningMessage = builderSection?.warnings[0]?.message ?? "";
    const warningHint = builderSection?.warnings[0]?.explainHint ?? "";

    expect(validation.hasErrors).toBe(false);
    expect(validation.hasWarnings).toBe(true);
    expect(warningMessage).toContain("Model confidence / approximation limit");
    expect(warningHint).toContain("runtime temperature/pressure");
    expect(warningHint).toContain("fallback to 22.4 L/mol");

    const startResult = applySimulationLifecycleCommand({
      command: "start",
      simulationControlState: {
        isPlaying: false,
        timelinePosition: 12,
      },
      runtimeSettings: VALID_RUNTIME_SETTINGS,
      builderDraft: createValidBuilderDraft(),
      launchBlocked: validation.hasErrors,
      baselineSnapshot: null,
    });

    expect(startResult.simulationControlState.isPlaying).toBe(true);
  });

  it("does not show approximation warning when gas amount/volume inputs are non-numeric", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithNonNumericGasInputs(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const builderSection = validation.sections.find((section) => section.id === "builder");
    const builderWarnings = builderSection?.warnings ?? [];

    expect(validation.hasErrors).toBe(true);
    expect(builderWarnings).toHaveLength(0);
    expect(validation.hasWarnings).toBe(false);
  });

  it("renders explain hint in the unified warning list format", () => {
    const validation = buildLaunchValidationModel(
      createValidBuilderDraft(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const html = renderToStaticMarkup(<LaunchValidationCard model={validation} />);

    expect(html).toContain("Play is ready. Review warnings and approximation limits below.");
    expect(html).toContain("Warning");
    expect(html).toContain("Model confidence / approximation limit");
    expect(html).toContain("Explain:");
  });

  it("keeps blocked-card style precedence when errors and warnings are both present", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const html = renderToStaticMarkup(<LaunchValidationCard model={validation} />);

    expect(validation.hasErrors).toBe(true);
    expect(validation.hasWarnings).toBe(true);
    expect(html).toContain("launch-validation-card launch-validation-card--blocked");
    expect(html).not.toContain("launch-validation-card--warning");
  });

  it("deduplicates repeated launch errors and warnings", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const builderSection = validation.sections.find((section) => section.id === "builder");
    const builderErrors = builderSection?.errors ?? [];
    const builderWarnings = builderSection?.warnings ?? [];

    const repeatedCoeffErrors = builderErrors.filter(
      (message) =>
        message === "Participant 1 (Hydrogen): reaction coefficient must be greater than 0.",
    );
    const repeatedModelLimitWarnings = builderWarnings.filter((warning) =>
      warning.message.includes("Model confidence / approximation limit"),
    );

    expect(repeatedCoeffErrors).toHaveLength(1);
    expect(repeatedModelLimitWarnings).toHaveLength(1);
  });

  it("keeps launch blocked when blocking errors are present", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );

    expect(validation.hasErrors).toBe(true);

    const startResult = applySimulationLifecycleCommand({
      command: "start",
      simulationControlState: {
        isPlaying: false,
        timelinePosition: 5,
      },
      runtimeSettings: VALID_RUNTIME_SETTINGS,
      builderDraft: createBuilderDraftWithRawId(),
      launchBlocked: validation.hasErrors,
      baselineSnapshot: null,
    });

    expect(startResult.simulationControlState.isPlaying).toBe(false);
  });

  it("marks calculation summary as stale when persisted signature differs from current inputs", () => {
    expect(isCalculationSummaryStale("sig-current", "sig-saved")).toBe(true);
    expect(isCalculationSummaryStale("sig-current", "sig-current")).toBe(false);
  });

  it("changes calculation input signature when referenced catalog fields change", () => {
    const draft = createValidBuilderDraft();
    const signatureBefore = createCalculationInputSignature(draft, VALID_RUNTIME_SETTINGS, [
      ...SAMPLE_SUBSTANCES,
    ]);
    const signatureAfter = createCalculationInputSignature(draft, VALID_RUNTIME_SETTINGS, [
      {
        ...SAMPLE_SUBSTANCES[0],
        molarMassGMol: 2.2,
      },
    ]);

    expect(signatureBefore).not.toBe(signatureAfter);
  });

  it("does not mark calculation summary as stale when nothing was persisted yet", () => {
    expect(isCalculationSummaryStale("sig-current", null)).toBe(false);
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

describe("App environment rewind workflow", () => {
  it("rewinds environment settings while preserving non-environment runtime controls", () => {
    const currentSettings: RightPanelRuntimeSettings = {
      ...VALID_RUNTIME_SETTINGS,
      temperatureC: 180,
      pressureAtm: 4.5,
      gasMedium: "vacuum",
      calculationPasses: 700,
      precisionProfile: "High Precision",
      fpsLimit: 144,
    };
    const rewindStack = [
      { temperatureC: 180, pressureAtm: 4.5, gasMedium: "vacuum" as const },
      { temperatureC: 65, pressureAtm: 2.2, gasMedium: "liquid" as const },
      { temperatureC: 25, pressureAtm: 1, gasMedium: "gas" as const },
    ];

    const rewindResult = rewindEnvironmentStep(currentSettings, rewindStack);

    expect(rewindResult.status).toBe("applied");
    if (rewindResult.status !== "applied") {
      throw new Error("Expected applied rewind result.");
    }

    expect(rewindResult.nextStack).toEqual(rewindStack.slice(1));
    expect(rewindResult.nextSettings).toEqual({
      ...currentSettings,
      temperatureC: 65,
      pressureAtm: 2.2,
      gasMedium: "liquid",
    });
  });

  it("keeps suppressible runtime update unset when rewind target already matches current settings", () => {
    const currentSettings: RightPanelRuntimeSettings = {
      ...VALID_RUNTIME_SETTINGS,
      temperatureC: 25,
      pressureAtm: 1,
      gasMedium: "gas",
      calculationPasses: 600,
      precisionProfile: "Custom",
      fpsLimit: 120,
    };
    const rewindStack = [
      { temperatureC: 80, pressureAtm: 2, gasMedium: "vacuum" as const },
      { temperatureC: 25, pressureAtm: 1, gasMedium: "gas" as const },
    ];

    const rewindResult = rewindEnvironmentStep(currentSettings, rewindStack);

    expect(rewindResult.status).toBe("no_change");
    expect(rewindResult.nextSettings).toBeNull();
    expect(rewindResult.nextStack).toEqual(rewindStack.slice(1));
  });

  it("anchors cold-start rewind stack to current runtime and rewinds to the previous stored top", () => {
    const currentSettings: RightPanelRuntimeSettings = {
      ...VALID_RUNTIME_SETTINGS,
      temperatureC: 25,
      pressureAtm: 1,
      gasMedium: "gas",
    };
    const storedStack = [
      { temperatureC: 80, pressureAtm: 2, gasMedium: "vacuum" as const },
      { temperatureC: 60, pressureAtm: 1.5, gasMedium: "liquid" as const },
    ];

    const anchoredStack = anchorEnvironmentRewindStack(currentSettings, storedStack);

    expect(anchoredStack).toEqual([
      { temperatureC: 25, pressureAtm: 1, gasMedium: "gas" },
      ...storedStack,
    ]);
    expect(anchoredStack.length).toBeGreaterThan(1);

    const rewindResult = rewindEnvironmentStep(currentSettings, anchoredStack);

    expect(rewindResult.status).toBe("applied");
    if (rewindResult.status !== "applied") {
      throw new Error("Expected applied rewind result.");
    }

    expect(rewindResult.nextSettings).toEqual({
      ...currentSettings,
      temperatureC: 80,
      pressureAtm: 2,
      gasMedium: "vacuum",
    });
    expect(rewindResult.nextStack).toEqual(storedStack);
  });

  it("does not duplicate rewind stack when stored top already matches current runtime", () => {
    const currentSettings: RightPanelRuntimeSettings = {
      ...VALID_RUNTIME_SETTINGS,
      temperatureC: 25,
      pressureAtm: 1,
      gasMedium: "gas",
    };
    const storedStack = [
      { temperatureC: 25, pressureAtm: 1, gasMedium: "gas" as const },
      { temperatureC: 10, pressureAtm: 0.7, gasMedium: "vacuum" as const },
    ];

    const anchoredStack = anchorEnvironmentRewindStack(currentSettings, storedStack);

    expect(anchoredStack).toBe(storedStack);
  });
});

describe("App persistence helpers", () => {
  it("hydrates scenario history from localStorage at initial render", () => {
    withMockWindowLocalStorage(
      {
        [SCENARIO_HISTORY_STORAGE_KEY]: JSON.stringify([
          {
            id: "history-local-1",
            timestampLabel: "09:15:00",
            category: "environment",
            message: "Persisted environment change from local storage.",
          },
        ]),
        [ENVIRONMENT_REWIND_STACK_STORAGE_KEY]: JSON.stringify([
          {
            temperatureC: 40,
            pressureAtm: 1.2,
            gasMedium: "gas",
          },
        ]),
      },
      () => {
        const html = renderToStaticMarkup(<App />);
        expect(html).toContain("Persisted environment change from local storage.");
        expect(html).toContain('data-testid="right-panel-summary-history-list"');
      },
    );
  });

  it("filters malformed localStorage payloads for history and rewind stack", () => {
    withMockWindowLocalStorage({}, (storage) => {
      storage.setItem(
        SCENARIO_HISTORY_STORAGE_KEY,
        JSON.stringify([
          {
            id: "history-1",
            timestampLabel: "10:00:00",
            category: "environment",
            message: "Valid history entry.",
          },
          { id: "invalid-category", timestampLabel: "10:01:00", category: "other", message: "x" },
          { id: 123, timestampLabel: "10:02:00", category: "environment", message: "x" },
        ]),
      );
      storage.setItem(
        ENVIRONMENT_REWIND_STACK_STORAGE_KEY,
        JSON.stringify([
          { temperatureC: 90, pressureAtm: 3, gasMedium: "liquid" },
          { temperatureC: "bad", pressureAtm: 1, gasMedium: "gas" },
          { temperatureC: 50, pressureAtm: null, gasMedium: "unknown" },
          null,
        ]),
      );

      const parsedHistory = parseScenarioHistoryFromStorageValue(
        storage.getItem(SCENARIO_HISTORY_STORAGE_KEY),
      );
      const parsedRewindStack = parseEnvironmentRewindStackFromStorageValue(
        storage.getItem(ENVIRONMENT_REWIND_STACK_STORAGE_KEY),
      );

      expect(parsedHistory).toEqual([
        {
          id: "history-1",
          timestampLabel: "10:00:00",
          category: "environment",
          message: "Valid history entry.",
        },
      ]);
      expect(parsedRewindStack).toEqual([
        {
          temperatureC: 90,
          pressureAtm: 3,
          gasMedium: "liquid",
        },
      ]);
    });
  });
});
