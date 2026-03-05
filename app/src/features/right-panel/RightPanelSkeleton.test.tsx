import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RightPanelSkeleton from "./RightPanelSkeleton";
import {
  STOICHIOMETRY_ASSUMPTIONS,
  STOICHIOMETRY_UNITS,
  type StoichiometryCalculationResult,
} from "../../shared/lib/stoichiometry";
import type { CalculationSummaryV1 } from "../../shared/contracts/ipc/v1";

describe("RightPanelSkeleton runtime settings hydration", () => {
  it("keeps null runtime fields empty instead of replacing them with defaults", () => {
    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        runtimeSettings={{
          temperatureC: null,
          pressureAtm: 1,
          gasMedium: "vacuum",
          calculationPasses: null,
          precisionProfile: "Custom",
          fpsLimit: null,
        }}
      />,
    );

    expect(html).toContain('data-testid="right-panel-environment-temperature" value=""');
    expect(html).toContain('data-testid="right-panel-environment-pressure" value="1"');
    expect(html).toContain('data-testid="right-panel-environment-gas-medium"');
    expect(html).toContain("Gas medium: vacuum");
    expect(html).toContain('data-testid="right-panel-calculations-input" value=""');
    expect(html).toContain('data-testid="right-panel-calculations-fps" value=""');
    expect(html).toContain('data-testid="right-panel-calculations-precision-value"');
    expect(html).toContain("Precision profile: Custom");
  });

  it("shows explicit environment range validation messages for out-of-range values", () => {
    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        runtimeSettings={{
          temperatureC: -500,
          pressureAtm: 80,
          gasMedium: "gas",
          calculationPasses: 250,
          precisionProfile: "Balanced",
          fpsLimit: 60,
        }}
      />,
    );

    expect(html).toContain('data-testid="right-panel-environment-temperature-validation"');
    expect(html).toContain("Temperature must stay between -273.14");
    expect(html).toContain('data-testid="right-panel-environment-pressure-validation"');
    expect(html).toContain("Pressure must stay between 0.1 atm and 50 atm.");
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
      derivedCalculations: {
        concentrations: [
          {
            participantId: "reactant-h2",
            participantLabel: "H2",
            role: "reactant",
            phase: "gas",
            amountMol: 5,
            volumeL: 112,
            concentrationMolL: 0.0446428571,
          },
          {
            participantId: "product-h2o",
            participantLabel: "H2O",
            role: "product",
            phase: "liquid",
            amountMol: 1.8,
            volumeL: 2,
            concentrationMolL: 0.9,
          },
        ],
        gasRuntime: {
          temperatureC: 25,
          temperatureK: 298.15,
          pressureAtm: 1,
          gasConstantLAtmPerMolK: 0.082057338,
        },
        gasCalculations: [
          {
            participantId: "reactant-h2",
            participantLabel: "H2",
            amountMolInput: 5,
            volumeLInput: 112,
            idealVolumeL: 122.3269766235,
            impliedAmountMolFromVolume: 4.577141,
            volumeDeltaL: -10.3269766235,
            amountDeltaMol: 0.422859,
            isVolumeConsistent: false,
            isAmountConsistent: false,
          },
        ],
      },
    };
    const calculationSummary: CalculationSummaryV1 = {
      version: 1,
      generatedAt: "2026-03-04T09:00:00.000Z",
      inputSignature: "sig-1",
      entries: [
        { resultType: "stoichiometry", inputs: {}, outputs: {}, warnings: [] },
        { resultType: "limiting_reagent", inputs: {}, outputs: {}, warnings: [] },
        { resultType: "yield", inputs: {}, outputs: {}, warnings: [] },
        {
          resultType: "conversion",
          inputs: {},
          outputs: {},
          warnings: ["Ideal-gas approximation"],
        },
        { resultType: "concentration", inputs: {}, outputs: {}, warnings: [] },
      ],
    };

    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        stoichiometryResult={stoichiometryResult}
        calculationSummary={calculationSummary}
        onExportCalculationSummary={() => {}}
      />,
    );

    expect(html).toContain('data-testid="right-panel-summary-export-calculation"');
    expect(html).toContain("Export summary (JSON)");
    expect(html).toContain("Calculation summary is current and ready for save/export.");
    expect(html).toContain('data-testid="right-panel-summary-calc-stoichiometry"');
    expect(html).toContain('data-testid="right-panel-summary-calc-limiting"');
    expect(html).toContain('data-testid="right-panel-summary-calc-yield"');
    expect(html).toContain('data-testid="right-panel-summary-calc-concentration"');
    expect(html).toContain('data-testid="right-panel-summary-calc-conversion"');
    expect(html).toContain("Gas conversion");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-limiting"');
    expect(html).toContain("Limiting reactant:");
    expect(html).toContain("O2");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-products"');
    expect(html).toContain("H2O:");
    expect(html).toContain("2");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-yields"');
    expect(html).toContain("% yield");
    expect(html).toContain("% yield 90");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-concentrations"');
    expect(html).toContain("Concentrations from entered amount/volume:");
    expect(html).toContain("0.9");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-gas-runtime"');
    expect(html).toContain("Gas calculations at 25");
    expect(html).toContain('data-testid="right-panel-summary-stoichiometry-gas"');
    expect(html).toContain("consistency check inputs.");
    expect(html).toContain("Units: amounts and reaction extent in");
  });

  it("renders scenario history entries in summary section", () => {
    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        scenarioHistory={[
          {
            id: "history-1",
            timestampLabel: "12:34:56",
            category: "environment",
            message: "Environment temperature set to 120 °C.",
          },
        ]}
      />,
    );

    expect(html).toContain('data-testid="right-panel-summary-history"');
    expect(html).toContain('data-testid="right-panel-summary-history-list"');
    expect(html).toContain("[12:34:56] Environment temperature set to 120 °C.");
  });

  it("renders stale summary status when inputs changed after previous save/export", () => {
    const html = renderToStaticMarkup(
      <RightPanelSkeleton
        healthMessage="ok"
        featureStatuses={[]}
        stoichiometryResult={{
          ok: false,
          units: STOICHIOMETRY_UNITS,
          assumptions: STOICHIOMETRY_ASSUMPTIONS,
          errors: [],
        }}
        calculationSummary={null}
        calculationSummaryIsStale
      />,
    );

    expect(html).toContain("Saved/exported calculation snapshot is stale because inputs changed.");
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
