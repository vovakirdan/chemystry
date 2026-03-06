import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FeatureFlags } from "../../shared/config/featureFlags";
import {
  healthV1,
  isCommandErrorV1,
  listPresetsV1,
  listScenariosV1,
  listSubstancesV1,
  resolveFeatureFlagsV1,
} from "../../shared/contracts/ipc/client";
import type {
  PresetCatalogEntryV1,
  ScenarioSummaryV1,
  SubstanceCatalogEntryV1,
} from "../../shared/contracts/ipc/v1";
import type { NotificationLevel } from "../../shared/lib/notifications";
import { sortPresetsByTitle } from "../persistence/leftPanelStorage";
import { formatCommandError, sortScenariosByUpdatedAt } from "../simulation/lifecycle";

type BootstrapDataDependencies = {
  healthV1: typeof healthV1;
  resolveFeatureFlagsV1: typeof resolveFeatureFlagsV1;
  listSubstancesV1: typeof listSubstancesV1;
  listPresetsV1: typeof listPresetsV1;
  listScenariosV1: typeof listScenariosV1;
  isCommandErrorV1: typeof isCommandErrorV1;
};

const DEFAULT_BOOTSTRAP_DATA_DEPENDENCIES: Readonly<BootstrapDataDependencies> = {
  healthV1,
  resolveFeatureFlagsV1,
  listSubstancesV1,
  listPresetsV1,
  listScenariosV1,
  isCommandErrorV1,
};

export type UseBootstrapDataParams = {
  enqueueNotification: (level: NotificationLevel, message: string) => void;
  setHealthMsg: Dispatch<SetStateAction<string>>;
  setFeatureFlags: Dispatch<SetStateAction<Readonly<FeatureFlags>>>;
  setFeatureFlagsMsg: Dispatch<SetStateAction<string>>;
  setAllSubstances: Dispatch<SetStateAction<ReadonlyArray<SubstanceCatalogEntryV1>>>;
  setAllPresets: Dispatch<SetStateAction<ReadonlyArray<PresetCatalogEntryV1>>>;
  setSavedScenarios: Dispatch<SetStateAction<ReadonlyArray<ScenarioSummaryV1>>>;
  setLibraryLoadState: Dispatch<SetStateAction<"loading" | "ready" | "error">>;
  setLibraryLoadError: Dispatch<SetStateAction<string | null>>;
  setPresetsLoadState: Dispatch<SetStateAction<"loading" | "ready" | "error">>;
  setPresetsLoadError: Dispatch<SetStateAction<string | null>>;
};

export function runBootstrapData(
  {
    enqueueNotification,
    setHealthMsg,
    setFeatureFlags,
    setFeatureFlagsMsg,
    setAllSubstances,
    setAllPresets,
    setSavedScenarios,
    setLibraryLoadState,
    setLibraryLoadError,
    setPresetsLoadState,
    setPresetsLoadError,
  }: UseBootstrapDataParams,
  isDisposed: () => boolean,
  dependencies: Readonly<BootstrapDataDependencies> = DEFAULT_BOOTSTRAP_DATA_DEPENDENCIES,
): void {
  dependencies
    .healthV1()
    .then((result) => {
      if (!isDisposed()) {
        setHealthMsg(`Backend ${result.status} (${result.version}, ref: ${result.requestId})`);
        enqueueNotification("info", `Backend status: ${result.status}.`);
      }
    })
    .catch((error: unknown) => {
      if (isDisposed()) {
        return;
      }

      if (dependencies.isCommandErrorV1(error)) {
        const message = `Backend error: ${formatCommandError(error)}`;
        setHealthMsg(message);
        enqueueNotification("error", message);
        return;
      }

      const message = `Backend error: ${String(error)}`;
      setHealthMsg(message);
      enqueueNotification("error", message);
    });

  dependencies
    .resolveFeatureFlagsV1()
    .then((result) => {
      if (isDisposed()) {
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
      if (isDisposed()) {
        return;
      }

      if (dependencies.isCommandErrorV1(error)) {
        const message = `Feature flag error: ${formatCommandError(error)}`;
        setFeatureFlagsMsg(message);
        enqueueNotification("error", message);
        return;
      }

      const message = `Feature flag error: ${String(error)}`;
      setFeatureFlagsMsg(message);
      enqueueNotification("error", message);
    });

  dependencies
    .listSubstancesV1()
    .then((result) => {
      if (isDisposed()) {
        return;
      }

      setAllSubstances(result.substances);
      setLibraryLoadState("ready");
      setLibraryLoadError(null);
    })
    .catch((error: unknown) => {
      if (isDisposed()) {
        return;
      }

      if (dependencies.isCommandErrorV1(error)) {
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

  dependencies
    .listPresetsV1()
    .then((result) => {
      if (isDisposed()) {
        return;
      }

      setAllPresets(sortPresetsByTitle(result.presets));
      setPresetsLoadState("ready");
      setPresetsLoadError(null);
    })
    .catch((error: unknown) => {
      if (isDisposed()) {
        return;
      }

      if (dependencies.isCommandErrorV1(error)) {
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

  dependencies
    .listScenariosV1()
    .then((result) => {
      if (!isDisposed()) {
        setSavedScenarios(sortScenariosByUpdatedAt(result.scenarios));
      }
    })
    .catch((error: unknown) => {
      if (isDisposed()) {
        return;
      }

      if (dependencies.isCommandErrorV1(error)) {
        enqueueNotification("error", `Scenario list error: ${formatCommandError(error)}`);
        return;
      }

      enqueueNotification("error", `Scenario list error: ${String(error)}`);
    });
}

export function useBootstrapData({
  enqueueNotification,
  setHealthMsg,
  setFeatureFlags,
  setFeatureFlagsMsg,
  setAllSubstances,
  setAllPresets,
  setSavedScenarios,
  setLibraryLoadState,
  setLibraryLoadError,
  setPresetsLoadState,
  setPresetsLoadError,
}: UseBootstrapDataParams): void {
  useEffect(() => {
    let disposed = false;

    runBootstrapData(
      {
        enqueueNotification,
        setHealthMsg,
        setFeatureFlags,
        setFeatureFlagsMsg,
        setAllSubstances,
        setAllPresets,
        setSavedScenarios,
        setLibraryLoadState,
        setLibraryLoadError,
        setPresetsLoadState,
        setPresetsLoadError,
      },
      () => disposed,
    );

    return () => {
      disposed = true;
    };
  }, [
    enqueueNotification,
    setAllPresets,
    setAllSubstances,
    setFeatureFlags,
    setFeatureFlagsMsg,
    setHealthMsg,
    setLibraryLoadError,
    setLibraryLoadState,
    setPresetsLoadError,
    setPresetsLoadState,
    setSavedScenarios,
  ]);
}
