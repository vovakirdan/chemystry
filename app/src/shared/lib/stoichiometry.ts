import { parseNormalizedNumberInput } from "./units";

export type StoichiometryParticipantRole = "reactant" | "product";

export const STOICHIOMETRY_PARTICIPANT_PHASES = ["solid", "liquid", "gas", "aqueous"] as const;
export type StoichiometryParticipantPhase = (typeof STOICHIOMETRY_PARTICIPANT_PHASES)[number];

export type StoichiometryParticipantInput = {
  id: string;
  label: string;
  role: StoichiometryParticipantRole;
  stoichCoeffInput: string;
  amountMolInput: string;
  phase?: string;
  volumeLInput?: string;
  actualYieldMolInput?: string;
};

export type StoichiometryRuntimeInput = {
  temperatureC: number | null;
  pressureAtm: number | null;
};

export type StoichiometryCalculationInput = {
  participants: ReadonlyArray<StoichiometryParticipantInput>;
  runtimeSettings?: StoichiometryRuntimeInput;
};

export const STOICHIOMETRY_UNITS = {
  amount: "mol",
  coefficient: "molar ratio",
  reactionExtent: "mol",
  percentYield: "%",
  concentration: "mol/L",
  volume: "L",
  temperature: "K",
  pressure: "atm",
  gasConstant: "L*atm/(mol*K)",
} as const;

export const STOICHIOMETRY_ASSUMPTIONS: ReadonlyArray<string> = [
  "Reaction coefficients from Builder are already balanced and used as exact molar ratios.",
  "All entered amounts are interpreted in mol.",
  "Theoretical amounts assume complete conversion until the limiting reactant is exhausted.",
  "Product actual-yield inputs are interpreted in mol and used for percent-yield calculation.",
  "Concentration is calculated only when volume is provided and uses c = n / V (mol/L).",
  "Gas-phase calculations use ideal gas law: n = (P*V)/(R*T) and V = (n*R*T)/P, with T in K.",
];

export type StoichiometryValidationErrorCode =
  | "MISSING_PARTICIPANTS"
  | "MISSING_REACTANT"
  | "MISSING_PRODUCT"
  | "MISSING_COEFFICIENT"
  | "INVALID_COEFFICIENT"
  | "NON_POSITIVE_COEFFICIENT"
  | "MISSING_AMOUNT_MOL"
  | "INVALID_AMOUNT_MOL"
  | "NEGATIVE_AMOUNT_MOL"
  | "MISSING_ACTUAL_YIELD"
  | "INVALID_ACTUAL_YIELD"
  | "NEGATIVE_ACTUAL_YIELD"
  | "ZERO_THEORETICAL_YIELD"
  | "INVALID_PHASE"
  | "MISSING_VOLUME_L"
  | "INVALID_VOLUME_L"
  | "NEGATIVE_VOLUME_L"
  | "NON_POSITIVE_VOLUME_L"
  | "MISSING_TEMPERATURE_C"
  | "INVALID_TEMPERATURE_C"
  | "NON_POSITIVE_TEMPERATURE_K"
  | "MISSING_PRESSURE_ATM"
  | "INVALID_PRESSURE_ATM"
  | "NON_POSITIVE_PRESSURE_ATM";

export type StoichiometryValidationField =
  | "reaction"
  | "stoichCoeffInput"
  | "amountMolInput"
  | "actualYieldMolInput"
  | "phase"
  | "volumeLInput"
  | "temperatureC"
  | "pressureAtm";

export type StoichiometryValidationError = {
  code: StoichiometryValidationErrorCode;
  field: StoichiometryValidationField;
  participantId: string | null;
  participantLabel: string | null;
  message: string;
};

export type StoichiometryLimitingReactant = {
  id: string;
  label: string;
  coefficient: number;
  availableAmountMol: number;
  maxReactionExtentMol: number;
};

