import type {
  PresetCatalogEntryV1,
  ReactionClassV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "../../shared/contracts/ipc/v1";
import {
  STANDARD_MOLAR_VOLUME_L_PER_MOL,
  convertQuantityInput,
  parseNormalizedNumberInput,
} from "../../shared/lib/units";

export const LEFT_PANEL_TAB_IDS = ["library", "builder", "presets"] as const;

export type LeftPanelTabId = (typeof LEFT_PANEL_TAB_IDS)[number];
export type LeftPanelPlaceholderState = "loading" | "empty" | "error" | "ready";

export const DEFAULT_LEFT_PANEL_TAB: LeftPanelTabId = "library";

export const LIBRARY_PHASE_FILTER_OPTIONS: ReadonlyArray<SubstancePhaseV1> = [
  "solid",
  "liquid",
  "gas",
  "aqueous",
];

export const LIBRARY_SOURCE_FILTER_OPTIONS: ReadonlyArray<SubstanceSourceV1> = [
  "builtin",
  "imported",
  "user",
];

export interface UserSubstanceDraft {
  name: string;
  formula: string;
  phase: SubstancePhaseV1;
  molarMassInput: string;
}

export type UserSubstanceDraftField = keyof UserSubstanceDraft;

export interface BuilderDraft {
  title: string;
  reactionClass: ReactionClassV1;
  equation: string;
  description: string;
  participants: ReadonlyArray<BuilderDraftParticipant>;
}

export const BUILDER_PARTICIPANT_ROLES = ["reactant", "product"] as const;
export type BuilderParticipantRole = (typeof BUILDER_PARTICIPANT_ROLES)[number];

export interface BuilderDraftParticipant {
  id: string;
  substanceId: string;
  role: BuilderParticipantRole;
  stoichCoeffInput: string;
  phase: SubstancePhaseV1;
  amountMolInput: string;
  massGInput: string;
  volumeLInput: string;
}

export type BuilderDraftField = "title" | "reactionClass" | "equation" | "description";
export type BuilderDraftParticipantField =
  | "substanceId"
  | "role"
  | "stoichCoeffInput"
  | "phase"
  | "amountMolInput"
  | "massGInput"
  | "volumeLInput";

export interface UserSubstanceFormInput {
  name: string;
  formula: string;
  phase: SubstancePhaseV1;
  molarMassGMol: number;
}

export interface UserSubstanceDraftValidationResult {
  errors: ReadonlyArray<string>;
  input: UserSubstanceFormInput | null;
}

export interface BuilderLaunchValidationOptions {
  gasMolarVolumeLPerMol?: number | null;
}

export const DEFAULT_USER_SUBSTANCE_DRAFT: Readonly<UserSubstanceDraft> = {
  name: "",
  formula: "",
  phase: "solid",
  molarMassInput: "",
};

export const DEFAULT_BUILDER_DRAFT: Readonly<BuilderDraft> = {
  title: "",
  reactionClass: "inorganic",
  equation: "",
  description: "",
  participants: [],
};

const LIBRARY_PHASE_LABEL_BY_VALUE: Record<SubstancePhaseV1, string> = {
  solid: "Solid",
  liquid: "Liquid",
  gas: "Gas",
  aqueous: "Aqueous",
};

const LIBRARY_SOURCE_LABEL_BY_VALUE: Record<SubstanceSourceV1, string> = {
  builtin: "Builtin",
  imported: "Imported",
  user: "User",
};

const REACTION_CLASS_LABEL_BY_VALUE: Record<ReactionClassV1, string> = {
  inorganic: "Inorganic",
  acid_base: "Acid/Base",
  redox: "Redox",
  organic_basic: "Organic Basic",
  equilibrium: "Equilibrium",
};

const BUILDER_DRAFT_STORAGE_VERSION = 1;

export const isLeftPanelTabId = (value: string): value is LeftPanelTabId =>
  LEFT_PANEL_TAB_IDS.includes(value as LeftPanelTabId);

export function isUserSubstanceEditable(substance: SubstanceCatalogEntryV1 | null): boolean {
  return substance !== null && substance.source === "user";
}

export function createUserSubstanceDraftFromCatalogEntry(
  substance: SubstanceCatalogEntryV1,
): UserSubstanceDraft {
  return {
    name: substance.name,
    formula: substance.formula,
    phase: substance.phase,
    molarMassInput:
      substance.molarMassGMol === null ? "" : String(Number(substance.molarMassGMol.toFixed(5))),
  };
}

export function createBuilderDraftFromPreset(preset: PresetCatalogEntryV1): BuilderDraft {
  return {
    title: preset.title,
    reactionClass: preset.reactionClass,
    equation: preset.equation,
    description: preset.description,
    participants: [],
  };
}

export function updateBuilderDraftField(
  draft: BuilderDraft,
  field: BuilderDraftField,
  value: string,
): BuilderDraft {
  if (field === "reactionClass") {
    if (!isReactionClass(value)) {
      return draft;
    }

    return {
      ...draft,
      reactionClass: value as ReactionClassV1,
    };
  }

  return {
    ...draft,
    [field]: value,
  };
}

export function addBuilderDraftParticipant(
  draft: BuilderDraft,
  participant: BuilderDraftParticipant,
): BuilderDraft {
  if (
    participant.id.trim().length === 0 ||
    participant.substanceId.trim().length === 0 ||
    !isBuilderParticipantRole(participant.role) ||
    !isSubstancePhase(participant.phase) ||
    draft.participants.some((currentParticipant) => currentParticipant.id === participant.id)
  ) {
    return draft;
  }

  return {
    ...draft,
    participants: [...draft.participants, participant],
  };
}

export function removeBuilderDraftParticipant(
  draft: BuilderDraft,
  participantId: string,
): BuilderDraft {
  const nextParticipants = draft.participants.filter(
    (participant) => participant.id !== participantId,
  );

  if (nextParticipants.length === draft.participants.length) {
    return draft;
  }

  return {
    ...draft,
    participants: nextParticipants,
  };
}

export function updateBuilderDraftParticipantField(
  draft: BuilderDraft,
  participantId: string,
  field: BuilderDraftParticipantField,
  value: string,
  substances: ReadonlyArray<SubstanceCatalogEntryV1> = [],
): BuilderDraft {
  let updated = false;

  const nextParticipants = draft.participants.map((participant) => {
    if (participant.id !== participantId) {
      return participant;
    }

    let nextParticipant = participant;

    if (field === "role") {
      if (!isBuilderParticipantRole(value)) {
        return participant;
      }

      updated = true;
      return {
        ...participant,
        role: value,
      };
    }

    if (field === "substanceId") {
      if (value.trim().length === 0) {
        return participant;
      }

      const selectedSubstance = substances.find((substance) => substance.id === value);
      nextParticipant = {
        ...participant,
        substanceId: value,
        phase: selectedSubstance?.phase ?? participant.phase,
      };
      nextParticipant = applyParticipantUnitConversions(nextParticipant, "substanceId", substances);
      updated = true;
      return nextParticipant;
    }

    if (field === "phase") {
      if (!isSubstancePhase(value)) {
        return participant;
      }

      updated = true;
      return {
        ...participant,
        phase: value,
      };
    }

    if (field === "stoichCoeffInput") {
      updated = true;
      return {
        ...participant,
        stoichCoeffInput: value,
      };
    }

    if (field === "amountMolInput") {
      nextParticipant = {
        ...participant,
        amountMolInput: value,
      };
      nextParticipant = applyParticipantUnitConversions(
        nextParticipant,
        "amountMolInput",
        substances,
      );
      updated = true;
      return nextParticipant;
    }

    if (field === "massGInput") {
      nextParticipant = {
        ...participant,
        massGInput: value,
      };
      nextParticipant = applyParticipantUnitConversions(nextParticipant, "massGInput", substances);
      updated = true;
      return nextParticipant;
    }

    nextParticipant = {
      ...participant,
      volumeLInput: value,
    };
    nextParticipant = applyParticipantUnitConversions(nextParticipant, "volumeLInput", substances);
    updated = true;
    return nextParticipant;
  });

  if (!updated) {
    return draft;
  }

  return {
    ...draft,
    participants: nextParticipants,
  };
}

export function serializeBuilderDraftForStorage(draft: BuilderDraft): string {
  return JSON.stringify({
    version: BUILDER_DRAFT_STORAGE_VERSION,
    draft,
  });
}

export function parseBuilderDraftFromStorage(
  storedValue: string | null,
  substances: ReadonlyArray<SubstanceCatalogEntryV1> = [],
): BuilderDraft | null {
  if (storedValue === null) {
    return null;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(storedValue) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsedValue)) {
    return null;
  }

  if (parsedValue.version !== BUILDER_DRAFT_STORAGE_VERSION) {
    return null;
  }

  return parseBuilderDraftValue(parsedValue.draft, substances);
}

