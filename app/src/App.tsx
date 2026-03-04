import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./app/layout/AppShell";
import reactLogo from "./assets/react.svg";
import CenterPanelSkeleton, {
  CENTER_TIMELINE_INITIAL,
  type CenterPanelControlState,
} from "./features/center-panel/CenterPanelSkeleton";
import LeftPanelSkeleton from "./features/left-panel/LeftPanelSkeleton";
import {
  createBuilderDraftFromPreset,
  DEFAULT_LEFT_PANEL_TAB,
  DEFAULT_USER_SUBSTANCE_DRAFT,
  LIBRARY_PHASE_FILTER_OPTIONS,
  LIBRARY_SOURCE_FILTER_OPTIONS,
  createUserSubstanceDraftFromCatalogEntry,
  filterLibrarySubstances,
  isUserSubstanceEditable,
  isLeftPanelTabId,
  resolveSelectedPresetId,
  resolveSelectedLibrarySubstanceId,
  updateBuilderDraftField,
  validateUserSubstanceDraft,
  type BuilderDraft,
  type BuilderDraftField,
  type LeftPanelPlaceholderState,
  type LeftPanelTabId,
  type UserSubstanceDraft,
  type UserSubstanceDraftField,
} from "./features/left-panel/model";
import RightPanelSkeleton, {
  type RightPanelFeatureStatus,
  type RightPanelRuntimeSettings,
} from "./features/right-panel/RightPanelSkeleton";
import NotificationCenter from "./shared/components/NotificationCenter";
import StatusBar from "./shared/components/StatusBar";
import type { FeatureFlagKey, FeatureFlags } from "./shared/config/featureFlags";
import { DEFAULT_FEATURE_FLAGS } from "./shared/config/featureFlags";
import {
  createSubstanceV1,
  deleteSubstanceV1,
  ensureFeatureEnabledV1,
  greetV1,
  healthV1,
  isCommandErrorV1,
  listPresetsV1,
  listSubstancesV1,
  resolveFeatureFlagsV1,
  toUserFacingMessageV1,
  updateSubstanceV1,
} from "./shared/contracts/ipc/client";
import type {
  CommandErrorV1,
  PresetCatalogEntryV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "./shared/contracts/ipc/v1";
import {
  appendNotification,
  type AppNotification,
  type NotificationLevel,
} from "./shared/lib/notifications";
import "./App.css";

const FEATURE_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Simulation",
  importExport: "Import/export",
  advancedPrecision: "Advanced precision",
};

const FEATURE_ACTION_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Try simulation path",
  importExport: "Try import/export path",
  advancedPrecision: "Try advanced precision path",
};

const FEATURE_KEYS: ReadonlyArray<FeatureFlagKey> = [
  "simulation",
  "importExport",
  "advancedPrecision",
];

const LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY = "chemystery.leftPanel.activeTab.v1";

const DEFAULT_CENTER_PANEL_STATE: Readonly<CenterPanelControlState> = {
  isPlaying: false,
  timelinePosition: CENTER_TIMELINE_INITIAL,
};

const DEFAULT_RUNTIME_SETTINGS: Readonly<RightPanelRuntimeSettings> = {
  precisionProfile: "Balanced",
  fpsLimit: 60,
};

function readStoredLeftPanelTab(): LeftPanelTabId {
  if (typeof window === "undefined") {
    return DEFAULT_LEFT_PANEL_TAB;
  }

  try {
    const storedTab = window.localStorage.getItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY);

    if (storedTab && isLeftPanelTabId(storedTab)) {
      return storedTab;
    }
  } catch {
    // Ignore localStorage failures and use the default tab.
  }

  return DEFAULT_LEFT_PANEL_TAB;
}

function persistLeftPanelTab(tab: LeftPanelTabId): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY, tab);
  } catch {
    // Ignore localStorage failures to keep the shell interactive.
  }
}

function formatCommandError(error: CommandErrorV1): string {
  return `${toUserFacingMessageV1(error)} [${error.code}] (ref: ${error.requestId})`;
}

function resolveSimulationState(state: CenterPanelControlState): string {
  if (state.isPlaying) {
    return "Running";
  }

  if (state.timelinePosition <= 0) {
    return "Reset";
  }

  if (state.timelinePosition >= 100) {
    return "Completed";
  }

  return "Paused";
}

