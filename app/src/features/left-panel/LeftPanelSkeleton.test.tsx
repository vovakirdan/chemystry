import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LeftPanelSkeleton from "./LeftPanelSkeleton";

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
        libraryViewModel={{
          searchQuery: "h2",
          onSearchQueryChange: vi.fn(),
          selectedPhases: new Set(["gas", "liquid", "solid", "aqueous"] as const),
          selectedSources: new Set(["builtin", "imported", "user"] as const),
          onTogglePhase: vi.fn(),
          onToggleSource: vi.fn(),
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
          onSelectSubstance: vi.fn(),
          emptyMessage: "No substances.",
          errorMessage: null,
        }}
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
        libraryViewModel={{
          searchQuery: "",
          onSearchQueryChange: vi.fn(),
          selectedPhases: new Set(["gas", "liquid", "solid", "aqueous"] as const),
          selectedSources: new Set(["builtin", "imported", "user"] as const),
          onTogglePhase: vi.fn(),
          onToggleSource: vi.fn(),
          substances: [],
          selectedSubstance: null,
          onSelectSubstance: vi.fn(),
          emptyMessage: "No substances.",
          errorMessage: "Backend unavailable",
        }}
      />,
    );

    expect(html).toContain('data-testid="library-state-error"');
    expect(html).toContain("Backend unavailable");
  });
});