export function validateBuilderDraftForLaunch(
  draft: BuilderDraft,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
  options: BuilderLaunchValidationOptions = {},
): ReadonlyArray<string> {
  const errors: string[] = [];
  const gasMolarVolumeLPerMol = resolveValidationGasMolarVolumeLPerMol(
    options.gasMolarVolumeLPerMol,
  );

  for (const participant of draft.participants) {
    if (!isSubstancePhase(participant.phase)) {
      errors.push(`Participant "${participant.id}" has unsupported phase value.`);
    }

    pushBuilderParticipantNonNegativeFieldError(
      errors,
      participant.id,
      "Stoich coeff",
      participant.stoichCoeffInput,
    );
    pushBuilderParticipantNonNegativeFieldError(
      errors,
      participant.id,
      "Amount (mol)",
      participant.amountMolInput,
    );
    pushBuilderParticipantNonNegativeFieldError(
      errors,
      participant.id,
      "Mass (g)",
      participant.massGInput,
    );
    pushBuilderParticipantNonNegativeFieldError(
      errors,
      participant.id,
      "Volume (L)",
      participant.volumeLInput,
    );
    pushBuilderParticipantDimensionConsistencyErrors(
      errors,
      participant,
      substances,
      gasMolarVolumeLPerMol,
    );
  }

  return errors;
}

