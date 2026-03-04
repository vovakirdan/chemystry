import { describe, expect, it } from "vitest";
import {
  convertQuantityInput,
  normalizeUnitInput,
  parseNormalizedNumberInput,
  STANDARD_MOLAR_VOLUME_L_PER_MOL,
} from "./units";

describe("parseNormalizedNumberInput", () => {
  it("normalizes trim, spaces, comma decimal separator, and exponent notation", () => {
    expect(parseNormalizedNumberInput(" 1,5e1 ")).toEqual({
      ok: true,
      value: 15,
      normalizedInput: "1.5e1",
    });

    expect(parseNormalizedNumberInput("2.5E-1")).toEqual({
      ok: true,
      value: 0.25,
      normalizedInput: "2.5E-1",
    });

    expect(parseNormalizedNumberInput(" 1,234 e -2 ")).toEqual({
      ok: true,
      value: 0.01234,
      normalizedInput: "1.234e-2",
    });
  });

  it("returns structured errors for empty, invalid, and negative inputs", () => {
    expect(parseNormalizedNumberInput("   ")).toMatchObject({
      ok: false,
      code: "EMPTY_INPUT",
    });

    expect(parseNormalizedNumberInput("1,2.3")).toMatchObject({
      ok: false,
      code: "INVALID_NUMBER",
    });

    expect(parseNormalizedNumberInput("1 2,3,4")).toMatchObject({
      ok: false,
      code: "INVALID_NUMBER",
    });

    expect(parseNormalizedNumberInput("1 2")).toMatchObject({
      ok: false,
      code: "INVALID_NUMBER",
    });

    expect(parseNormalizedNumberInput("1 e 2 3")).toMatchObject({
      ok: false,
      code: "INVALID_NUMBER",
    });

    expect(parseNormalizedNumberInput("-0.1")).toMatchObject({
      ok: false,
      code: "NEGATIVE_VALUE",
    });
  });
});

describe("normalizeUnitInput", () => {
  it("normalizes supported aliases to internal unit symbols", () => {
    expect(normalizeUnitInput(" grams ")).toEqual({
      ok: true,
      unit: "g",
      normalizedInput: "grams",
    });

    expect(normalizeUnitInput("MoLeS")).toEqual({
      ok: true,
      unit: "mol",
      normalizedInput: "moles",
    });

    expect(normalizeUnitInput("liter")).toEqual({
      ok: true,
      unit: "L",
      normalizedInput: "liter",
    });
  });

  it("returns explicit unsupported unit errors", () => {
    const result = normalizeUnitInput("kg");

    expect(result).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_UNIT",
    });

    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

describe("convertQuantityInput", () => {
  it("converts between mass and amount using molar mass context", () => {
    const amountResult = convertQuantityInput({
      valueInput: "10.0794",
      fromUnit: "g",
      toUnit: "mol",
      context: {
        molarMassGMol: 2.01588,
      },
    });

    expect(amountResult).toMatchObject({
      ok: true,
      fromUnit: "g",
      toUnit: "mol",
      value: 5,
      formattedValue: "5",
    });

    const massResult = convertQuantityInput({
      valueInput: "2",
      fromUnit: "mol",
      toUnit: "g",
      context: {
        molarMassGMol: 58.44277,
      },
    });

    expect(massResult).toMatchObject({
      ok: true,
      fromUnit: "mol",
      toUnit: "g",
      value: 116.88554,
      formattedValue: "116.88554",
    });
  });

  it("converts between amount and volume for gas phase using molar volume", () => {
    const defaultMolarVolumeResult = convertQuantityInput({
      valueInput: "2",
      fromUnit: "mol",
      toUnit: "L",
      context: {
        isGasPhase: true,
      },
    });

    expect(defaultMolarVolumeResult).toMatchObject({
      ok: true,
      value: 2 * STANDARD_MOLAR_VOLUME_L_PER_MOL,
      formattedValue: "44.8",
    });

    const customMolarVolumeResult = convertQuantityInput({
      valueInput: "49",
      fromUnit: "L",
      toUnit: "mol",
      context: {
        isGasPhase: true,
        molarVolumeLPerMol: 24.5,
      },
    });

    expect(customMolarVolumeResult).toMatchObject({
      ok: true,
      value: 2,
      formattedValue: "2",
    });
  });

  it("converts between mass and volume through amount for supported gas-phase cases", () => {
    const toVolume = convertQuantityInput({
      valueInput: "1,5e1",
      fromUnit: "g",
      toUnit: "L",
      context: {
        molarMassGMol: 2,
        isGasPhase: true,
      },
    });

    expect(toVolume).toMatchObject({
      ok: true,
      value: 168,
      formattedValue: "168",
    });

    const toMass = convertQuantityInput({
      valueInput: "49",
      fromUnit: "liters",
      toUnit: "grams",
      context: {
        molarMassGMol: 2.01588,
        molarVolumeLPerMol: 24.5,
        isGasPhase: true,
      },
    });

    expect(toMass).toMatchObject({
      ok: true,
      value: 4.03176,
      formattedValue: "4.03176",
    });
  });

  it("returns structured errors for incompatible conversions and missing context", () => {
    const nonGasVolume = convertQuantityInput({
      valueInput: "1",
      fromUnit: "mol",
      toUnit: "L",
      context: {
        isGasPhase: false,
      },
    });

    expect(nonGasVolume).toMatchObject({
      ok: false,
      code: "INCOMPATIBLE_UNITS",
    });

    const missingMolarMass = convertQuantityInput({
      valueInput: "1",
      fromUnit: "g",
      toUnit: "mol",
      context: {
        isGasPhase: true,
      },
    });

    expect(missingMolarMass).toMatchObject({
      ok: false,
      code: "MISSING_MOLAR_MASS",
    });

    const invalidMolarVolume = convertQuantityInput({
      valueInput: "1",
      fromUnit: "L",
      toUnit: "mol",
      context: {
        isGasPhase: true,
        molarVolumeLPerMol: 0,
      },
    });

    expect(invalidMolarVolume).toMatchObject({
      ok: false,
      code: "INVALID_CONTEXT",
    });
  });

  it("returns structured errors for invalid numbers and unsupported units", () => {
    const invalidNumber = convertQuantityInput({
      valueInput: "not-a-number",
      fromUnit: "mol",
      toUnit: "g",
      context: {
        molarMassGMol: 1,
      },
    });

    expect(invalidNumber).toMatchObject({
      ok: false,
      code: "INVALID_NUMBER",
    });

    const unsupportedUnit = convertQuantityInput({
      valueInput: "1",
      fromUnit: "kg",
      toUnit: "mol",
      context: {
        molarMassGMol: 1,
      },
    });

    expect(unsupportedUnit).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_UNIT",
    });

    if (!unsupportedUnit.ok) {
      expect(unsupportedUnit.message.length).toBeGreaterThan(0);
    }
  });
});
