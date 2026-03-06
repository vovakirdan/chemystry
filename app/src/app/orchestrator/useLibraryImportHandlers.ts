import { useCallback } from "react";
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from "react";
import type { FeatureFlags } from "../../shared/config/featureFlags";
import {
  ensureFeatureEnabledV1,
  importSdfMolV1,
  importSmilesV1,
  importXyzV1,
  isCommandErrorV1,
} from "../../shared/contracts/ipc/client";
import type { SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";
import type { NotificationLevel } from "../../shared/lib/notifications";
import { sortSubstancesByName } from "../persistence/leftPanelStorage";
import { formatCommandError } from "../simulation/lifecycle";
import { formatXyzInferenceNotificationSummary } from "./constants";

type MutationState = "idle" | "creating" | "updating" | "deleting" | "importing";

type UseLibraryImportHandlersParams = {
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

export function mergeImportedSubstances(
  currentSubstances: ReadonlyArray<SubstanceCatalogEntryV1>,
  importedSubstances: ReadonlyArray<SubstanceCatalogEntryV1>,
): ReadonlyArray<SubstanceCatalogEntryV1> {
  const importedSubstanceIds = new Set(importedSubstances.map((substance) => substance.id));
  return sortSubstancesByName([
    ...currentSubstances.filter((substance) => !importedSubstanceIds.has(substance.id)),
    ...importedSubstances,
  ]);
}

export function mapLibraryImportError(
  prefix: string,
  error: unknown,
  isCommandError: typeof isCommandErrorV1 = isCommandErrorV1,
): string {
  if (isCommandError(error)) {
    return `${prefix}: ${formatCommandError(error)}`;
  }

  return `${prefix}: ${String(error)}`;
}

function openImportPicker(
  featureFlags: Readonly<FeatureFlags>,
  libraryMutationState: MutationState,
  ref: MutableRefObject<HTMLInputElement | null>,
  featureUnavailablePrefix: string,
  unavailableMessage: string,
  setLibraryMutationError: Dispatch<SetStateAction<string | null>>,
  enqueueNotification: (level: NotificationLevel, message: string) => void,
): boolean {
  if (libraryMutationState !== "idle") {
    return false;
  }

  try {
    ensureFeatureEnabledV1(featureFlags, "importExport");
  } catch (error: unknown) {
    const message = isCommandErrorV1(error)
      ? formatCommandError(error)
      : `${featureUnavailablePrefix}: ${String(error)}`;
    setLibraryMutationError(message);
    enqueueNotification("warn", message);
    return false;
  }

  const fileInput = ref.current;
  if (fileInput === null) {
    setLibraryMutationError(unavailableMessage);
    enqueueNotification("error", unavailableMessage);
    return false;
  }

  fileInput.value = "";
  fileInput.click();
  return true;
}

export function useLibraryImportHandlers({
  libraryMutationState,
  setLibraryMutationState,
  setLibraryMutationError,
  featureFlags,
  importSdfMolFileInputRef,
  importSmilesFileInputRef,
  importXyzFileInputRef,
  setAllSubstances,
  setSelectedLibrarySubstanceId,
  setLibraryLoadState,
  setLibraryLoadError,
  enqueueNotification,
}: UseLibraryImportHandlersParams) {
  const handleImportSdfMolClick = useCallback((): void => {
    openImportPicker(
      featureFlags,
      libraryMutationState,
      importSdfMolFileInputRef,
      "Import SDF/MOL is unavailable",
      "Import file picker is unavailable in this environment.",
      setLibraryMutationError,
      enqueueNotification,
    );
  }, [
    enqueueNotification,
    featureFlags,
    importSdfMolFileInputRef,
    libraryMutationState,
    setLibraryMutationError,
  ]);

  const handleImportSmilesClick = useCallback((): void => {
    openImportPicker(
      featureFlags,
      libraryMutationState,
      importSmilesFileInputRef,
      "Import SMILES is unavailable",
      "SMILES import file picker is unavailable in this environment.",
      setLibraryMutationError,
      enqueueNotification,
    );
  }, [
    enqueueNotification,
    featureFlags,
    importSmilesFileInputRef,
    libraryMutationState,
    setLibraryMutationError,
  ]);

  const handleImportXyzClick = useCallback((): void => {
    const opened = openImportPicker(
      featureFlags,
      libraryMutationState,
      importXyzFileInputRef,
      "Import XYZ is unavailable",
      "XYZ import file picker is unavailable in this environment.",
      setLibraryMutationError,
      enqueueNotification,
    );
    if (opened) {
      enqueueNotification(
        "warn",
        "XYZ bond inference is heuristic (distance + covalent radii) and may be inaccurate for edge cases.",
      );
    }
  }, [
    enqueueNotification,
    featureFlags,
    importXyzFileInputRef,
    libraryMutationState,
    setLibraryMutationError,
  ]);

  const handleImportSdfMolFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const selectedFile = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (selectedFile === null) {
        return;
      }

      setLibraryMutationError(null);
      setLibraryMutationState("importing");

      try {
        const result = await importSdfMolV1({
          fileName: selectedFile.name,
          contents: await selectedFile.text(),
        });
        setAllSubstances((currentSubstances) =>
          mergeImportedSubstances(currentSubstances, result.substances),
        );
        if (result.substances.length > 0) {
          setSelectedLibrarySubstanceId(result.substances[0]?.id ?? null);
        }
        setLibraryLoadState("ready");
        setLibraryLoadError(null);
        enqueueNotification(
          "info",
          `Imported ${result.importedCount} substance(s) from "${selectedFile.name}".`,
        );
      } catch (error: unknown) {
        const message = mapLibraryImportError("Import SDF/MOL error", error);
        setLibraryMutationError(message);
        enqueueNotification("error", message);
      } finally {
        setLibraryMutationState("idle");
      }
    },
    [
      enqueueNotification,
      setAllSubstances,
      setLibraryLoadError,
      setLibraryLoadState,
      setLibraryMutationError,
      setLibraryMutationState,
      setSelectedLibrarySubstanceId,
    ],
  );

  const handleImportSmilesFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const selectedFile = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (selectedFile === null) {
        return;
      }

      setLibraryMutationError(null);
      setLibraryMutationState("importing");

      try {
        const result = await importSmilesV1({
          fileName: selectedFile.name,
          contents: await selectedFile.text(),
        });
        setAllSubstances((currentSubstances) =>
          mergeImportedSubstances(currentSubstances, result.substances),
        );
        if (result.substances.length > 0) {
          setSelectedLibrarySubstanceId(result.substances[0]?.id ?? null);
        }
        setLibraryLoadState("ready");
        setLibraryLoadError(null);
        enqueueNotification(
          "info",
          `Imported ${result.importedCount} substance(s) from "${selectedFile.name}".`,
        );
      } catch (error: unknown) {
        const message = mapLibraryImportError("Import SMILES error", error);
        setLibraryMutationError(message);
        enqueueNotification("error", message);
      } finally {
        setLibraryMutationState("idle");
      }
    },
    [
      enqueueNotification,
      setAllSubstances,
      setLibraryLoadError,
      setLibraryLoadState,
      setLibraryMutationError,
      setLibraryMutationState,
      setSelectedLibrarySubstanceId,
    ],
  );

  const handleImportXyzFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const selectedFile = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (selectedFile === null) {
        return;
      }

      setLibraryMutationError(null);
      setLibraryMutationState("importing");

      try {
        const result = await importXyzV1({
          fileName: selectedFile.name,
          contents: await selectedFile.text(),
        });
        setAllSubstances((currentSubstances) =>
          mergeImportedSubstances(currentSubstances, result.substances),
        );
        if (result.substances.length > 0) {
          setSelectedLibrarySubstanceId(result.substances[0]?.id ?? null);
        }
        setLibraryLoadState("ready");
        setLibraryLoadError(null);
        const summaryText = formatXyzInferenceNotificationSummary(result.inferenceSummaries);
        enqueueNotification(
          "info",
          `Imported ${result.importedCount} substance(s) from "${selectedFile.name}". ${summaryText}`,
        );
      } catch (error: unknown) {
        const message = mapLibraryImportError("Import XYZ error", error);
        setLibraryMutationError(message);
        enqueueNotification("error", message);
      } finally {
        setLibraryMutationState("idle");
      }
    },
    [
      enqueueNotification,
      setAllSubstances,
      setLibraryLoadError,
      setLibraryLoadState,
      setLibraryMutationError,
      setLibraryMutationState,
      setSelectedLibrarySubstanceId,
    ],
  );

  return {
    handleImportSdfMolClick,
    handleImportSmilesClick,
    handleImportXyzClick,
    handleImportSdfMolFileChange,
    handleImportSmilesFileChange,
    handleImportXyzFileChange,
  };
}