export type StoichiometryParticipantAmount = {
  id: string;
  label: string;
  role: StoichiometryParticipantRole;
  coefficient: number;
  initialAmountMol: number;
  theoreticalAmountMol: number;
  actualYieldAmountMol: number | null;
  percentYield: number | null;
  stoichRatioToLimiting: number;
  consumedAmountMol: number | null;
  producedAmountMol: number | null;
  remainingAmountMol: number | null;
};

export type StoichiometryParticipantConcentration = {
  participantId: string;
  participantLabel: string;
  role: StoichiometryParticipantRole;
  phase: StoichiometryParticipantPhase | null;
  amountMol: number;
  volumeL: number;
  concentrationMolL: number;
};

export type StoichiometryGasRuntime = {
  temperatureC: number;
  temperatureK: number;
  pressureAtm: number;
  gasConstantLAtmPerMolK: number;
};

export type StoichiometryGasCalculation = {
  participantId: string;
  participantLabel: string;
  amountMolInput: number;
  volumeLInput: number;
  idealVolumeL: number;
  impliedAmountMolFromVolume: number;
  volumeDeltaL: number;
  amountDeltaMol: number;
  isVolumeConsistent: boolean;
  isAmountConsistent: boolean;
};

export type StoichiometryDerivedCalculations = {
  concentrations: ReadonlyArray<StoichiometryParticipantConcentration>;
  gasRuntime: StoichiometryGasRuntime | null;
  gasCalculations: ReadonlyArray<StoichiometryGasCalculation>;
};

export type StoichiometryCalculationSuccess = {
  ok: true;
  units: typeof STOICHIOMETRY_UNITS;
  assumptions: ReadonlyArray<string>;
  limitingReactants: ReadonlyArray<StoichiometryLimitingReactant>;
  reactionExtentMol: number;
  participants: ReadonlyArray<StoichiometryParticipantAmount>;
  derivedCalculations: StoichiometryDerivedCalculations;
};

export type StoichiometryCalculationFailure = {
  ok: false;
  units: typeof STOICHIOMETRY_UNITS;
  assumptions: ReadonlyArray<string>;
  errors: ReadonlyArray<StoichiometryValidationError>;
};

export type StoichiometryCalculationResult =
  | StoichiometryCalculationSuccess
  | StoichiometryCalculationFailure;

type ParsedParticipant = {
  id: string;
  label: string;
  role: StoichiometryParticipantRole;
  coefficient: number;
  amountMol: number;
  phase: StoichiometryParticipantPhase | null;
  hasVolumeInput: boolean;
  volumeL: number | null;
  actualYieldMol: number | null;
};

type ReactantExtent = {
  participant: ParsedParticipant;
  maxReactionExtentMol: number;
};

const LIMITING_REACTANT_RELATIVE_TOLERANCE = 1e-12;
const LIMITING_REACTANT_ABSOLUTE_TOLERANCE = 1e-15;
const ZERO_CLAMP_EPSILON = 1e-10;
const IDEAL_GAS_CONSTANT_L_ATM_PER_MOL_K = 0.082057338;
const CELSIUS_TO_KELVIN_OFFSET = 273.15;
// Keep tolerances aligned with E07 dimensional checks.
const DIMENSION_CHECK_ABSOLUTE_TOLERANCE = 1e-6;
const DIMENSION_CHECK_RELATIVE_TOLERANCE = 1e-4;

function normalizeParticipantLabel(labelInput: string, fallbackIndex: number): string {
  const normalizedLabel = labelInput.trim();
  if (normalizedLabel.length > 0) {
    return normalizedLabel;
  }

  return `Participant ${(fallbackIndex + 1).toString()}`;
}

function createGlobalError(
  code: StoichiometryValidationErrorCode,
  message: string,
): StoichiometryValidationError {
  return {
    code,
    field: "reaction",
    participantId: null,
    participantLabel: null,
    message,
  };
}

