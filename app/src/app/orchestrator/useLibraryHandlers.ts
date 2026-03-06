import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { FeatureFlags } from "../../shared/config/featureFlags";
import type {
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
  SubstanceSourceV1,
} from "../../shared/contracts/ipc/v1";
import type { NotificationLevel } from "../../shared/lib/notifications";
import type { UserSubstanceDraft } from "../../features/left-panel/model";
import { useLibraryImportHandlers } from "./useLibraryImportHandlers";
import { useLibraryMutationHandlers } from "./useLibraryMutationHandlers";

type MutationState = "idle" | "creating" | "updating" | "deleting" | "importing";

type UseLibraryHandlersParams = {
  setSelectedLibraryPhases: Dispatch<SetStateAction<ReadonlySet<SubstancePhaseV1>>>;
  setSelectedLibrarySources: Dispatch<SetStateAction<ReadonlySet<SubstanceSourceV1>>>;
  createSubstanceDraft: UserSubstanceDraft;
  setCreateSubstanceDraft: Dispatch<SetStateAction<UserSubstanceDraft>>;
  setCreateSubstanceValidationErrors: Dispatch<SetStateAction<ReadonlyArray<string>>>;
  editSubstanceDraft: UserSubstanceDraft | null;
  setEditSubstanceDraft: Dispatch<SetStateAction<UserSubstanceDraft | null>>;
  setEditSubstanceValidationErrors: Dispatch<SetStateAction<ReadonlyArray<string>>>;
  selectedEditableLibrarySubstance: SubstanceCatalogEntryV1 | null;
  libraryMutationState: MutationState;
  setLibraryMutationState: Dispatch<SetStateAction<MutationState>>;
  setLibraryMutationError: Dispatch<SetStateAction<string | null>>;
  featureFlags: Readonly<FeatureFlags>;
  importSdfMolFileInputRef: MutableRefObject<HTMLInputElement | null>;
  importSmilesFileInputRef: MutableRefObject<HTMLInputElement | null>;
  importXyzFileInputRef: MutableRefObject<HTMLInputElement | null>;
  setAllSubstances: Dispatch<SetStateAction<ReadonlyArray<SubstanceCatalogEntryV1>>>;
  setSelectedLibrarySubstanceId: Dispatch<SetStateAction<string | null>>;
  setLibraryLoadState: Dispatch<SetStateAction<"loading" | "ready" | "error">>;
  setLibraryLoadError: Dispatch<SetStateAction<string | null>>;
  enqueueNotification: (level: NotificationLevel, message: string) => void;
};

export function useLibraryHandlers(params: UseLibraryHandlersParams) {
  const mutationHandlers = useLibraryMutationHandlers({
    setSelectedLibraryPhases: params.setSelectedLibraryPhases,
    setSelectedLibrarySources: params.setSelectedLibrarySources,
    createSubstanceDraft: params.createSubstanceDraft,
    setCreateSubstanceDraft: params.setCreateSubstanceDraft,
    setCreateSubstanceValidationErrors: params.setCreateSubstanceValidationErrors,
    editSubstanceDraft: params.editSubstanceDraft,
    setEditSubstanceDraft: params.setEditSubstanceDraft,
    setEditSubstanceValidationErrors: params.setEditSubstanceValidationErrors,
    selectedEditableLibrarySubstance: params.selectedEditableLibrarySubstance,
    setLibraryMutationState: params.setLibraryMutationState,
    setLibraryMutationError: params.setLibraryMutationError,
    setAllSubstances: params.setAllSubstances,
    setSelectedLibrarySubstanceId: params.setSelectedLibrarySubstanceId,
    enqueueNotification: params.enqueueNotification,
  });

  const importHandlers = useLibraryImportHandlers({
    libraryMutationState: params.libraryMutationState,
    setLibraryMutationState: params.setLibraryMutationState,
    setLibraryMutationError: params.setLibraryMutationError,
    featureFlags: params.featureFlags,
    importSdfMolFileInputRef: params.importSdfMolFileInputRef,
    importSmilesFileInputRef: params.importSmilesFileInputRef,
    importXyzFileInputRef: params.importXyzFileInputRef,
    setAllSubstances: params.setAllSubstances,
    setSelectedLibrarySubstanceId: params.setSelectedLibrarySubstanceId,
    setLibraryLoadState: params.setLibraryLoadState,
    setLibraryLoadError: params.setLibraryLoadError,
    enqueueNotification: params.enqueueNotification,
  });

  return {
    ...mutationHandlers,
    ...importHandlers,
  };
}