function toggleFilterValue<T extends string>(
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

function createDefaultUserSubstanceDraft(): UserSubstanceDraft {
  return {
    ...DEFAULT_USER_SUBSTANCE_DRAFT,
  };
}

function createBuilderCopyFeedbackMessage(presetTitle: string): string {
  return `You are editing copy of preset "${presetTitle}". Original preset remains unchanged.`;
}

function updateUserSubstanceDraftField(
  draft: UserSubstanceDraft,
  field: UserSubstanceDraftField,
  value: string,
): UserSubstanceDraft {
  switch (field) {
    case "name":
      return {
        ...draft,
        name: value,
      };
    case "formula":
      return {
        ...draft,
        formula: value,
      };
    case "phase":
      if (LIBRARY_PHASE_FILTER_OPTIONS.includes(value as SubstancePhaseV1)) {
        return {
          ...draft,
          phase: value as SubstancePhaseV1,
        };
      }
      return draft;
    case "molarMassInput":
      return {
        ...draft,
        molarMassInput: value,
      };
    default:
      return draft;
  }
}

function sortSubstancesByName(
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

function sortPresetsByTitle(
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

function App() {
  const [activeLeftPanelTab, setActiveLeftPanelTab] =
    useState<LeftPanelTabId>(readStoredLeftPanelTab);
  const [greetMsg, setGreetMsg] = useState("");
  const [healthMsg, setHealthMsg] = useState("Checking backend health...");
  const [name, setName] = useState("");
  const [featureFlags, setFeatureFlags] = useState<Readonly<FeatureFlags>>(DEFAULT_FEATURE_FLAGS);
  const [featureFlagsMsg, setFeatureFlagsMsg] = useState("Loading feature flags...");
  const [featurePathMsg, setFeaturePathMsg] = useState("");
  const [simulationControlState, setSimulationControlState] = useState<CenterPanelControlState>(
    DEFAULT_CENTER_PANEL_STATE,
  );
  const [runtimeSettings, setRuntimeSettings] =
    useState<RightPanelRuntimeSettings>(DEFAULT_RUNTIME_SETTINGS);
  const [allSubstances, setAllSubstances] = useState<ReadonlyArray<SubstanceCatalogEntryV1>>([]);
  const [allPresets, setAllPresets] = useState<ReadonlyArray<PresetCatalogEntryV1>>([]);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [selectedLibraryPhases, setSelectedLibraryPhases] = useState<ReadonlySet<SubstancePhaseV1>>(
    () => new Set(LIBRARY_PHASE_FILTER_OPTIONS),
  );
  const [selectedLibrarySources, setSelectedLibrarySources] = useState<
    ReadonlySet<SubstanceSourceV1>
  >(() => new Set(LIBRARY_SOURCE_FILTER_OPTIONS));
  const [selectedLibrarySubstanceId, setSelectedLibrarySubstanceId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [libraryLoadState, setLibraryLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [libraryLoadError, setLibraryLoadError] = useState<string | null>(null);
  const [presetsLoadState, setPresetsLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [presetsLoadError, setPresetsLoadError] = useState<string | null>(null);
  const [builderDraft, setBuilderDraft] = useState<BuilderDraft | null>(null);
  const [builderCopyFeedbackMessage, setBuilderCopyFeedbackMessage] = useState<string | null>(null);
  const [createSubstanceDraft, setCreateSubstanceDraft] = useState<UserSubstanceDraft>(
    createDefaultUserSubstanceDraft,
  );
  const [createSubstanceValidationErrors, setCreateSubstanceValidationErrors] = useState<
    ReadonlyArray<string>
  >([]);
  const [editSubstanceDraft, setEditSubstanceDraft] = useState<UserSubstanceDraft | null>(null);
  const [editSubstanceValidationErrors, setEditSubstanceValidationErrors] = useState<
    ReadonlyArray<string>
  >([]);
  const [libraryMutationState, setLibraryMutationState] = useState<
    "idle" | "creating" | "updating" | "deleting"
  >("idle");
  const [libraryMutationError, setLibraryMutationError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ReadonlyArray<AppNotification>>([]);
  const notificationIdRef = useRef(0);
  const previousSimulationStateRef = useRef<string | null>(null);
  const previousRuntimeSettingsRef = useRef<RightPanelRuntimeSettings | null>(null);

  const enqueueNotification = useCallback((level: NotificationLevel, message: string): void => {
    notificationIdRef.current += 1;
    const nextNotification: AppNotification = {
      id: notificationIdRef.current,
      level,
      message,
    };

    setNotifications((queue) => appendNotification(queue, nextNotification));
  }, []);

  const dismissNotification = useCallback((id: number): void => {
    setNotifications((queue) => queue.filter((notification) => notification.id !== id));
  }, []);

  const simulationStateLabel = resolveSimulationState(simulationControlState);

  useEffect(() => {
    persistLeftPanelTab(activeLeftPanelTab);
  }, [activeLeftPanelTab]);

  useEffect(() => {
    let disposed = false;

    healthV1()
      .then((result) => {
        if (!disposed) {
          setHealthMsg(`Backend ${result.status} (${result.version}, ref: ${result.requestId})`);
          enqueueNotification("info", `Backend status: ${result.status}.`);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          if (isCommandErrorV1(error)) {
            const message = `Backend error: ${formatCommandError(error)}`;
            setHealthMsg(message);
            enqueueNotification("error", message);
            return;
          }

          const message = `Backend error: ${String(error)}`;
          setHealthMsg(message);
          enqueueNotification("error", message);
        }
      });

    resolveFeatureFlagsV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setFeatureFlags(result.flags);
        setFeatureFlagsMsg(
          result.warning
            ? `Feature flags: ${result.source} (ref: ${result.requestId}) - ${result.warning}`
            : `Feature flags: ${result.source} (ref: ${result.requestId})`,
        );
        if (result.warning) {
          enqueueNotification("warn", `Feature flag warning: ${result.warning}`);
        }
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          const message = `Feature flag error: ${formatCommandError(error)}`;
          setFeatureFlagsMsg(message);
          enqueueNotification("error", message);
          return;
        }

        const message = `Feature flag error: ${String(error)}`;
        setFeatureFlagsMsg(message);
        enqueueNotification("error", message);
      });

    listSubstancesV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setAllSubstances(result.substances);
        setLibraryLoadState("ready");
        setLibraryLoadError(null);
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          const message = `Library error: ${formatCommandError(error)}`;
          setLibraryLoadError(message);
          setLibraryLoadState("error");
          enqueueNotification("error", message);
          return;
        }

        const message = `Library error: ${String(error)}`;
        setLibraryLoadError(message);
        setLibraryLoadState("error");
        enqueueNotification("error", message);
      });

    listPresetsV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setAllPresets(sortPresetsByTitle(result.presets));
        setPresetsLoadState("ready");
        setPresetsLoadError(null);
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          const message = `Preset library error: ${formatCommandError(error)}`;
          setPresetsLoadError(message);
          setPresetsLoadState("error");
          enqueueNotification("error", message);
          return;
        }

        const message = `Preset library error: ${String(error)}`;
        setPresetsLoadError(message);
        setPresetsLoadState("error");
        enqueueNotification("error", message);
      });

    return () => {
      disposed = true;
    };
  }, [enqueueNotification]);

  useEffect(() => {
    const previousSimulationState = previousSimulationStateRef.current;

    if (previousSimulationState === null) {
      previousSimulationStateRef.current = simulationStateLabel;
      return;
    }

    if (previousSimulationState !== simulationStateLabel) {
      enqueueNotification("info", `Simulation state changed: ${simulationStateLabel}.`);
      previousSimulationStateRef.current = simulationStateLabel;
    }
  }, [enqueueNotification, simulationStateLabel]);

  useEffect(() => {
    const previousRuntimeSettings = previousRuntimeSettingsRef.current;

    if (previousRuntimeSettings === null) {
      previousRuntimeSettingsRef.current = runtimeSettings;
      return;
    }

    if (previousRuntimeSettings.precisionProfile !== runtimeSettings.precisionProfile) {
      enqueueNotification("info", `Precision profile set to ${runtimeSettings.precisionProfile}.`);
    }

    if (previousRuntimeSettings.fpsLimit !== runtimeSettings.fpsLimit) {
      if (runtimeSettings.fpsLimit > 120) {
        enqueueNotification(
          "warn",
          `FPS limit ${runtimeSettings.fpsLimit} may reduce stability on low-end hardware.`,
        );
      } else {
        enqueueNotification("info", `FPS limit set to ${runtimeSettings.fpsLimit}.`);
      }
    }

    previousRuntimeSettingsRef.current = runtimeSettings;
  }, [enqueueNotification, runtimeSettings]);

  async function greet() {
    try {
      const result = await greetV1({ name });
      setGreetMsg(`${result.message} (ref: ${result.requestId})`);
      enqueueNotification("info", `Greeting completed for "${name || "anonymous"}".`);
    } catch (error: unknown) {
      if (isCommandErrorV1(error)) {
        const message = formatCommandError(error);
        setGreetMsg(message);
        enqueueNotification("error", message);
        return;
      }

      const message = `Unexpected error: ${String(error)}`;
      setGreetMsg(message);
      enqueueNotification("error", message);
    }
  }

  function triggerFeaturePath(feature: FeatureFlagKey) {
    try {
      ensureFeatureEnabledV1(featureFlags, feature);
      const message = `${FEATURE_LABEL_BY_KEY[feature]} path is available.`;
      setFeaturePathMsg(message);
      enqueueNotification("info", message);
    } catch (error: unknown) {
      if (isCommandErrorV1(error)) {
        const message = formatCommandError(error);
        setFeaturePathMsg(message);
        enqueueNotification("warn", message);
        return;
      }

      const message = `Unexpected error: ${String(error)}`;
      setFeaturePathMsg(message);
      enqueueNotification("error", message);
    }
  }

  function availabilityLabel(enabled: boolean): string {
    return enabled ? "available" : "unavailable";
  }

  const filteredLibrarySubstances = useMemo(
    () =>
      filterLibrarySubstances(
        allSubstances,
        librarySearchQuery,
        selectedLibraryPhases,
        selectedLibrarySources,
      ),
    [allSubstances, librarySearchQuery, selectedLibraryPhases, selectedLibrarySources],
  );

  const resolvedSelectedLibrarySubstanceId = useMemo(
    () => resolveSelectedLibrarySubstanceId(selectedLibrarySubstanceId, filteredLibrarySubstances),
    [filteredLibrarySubstances, selectedLibrarySubstanceId],
  );

  const selectedLibrarySubstance = useMemo(
    () =>
      filteredLibrarySubstances.find(
        (substance) => substance.id === resolvedSelectedLibrarySubstanceId,
      ) ?? null,
    [filteredLibrarySubstances, resolvedSelectedLibrarySubstanceId],
  );

  const selectedEditableLibrarySubstance = useMemo(
    () => (isUserSubstanceEditable(selectedLibrarySubstance) ? selectedLibrarySubstance : null),
    [selectedLibrarySubstance],
  );

  const resolvedSelectedPresetId = useMemo(
    () => resolveSelectedPresetId(selectedPresetId, allPresets),
    [allPresets, selectedPresetId],
  );

  const selectedPreset = useMemo(
    () => allPresets.find((preset) => preset.id === resolvedSelectedPresetId) ?? null,
    [allPresets, resolvedSelectedPresetId],
  );

  useEffect(() => {
    if (selectedEditableLibrarySubstance === null) {
      setEditSubstanceDraft(null);
      setEditSubstanceValidationErrors([]);
      return;
    }

    setEditSubstanceDraft(
      createUserSubstanceDraftFromCatalogEntry(selectedEditableLibrarySubstance),
    );
    setEditSubstanceValidationErrors([]);
  }, [selectedEditableLibrarySubstance]);

  useEffect(() => {
    if (selectedPresetId === resolvedSelectedPresetId) {
      return;
    }

    setSelectedPresetId(resolvedSelectedPresetId);
  }, [resolvedSelectedPresetId, selectedPresetId]);

  const libraryPlaceholderState: LeftPanelPlaceholderState = useMemo(() => {
    if (libraryLoadState === "loading") {
      return "loading";
    }

    if (libraryLoadState === "error") {
      return "error";
    }

    return filteredLibrarySubstances.length === 0 ? "empty" : "ready";
  }, [filteredLibrarySubstances.length, libraryLoadState]);

  const presetsPlaceholderState: LeftPanelPlaceholderState = useMemo(() => {
    if (presetsLoadState === "loading") {
      return "loading";
    }

    if (presetsLoadState === "error") {
      return "error";
    }

    return allPresets.length === 0 ? "empty" : "ready";
  }, [allPresets.length, presetsLoadState]);

  const builderPlaceholderState: LeftPanelPlaceholderState = useMemo(
    () => (builderDraft === null ? "empty" : "ready"),
    [builderDraft],
  );

  const placeholderStateByTab: Readonly<Record<LeftPanelTabId, LeftPanelPlaceholderState>> =
    useMemo(
      () => ({
        library: libraryPlaceholderState,
        builder: builderPlaceholderState,
        presets: presetsPlaceholderState,
      }),
      [builderPlaceholderState, libraryPlaceholderState, presetsPlaceholderState],
    );

  const libraryEmptyMessage =
    allSubstances.length === 0
      ? "No substances are available in the local catalog."
      : "No substances match the current search and filters.";

  const presetsEmptyMessage = "No presets are available in the local preset library.";

  const builderEmptyMessage = 'Select a preset and click "Use in Builder" to start editing.';

  const handleLibraryPhaseToggle = useCallback((phase: SubstancePhaseV1): void => {
    setSelectedLibraryPhases((currentSelection) => toggleFilterValue(currentSelection, phase));
  }, []);

  const handleLibrarySourceToggle = useCallback((source: SubstanceSourceV1): void => {
    setSelectedLibrarySources((currentSelection) => toggleFilterValue(currentSelection, source));
  }, []);

  const handleBuilderDraftFieldChange = useCallback(
    (field: BuilderDraftField, value: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return updateBuilderDraftField(currentDraft, field, value);
      });
    },
    [],
  );

  const handleUsePresetInBuilder = useCallback(
    (presetId: string): void => {
      const preset = allPresets.find((candidate) => candidate.id === presetId);
      if (preset === undefined) {
        const message = "Preset was not found. Reload preset library and try again.";
        setPresetsLoadError(message);
        enqueueNotification("error", message);
        return;
      }

      setSelectedPresetId(preset.id);
      setBuilderDraft(createBuilderDraftFromPreset(preset));
      setBuilderCopyFeedbackMessage(createBuilderCopyFeedbackMessage(preset.title));
      setActiveLeftPanelTab("builder");
      enqueueNotification("info", `Preset "${preset.title}" loaded into Builder as editable copy.`);
    },
    [allPresets, enqueueNotification],
  );

  const handleCreateSubstanceDraftFieldChange = useCallback(
    (field: UserSubstanceDraftField, value: string): void => {
      setCreateSubstanceDraft((currentDraft) =>
        updateUserSubstanceDraftField(currentDraft, field, value),
      );
      setCreateSubstanceValidationErrors((currentErrors) =>
        currentErrors.length === 0 ? currentErrors : [],
      );
      setLibraryMutationError((currentError) => (currentError === null ? currentError : null));
    },
    [],
  );

  const handleEditSubstanceDraftFieldChange = useCallback(
    (field: UserSubstanceDraftField, value: string): void => {
      setEditSubstanceDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return updateUserSubstanceDraftField(currentDraft, field, value);
      });
      setEditSubstanceValidationErrors((currentErrors) =>
        currentErrors.length === 0 ? currentErrors : [],
      );
      setLibraryMutationError((currentError) => (currentError === null ? currentError : null));
    },
    [],
  );

  const handleCreateSubstanceSubmit = useCallback(async (): Promise<void> => {
    const validationResult = validateUserSubstanceDraft(createSubstanceDraft);
    if (validationResult.input === null) {
      setCreateSubstanceValidationErrors(validationResult.errors);
      return;
    }

    setCreateSubstanceValidationErrors([]);
    setLibraryMutationError(null);
    setLibraryMutationState("creating");

    try {
      const result = await createSubstanceV1(validationResult.input);
      setAllSubstances((currentSubstances) =>
        sortSubstancesByName([
          ...currentSubstances.filter((substance) => substance.id !== result.substance.id),
          result.substance,
        ]),
      );
      setCreateSubstanceDraft(createDefaultUserSubstanceDraft());
      setSelectedLibrarySubstanceId(result.substance.id);
      enqueueNotification("info", `Substance "${result.substance.name}" was created.`);
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Create substance error: ${formatCommandError(error)}`
        : `Create substance error: ${String(error)}`;
      setLibraryMutationError(message);
      enqueueNotification("error", message);
    } finally {
      setLibraryMutationState("idle");
    }
  }, [createSubstanceDraft, enqueueNotification]);

  const handleUpdateSubstanceSubmit = useCallback(async (): Promise<void> => {
    if (selectedEditableLibrarySubstance === null || editSubstanceDraft === null) {
      setLibraryMutationError("Select a user substance before saving edits.");
      return;
    }

    const validationResult = validateUserSubstanceDraft(editSubstanceDraft);
    if (validationResult.input === null) {
      setEditSubstanceValidationErrors(validationResult.errors);
      return;
    }

    setEditSubstanceValidationErrors([]);
    setLibraryMutationError(null);
    setLibraryMutationState("updating");

    try {
      const result = await updateSubstanceV1({
        id: selectedEditableLibrarySubstance.id,
        ...validationResult.input,
      });
      setAllSubstances((currentSubstances) =>
        sortSubstancesByName(
          currentSubstances.map((substance) =>
            substance.id === result.substance.id ? result.substance : substance,
          ),
        ),
      );
      setEditSubstanceDraft(createUserSubstanceDraftFromCatalogEntry(result.substance));
      setSelectedLibrarySubstanceId(result.substance.id);
      enqueueNotification("info", `Substance "${result.substance.name}" was updated.`);
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Update substance error: ${formatCommandError(error)}`
        : `Update substance error: ${String(error)}`;
      setLibraryMutationError(message);
      enqueueNotification("error", message);
    } finally {
      setLibraryMutationState("idle");
    }
  }, [editSubstanceDraft, enqueueNotification, selectedEditableLibrarySubstance]);

  const handleDeleteSelectedSubstance = useCallback(async (): Promise<void> => {
    if (selectedEditableLibrarySubstance === null) {
      setLibraryMutationError("Select a user substance before deleting.");
      return;
    }

    setLibraryMutationError(null);
    setLibraryMutationState("deleting");

    try {
      const result = await deleteSubstanceV1({ id: selectedEditableLibrarySubstance.id });
      if (!result.deleted) {
        const message = `Substance "${selectedEditableLibrarySubstance.name}" was not deleted.`;
        setLibraryMutationError(message);
        enqueueNotification("warn", message);
        return;
      }

      setAllSubstances((currentSubstances) =>
        currentSubstances.filter(
          (substance) => substance.id !== selectedEditableLibrarySubstance.id,
        ),
      );
      setSelectedLibrarySubstanceId(null);
      setEditSubstanceValidationErrors([]);
      setEditSubstanceDraft(null);
      enqueueNotification(
        "info",
        `Substance "${selectedEditableLibrarySubstance.name}" was deleted.`,
      );
    } catch (error: unknown) {
      const message = isCommandErrorV1(error)
        ? `Delete substance error: ${formatCommandError(error)}`
        : `Delete substance error: ${String(error)}`;
      setLibraryMutationError(message);
      enqueueNotification("error", message);
    } finally {
      setLibraryMutationState("idle");
    }
  }, [enqueueNotification, selectedEditableLibrarySubstance]);

  const rightPanelFeatureStatuses: ReadonlyArray<RightPanelFeatureStatus> = FEATURE_KEYS.map(
    (feature) => ({
      id: feature,
      label: FEATURE_LABEL_BY_KEY[feature],
      availability: availabilityLabel(featureFlags[feature]),
    }),
  );

  const handleSimulationControlsChange = useCallback((state: CenterPanelControlState): void => {
    setSimulationControlState(state);
  }, []);

  const handleRuntimeSettingsChange = useCallback((state: RightPanelRuntimeSettings): void => {
    setRuntimeSettings(state);
  }, []);

  return (
    <div className="app-root">
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
      <AppShell
        leftPanel={
          <LeftPanelSkeleton
            activeTab={activeLeftPanelTab}
            onTabChange={setActiveLeftPanelTab}
            placeholderStateByTab={placeholderStateByTab}
            libraryViewModel={{
              searchQuery: librarySearchQuery,
              onSearchQueryChange: setLibrarySearchQuery,
              selectedPhases: selectedLibraryPhases,
              selectedSources: selectedLibrarySources,
              onTogglePhase: handleLibraryPhaseToggle,
              onToggleSource: handleLibrarySourceToggle,
              substances: filteredLibrarySubstances,
              selectedSubstance: selectedLibrarySubstance,
              onSelectSubstance: setSelectedLibrarySubstanceId,
              createDraft: createSubstanceDraft,
              createValidationErrors: createSubstanceValidationErrors,
              onCreateDraftFieldChange: handleCreateSubstanceDraftFieldChange,
              onCreateSubmit: () => {
                void handleCreateSubstanceSubmit();
              },
              editDraft: editSubstanceDraft,
              editValidationErrors: editSubstanceValidationErrors,
              onEditDraftFieldChange: handleEditSubstanceDraftFieldChange,
              onEditSubmit: () => {
                void handleUpdateSubstanceSubmit();
              },
              onDeleteSelected: () => {
                void handleDeleteSelectedSubstance();
              },
              isMutating: libraryMutationState !== "idle",
              mutationErrorMessage: libraryMutationError,
              emptyMessage: libraryEmptyMessage,
              errorMessage: libraryLoadError,
            }}
            builderViewModel={{
              draft: builderDraft,
              onDraftFieldChange: handleBuilderDraftFieldChange,
              copyFeedbackMessage: builderCopyFeedbackMessage,
              emptyMessage: builderEmptyMessage,
            }}
            presetsViewModel={{
              presets: allPresets,
              selectedPreset,
              onSelectPreset: setSelectedPresetId,
              onUsePresetInBuilder: handleUsePresetInBuilder,
              emptyMessage: presetsEmptyMessage,
              errorMessage: presetsLoadError,
            }}
          />
        }
        centerPanel={
          <CenterPanelSkeleton onSimulationControlsChange={handleSimulationControlsChange}>
            <header className="center-header">
              <h1>Welcome to Tauri + React</h1>
              <p>
                The app shell is split into left, center, and right panels while keeping the
                original demo actions available in the center workspace.
              </p>
            </header>

            <div className="logo-row">
              <a href="https://vite.dev" target="_blank" rel="noreferrer">
                <img src="/vite.svg" className="logo vite" alt="Vite logo" />
              </a>
              <a href="https://tauri.app" target="_blank" rel="noreferrer">
                <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
              </a>
              <a href="https://react.dev" target="_blank" rel="noreferrer">
                <img src={reactLogo} className="logo react" alt="React logo" />
              </a>
            </div>

            <section id="backend-health" className="content-card" aria-label="Backend health card">
              <h2>Backend health</h2>
              <p>{healthMsg}</p>
              <p>{featureFlagsMsg}</p>
            </section>

            <section id="feature-flags" className="content-card" aria-label="Feature paths card">
              <h2>Feature paths</h2>
              <ul className="status-list">
                {FEATURE_KEYS.map((feature) => (
                  <li key={feature}>
                    {FEATURE_LABEL_BY_KEY[feature]}: {availabilityLabel(featureFlags[feature])}
                  </li>
                ))}
              </ul>

              <div className="action-row">
                {FEATURE_KEYS.map((feature) => (
                  <button type="button" key={feature} onClick={() => triggerFeaturePath(feature)}>
                    {FEATURE_ACTION_LABEL_BY_KEY[feature]}
                  </button>
                ))}
              </div>

              <p>{featurePathMsg}</p>
            </section>

            <section id="greet-form" className="content-card" aria-label="Greeting demo card">
              <h2>Greeting demo</h2>
              <form
                className="greet-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  greet();
                }}
              >
                <input
                  id="greet-input"
                  onChange={(e) => setName(e.currentTarget.value)}
                  value={name}
                  placeholder="Enter a name..."
                />
                <button type="submit">Greet</button>
              </form>
              <p>{greetMsg}</p>
            </section>
          </CenterPanelSkeleton>
        }
        rightPanel={
          <RightPanelSkeleton
            healthMessage={healthMsg}
            featureStatuses={rightPanelFeatureStatuses}
            onRuntimeSettingsChange={handleRuntimeSettingsChange}
          />
        }
      />
      <StatusBar
        simulationState={simulationStateLabel}
        precisionProfile={runtimeSettings.precisionProfile}
        fpsLimit={runtimeSettings.fpsLimit}
      />
    </div>
  );
}

export default App;
