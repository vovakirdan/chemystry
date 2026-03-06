import { describe, expect, it, vi } from "vitest";
import { buildAppOrchestratorLayoutProps } from "./buildLayoutProps";
import { STOICHIOMETRY_ASSUMPTIONS, STOICHIOMETRY_UNITS } from "../../shared/lib/stoichiometry";

type BuildParams = Parameters<typeof buildAppOrchestratorLayoutProps>[0];

function createParams(overrides?: Partial<BuildParams>): BuildParams {
  const libraryHandlers = {
    handleLibraryPhaseToggle: vi.fn(),
    handleLibrarySourceToggle: vi.fn(),
    handleImportSdfMolClick: vi.fn(),
    handleImportSmilesClick: vi.fn(),
    handleImportXyzClick: vi.fn(),
    handleCreateSubstanceDraftFieldChange: vi.fn(),
    handleCreateSubstanceSubmit: vi.fn(async () => {}),
    handleEditSubstanceDraftFieldChange: vi.fn(),
    handleUpdateSubstanceSubmit: vi.fn(async () => {}),
    handleDeleteSelectedSubstance: vi.fn(async () => {}),
    handleImportSdfMolFileChange: vi.fn(async () => {}),
    handleImportSmilesFileChange: vi.fn(async () => {}),
    handleImportXyzFileChange: vi.fn(async () => {}),
  };

  const scenarioHandlers = {
    handleSaveScenario: vi.fn(async () => {}),
    handleLoadScenario: vi.fn(async () => {}),
    handleSetBaselineSnapshot: vi.fn(),
    handleRevertToBaseline: vi.fn(),
    handleRewindScenarioStep: vi.fn(),
  };

  const simulationHandlers = {
    handleRuntimeSettingsChange: vi.fn(),
    handleExportCalculationSummary: vi.fn(),
    handleSimulationStart: vi.fn(),
    handleSimulationPause: vi.fn(),
    handleSimulationReset: vi.fn(),
    handleSimulationTimelinePositionChange: vi.fn(),
  };

  const params: BuildParams = {
    importSdfMolFileInputRef: { current: null },
    importSmilesFileInputRef: { current: null },
    importXyzFileInputRef: { current: null },
    notifications: [],
    dismissNotification: vi.fn(),
    activeLeftPanelTab: "library",
    onLeftPanelTabChange: vi.fn(),
    librarySearchQuery: "",
    onLibrarySearchQueryChange: vi.fn(),
    selectedLibraryPhases: new Set(),
    selectedLibrarySources: new Set(),
    onSelectLibrarySubstance: vi.fn(),
    createSubstanceDraft: {
      name: "",
      formula: "",
      phase: "solid",
      molarMassInput: "",
    },
    createSubstanceValidationErrors: [],
    editSubstanceDraft: null,
    editSubstanceValidationErrors: [],
    libraryMutationState: "idle",
    libraryMutationError: null,
    libraryLoadError: null,
    builderDraft: null,
    allSubstances: [],
    builderCopyFeedbackMessage: null,
    scenarioNameInput: "",
    onScenarioNameInputChange: vi.fn(),
    savedScenarios: [],
    selectedScenarioId: null,
    onSelectScenarioId: vi.fn(),
    allPresets: [],
    onSelectPresetId: vi.fn(),
    presetsLoadError: null,
    rightPanelSyncRevision: 7,
    healthMsg: "ok",
    scenarioHistory: [],
    runtimeSettings: {
      temperatureC: 25,
      pressureAtm: 1,
      gasMedium: "gas",
      calculationPasses: 250,
      precisionProfile: "Balanced",
      fpsLimit: 60,
    },
    simulationControlState: { isPlaying: false, timelinePosition: 0 },
    simulationStateLabel: "Paused",
    baselineSnapshot: null,
    featureFlagsMsg: "flags",
    featureFlags: { simulation: true, importExport: true, advancedPrecision: false },
    featurePathMsg: "",
    viewModels: {
      placeholderStateByTab: { library: "ready", builder: "empty", presets: "empty" },
      filteredLibrarySubstances: [],
      selectedLibrarySubstance: null,
      selectedEditableLibrarySubstance: null,
      libraryEmptyMessage: "",
      isBuilderLaunchBlocked: false,
      builderLaunchValidationErrors: [],
      canSaveScenario: false,
      canLoadScenario: false,
      canSetBaselineSnapshot: false,
      canRevertToBaseline: false,
      canRewindScenarioStep: false,
      isScenarioBusy: false,
      builderEmptyMessage: "",
      selectedPreset: null,
      resolvedSelectedPresetId: null,
      presetsEmptyMessage: "",
      stoichiometryResult: {
        ok: false,
        units: STOICHIOMETRY_UNITS,
        assumptions: STOICHIOMETRY_ASSUMPTIONS,
        errors: [],
      },
      calculationSummary: null,
      calculationInputSignature: "",
      calculationSummaryIsStale: false,
      environmentDerivedMetrics: {
        current: {
          temperatureK: 298.15,
          pressureAtm: 1,
          gasMedium: "gas",
          gasMolarVolumeLPerMol: null,
          collisionRateIndex: null,
        },
        baseline: null,
        warnings: [],
        errors: [],
        updatedAtLabel: "00:00:00",
      },
      isLaunchBlocked: false,
      launchBlockedReason: null,
      anchoredEnvironmentRewindStack: [],
      sceneParticipants: [],
      particleModelEnvironment: { temperatureK: 298.15, pressureAtm: 1, medium: "gas" },
      launchValidationModel: {
        sections: [],
        hasErrors: false,
        hasWarnings: false,
        firstError: null,
      },
    },
    builderHandlers: {
      handleBuilderDraftFieldChange: vi.fn(),
      handleBuilderParticipantAdd: vi.fn(),
      handleBuilderParticipantFieldChange: vi.fn(),
      handleBuilderParticipantRemove: vi.fn(),
      handleSaveBuilderDraft: vi.fn(),
      handleUsePresetInBuilder: vi.fn(),
    },
    libraryHandlers,
    scenarioHandlers,
    simulationHandlers,
    triggerFeaturePath: vi.fn(),
    rightPanelFeatureStatuses: [
      { id: "simulation", label: "Simulation", availability: "available" },
      { id: "importExport", label: "Import/export", availability: "available" },
      { id: "advancedPrecision", label: "Advanced precision", availability: "unavailable" },
    ],
    ...overrides,
  };

  return params;
}

