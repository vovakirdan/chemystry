export const SUPPORTED_UNIT_SYMBOLS = ["g", "mol", "L"] as const;
export type SupportedUnitSymbol = (typeof SUPPORTED_UNIT_SYMBOLS)[number];

export const STANDARD_MOLAR_VOLUME_L_PER_MOL = 22.4;

export interface ParseNormalizedNumberInputOptions {
  allowNegative?: boolean;
}

export type ParseNormalizedNumberInputErrorCode =
  | "EMPTY_INPUT"
  | "INVALID_NUMBER"
  | "NEGATIVE_VALUE";

export type ParseNormalizedNumberInputResult =
  | {
      ok: true;
      value: number;
      normalizedInput: string;
    }
  | {
      ok: false;
      code: ParseNormalizedNumberInputErrorCode;
      message: string;
    };

export type NormalizeUnitInputResult =
  | {
      ok: true;
      unit: SupportedUnitSymbol;
      normalizedInput: string;
    }
  | {
      ok: false;
      code: "UNSUPPORTED_UNIT";
      message: string;
    };

export interface UnitsConversionContext {
  molarMassGMol?: number | null;
  molarVolumeLPerMol?: number | null;
  isGasPhase?: boolean;
}

export type UnitsConversionErrorCode =
  | ParseNormalizedNumberInputErrorCode
  | "UNSUPPORTED_UNIT"
  | "INCOMPATIBLE_UNITS"
  | "MISSING_MOLAR_MASS"
  | "INVALID_CONTEXT";

export type UnitsConversionResult =
  | {
      ok: true;
      fromUnit: SupportedUnitSymbol;
      toUnit: SupportedUnitSymbol;
      normalizedInput: string;
      value: number;
      formattedValue: string;
    }
  | {
      ok: false;
      code: UnitsConversionErrorCode;
      message: string;
    };

const UNIT_ALIAS_TO_SYMBOL: Readonly<Record<string, SupportedUnitSymbol>> = {
  g: "g",
  gram: "g",
  grams: "g",
  mol: "mol",
  mole: "mol",
  moles: "mol",
  l: "L",
  liter: "L",
  litre: "L",
  liters: "L",
  litres: "L",
};

function normalizeDecimalInput(valueInput: string): string | null {
  if (valueInput.includes(",")) {
    if (valueInput.includes(".")) {
      return null;
    }

    if (valueInput.split(",").length !== 2) {
      return null;
    }

    return valueInput.replace(",", ".");
  }

  return valueInput;
}

export function parseNormalizedNumberInput(
  valueInput: string,
  options: ParseNormalizedNumberInputOptions = {},
): ParseNormalizedNumberInputResult {
  const trimmedInput = valueInput.trim();
  if (trimmedInput.length === 0) {
    return {
      ok: false,
      code: "EMPTY_INPUT",
      message: "Numeric input is required.",
    };
  }

  const normalizedInput = normalizeDecimalInput(trimmedInput);
  if (normalizedInput === null) {
    return {
      ok: false,
      code: "INVALID_NUMBER",
      message: "Numeric input has an unsupported decimal separator format.",
    };
  }

  const parsedValue = Number(normalizedInput);
  if (!Number.isFinite(parsedValue)) {
    return {
      ok: false,
      code: "INVALID_NUMBER",
      message: "Numeric input must be a finite number.",
    };
  }

  if (options.allowNegative !== true && parsedValue < 0) {
    return {
      ok: false,
      code: "NEGATIVE_VALUE",
      message: "Numeric input must not be negative.",
    };
  }

  return {
    ok: true,
    value: parsedValue,
    normalizedInput,
  };
}

export function normalizeUnitInput(unitInput: string): NormalizeUnitInputResult {
  const normalizedInput = unitInput.trim().toLowerCase();
  const normalizedUnit = UNIT_ALIAS_TO_SYMBOL[normalizedInput];

  if (normalizedUnit === undefined) {
    return {
      ok: false,
      code: "UNSUPPORTED_UNIT",
      message: `Unsupported unit: "${unitInput}". Supported units: g, mol, L.`,
    };
  }

  return {
    ok: true,
    unit: normalizedUnit,
    normalizedInput,
  };
}