function createRuntimeError(
  code: StoichiometryValidationErrorCode,
  field: "temperatureC" | "pressureAtm",
  message: string,
): StoichiometryValidationError {
  return {
    code,
    field,
    participantId: null,
    participantLabel: null,
    message,
  };
}

function createParticipantError(params: {
  code: StoichiometryValidationErrorCode;
  field: Exclude<StoichiometryValidationField, "reaction" | "temperatureC" | "pressureAtm">;
  participant: StoichiometryParticipantInput;
  participantLabel: string;
  message: string;
}): StoichiometryValidationError {
  return {
    code: params.code,
    field: params.field,
    participantId: params.participant.id,
    participantLabel: params.participantLabel,
    message: params.message,
  };
}

function parseParticipantPhase(
  participant: StoichiometryParticipantInput,
  participantLabel: string,
  errors: StoichiometryValidationError[],
): StoichiometryParticipantPhase | null {
  const normalizedPhaseInput = participant.phase?.trim().toLowerCase() ?? "";
  if (normalizedPhaseInput.length === 0) {
    return null;
  }

  if (
    !STOICHIOMETRY_PARTICIPANT_PHASES.includes(
      normalizedPhaseInput as StoichiometryParticipantPhase,
    )
  ) {
    errors.push(
      createParticipantError({
        code: "INVALID_PHASE",
        field: "phase",
        participant,
        participantLabel,
        message: `${participantLabel}: choose a valid phase.`,
      }),
    );
    return null;
  }

  return normalizedPhaseInput as StoichiometryParticipantPhase;
}