describe("buildAppOrchestratorLayoutProps", () => {
  it("wires async submit/import callbacks to the matching handler functions", async () => {
    const params = createParams();
    const layout = buildAppOrchestratorLayoutProps(params);

    await layout.leftPanelProps.libraryViewModel.onCreateSubmit();
    await layout.leftPanelProps.libraryViewModel.onEditSubmit();
    await layout.leftPanelProps.libraryViewModel.onDeleteSelected();
    await layout.leftPanelProps.builderViewModel.onSaveScenario();
    await layout.leftPanelProps.builderViewModel.onLoadScenario();
    await layout.onImportSdfMolFileChange({} as never);
    await layout.onImportSmilesFileChange({} as never);
    await layout.onImportXyzFileChange({} as never);

    expect(params.libraryHandlers.handleCreateSubstanceSubmit).toHaveBeenCalledTimes(1);
    expect(params.libraryHandlers.handleUpdateSubstanceSubmit).toHaveBeenCalledTimes(1);
    expect(params.libraryHandlers.handleDeleteSelectedSubstance).toHaveBeenCalledTimes(1);
    expect(params.scenarioHandlers.handleSaveScenario).toHaveBeenCalledTimes(1);
    expect(params.scenarioHandlers.handleLoadScenario).toHaveBeenCalledTimes(1);
    expect(params.libraryHandlers.handleImportSdfMolFileChange).toHaveBeenCalledTimes(1);
    expect(params.libraryHandlers.handleImportSmilesFileChange).toHaveBeenCalledTimes(1);
    expect(params.libraryHandlers.handleImportXyzFileChange).toHaveBeenCalledTimes(1);
  });

  it("keeps panel control wiring and right-panel key contract", () => {
    const params = createParams();
    const layout = buildAppOrchestratorLayoutProps(params);

    layout.onSimulationStart();
    layout.onSimulationPause();
    layout.onSimulationReset();
    layout.onSimulationTimelinePositionChange(42);
    layout.rightPanelProps.onExportCalculationSummary?.();

    expect(params.simulationHandlers.handleSimulationStart).toHaveBeenCalledTimes(1);
    expect(params.simulationHandlers.handleSimulationPause).toHaveBeenCalledTimes(1);
    expect(params.simulationHandlers.handleSimulationReset).toHaveBeenCalledTimes(1);
    expect(params.simulationHandlers.handleSimulationTimelinePositionChange).toHaveBeenCalledWith(
      42,
    );
    expect(params.simulationHandlers.handleExportCalculationSummary).toHaveBeenCalledTimes(1);
    expect(layout.rightPanelKey).toBe("right-panel-7");
  });
});
