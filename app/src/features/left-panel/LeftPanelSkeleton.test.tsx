import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BuilderDraft, UserSubstanceDraft } from "./model";
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
};

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
    copyFeedbackMessage: null,
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
    expect(html).not.toContain('data-testid="builder-title-input" disabled=""');
  });
});
