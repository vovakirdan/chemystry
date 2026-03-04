import type {
  PresetCatalogEntryV1,
  ReactionClassV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "../../shared/contracts/ipc/v1";

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
}

export type BuilderDraftField = keyof BuilderDraft;

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
  };
}

export function updateBuilderDraftField(
  draft: BuilderDraft,
  field: BuilderDraftField,
  value: string,
): BuilderDraft {
  if (field === "reactionClass") {
    if (!(value in REACTION_CLASS_LABEL_BY_VALUE)) {
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
    const parsedMolarMass = Number(molarMassText);
    if (!Number.isFinite(parsedMolarMass) || parsedMolarMass <= 0) {
      errors.push("Molar mass must be a positive number.");
    } else {
      molarMassGMol = parsedMolarMass;
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