function parseParticipant(
  participant: StoichiometryParticipantInput,
  participantIndex: number,
  errors: StoichiometryValidationError[],
): ParsedParticipant | null {
  const participantLabel = normalizeParticipantLabel(participant.label, participantIndex);
  const normalizedCoefficient = participant.stoichCoeffInput.trim();
  const normalizedAmountMol = participant.amountMolInput.trim();
  const normalizedVolumeL = participant.volumeLInput?.trim() ?? "";
  const normalizedActualYieldMol = participant.actualYieldMolInput?.trim() ?? "";
  const parsedPhase = parseParticipantPhase(participant, participantLabel, errors);

  let coefficient: number | null = null;
  if (normalizedCoefficient.length === 0) {
    errors.push(
      createParticipantError({
        code: "MISSING_COEFFICIENT",
        field: "stoichCoeffInput",
        participant,
        participantLabel,
        message: `${participantLabel}: enter a reaction coefficient.`,
      }),
    );
  } else {
    const parsedCoefficient = parseNormalizedNumberInput(normalizedCoefficient, {
      allowNegative: true,
    });

    if (!parsedCoefficient.ok) {
      errors.push(
        createParticipantError({
          code: "INVALID_COEFFICIENT",
          field: "stoichCoeffInput",
          participant,
          participantLabel,
          message: `${participantLabel}: reaction coefficient must be a number.`,
        }),
      );
    } else if (parsedCoefficient.value <= 0) {
      errors.push(
        createParticipantError({
          code: "NON_POSITIVE_COEFFICIENT",
          field: "stoichCoeffInput",
          participant,
          participantLabel,
          message: `${participantLabel}: reaction coefficient must be greater than 0.`,
        }),
      );
    } else {
      coefficient = parsedCoefficient.value;
    }
  }

  let amountMol: number | null = null;
  if (normalizedAmountMol.length === 0) {
    errors.push(
      createParticipantError({
        code: "MISSING_AMOUNT_MOL",
        field: "amountMolInput",
        participant,
        participantLabel,
        message: `${participantLabel}: enter amount in mol.`,
      }),
    );
  } else {
    const parsedAmountMol = parseNormalizedNumberInput(normalizedAmountMol);
    if (!parsedAmountMol.ok) {
      if (parsedAmountMol.code === "NEGATIVE_VALUE") {
        errors.push(
          createParticipantError({
            code: "NEGATIVE_AMOUNT_MOL",
            field: "amountMolInput",
            participant,
            participantLabel,
            message: `${participantLabel}: amount in mol cannot be negative.`,
          }),
        );
      } else {
        errors.push(
          createParticipantError({
            code: "INVALID_AMOUNT_MOL",
            field: "amountMolInput",
            participant,
            participantLabel,
            message: `${participantLabel}: amount in mol must be a number.`,
          }),
        );
      }
    } else {
      amountMol = parsedAmountMol.value;
    }
  }

  let volumeL: number | null = null;
  const hasVolumeInput = normalizedVolumeL.length > 0;
  if (hasVolumeInput) {
    const parsedVolumeL = parseNormalizedNumberInput(normalizedVolumeL);
    if (!parsedVolumeL.ok) {
      if (parsedVolumeL.code === "NEGATIVE_VALUE") {
        errors.push(
          createParticipantError({
            code: "NEGATIVE_VOLUME_L",
            field: "volumeLInput",
            participant,
            participantLabel,
            message: `${participantLabel}: volume in liters cannot be negative.`,
          }),
        );
      } else {
        errors.push(
          createParticipantError({
            code: "INVALID_VOLUME_L",
            field: "volumeLInput",
            participant,
            participantLabel,
            message: `${participantLabel}: volume in liters must be a number.`,
          }),
        );
      }
    } else {
      volumeL = parsedVolumeL.value;
      if (parsedVolumeL.value <= 0) {
        errors.push(
          createParticipantError({
            code: "NON_POSITIVE_VOLUME_L",
            field: "volumeLInput",
            participant,
            participantLabel,
            message: `${participantLabel}: volume in liters must be greater than 0 for concentration and gas calculations.`,
          }),
        );
      }
    }
  }

  if (parsedPhase === "gas" && !hasVolumeInput) {
    errors.push(
      createParticipantError({
        code: "MISSING_VOLUME_L",
        field: "volumeLInput",
        participant,
        participantLabel,
        message: `${participantLabel}: enter volume in liters for gas-phase calculations.`,
      }),
    );
  }

  let actualYieldMol: number | null = null;
  if (participant.role === "product") {
    if (normalizedActualYieldMol.length === 0) {
      errors.push(
        createParticipantError({
          code: "MISSING_ACTUAL_YIELD",
          field: "actualYieldMolInput",
          participant,
          participantLabel,
          message: `${participantLabel}: enter actual yield in mol.`,
        }),
      );
    } else {
      const parsedActualYieldMol = parseNormalizedNumberInput(normalizedActualYieldMol);
      if (!parsedActualYieldMol.ok) {
        if (parsedActualYieldMol.code === "NEGATIVE_VALUE") {
          errors.push(
            createParticipantError({
              code: "NEGATIVE_ACTUAL_YIELD",
              field: "actualYieldMolInput",
              participant,
              participantLabel,
              message: `${participantLabel}: actual yield in mol cannot be negative.`,
            }),
          );
        } else {
          errors.push(
            createParticipantError({
              code: "INVALID_ACTUAL_YIELD",
              field: "actualYieldMolInput",
              participant,
              participantLabel,
              message: `${participantLabel}: actual yield in mol must be a number.`,
            }),
          );
        }
      } else {
        actualYieldMol = parsedActualYieldMol.value;
      }
    }
  }

  if (coefficient === null || amountMol === null) {
    return null;
  }

  return {
    id: participant.id,
    label: participantLabel,
    role: participant.role,
    coefficient,
    amountMol,
    phase: parsedPhase,
    hasVolumeInput,
    volumeL,
    actualYieldMol,
  };
}

function buildFailureResult(
  errors: ReadonlyArray<StoichiometryValidationError>,
): StoichiometryCalculationFailure {
  return {
    ok: false,
    units: STOICHIOMETRY_UNITS,
    assumptions: STOICHIOMETRY_ASSUMPTIONS,
    errors,
  };
}

function clampNearZero(value: number): number {
  if (Math.abs(value) <= ZERO_CLAMP_EPSILON) {
    return 0;
  }

  return value;
}