export function formatConvertedQuantity(value: number, precision = 8): string {
  const roundedValue = Number(value.toFixed(precision));

  if (Object.is(roundedValue, -0)) {
    return "0";
  }

  return String(roundedValue);
}

function parseConversionSourceInput(valueInput: string | number): ParseNormalizedNumberInputResult {
  if (typeof valueInput === "number") {
    if (!Number.isFinite(valueInput)) {
      return {
        ok: false,
        code: "INVALID_NUMBER",
        message: "Numeric input must be a finite number.",
      };
    }

    if (valueInput < 0) {
      return {
        ok: false,
        code: "NEGATIVE_VALUE",
        message: "Numeric input must not be negative.",
      };
    }

    return {
      ok: true,
      value: valueInput,
      normalizedInput: formatConvertedQuantity(valueInput, 12),
    };
  }

  return parseNormalizedNumberInput(valueInput);
}

export function convertQuantityInput(params: {
  valueInput: string | number;
  fromUnit: string;
  toUnit: string;
  context?: UnitsConversionContext;
}): UnitsConversionResult {
  const parsedInput = parseConversionSourceInput(params.valueInput);
  if (!parsedInput.ok) {
    return parsedInput;
  }

  const fromUnit = normalizeUnitInput(params.fromUnit);
  if (!fromUnit.ok) {
    return fromUnit;
  }

  const toUnit = normalizeUnitInput(params.toUnit);
  if (!toUnit.ok) {
    return toUnit;
  }

  if (fromUnit.unit === toUnit.unit) {
    return {
      ok: true,
      fromUnit: fromUnit.unit,
      toUnit: toUnit.unit,
      normalizedInput: parsedInput.normalizedInput,
      value: parsedInput.value,
      formattedValue: formatConvertedQuantity(parsedInput.value),
    };
  }

  const context = params.context ?? {};
  const requiresMassContext = fromUnit.unit === "g" || toUnit.unit === "g";
  const requiresVolumeContext = fromUnit.unit === "L" || toUnit.unit === "L";

  let molarMassGMol: number | null = null;
  if (requiresMassContext) {
    if (context.molarMassGMol === null || context.molarMassGMol === undefined) {
      return {
        ok: false,
        code: "MISSING_MOLAR_MASS",
        message: "Molar mass is required for conversions involving mass.",
      };
    }

    if (!Number.isFinite(context.molarMassGMol) || context.molarMassGMol <= 0) {
      return {
        ok: false,
        code: "INVALID_CONTEXT",
        message: "Molar mass must be a positive finite number.",
      };
    }

    molarMassGMol = context.molarMassGMol;
  }

  let molarVolumeLPerMol = STANDARD_MOLAR_VOLUME_L_PER_MOL;
  if (requiresVolumeContext) {
    if (context.isGasPhase !== true) {
      return {
        ok: false,
        code: "INCOMPATIBLE_UNITS",
        message: "Volume conversions are supported only for gas phase.",
      };
    }

    if (context.molarVolumeLPerMol !== null && context.molarVolumeLPerMol !== undefined) {
      if (!Number.isFinite(context.molarVolumeLPerMol) || context.molarVolumeLPerMol <= 0) {
        return {
          ok: false,
          code: "INVALID_CONTEXT",
          message: "Molar volume must be a positive finite number.",
        };
      }

      molarVolumeLPerMol = context.molarVolumeLPerMol;
    }
  }

  let amountMol = parsedInput.value;
  if (fromUnit.unit === "g") {
    amountMol = parsedInput.value / (molarMassGMol as number);
  } else if (fromUnit.unit === "L") {
    amountMol = parsedInput.value / molarVolumeLPerMol;
  }

  let convertedValue = amountMol;
  if (toUnit.unit === "g") {
    convertedValue = amountMol * (molarMassGMol as number);
  } else if (toUnit.unit === "L") {
    convertedValue = amountMol * molarVolumeLPerMol;
  }

  return {
    ok: true,
    fromUnit: fromUnit.unit,
    toUnit: toUnit.unit,
    normalizedInput: parsedInput.normalizedInput,
    value: convertedValue,
    formattedValue: formatConvertedQuantity(convertedValue),
  };
}