export function validateUserSubstanceDraft(
  draft: UserSubstanceDraft,
): UserSubstanceDraftValidationResult {
  const errors: string[] = [];
  const normalizedName = draft.name.trim();
  const normalizedFormula = draft.formula.trim();

  if (normalizedName.length === 0) {
    errors.push("Name is required.");
  }

  if (normalizedFormula.length === 0) {
    errors.push("Formula is required.");
  }

  if (!LIBRARY_PHASE_FILTER_OPTIONS.includes(draft.phase)) {
    errors.push("Phase must be one of: solid, liquid, gas, aqueous.");
  }

  const molarMassText = draft.molarMassInput.trim();
  let molarMassGMol: number | null = null;
  if (molarMassText.length === 0) {
    errors.push("Molar mass is required.");
  } else {
    const parsedMolarMass = parseNormalizedNumberInput(molarMassText);
    if (!parsedMolarMass.ok || parsedMolarMass.value <= 0) {
      errors.push("Molar mass must be a positive number.");
    } else {
      molarMassGMol = parsedMolarMass.value;
    }
  }

  if (errors.length > 0) {
    return {
      errors,
      input: null,
    };
  }

  if (molarMassGMol === null) {
    return {
      errors: ["Molar mass is required."],
      input: null,
    };
  }

  return {
    errors: [],
    input: {
      name: normalizedName,
      formula: normalizedFormula,
      phase: draft.phase,
      molarMassGMol,
    },
  };
}

export function normalizeLibrarySearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function filterLibrarySubstances(
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
  searchQuery: string,
  selectedPhases: ReadonlySet<SubstancePhaseV1>,
  selectedSources: ReadonlySet<SubstanceSourceV1>,
): ReadonlyArray<SubstanceCatalogEntryV1> {
  const normalizedSearch = normalizeLibrarySearchQuery(searchQuery);

  return substances.filter((substance) => {
    if (!selectedPhases.has(substance.phase)) {
      return false;
    }

    if (!selectedSources.has(substance.source)) {
      return false;
    }

    if (normalizedSearch.length === 0) {
      return true;
    }

    return (
      substance.name.toLowerCase().includes(normalizedSearch) ||
      substance.formula.toLowerCase().includes(normalizedSearch)
    );
  });
}