function areExtentsEquivalent(leftExtentMol: number, rightExtentMol: number): boolean {
  const difference = Math.abs(leftExtentMol - rightExtentMol);
  const scaledTolerance = Math.max(
    LIMITING_REACTANT_ABSOLUTE_TOLERANCE,
    LIMITING_REACTANT_RELATIVE_TOLERANCE *
      Math.max(Math.abs(leftExtentMol), Math.abs(rightExtentMol)),
  );

  return difference <= scaledTolerance;
}

function isDimensionValueConsistent(expectedValue: number, actualValue: number): boolean {
  const delta = Math.abs(expectedValue - actualValue);
  const scale = Math.max(Math.abs(expectedValue), Math.abs(actualValue), Number.EPSILON);
  return (
    delta <= DIMENSION_CHECK_ABSOLUTE_TOLERANCE ||
    delta <= scale * DIMENSION_CHECK_RELATIVE_TOLERANCE
  );
}

function buildReactantExtents(
  reactants: ReadonlyArray<ParsedParticipant>,
): ReadonlyArray<ReactantExtent> {
  return reactants.map((reactant) => ({
    participant: reactant,
    maxReactionExtentMol: reactant.amountMol / reactant.coefficient,
  }));
}

function parseGasRuntimeSettings(
  runtimeSettings: StoichiometryRuntimeInput | undefined,
  errors: StoichiometryValidationError[],
): StoichiometryGasRuntime | null {
  const temperatureC = runtimeSettings?.temperatureC ?? null;
  const pressureAtm = runtimeSettings?.pressureAtm ?? null;

  let resolvedTemperatureC: number | null = null;
  if (temperatureC === null) {
    errors.push(
      createRuntimeError(
        "MISSING_TEMPERATURE_C",
        "temperatureC",
        "Enter runtime temperature in °C for gas-phase calculations.",
      ),
    );
  } else if (!Number.isFinite(temperatureC)) {
    errors.push(
      createRuntimeError(
        "INVALID_TEMPERATURE_C",
        "temperatureC",
        "Runtime temperature must be a finite number.",
      ),
    );
  } else {
    const temperatureK = temperatureC + CELSIUS_TO_KELVIN_OFFSET;
    if (temperatureK <= 0) {
      errors.push(
        createRuntimeError(
          "NON_POSITIVE_TEMPERATURE_K",
          "temperatureC",
          "Runtime temperature must be above -273.15°C for ideal-gas calculations.",
        ),
      );
    } else {
      resolvedTemperatureC = temperatureC;
    }
  }

  let resolvedPressureAtm: number | null = null;
  if (pressureAtm === null) {
    errors.push(
      createRuntimeError(
        "MISSING_PRESSURE_ATM",
        "pressureAtm",
        "Enter runtime pressure in atm for gas-phase calculations.",
      ),
    );
  } else if (!Number.isFinite(pressureAtm)) {
    errors.push(
      createRuntimeError(
        "INVALID_PRESSURE_ATM",
        "pressureAtm",
        "Runtime pressure must be a finite number.",
      ),
    );
  } else if (pressureAtm <= 0) {
    errors.push(
      createRuntimeError(
        "NON_POSITIVE_PRESSURE_ATM",
        "pressureAtm",
        "Runtime pressure must be greater than 0 atm for ideal-gas calculations.",
      ),
    );
  } else {
    resolvedPressureAtm = pressureAtm;
  }

  if (resolvedTemperatureC === null || resolvedPressureAtm === null) {
    return null;
  }

  return {
    temperatureC: resolvedTemperatureC,
    temperatureK: resolvedTemperatureC + CELSIUS_TO_KELVIN_OFFSET,
    pressureAtm: resolvedPressureAtm,
    gasConstantLAtmPerMolK: IDEAL_GAS_CONSTANT_L_ATM_PER_MOL_K,
  };
}

