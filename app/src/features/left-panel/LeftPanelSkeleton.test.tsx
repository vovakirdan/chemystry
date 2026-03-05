import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CenterPanelSkeleton from "../center-panel/CenterPanelSkeleton";
import type { BuilderDraft, BuilderDraftParticipant, UserSubstanceDraft } from "./model";
import LeftPanelSkeleton from "./LeftPanelSkeleton";

const DEFAULT_SUBSTANCE_DRAFT: UserSubstanceDraft = {
  name: "",
  formula: "",
  phase: "solid",
  molarMassInput: "",
};

const DEFAULT_BUILDER_DRAFT: BuilderDraft = {
  title: "",
  reactionClass: "inorganic",
  equation: "",
  description: "",
  participants: [],
};

function createBuilderParticipant(
  overrides: Partial<BuilderDraftParticipant> = {},
): BuilderDraftParticipant {
  return {
    id: "participant-1",
    substanceId: "builtin-substance-hydrogen",
    role: "reactant",
    stoichCoeffInput: "2",
    phase: "gas",
    amountMolInput: "1",
    massGInput: "2.01588",
    volumeLInput: "22.4",
    ...overrides,
  };
}

function createLibraryViewModel(
  overrides: Partial<ComponentProps<typeof LeftPanelSkeleton>["libraryViewModel"]> = {},
): ComponentProps<typeof LeftPanelSkeleton>["libraryViewModel"] {
  return {
    searchQuery: "",
    onSearchQueryChange: vi.fn(),
    selectedPhases: new Set(["gas", "liquid", "solid", "aqueous"] as const),
    selectedSources: new Set(["builtin", "imported", "user"] as const),
    onTogglePhase: vi.fn(),
    onToggleSource: vi.fn(),
    substances: [],
    selectedSubstance: null,
    onSelectSubstance: vi.fn(),
    createDraft: DEFAULT_SUBSTANCE_DRAFT,
    createValidationErrors: [],
    onCreateDraftFieldChange: vi.fn(),
    onCreateSubmit: vi.fn(),
    editDraft: null,
    editValidationErrors: [],
    onEditDraftFieldChange: vi.fn(),
    onEditSubmit: vi.fn(),
    onDeleteSelected: vi.fn(),
    isMutating: false,
    mutationErrorMessage: null,
    emptyMessage: "No substances.",
    errorMessage: null,
    ...overrides,
  };
}

function createBuilderViewModel(
  overrides: Partial<ComponentProps<typeof LeftPanelSkeleton>["builderViewModel"]> = {},
): ComponentProps<typeof LeftPanelSkeleton>["builderViewModel"] {
  return {
    draft: DEFAULT_BUILDER_DRAFT,
    onDraftFieldChange: vi.fn(),
    allSubstances: [],
    onParticipantAdd: vi.fn(),
    onParticipantFieldChange: vi.fn(),
    onParticipantRemove: vi.fn(),
    onSaveDraft: vi.fn(),
    copyFeedbackMessage: null,
    launchBlocked: false,
    launchBlockReasons: [],
    scenarioNameInput: "",
    onScenarioNameInputChange: vi.fn(),
    savedScenarios: [],
    selectedScenarioId: null,
    onSelectScenario: vi.fn(),
    onSaveScenario: vi.fn(),
    onLoadScenario: vi.fn(),
    onSetBaselineSnapshot: vi.fn(),
    onRevertToBaseline: vi.fn(),
    onRewindScenarioStep: vi.fn(),
    canSaveScenario: false,
    canLoadScenario: false,
    canSetBaselineSnapshot: true,
    canRevertToBaseline: false,
    canRewindScenarioStep: false,
    isScenarioBusy: false,
    emptyMessage: "Select a preset and use it in Builder.",
    ...overrides,
  };
}

function createPresetsViewModel(
  overrides: Partial<ComponentProps<typeof LeftPanelSkeleton>["presetsViewModel"]> = {},
): ComponentProps<typeof LeftPanelSkeleton>["presetsViewModel"] {
  return {
    presets: [],
    selectedPreset: null,
    onSelectPreset: vi.fn(),
    onUsePresetInBuilder: vi.fn(),
    emptyMessage: "No presets available.",
    errorMessage: null,
    ...overrides,
  };
}

