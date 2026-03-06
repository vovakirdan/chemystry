import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  addBuilderDraftParticipant,
  createBuilderDraftFromPreset,
  removeBuilderDraftParticipant,
  updateBuilderDraftField,
  updateBuilderDraftParticipantField,
  type BuilderDraft,
  type BuilderDraftField,
  type BuilderDraftParticipantField,
  type LeftPanelTabId,
} from "../../features/left-panel/model";
import type { PresetCatalogEntryV1, SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";
import type { NotificationLevel } from "../../shared/lib/notifications";
import {
  createBuilderCopyFeedbackMessage,
  createBuilderParticipantId,
  persistBuilderDraft,
  resolveBuilderParticipantPhase,
} from "../persistence/leftPanelStorage";

type UseBuilderHandlersParams = {
  allSubstances: ReadonlyArray<SubstanceCatalogEntryV1>;
  allPresets: ReadonlyArray<PresetCatalogEntryV1>;
  builderDraft: BuilderDraft | null;
  setBuilderDraft: Dispatch<SetStateAction<BuilderDraft | null>>;
  setPresetsLoadError: Dispatch<SetStateAction<string | null>>;
  setSelectedPresetId: Dispatch<SetStateAction<string | null>>;
  setBuilderCopyFeedbackMessage: Dispatch<SetStateAction<string | null>>;
  setScenarioNameInput: Dispatch<SetStateAction<string>>;
  setActiveLeftPanelTab: Dispatch<SetStateAction<LeftPanelTabId>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

export function useBuilderHandlers({
  allSubstances,
  allPresets,
  builderDraft,
  setBuilderDraft,
  setPresetsLoadError,
  setSelectedPresetId,
  setBuilderCopyFeedbackMessage,
  setScenarioNameInput,
  setActiveLeftPanelTab,
  enqueueNotification,
}: UseBuilderHandlersParams) {
  const handleBuilderDraftFieldChange = useCallback(
    (field: BuilderDraftField, value: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return updateBuilderDraftField(currentDraft, field, value);
      });
    },
    [setBuilderDraft],
  );

  const handleBuilderParticipantAdd = useCallback(
    (substanceId: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return addBuilderDraftParticipant(currentDraft, {
          id: createBuilderParticipantId(),
          substanceId,
          role: "reactant",
          stoichCoeffInput: "1",
          phase: resolveBuilderParticipantPhase(substanceId, allSubstances),
          amountMolInput: "",
          massGInput: "",
          volumeLInput: "",
        });
      });
    },
    [allSubstances, setBuilderDraft],
  );

  const handleBuilderParticipantFieldChange = useCallback(
    (participantId: string, field: BuilderDraftParticipantField, value: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return updateBuilderDraftParticipantField(
          currentDraft,
          participantId,
          field,
          value,
          allSubstances,
        );
      });
    },
    [allSubstances, setBuilderDraft],
  );

  const handleBuilderParticipantRemove = useCallback(
    (participantId: string): void => {
      setBuilderDraft((currentDraft) => {
        if (currentDraft === null) {
          return currentDraft;
        }

        return removeBuilderDraftParticipant(currentDraft, participantId);
      });
    },
    [setBuilderDraft],
  );

  const handleSaveBuilderDraft = useCallback((): void => {
    if (builderDraft === null) {
      enqueueNotification("warn", "Builder draft is empty. Nothing to save.");
      return;
    }

    if (!persistBuilderDraft(builderDraft)) {
      enqueueNotification("error", "Unable to save builder draft to local storage.");
      return;
    }

    enqueueNotification("info", "Builder draft saved to local storage.");
  }, [builderDraft, enqueueNotification]);

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
      setScenarioNameInput(preset.title);
      setActiveLeftPanelTab("builder");
      enqueueNotification("info", `Preset "${preset.title}" loaded into Builder as editable copy.`);
    },
    [
      allPresets,
      enqueueNotification,
      setActiveLeftPanelTab,
      setBuilderCopyFeedbackMessage,
      setBuilderDraft,
      setPresetsLoadError,
      setScenarioNameInput,
      setSelectedPresetId,
    ],
  );

  return {
    handleBuilderDraftFieldChange,
    handleBuilderParticipantAdd,
    handleBuilderParticipantFieldChange,
    handleBuilderParticipantRemove,
    handleSaveBuilderDraft,
    handleUsePresetInBuilder,
  };
}
