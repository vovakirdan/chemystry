import { describe, expect, it } from "vitest";
import {
  calculateStoichiometry,
  formatStoichiometryValue,
  STOICHIOMETRY_ASSUMPTIONS,
  STOICHIOMETRY_UNITS,
} from "./stoichiometry";

describe("calculateStoichiometry", () => {
  it("calculates theoretical amounts from balanced coefficients and identifies limiting reactant", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "r-h2",
          label: "H2",
          role: "reactant",
          stoichCoeffInput: "2",
          amountMolInput: "5",
        },
        {
          id: "r-o2",
          label: "O2",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1",
        },
        {
          id: "p-h2o",
          label: "H2O",
          role: "product",
          stoichCoeffInput: "2",
          amountMolInput: "0",
          actualYieldMolInput: "0",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.units).toEqual(STOICHIOMETRY_UNITS);
    expect(result.assumptions).toEqual(STOICHIOMETRY_ASSUMPTIONS);
    expect(result.reactionExtentMol).toBe(1);
    expect(result.limitingReactants.map((reactant) => reactant.label)).toEqual(["O2"]);

    const water = result.participants.find((participant) => participant.id === "p-h2o");
    expect(water?.producedAmountMol).toBe(2);
    expect(water?.theoreticalAmountMol).toBe(2);
    expect(water?.actualYieldAmountMol).toBe(0);
    expect(water?.percentYield).toBe(0);

    const hydrogen = result.participants.find((participant) => participant.id === "r-h2");
    expect(hydrogen?.consumedAmountMol).toBe(2);
    expect(hydrogen?.remainingAmountMol).toBe(3);
    expect(hydrogen?.stoichRatioToLimiting).toBe(2);
    expect(hydrogen?.percentYield).toBeNull();
    expect(result.derivedCalculations.concentrations).toEqual([]);
    expect(result.derivedCalculations.gasRuntime).toBeNull();
    expect(result.derivedCalculations.gasCalculations).toEqual([]);
  });

  it("supports co-limiting reactants when reactant ratios are exactly matched", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "n2",
          label: "N2",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1",
        },
        {
          id: "h2",
          label: "H2",
          role: "reactant",
          stoichCoeffInput: "3",
          amountMolInput: "3",
        },
        {
          id: "nh3",
          label: "NH3",
          role: "product",
          stoichCoeffInput: "2",
          amountMolInput: "0",
          actualYieldMolInput: "0",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.limitingReactants.map((reactant) => reactant.label)).toEqual(["N2", "H2"]);
    expect(result.reactionExtentMol).toBe(1);

    const ammonia = result.participants.find((participant) => participant.id === "nh3");
    expect(ammonia?.theoreticalAmountMol).toBe(2);
    expect(ammonia?.percentYield).toBe(0);
  });

  it("does not merge distinct tiny extents into co-limiting reactants", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "r-a",
          label: "A",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1e-12",
        },
        {
          id: "r-b",
          label: "B",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "2e-12",
        },
        {
          id: "p-c",
          label: "C",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "0",
          actualYieldMolInput: "0",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reactionExtentMol).toBe(1e-12);
    expect(result.limitingReactants.map((reactant) => reactant.id)).toEqual(["r-a"]);
  });

  it("returns explicit validation errors for missing/invalid input and no partial output", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "invalid-reactant",
          label: "Participant 1",
          role: "reactant",
          stoichCoeffInput: "",
          amountMolInput: "-1",
        },
        {
          id: "invalid-product",
          label: "Participant 2",
          role: "product",
          stoichCoeffInput: "abc",
          amountMolInput: "",
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.map((error) => error.code)).toEqual([
      "MISSING_COEFFICIENT",
      "NEGATIVE_AMOUNT_MOL",
      "INVALID_COEFFICIENT",
      "MISSING_AMOUNT_MOL",
      "MISSING_ACTUAL_YIELD",
    ]);
    expect("reactionExtentMol" in result).toBe(false);
    expect("participants" in result).toBe(false);
    expect(result.units).toEqual(STOICHIOMETRY_UNITS);
    expect(result.assumptions).toEqual(STOICHIOMETRY_ASSUMPTIONS);
  });

  it("validates missing reaction setup", () => {
    const noParticipants = calculateStoichiometry({ participants: [] });
    expect(noParticipants.ok).toBe(false);
    if (!noParticipants.ok) {
      expect(noParticipants.errors).toHaveLength(1);
      expect(noParticipants.errors[0]?.code).toBe("MISSING_PARTICIPANTS");
    }

    const noReactant = calculateStoichiometry({
      participants: [
        {
          id: "product-only",
          label: "Product",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "1",
        },
      ],
    });

    expect(noReactant.ok).toBe(false);
    if (!noReactant.ok) {
      expect(noReactant.errors.some((error) => error.code === "MISSING_REACTANT")).toBe(true);
    }

    const noProduct = calculateStoichiometry({
      participants: [
        {
          id: "reactant-only",
          label: "Reactant",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1",
        },
      ],
    });

    expect(noProduct.ok).toBe(false);
    if (!noProduct.ok) {
      expect(noProduct.errors.some((error) => error.code === "MISSING_PRODUCT")).toBe(true);
    }
  });

  it("accepts localized comma decimal input", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-a",
          label: "A",
          role: "reactant",
          stoichCoeffInput: "0,5",
          amountMolInput: "1,5",
        },
        {
          id: "product-b",
          label: "B",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "0",
          actualYieldMolInput: "1,5",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.reactionExtentMol).toBe(3);
    const product = result.participants.find((participant) => participant.id === "product-b");
    expect(product?.theoreticalAmountMol).toBe(3);
    expect(product?.actualYieldAmountMol).toBe(1.5);
    expect(product?.percentYield).toBe(50);
  });

  it("calculates percent yield from explicit product actual-yield input", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-a",
          label: "A",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "2",
        },
        {
          id: "product-b",
          label: "B",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "0",
          actualYieldMolInput: "1.5",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const product = result.participants.find((participant) => participant.id === "product-b");
    expect(product?.theoreticalAmountMol).toBe(2);
    expect(product?.actualYieldAmountMol).toBe(1.5);
    expect(product?.percentYield).toBe(75);
  });

  it("returns explicit validation error when product actual yield input is missing", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-a",
          label: "A",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "2",
        },
        {
          id: "product-b",
          label: "B",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "1.5",
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.map((error) => error.code)).toEqual(["MISSING_ACTUAL_YIELD"]);
    expect(result.errors[0]?.field).toBe("actualYieldMolInput");
  });

  it("keeps product initial amount traceable when actual yield differs", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-a",
          label: "A",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "2",
        },
        {
          id: "product-b",
          label: "B",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "0.25",
          actualYieldMolInput: "1.5",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const product = result.participants.find((participant) => participant.id === "product-b");
    expect(product?.initialAmountMol).toBe(0.25);
    expect(product?.actualYieldAmountMol).toBe(1.5);
    expect(product?.theoreticalAmountMol).toBe(2);
    expect(product?.percentYield).toBe(75);
  });

  it("returns explicit validation error when product actual yield is negative", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-a",
          label: "A",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "2",
        },
        {
          id: "product-b",
          label: "B",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          actualYieldMolInput: "-1",
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.map((error) => error.code)).toEqual(["NEGATIVE_ACTUAL_YIELD"]);
    expect(result.errors[0]?.field).toBe("actualYieldMolInput");
  });

  it("returns explicit validation error when theoretical yield is zero", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-a",
          label: "A",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "0",
        },
        {
          id: "product-b",
          label: "B",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "0",
          actualYieldMolInput: "0",
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.map((error) => error.code)).toEqual(["ZERO_THEORETICAL_YIELD"]);
    expect(result.errors[0]?.field).toBe("actualYieldMolInput");
    expect("participants" in result).toBe(false);
  });

  it("calculates concentration and gas conversions using runtime temperature and pressure", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-gas",
          label: "Gas Reactant",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          phase: "gas",
          volumeLInput: "24.4653953247",
        },
        {
          id: "product-gas",
          label: "Gas Product",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          phase: "gas",
          volumeLInput: "24.4653953247",
          actualYieldMolInput: "1",
        },
      ],
      runtimeSettings: {
        temperatureC: 25,
        pressureAtm: 1,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.derivedCalculations.concentrations).toHaveLength(2);
    expect(result.derivedCalculations.concentrations[0]?.concentrationMolL).toBeCloseTo(
      0.0408740585,
      10,
    );
    expect(result.derivedCalculations.gasRuntime).not.toBeNull();
    expect(result.derivedCalculations.gasRuntime?.temperatureK).toBeCloseTo(298.15, 8);
    expect(result.derivedCalculations.gasRuntime?.pressureAtm).toBe(1);
    expect(result.derivedCalculations.gasCalculations).toHaveLength(2);
    expect(result.derivedCalculations.gasCalculations[0]?.idealVolumeL).toBeCloseTo(
      24.4653953247,
      10,
    );
    expect(result.derivedCalculations.gasCalculations[0]?.impliedAmountMolFromVolume).toBeCloseTo(
      1,
      10,
    );
    expect(result.derivedCalculations.gasCalculations[0]?.isVolumeConsistent).toBe(true);
    expect(result.derivedCalculations.gasCalculations[0]?.isAmountConsistent).toBe(true);
  });

  it("returns explicit validation errors when gas calculations are requested without runtime T/P", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-gas",
          label: "Gas Reactant",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          phase: "gas",
          volumeLInput: "22.4",
        },
        {
          id: "product-gas",
          label: "Gas Product",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          phase: "gas",
          volumeLInput: "22.4",
          actualYieldMolInput: "1",
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.map((error) => error.code)).toEqual([
      "MISSING_TEMPERATURE_C",
      "MISSING_PRESSURE_ATM",
    ]);
    expect(result.errors[0]?.field).toBe("temperatureC");
    expect(result.errors[1]?.field).toBe("pressureAtm");
  });

  it("returns explicit validation error when gas/concentration volume is non-positive", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-gas",
          label: "Gas Reactant",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          phase: "gas",
          volumeLInput: "0",
        },
        {
          id: "product-liquid",
          label: "Liquid Product",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          phase: "liquid",
          actualYieldMolInput: "1",
        },
      ],
      runtimeSettings: {
        temperatureC: 25,
        pressureAtm: 1,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.map((error) => error.code)).toEqual(["NON_POSITIVE_VOLUME_L"]);
    expect(result.errors[0]?.field).toBe("volumeLInput");
  });

  it("returns explicit validation error when participant phase is unsupported", () => {
    const result = calculateStoichiometry({
      participants: [
        {
          id: "reactant-invalid-phase",
          label: "Invalid phase",
          role: "reactant",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          phase: "plasma",
        },
        {
          id: "product-valid",
          label: "Product",
          role: "product",
          stoichCoeffInput: "1",
          amountMolInput: "1",
          actualYieldMolInput: "1",
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.map((error) => error.code)).toEqual(["INVALID_PHASE"]);
    expect(result.errors[0]?.field).toBe("phase");
  });
});

describe("formatStoichiometryValue", () => {
  it("formats values and normalizes negative zero", () => {
    expect(formatStoichiometryValue(1.23456789)).toBe("1.234568");
    expect(formatStoichiometryValue(-0)).toBe("0");
  });
});