function createLeftPanelProps(
  overrides: Partial<ComponentProps<typeof LeftPanelSkeleton>> = {},
): ComponentProps<typeof LeftPanelSkeleton> {
  return {
    activeTab: "library",
    onTabChange: vi.fn(),
    placeholderStateByTab: {
      library: "ready",
      builder: "empty",
      presets: "empty",
    },
    libraryViewModel: createLibraryViewModel(),
    builderViewModel: createBuilderViewModel(),
    presetsViewModel: createPresetsViewModel(),
    ...overrides,
  };
}

describe("LeftPanelSkeleton library tab", () => {
  it("renders stable selectors for search, filters, list, and property card when ready", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "library",
          libraryViewModel: createLibraryViewModel({
            searchQuery: "h2",
            substances: [
              {
                id: "builtin-substance-hydrogen",
                name: "Hydrogen",
                formula: "H2",
                phase: "gas",
                source: "builtin",
                molarMassGMol: 2.01588,
              },
            ],
            selectedSubstance: {
              id: "builtin-substance-hydrogen",
              name: "Hydrogen",
              formula: "H2",
              phase: "gas",
              source: "builtin",
              molarMassGMol: 2.01588,
            },
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="library-search-input"');
    expect(html).toContain('data-testid="library-filter-phase-gas"');
    expect(html).toContain('data-testid="library-filter-source-builtin"');
    expect(html).toContain('data-testid="library-substance-list"');
    expect(html).toContain('data-testid="library-property-card"');
    expect(html).toContain(">Hydrogen<");
  });

  it("renders library error state message", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "library",
          placeholderStateByTab: {
            library: "error",
            builder: "empty",
            presets: "empty",
          },
          libraryViewModel: createLibraryViewModel({
            errorMessage: "Backend unavailable",
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="library-state-error"');
    expect(html).toContain("Backend unavailable");
  });

  it("renders read-only message and no edit actions for builtin/imported selection", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "library",
          libraryViewModel: createLibraryViewModel({
            selectedSubstance: {
              id: "builtin-substance-water",
              name: "Water",
              formula: "H2O",
              phase: "liquid",
              source: "builtin",
              molarMassGMol: 18.01528,
            },
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="library-readonly-message"');
    expect(html).not.toContain('data-testid="library-edit-form"');
    expect(html).not.toContain('data-testid="library-delete-button"');
  });

  it("renders edit and delete actions for selected user substance with validation block", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "library",
          libraryViewModel: createLibraryViewModel({
            selectedSubstance: {
              id: "user-substance-ethanol",
              name: "Ethanol",
              formula: "C2H6O",
              phase: "liquid",
              source: "user",
              molarMassGMol: 46.06844,
            },
            editDraft: {
              name: "",
              formula: "",
              phase: "liquid",
              molarMassInput: "bad",
            },
            editValidationErrors: ["Name is required."],
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="library-edit-form"');
    expect(html).toContain('data-testid="library-delete-button"');
    expect(html).toContain('data-testid="library-edit-errors"');
  });
});

describe("CenterPanelSkeleton launch blocking", () => {
  it("disables Play and shows blocked reason when play is blocked", () => {
    const html = renderToStaticMarkup(
      <CenterPanelSkeleton
        controlState={{ isPlaying: false, timelinePosition: 25 }}
        playBlocked
        playBlockedReason={'Mass (g) for participant "participant-1" cannot be negative.'}
      />,
    );

    expect(html).toContain('data-testid="center-control-play"');
    expect(html).toContain('data-testid="center-control-play" disabled=""');
    expect(html).toContain('data-testid="center-control-status"');
    expect(html).toContain("Playback: blocked");
    expect(html).toContain('data-testid="center-control-blocked-reason"');
    expect(html).toContain(
      "Play disabled: Mass (g) for participant &quot;participant-1&quot; cannot be negative.",
    );
  });

  it("keeps Play available when blocking conditions are removed", () => {
    const html = renderToStaticMarkup(
      <CenterPanelSkeleton
        controlState={{ isPlaying: false, timelinePosition: 25 }}
        playBlocked={false}
      />,
    );

    expect(html).toContain('data-testid="center-control-play"');
    expect(html).not.toContain('data-testid="center-control-play" disabled=""');
    expect(html).not.toContain("Playback: blocked");
  });
});

describe("LeftPanelSkeleton presets and builder tabs", () => {
  it("renders presets metadata with class, complexity, description, and use action", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "presets",
          placeholderStateByTab: {
            library: "ready",
            builder: "empty",
            presets: "ready",
          },
          presetsViewModel: createPresetsViewModel({
            presets: [
              {
                id: "builtin-preset-hydrogen-combustion-v1",
                title: "Hydrogen combustion",
                reactionClass: "redox",
                equation: "2H2 + O2 -> 2H2O",
                complexity: "intro_level",
                description: "Preset combustion template for hydrogen oxidation.",
              },
            ],
            selectedPreset: {
              id: "builtin-preset-hydrogen-combustion-v1",
              title: "Hydrogen combustion",
              reactionClass: "redox",
              equation: "2H2 + O2 -> 2H2O",
              complexity: "intro_level",
              description: "Preset combustion template for hydrogen oxidation.",
            },
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="presets-list"');
    expect(html).toContain('data-testid="preset-meta-builtin-preset-hydrogen-combustion-v1"');
    expect(html).toContain(">Redox<");
    expect(html).toContain(">Intro Level<");
    expect(html).toContain("Preset combustion template for hydrogen oxidation.");
    expect(html).toContain('data-testid="preset-use-builtin-preset-hydrogen-combustion-v1"');
  });

  it("renders builder copy feedback banner and editable copied fields", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "builder",
          placeholderStateByTab: {
            library: "ready",
            builder: "ready",
            presets: "ready",
          },
          builderViewModel: createBuilderViewModel({
            draft: {
              title: "Hydrogen combustion",
              reactionClass: "redox",
              equation: "2H2 + O2 -> 2H2O",
              description: "Editable copy.",
              participants: [],
            },
            copyFeedbackMessage:
              'You are editing copy of preset "Hydrogen combustion". Original preset remains unchanged.',
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="builder-copy-feedback"');
    expect(html).toContain("editing copy of preset");
    expect(html).toContain("Hydrogen combustion");
    expect(html).toContain('data-testid="builder-form"');
    expect(html).toContain('data-testid="builder-title-input"');
    expect(html).toContain('value="Hydrogen combustion"');
    expect(html).toContain('data-testid="builder-class-select"');
    expect(html).toContain('data-testid="builder-equation-input"');
    expect(html).toContain('data-testid="builder-description-input"');
    expect(html).toContain('data-testid="builder-participant-add-form"');
    expect(html).toContain('data-testid="builder-save-draft-button"');
    expect(html).not.toContain('data-testid="builder-title-input" disabled=""');
  });

  it("renders scenario controls with stable selectors for save, load, and baseline actions", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "builder",
          placeholderStateByTab: {
            library: "ready",
            builder: "ready",
            presets: "ready",
          },
          builderViewModel: createBuilderViewModel({
            draft: {
              title: "Hydrogen combustion",
              reactionClass: "redox",
              equation: "2H2 + O2 -> 2H2O",
              description: "Editable scenario",
              participants: [],
            },
            scenarioNameInput: "Hydrogen what-if",
            savedScenarios: [
              {
                id: "scenario-run-1",
                name: "Hydrogen what-if",
                updatedAt: "2026-03-04T09:10:00Z",
              },
            ],
            selectedScenarioId: "scenario-run-1",
            canSaveScenario: true,
            canLoadScenario: true,
            canSetBaselineSnapshot: true,
            canRevertToBaseline: true,
            canRewindScenarioStep: true,
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="builder-scenario-controls"');
    expect(html).toContain('data-testid="builder-scenario-name-input"');
    expect(html).toContain('data-testid="builder-scenario-save-button"');
    expect(html).toContain('data-testid="builder-scenario-list-select"');
    expect(html).toContain('data-testid="builder-scenario-option-scenario-run-1"');
    expect(html).toContain('data-testid="builder-scenario-load-button"');
    expect(html).toContain('data-testid="builder-scenario-set-baseline-button"');
    expect(html).toContain('data-testid="builder-scenario-revert-baseline-button"');
    expect(html).toContain('data-testid="builder-scenario-rewind-button"');
  });

  it("renders participant list controls with stable selectors, units, and conversion hint", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "builder",
          placeholderStateByTab: {
            library: "ready",
            builder: "ready",
            presets: "ready",
          },
          builderViewModel: createBuilderViewModel({
            draft: {
              title: "Water synthesis",
              reactionClass: "inorganic",
              equation: "2H2 + O2 -> 2H2O",
              description: "Builder draft",
              participants: [
                createBuilderParticipant(),
                createBuilderParticipant({
                  id: "participant-2",
                  substanceId: "builtin-substance-water",
                  phase: "liquid",
                }),
              ],
            },
            allSubstances: [
              {
                id: "builtin-substance-hydrogen",
                name: "Hydrogen",
                formula: "H2",
                phase: "gas",
                source: "builtin",
                molarMassGMol: 2.01588,
              },
              {
                id: "builtin-substance-water",
                name: "Water",
                formula: "H2O",
                phase: "liquid",
                source: "builtin",
                molarMassGMol: 18.01528,
              },
            ],
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="builder-participant-list"');
    expect(html).toContain('data-testid="builder-participant-item-participant-1"');
    expect(html).toContain('data-testid="builder-participant-item-participant-2"');
    expect(html).toContain('data-testid="builder-participant-role-participant-1"');
    expect(html).toContain('data-testid="builder-participant-phase-participant-1"');
    expect(html).toContain('data-testid="builder-participant-coeff-participant-1"');
    expect(html).toContain('data-testid="builder-participant-mol-participant-1"');
    expect(html).toContain('data-testid="builder-participant-mass-participant-1"');
    expect(html).toContain('data-testid="builder-participant-volume-participant-1"');
    expect(html).toContain('data-testid="builder-participant-substance-participant-1"');
    expect(html).toContain('data-testid="builder-participant-remove-participant-1"');
    expect(html).toContain('data-testid="builder-participant-volume-warning-participant-2"');
    expect(html).toContain("Volume auto-conversion requires gas phase.");
    expect(html).toContain('data-testid="builder-participant-conversion-hint"');
    expect(html).toContain("Amount (mol)");
    expect(html).toContain("Mass (g)");
    expect(html).toContain("Volume (L)");
    expect(html).toContain("auto-converts only for gas phase.");
    expect(html).toContain('data-testid="builder-participant-add-substance-select"');
    expect(html).toContain('data-testid="builder-participant-add-submit"');
    expect(html).toContain('data-testid="builder-save-draft-button"');
  });

  it("renders launch-blocked indicator when builder has validation errors", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        {...createLeftPanelProps({
          activeTab: "builder",
          placeholderStateByTab: {
            library: "ready",
            builder: "ready",
            presets: "ready",
          },
          builderViewModel: createBuilderViewModel({
            draft: {
              title: "Blocked draft",
              reactionClass: "inorganic",
              equation: "",
              description: "",
              participants: [createBuilderParticipant()],
            },
            launchBlocked: true,
            launchBlockReasons: ['Mass (g) for participant "participant-1" cannot be negative.'],
          }),
        })}
      />,
    );

    expect(html).toContain('data-testid="builder-launch-blocked-banner"');
    expect(html).toContain("Launch blocked: fix invalid participant values.");
    expect(html).toContain('data-testid="builder-launch-blocked-errors"');
    expect(html).toContain(
      "Mass (g) for participant &quot;participant-1&quot; cannot be negative.",
    );
  });
});
