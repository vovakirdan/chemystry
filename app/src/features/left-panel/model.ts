import type {
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

export const isLeftPanelTabId = (value: string): value is LeftPanelTabId =>
  LEFT_PANEL_TAB_IDS.includes(value as LeftPanelTabId);

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

export function formatLibraryPhaseLabel(value: SubstancePhaseV1): string {
  return LIBRARY_PHASE_LABEL_BY_VALUE[value];
}

export function formatLibrarySourceLabel(value: SubstanceSourceV1): string {
  return LIBRARY_SOURCE_LABEL_BY_VALUE[value];
}