function buildConcentrationCalculations(
  participants: ReadonlyArray<ParsedParticipant>,
): ReadonlyArray<StoichiometryParticipantConcentration> {
  return participants
    .filter((participant) => participant.hasVolumeInput && participant.volumeL !== null)
    .filter((participant) => (participant.volumeL as number) > 0)
    .map(
      (participant): StoichiometryParticipantConcentration => ({
        participantId: participant.id,
        participantLabel: participant.label,
        role: participant.role,
        phase: participant.phase,
        amountMol: participant.amountMol,
        volumeL: participant.volumeL as number,
        concentrationMolL: participant.amountMol / (participant.volumeL as number),
      }),
    );
}

function buildGasCalculations(
  participants: ReadonlyArray<ParsedParticipant>,
  runtime: StoichiometryGasRuntime,
): ReadonlyArray<StoichiometryGasCalculation> {
  return participants
    .filter((participant) => participant.phase === "gas")
    .filter((participant) => participant.volumeL !== null)
    .filter((participant) => (participant.volumeL as number) > 0)
    .map((participant): StoichiometryGasCalculation => {
      const volumeLInput = participant.volumeL as number;
      const idealVolumeL =
        (participant.amountMol * runtime.gasConstantLAtmPerMolK * runtime.temperatureK) /
        runtime.pressureAtm;
      const impliedAmountMolFromVolume =
        (runtime.pressureAtm * volumeLInput) /
        (runtime.gasConstantLAtmPerMolK * runtime.temperatureK);
      const volumeDeltaL = volumeLInput - idealVolumeL;
      const amountDeltaMol = participant.amountMol - impliedAmountMolFromVolume;

      return {
        participantId: participant.id,
        participantLabel: participant.label,
        amountMolInput: participant.amountMol,
        volumeLInput,
        idealVolumeL,
        impliedAmountMolFromVolume,
        volumeDeltaL,
        amountDeltaMol,
        isVolumeConsistent: isDimensionValueConsistent(idealVolumeL, volumeLInput),
        isAmountConsistent: isDimensionValueConsistent(
          impliedAmountMolFromVolume,
          participant.amountMol,
        ),
      };
    });
}

