import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  createUserSubstanceDraftFromCatalogEntry,
  validateUserSubstanceDraft,
  type UserSubstanceDraft,
  type UserSubstanceDraftField,
} from "../../features/left-panel/model";
import {
  createSubstanceV1,
  deleteSubstanceV1,
  isCommandErrorV1,
  updateSubstanceV1,
} from "../../shared/contracts/ipc/client";
import type {
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "../../shared/contracts/ipc/v1";
import type { NotificationLevel } from "../../shared/lib/notifications";
import {
  createDefaultUserSubstanceDraft,
  sortSubstancesByName,
  toggleFilterValue,
  updateUserSubstanceDraftField,
} from "../persistence/leftPanelStorage";
import { formatCommandError } from "../simulation/lifecycle";

type MutationState = "idle" | "creating" | "updating" | "deleting" | "importing";

type UseLibraryMutationHandlersParams = {
  setSelectedLibraryPhases: Dispatch<SetStateAction<ReadonlySet<SubstancePhaseV1>>>;
  setSelectedLibrarySources: Dispatch<SetStateAction<ReadonlySet<SubstanceSourceV1>>>;
  createSubstanceDraft: UserSubstanceDraft;
  setCreateSubstanceDraft: Dispatch<SetStateAction<UserSubstanceDraft>>;
  setCreateSubstanceValidationErrors: Dispatch<SetStateAction<ReadonlyArray<string>>>;
  editSubstanceDraft: UserSubstanceDraft | null;
  setEditSubstanceDraft: Dispatch<SetStateAction<UserSubstanceDraft | null>>;
  setEditSubstanceValidationErrors: Dispatch<SetStateAction<ReadonlyArray<string>>>;
  selectedEditableLibrarySubstance: SubstanceCatalogEntryV1 | null;
  setLibraryMutationState: Dispatch<SetStateAction<MutationState>>;
  setLibraryMutationError: Dispatch<SetStateAction<string | null>>;
  setAllSubstances: Dispatch<SetStateAction<ReadonlyArray<SubstanceCatalogEntryV1>>>;
  setSelectedLibrarySubstanceId: Dispatch<SetStateAction<string | null>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

export function useLibraryMutationHandlers({
  setSelectedLibraryPhases,
  setSelectedLibrarySources,
  createSubstanceDraft,
  setCreateSubstanceDraft,
  setCreateSubstanceValidationErrors,
  editSubstanceDraft,
  setEditSubstanceDraft,
  setEditSubstanceValidationErrors,
  selectedEditableLibrarySubstance,
  setLibraryMutationState,
  setLibraryMutationError,
  setAllSubstances,
  setSelectedLibrarySubstanceId,
  enqueueNotification,
}: UseLibraryMutationHandlersParams) {
  const handleLibraryPhaseToggle = useCallback(
    (phase: SubstancePhaseV1): void => {
      setSelectedLibraryPhases((currentSelection) => toggleFilterValue(currentSelection, phase));
    },
    [setSelectedLibraryPhases],
  );

  const handleLibrarySourceToggle = useCallback(
    (source: SubstanceSourceV1): void => {
      setSelectedLibrarySources((currentSelection) => toggleFilterValue(currentSelection, source));
    },
    [setSelectedLibrarySources],
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
    [setCreateSubstanceDraft, setCreateSubstanceValidationErrors, setLibraryMutationError],
  );

  const handleEditSubstanceDraftFieldChange = useCallback(
    (field: UserSubstanceDraftField, value: string): void => {
      setEditSubstanceDraft((currentDraft) =>
        currentDraft === null
          ? currentDraft
          : updateUserSubstanceDraftField(currentDraft, field, value),
      );
      setEditSubstanceValidationErrors((currentErrors) =>
        currentErrors.length === 0 ? currentErrors : [],
      );
      setLibraryMutationError((currentError) => (currentError === null ? currentError : null));
    },
    [setEditSubstanceDraft, setEditSubstanceValidationErrors, setLibraryMutationError],
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
  }, [
    createSubstanceDraft,
    enqueueNotification,
    setAllSubstances,
    setCreateSubstanceDraft,
    setCreateSubstanceValidationErrors,
    setLibraryMutationError,
    setLibraryMutationState,
    setSelectedLibrarySubstanceId,
  ]);

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
  }, [
    editSubstanceDraft,
    enqueueNotification,
    selectedEditableLibrarySubstance,
    setAllSubstances,
    setEditSubstanceDraft,
    setEditSubstanceValidationErrors,
    setLibraryMutationError,
    setLibraryMutationState,
    setSelectedLibrarySubstanceId,
  ]);

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
  }, [
    enqueueNotification,
    selectedEditableLibrarySubstance,
    setAllSubstances,
    setEditSubstanceDraft,
    setEditSubstanceValidationErrors,
    setLibraryMutationError,
    setLibraryMutationState,
    setSelectedLibrarySubstanceId,
  ]);

  return {
    handleLibraryPhaseToggle,
    handleLibrarySourceToggle,
    handleCreateSubstanceDraftFieldChange,
    handleEditSubstanceDraftFieldChange,
    handleCreateSubstanceSubmit,
    handleUpdateSubstanceSubmit,
    handleDeleteSelectedSubstance,
  };
}