export function resolveSelectedLibrarySubstanceId(
  currentSelectionId: string | null,
  visibleSubstances: ReadonlyArray<SubstanceCatalogEntryV1>,
): string | null {
  if (visibleSubstances.length === 0) {
    return null;
  }

  if (
    currentSelectionId !== null &&
    visibleSubstances.some((substance) => substance.id === currentSelectionId)
  ) {
    return currentSelectionId;
  }

  return visibleSubstances[0].id;
}

export function resolveSelectedPresetId(
  currentSelectionId: string | null,
  presets: ReadonlyArray<PresetCatalogEntryV1>,
): string | null {
  if (presets.length === 0) {
    return null;
  }

  if (currentSelectionId !== null && presets.some((preset) => preset.id === currentSelectionId)) {
    return currentSelectionId;
  }

  return presets[0].id;
}

export function formatLibraryPhaseLabel(value: SubstancePhaseV1): string {
  return LIBRARY_PHASE_LABEL_BY_VALUE[value];
}

export function formatLibrarySourceLabel(value: SubstanceSourceV1): string {
  return LIBRARY_SOURCE_LABEL_BY_VALUE[value];
}

export function formatReactionClassLabel(value: ReactionClassV1): string {
  return REACTION_CLASS_LABEL_BY_VALUE[value];
}

export function formatPresetComplexityLabel(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/u)
    .filter((token) => token.length > 0)
    .map((token) => `${token[0].toUpperCase()}${token.slice(1).toLowerCase()}`)
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReactionClass(value: string): value is ReactionClassV1 {
  return Object.prototype.hasOwnProperty.call(REACTION_CLASS_LABEL_BY_VALUE, value);
}

function isBuilderParticipantRole(value: string): value is BuilderParticipantRole {
  return BUILDER_PARTICIPANT_ROLES.includes(value as BuilderParticipantRole);
}

function isSubstancePhase(value: string): value is SubstancePhaseV1 {
  return LIBRARY_PHASE_FILTER_OPTIONS.includes(value as SubstancePhaseV1);
}

function parseSubstancePhase(value: unknown): SubstancePhaseV1 | null {
  if (typeof value !== "string" || !isSubstancePhase(value)) {
    return null;
  }

  return value;
}

function isOptionalInputString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

const PARTICIPANT_INPUT_FIELD_UNITS = {
  amountMolInput: "mol",
  massGInput: "g",
  volumeLInput: "L",
} as const;

type ParticipantConvertibleInputField = keyof typeof PARTICIPANT_INPUT_FIELD_UNITS;

const PARTICIPANT_CONVERSION_SOURCE_PRIORITY: ReadonlyArray<ParticipantConvertibleInputField> = [
  "amountMolInput",
  "massGInput",
  "volumeLInput",
];

const DIMENSION_CHECK_ABSOLUTE_TOLERANCE = 1e-6;
const DIMENSION_CHECK_RELATIVE_TOLERANCE = 1e-4;

function parseNonNegativeInputNumber(value: string): number | null {
  const parsedValue = parseNormalizedNumberInput(value);
  if (!parsedValue.ok) {
    return null;
  }

  return parsedValue.value;
}

function resolveValidationGasMolarVolumeLPerMol(
  gasMolarVolumeLPerMol: number | null | undefined,
): number {
  if (
    gasMolarVolumeLPerMol === undefined ||
    gasMolarVolumeLPerMol === null ||
    !Number.isFinite(gasMolarVolumeLPerMol) ||
    gasMolarVolumeLPerMol <= 0
  ) {
    return STANDARD_MOLAR_VOLUME_L_PER_MOL;
  }

  return gasMolarVolumeLPerMol;
}