export function calculateStoichiometry(
  input: StoichiometryCalculationInput,
): StoichiometryCalculationResult {
  if (input.participants.length === 0) {
    return buildFailureResult([
      createGlobalError(
        "MISSING_PARTICIPANTS",
        "Add participants in Builder to calculate stoichiometry and limiting reactant.",
      ),
    ]);
  }

  const errors: StoichiometryValidationError[] = [];
  const parsedParticipants: ParsedParticipant[] = [];

  for (const [participantIndex, participant] of input.participants.entries()) {
    const parsedParticipant = parseParticipant(participant, participantIndex, errors);
    if (parsedParticipant !== null) {
      parsedParticipants.push(parsedParticipant);
    }
  }

  const hasReactant = input.participants.some((participant) => participant.role === "reactant");
  if (!hasReactant) {
    errors.push(
      createGlobalError("MISSING_REACTANT", "Mark at least one participant as a reactant."),
    );
  }

  const hasProduct = input.participants.some((participant) => participant.role === "product");
  if (!hasProduct) {
    errors.push(
      createGlobalError("MISSING_PRODUCT", "Mark at least one participant as a product."),
    );
  }

  const requiresGasRuntime = parsedParticipants.some((participant) => participant.phase === "gas");
  const gasRuntime = requiresGasRuntime
    ? parseGasRuntimeSettings(input.runtimeSettings, errors)
    : null;

  if (errors.length > 0) {
    return buildFailureResult(errors);
  }

  const reactants = parsedParticipants.filter((participant) => participant.role === "reactant");
  const reactantExtents = buildReactantExtents(reactants);
  const reactionExtentMol = Math.min(
    ...reactantExtents.map((reactantExtent) => reactantExtent.maxReactionExtentMol),
  );

  const limitingReactants = reactantExtents
    .filter((reactantExtent) =>
      areExtentsEquivalent(reactantExtent.maxReactionExtentMol, reactionExtentMol),
    )
    .map(
      (reactantExtent): StoichiometryLimitingReactant => ({
        id: reactantExtent.participant.id,
        label: reactantExtent.participant.label,
        coefficient: reactantExtent.participant.coefficient,
        availableAmountMol: reactantExtent.participant.amountMol,
        maxReactionExtentMol: reactantExtent.maxReactionExtentMol,
      }),
    );

  const referenceLimitingCoefficient = limitingReactants[0].coefficient;
  const yieldValidationErrors: StoichiometryValidationError[] = [];
  const participantSummaries: ReadonlyArray<StoichiometryParticipantAmount> =
    parsedParticipants.map((participant) => {
      const theoreticalAmountMol = participant.coefficient * reactionExtentMol;

      if (participant.role === "reactant") {
        const consumedAmountMol = theoreticalAmountMol;
        const remainingAmountMol = clampNearZero(participant.amountMol - consumedAmountMol);

        return {
          id: participant.id,
          label: participant.label,
          role: participant.role,
          coefficient: participant.coefficient,
          initialAmountMol: participant.amountMol,
          theoreticalAmountMol,
          actualYieldAmountMol: null,
          percentYield: null,
          stoichRatioToLimiting: participant.coefficient / referenceLimitingCoefficient,
          consumedAmountMol,
          producedAmountMol: null,
          remainingAmountMol,
        };
      }

      const actualYieldAmountMol = participant.actualYieldMol;
      if (actualYieldAmountMol === null) {
        yieldValidationErrors.push({
          code: "MISSING_ACTUAL_YIELD",
          field: "actualYieldMolInput",
          participantId: participant.id,
          participantLabel: participant.label,
          message: `${participant.label}: enter actual yield in mol.`,
        });
      }

      if (Math.abs(theoreticalAmountMol) <= LIMITING_REACTANT_ABSOLUTE_TOLERANCE) {
        yieldValidationErrors.push({
          code: "ZERO_THEORETICAL_YIELD",
          field: "actualYieldMolInput",
          participantId: participant.id,
          participantLabel: participant.label,
          message: `${participant.label}: theoretical yield is 0 mol, so percent yield cannot be calculated.`,
        });
      }

      const percentYield =
        Math.abs(theoreticalAmountMol) <= LIMITING_REACTANT_ABSOLUTE_TOLERANCE ||
        actualYieldAmountMol === null
          ? null
          : (actualYieldAmountMol / theoreticalAmountMol) * 100;

      return {
        id: participant.id,
        label: participant.label,
        role: participant.role,
        coefficient: participant.coefficient,
        initialAmountMol: participant.amountMol,
        theoreticalAmountMol,
        actualYieldAmountMol,
        percentYield,
        stoichRatioToLimiting: participant.coefficient / referenceLimitingCoefficient,
        consumedAmountMol: null,
        producedAmountMol: theoreticalAmountMol,
        remainingAmountMol: null,
      };
    });

  if (yieldValidationErrors.length > 0) {
    return buildFailureResult(yieldValidationErrors);
  }

  const derivedCalculations: StoichiometryDerivedCalculations = {
    concentrations: buildConcentrationCalculations(parsedParticipants),
    gasRuntime,
    gasCalculations:
      gasRuntime === null ? [] : buildGasCalculations(parsedParticipants, gasRuntime),
  };

  return {
    ok: true,
    units: STOICHIOMETRY_UNITS,
    assumptions: STOICHIOMETRY_ASSUMPTIONS,
    limitingReactants,
    reactionExtentMol,
    participants: participantSummaries,
    derivedCalculations,
  };
}

export function formatStoichiometryValue(value: number, precision = 6): string {
  const roundedValue = Number(value.toFixed(precision));
  if (Object.is(roundedValue, -0)) {
    return "0";
  }

  return String(roundedValue);
}
