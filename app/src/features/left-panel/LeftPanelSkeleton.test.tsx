import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { UserSubstanceDraft } from "./model";
import LeftPanelSkeleton from "./LeftPanelSkeleton";

const DEFAULT_DRAFT: UserSubstanceDraft = {
  name: "",
  formula: "",
  phase: "solid",
  molarMassInput: "",
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
    createDraft: DEFAULT_DRAFT,
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

describe("LeftPanelSkeleton library tab", () => {
  it("renders stable selectors for search, filters, list, and property card when ready", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        activeTab="library"
        onTabChange={vi.fn()}
        placeholderStateByTab={{
          library: "ready",
          builder: "empty",
          presets: "error",
        }}
        libraryViewModel={createLibraryViewModel({
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
        activeTab="library"
        onTabChange={vi.fn()}
        placeholderStateByTab={{
          library: "error",
          builder: "empty",
          presets: "error",
        }}
        libraryViewModel={createLibraryViewModel({
          errorMessage: "Backend unavailable",
        })}
      />,
    );

    expect(html).toContain('data-testid="library-state-error"');
    expect(html).toContain("Backend unavailable");
  });

  it("renders read-only message and no edit actions for builtin/imported selection", () => {
    const html = renderToStaticMarkup(
      <LeftPanelSkeleton
        activeTab="library"
        onTabChange={vi.fn()}
        placeholderStateByTab={{
          library: "ready",
          builder: "empty",
          presets: "error",
        }}
        libraryViewModel={createLibraryViewModel({
          selectedSubstance: {
            id: "builtin-substance-water",
            name: "Water",
            formula: "H2O",
            phase: "liquid",
            source: "builtin",
            molarMassGMol: 18.01528,
          },
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
        activeTab="library"
        onTabChange={vi.fn()}
        placeholderStateByTab={{
          library: "ready",
          builder: "empty",
          presets: "error",
        }}
        libraryViewModel={createLibraryViewModel({
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
        })}
      />,
    );

    expect(html).toContain('data-testid="library-edit-form"');
    expect(html).toContain('data-testid="library-delete-button"');
    expect(html).toContain('data-testid="library-edit-errors"');
  });
});