function resolveParticipantMolarMassGMol(
  participant: BuilderDraftParticipant,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): number | null {
  const selectedSubstance =
    substances.find((substance) => substance.id === participant.substanceId) ?? null;
  if (selectedSubstance === null || selectedSubstance.molarMassGMol === null) {
    return null;
  }

  if (!Number.isFinite(selectedSubstance.molarMassGMol) || selectedSubstance.molarMassGMol <= 0) {
    return null;
  }

  return selectedSubstance.molarMassGMol;
}

function resolveParticipantConversionContext(
  participant: BuilderDraftParticipant,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): { molarMassGMol?: number; isGasPhase: boolean } {
  const context: {
    molarMassGMol?: number;
    isGasPhase: boolean;
  } = {
    isGasPhase: participant.phase === "gas",
  };

  const molarMassGMol = resolveParticipantMolarMassGMol(participant, substances);
  if (molarMassGMol !== null) {
    context.molarMassGMol = molarMassGMol;
  }

  return context;
}

function applyParticipantUnitConversionsFromSourceField(
  participant: BuilderDraftParticipant,
  sourceField: ParticipantConvertibleInputField,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): BuilderDraftParticipant | null {
  const conversionContext = resolveParticipantConversionContext(participant, substances);
  const sourceValueInput = participant[sourceField];
  const sourceUnit = PARTICIPANT_INPUT_FIELD_UNITS[sourceField];

  let convertedParticipant = participant;
  let hasAnyConversion = false;

  for (const targetField of PARTICIPANT_CONVERSION_SOURCE_PRIORITY) {
    if (targetField === sourceField) {
      continue;
    }

    const targetUnit = PARTICIPANT_INPUT_FIELD_UNITS[targetField];
    const conversionResult = convertQuantityInput({
      valueInput: sourceValueInput,
      fromUnit: sourceUnit,
      toUnit: targetUnit,
      context: conversionContext,
    });

    if (!conversionResult.ok) {
      continue;
    }

    convertedParticipant = {
      ...convertedParticipant,
      [targetField]: conversionResult.formattedValue,
    };
    hasAnyConversion = true;
  }

  return hasAnyConversion ? convertedParticipant : null;
}

function applyParticipantUnitConversions(
  participant: BuilderDraftParticipant,
  sourceField: "substanceId" | ParticipantConvertibleInputField,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): BuilderDraftParticipant {
  if (sourceField === "substanceId") {
    for (const candidateSourceField of PARTICIPANT_CONVERSION_SOURCE_PRIORITY) {
      if (parseNonNegativeInputNumber(participant[candidateSourceField]) === null) {
        continue;
      }

      const convertedFromCandidate = applyParticipantUnitConversionsFromSourceField(
        participant,
        candidateSourceField,
        substances,
      );
      if (convertedFromCandidate !== null) {
        return convertedFromCandidate;
      }
    }

    return participant;
  }

  const convertedParticipant = applyParticipantUnitConversionsFromSourceField(
    participant,
    sourceField,
    substances,
  );
  return convertedParticipant ?? participant;
}

function pushBuilderParticipantNonNegativeFieldError(
  errors: string[],
  participantId: string,
  fieldLabel: string,
  value: string,
): void {
  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return;
  }

  const parsedValue = parseNormalizedNumberInput(normalizedValue);
  if (!parsedValue.ok) {
    if (parsedValue.code === "NEGATIVE_VALUE") {
      errors.push(`${fieldLabel} for participant "${participantId}" cannot be negative.`);
      return;
    }

    errors.push(`${fieldLabel} for participant "${participantId}" must be a number.`);
    return;
  }
}

function isDimensionValueConsistent(expectedValue: number, actualValue: number): boolean {
  const delta = Math.abs(expectedValue - actualValue);
  const scale = Math.max(Math.abs(expectedValue), Math.abs(actualValue), Number.EPSILON);
  return (
    delta <= DIMENSION_CHECK_ABSOLUTE_TOLERANCE ||
    delta <= scale * DIMENSION_CHECK_RELATIVE_TOLERANCE
  );
}

