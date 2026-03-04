import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RightPanelSkeleton from "./RightPanelSkeleton";
import {
  STOICHIOMETRY_ASSUMPTIONS,
  STOICHIOMETRY_UNITS,
  type StoichiometryCalculationResult,
} from "../../shared/lib/stoichiometry";

describe("RightPanelSkeleton runtime settings hydration", () => {
  it("keeps null runtime fields empty instead of replacing them with defaults", () => {
    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        runtimeSettings={{
          temperatureC: null,
          pressureAtm: 1,
          calculationPasses: null,
          precisionProfile: "Custom",
          fpsLimit: null,
        }}
      />,
    );

    expect(html).toContain('data-testid="right-panel-environment-temperature" value=""');
    expect(html).toContain('data-testid="right-panel-environment-pressure" value="1"');
    expect(html).toContain('data-testid="right-panel-calculations-input" value=""');
    expect(html).toContain('data-testid="right-panel-calculations-fps" value=""');
    expect(html).toContain('data-testid="right-panel-calculations-precision-value"');
    expect(html).toContain("Precision profile: Custom");
  });
});

describe("RightPanelSkeleton stoichiometry summary", () => {
  it("renders limiting reactant and theoretical amounts in summary section", () => {
    const stoichiometryResult: StoichiometryCalculationResult = {
      ok: true,
      units: STOICHIOMETRY_UNITS,
      assumptions: STOICHIOMETRY_ASSUMPTIONS,
      limitingReactants: [
        {
          id: "reactant-o2",
          label: "O2",
          coefficient: 1,
          availableAmountMol: 1,
          maxReactionExtentMol: 1,
        },
      ],
      reactionExtentMol: 1,
      participants: [
        {
          id: "reactant-h2",
          label: "H2",
          role: "reactant",
          coefficient: 2,
          initialAmountMol: 5,
          theoreticalAmountMol: 2,
          actualYieldAmountMol: null,
          percentYield: null,
          stoichRatioToLimiting: 2,
          consumedAmountMol: 2,
          producedAmountMol: null,
          remainingAmountMol: 3,
        },
        {
          id: "reactant-o2",
          label: "O2",
          role: "reactant",
          coefficient: 1,
          initialAmountMol: 1,
          theoreticalAmountMol: 1,
          actualYieldAmountMol: null,
          percentYield: null,
          stoichRatioToLimiting: 1,
          consumedAmountMol: 1,
          producedAmountMol: null,
          remainingAmountMol: 0,
        },
        {
          id: "product-h2o",
          label: "H2O",
          role: "product",
          coefficient: 2,
          initialAmountMol: 1.8,
          theoreticalAmountMol: 2,
          actualYieldAmountMol: 1.8,
          percentYield: 90,
          stoichRatioToLimiting: 2,
          consumedAmountMol: null,
          producedAmountMol: 2,
          remainingAmountMol: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        stoichiometryResult={stoichiometryResult}
      />,
    );

    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-limiting"');
    expect(html).toContain("Limiting reactant:");
    expect(html).toContain("O2");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-products"');
    expect(html).toContain("H2O:");
    expect(html).toContain("2");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-yields"');
    expect(html).toContain("% yield");
    expect(html).toContain("% yield 90");
    expect(html).toContain("Units: amounts and reaction extent in");
  });

  it("renders explicit validation errors when stoichiometry input is incomplete", () => {
    const stoichiometryResult: StoichiometryCalculationResult = {
      ok: false,
      units: STOICHIOMETRY_UNITS,
      assumptions: STOICHIOMETRY_ASSUMPTIONS,
      errors: [
        {
          code: "MISSING_COEFFICIENT",
          field: "stoichCoeffInput",
          participantId: "reactant-1",
          participantLabel: "Participant 1",
          message: "Participant 1: enter a reaction coefficient.",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        stoichiometryResult={stoichiometryResult}
      />,
    );

    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-error"');
    expect(html).toContain("Stoichiometry is blocked until required Builder inputs are complete.");
    expect(html).toContain("Participant 1: enter a reaction coefficient.");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-assumptions"');
  });
});
