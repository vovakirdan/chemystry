import {
  DEFAULT_LEFT_PANEL_TAB,
  DEFAULT_USER_SUBSTANCE_DRAFT,
  LIBRARY_PHASE_FILTER_OPTIONS,
  isLeftPanelTabId,
  parseBuilderDraftFromStorage,
  serializeBuilderDraftForStorage,
  type BuilderDraft,
  type LeftPanelTabId,
  type UserSubstanceDraft,
  type UserSubstanceDraftField,
} from "../../features/left-panel/model";
import type {
  PresetCatalogEntryV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
} from "../../shared/contracts/ipc/v1";

const LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY = "chemystery.leftPanel.activeTab.v1";
const BUILDER_DRAFT_STORAGE_KEY = "chemystery.builder.draft.v1";

export function readStoredLeftPanelTab(): LeftPanelTabId {
  if (typeof window === "undefined") {
    return DEFAULT_LEFT_PANEL_TAB;
  }

  try {
    const storedTab = window.localStorage.getItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY);
    if (storedTab && isLeftPanelTabId(storedTab)) {
      return storedTab;
    }
  } catch {
    // Ignore localStorage failures and use default.
  }

  return DEFAULT_LEFT_PANEL_TAB;
}

export function persistLeftPanelTab(tab: LeftPanelTabId): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY, tab);
  } catch {
    // Ignore localStorage failures to keep UI interactive.
  }
}

export function readStoredBuilderDraft(
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): BuilderDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseBuilderDraftFromStorage(
      window.localStorage.getItem(BUILDER_DRAFT_STORAGE_KEY),
      substances,
    );
  } catch {
    return null;
  }
}

export function persistBuilderDraft(draft: BuilderDraft): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(BUILDER_DRAFT_STORAGE_KEY, serializeBuilderDraftForStorage(draft));
    return true;
  } catch {
    return false;
  }
}

export function toggleFilterValue<T extends string>(
  currentSelection: ReadonlySet<T>,
  value: T,
): ReadonlySet<T> {
  const nextSelection = new Set(currentSelection);
  if (nextSelection.has(value)) {
    nextSelection.delete(value);
  } else {
    nextSelection.add(value);
  }

  return nextSelection;
}

export function createDefaultUserSubstanceDraft(): UserSubstanceDraft {
  return {
    ...DEFAULT_USER_SUBSTANCE_DRAFT,
  };
}

export function createBuilderCopyFeedbackMessage(presetTitle: string): string {
  return `You are editing copy of preset "${presetTitle}". Original preset remains unchanged.`;
}

export function createBuilderParticipantId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `participant-${crypto.randomUUID()}`;
  }

  return `participant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveBuilderParticipantPhase(
  substanceId: string,
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): SubstancePhaseV1 {
  return substances.find((substance) => substance.id === substanceId)?.phase ?? "solid";
}

export function updateUserSubstanceDraftField(
  draft: UserSubstanceDraft,
  field: UserSubstanceDraftField,
  value: string,
): UserSubstanceDraft {
  switch (field) {
    case "name":
      return { ...draft, name: value };
    case "formula":
      return { ...draft, formula: value };
    case "phase":
      if (LIBRARY_PHASE_FILTER_OPTIONS.includes(value as SubstancePhaseV1)) {
        return { ...draft, phase: value as SubstancePhaseV1 };
      }
      return draft;
    case "molarMassInput":
      return { ...draft, molarMassInput: value };
    default:
      return draft;
  }
}

export function sortSubstancesByName(
  substances: ReadonlyArray<SubstanceCatalogEntryV1>,
): ReadonlyArray<SubstanceCatalogEntryV1> {
  return [...substances].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameOrder !== 0) {
      return nameOrder;
    }

    const formulaOrder = left.formula.localeCompare(right.formula, undefined, {
      sensitivity: "base",
    });
    if (formulaOrder !== 0) {
      return formulaOrder;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}

export function sortPresetsByTitle(
  presets: ReadonlyArray<PresetCatalogEntryV1>,
): ReadonlyArray<PresetCatalogEntryV1> {
  return [...presets].sort((left, right) => {
    const titleOrder = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    if (titleOrder !== 0) {
      return titleOrder;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}