function pushBuilderParticipantDimensionConsistencyErrors(
  errors: string[],
  participant: BuilderDraftParticipant,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
  gasMolarVolumeLPerMol: number,
): void {
  const parsedAmountMol = parseNonNegativeInputNumber(participant.amountMolInput);
  const parsedMassG = parseNonNegativeInputNumber(participant.massGInput);
  const parsedVolumeL = parseNonNegativeInputNumber(participant.volumeLInput);

  if (parsedAmountMol !== null && parsedMassG !== null) {
    const hasCatalogContext = substances.some(
      (substance) => substance.id === participant.substanceId,
    );
    if (hasCatalogContext) {
      const molarMassGMol = resolveParticipantMolarMassGMol(participant, substances);
      if (molarMassGMol === null) {
        errors.push(
          `Mass (g) for participant "${participant.id}" cannot be checked against Amount (mol) because molar mass is missing.`,
        );
      } else {
        const expectedMassG = parsedAmountMol * molarMassGMol;
        if (!isDimensionValueConsistent(expectedMassG, parsedMassG)) {
          errors.push(
            `Mass (g) for participant "${participant.id}" is inconsistent with Amount (mol) for selected molar mass.`,
          );
        }
      }
    }
  }

  if (participant.phase !== "gas") {
    return;
  }

  if (parsedAmountMol !== null && parsedVolumeL !== null) {
    const expectedVolumeL = parsedAmountMol * gasMolarVolumeLPerMol;
    if (!isDimensionValueConsistent(expectedVolumeL, parsedVolumeL)) {
      errors.push(
        `Volume (L) for participant "${participant.id}" is inconsistent with Amount (mol) for gas molar volume.`,
      );
    }
  }
}

function parseBuilderDraftValue(
  value: unknown,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): BuilderDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  const { title, reactionClass, equation, description } = value;
  if (
    typeof title !== "string" ||
    typeof reactionClass !== "string" ||
    typeof equation !== "string" ||
    typeof description !== "string" ||
    !isReactionClass(reactionClass)
  ) {
    return null;
  }

  const rawParticipants = value.participants;
  if (rawParticipants === undefined) {
    return {
      title,
      reactionClass,
      equation,
      description,
      participants: [],
    };
  }

  if (!Array.isArray(rawParticipants)) {
    return null;
  }

  const participants: BuilderDraftParticipant[] = [];
  const participantIds = new Set<string>();
  for (const rawParticipant of rawParticipants) {
    const parsedParticipant = parseBuilderDraftParticipant(rawParticipant, substances);
    if (parsedParticipant === null || participantIds.has(parsedParticipant.id)) {
      return null;
    }

    participantIds.add(parsedParticipant.id);
    participants.push(parsedParticipant);
  }

  return {
    title,
    reactionClass,
    equation,
    description,
    participants,
  };
}

function resolveLegacyParticipantPhase(
  substanceId: string,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): SubstancePhaseV1 {
  return substances.find((substance) => substance.id === substanceId)?.phase ?? "solid";
}

function parseBuilderDraftParticipant(
  value: unknown,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): BuilderDraftParticipant | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    id,
    substanceId,
    role,
    stoichCoeffInput,
    phase,
    amountMolInput,
    massGInput,
    volumeLInput,
  } = value;
  if (
    typeof id !== "string" ||
    typeof substanceId !== "string" ||
    typeof role !== "string" ||
    typeof stoichCoeffInput !== "string" ||
    id.trim().length === 0 ||
    substanceId.trim().length === 0 ||
    !isBuilderParticipantRole(role)
  ) {
    return null;
  }

  const parsedPhase =
    phase === undefined
      ? resolveLegacyParticipantPhase(substanceId, substances)
      : parseSubstancePhase(phase);
  if (parsedPhase === null) {
    return null;
  }

  if (
    !isOptionalInputString(amountMolInput) ||
    !isOptionalInputString(massGInput) ||
    !isOptionalInputString(volumeLInput)
  ) {
    return null;
  }

  return {
    id,
    substanceId,
    role,
    stoichCoeffInput,
    phase: parsedPhase,
    amountMolInput: amountMolInput ?? "",
    massGInput: massGInput ?? "",
    volumeLInput: volumeLInput ?? "",
  };
}
