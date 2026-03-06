import type { GasMediumV1 } from "../../shared/contracts/ipc/v1";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";

const MAX_SCENARIO_HISTORY_ENTRIES = 100;

export type EnvironmentStepSnapshot = {
  temperatureC: number | null;
  pressureAtm: number | null;
  gasMedium: GasMediumV1;
};

export type EnvironmentRewindResult =
  | {
      status: "unavailable";
      nextStack: ReadonlyArray<EnvironmentStepSnapshot>;
      nextSettings: null;
      message: string;
    }
  | {
      status: "no_change";
      nextStack: ReadonlyArray<EnvironmentStepSnapshot>;
      nextSettings: null;
      message: string;
    }
  | {
      status: "applied";
      nextStack: ReadonlyArray<EnvironmentStepSnapshot>;
      nextSettings: RightPanelRuntimeSettings;
      message: string;
    };

export function createEnvironmentStepSnapshot(
  settings: RightPanelRuntimeSettings,
): EnvironmentStepSnapshot {
  return {
    temperatureC: settings.temperatureC,
    pressureAtm: settings.pressureAtm,
    gasMedium: settings.gasMedium,
  };
}

function areEnvironmentStepSnapshotsEqual(
  left: EnvironmentStepSnapshot,
  right: EnvironmentStepSnapshot,
): boolean {
  return (
    left.temperatureC === right.temperatureC &&
    left.pressureAtm === right.pressureAtm &&
    left.gasMedium === right.gasMedium
  );
}

export function appendEnvironmentStepSnapshot(
  currentEntries: ReadonlyArray<EnvironmentStepSnapshot>,
  snapshot: EnvironmentStepSnapshot,
): ReadonlyArray<EnvironmentStepSnapshot> {
  if (currentEntries.length > 0 && areEnvironmentStepSnapshotsEqual(currentEntries[0], snapshot)) {
    return currentEntries;
  }
  return [snapshot, ...currentEntries].slice(0, MAX_SCENARIO_HISTORY_ENTRIES);
}

export function anchorEnvironmentRewindStack(
  currentSettings: RightPanelRuntimeSettings,
  stack: ReadonlyArray<EnvironmentStepSnapshot>,
): ReadonlyArray<EnvironmentStepSnapshot> {
  return appendEnvironmentStepSnapshot(stack, createEnvironmentStepSnapshot(currentSettings));
}

function applyEnvironmentStepSnapshot(
  currentSettings: RightPanelRuntimeSettings,
  snapshot: EnvironmentStepSnapshot,
): RightPanelRuntimeSettings {
  return {
    ...currentSettings,
    temperatureC: snapshot.temperatureC,
    pressureAtm: snapshot.pressureAtm,
    gasMedium: snapshot.gasMedium,
  };
}

function areRuntimeEnvironmentSettingsEqual(
  left: RightPanelRuntimeSettings,
  right: RightPanelRuntimeSettings,
): boolean {
  return (
    left.temperatureC === right.temperatureC &&
    left.pressureAtm === right.pressureAtm &&
    left.gasMedium === right.gasMedium &&
    left.calculationPasses === right.calculationPasses &&
    left.precisionProfile === right.precisionProfile &&
    left.fpsLimit === right.fpsLimit
  );
}

export function rewindEnvironmentStep(
  currentSettings: RightPanelRuntimeSettings,
  stack: ReadonlyArray<EnvironmentStepSnapshot>,
): EnvironmentRewindResult {
  if (stack.length < 2) {
    return {
      status: "unavailable",
      nextStack: stack,
      nextSettings: null,
      message: "No previous environment step is available for rewind.",
    };
  }

  const targetSnapshot = stack[1];
  const nextStack = stack.slice(1);
  const nextSettings = applyEnvironmentStepSnapshot(currentSettings, targetSnapshot);
  if (areRuntimeEnvironmentSettingsEqual(currentSettings, nextSettings)) {
    return {
      status: "no_change",
      nextStack,
      nextSettings: null,
      message: "Rewind target already matches current environment settings.",
    };
  }

  const temperatureLabel =
    targetSnapshot.temperatureC === null ? "not set" : `${targetSnapshot.temperatureC} °C`;
  const pressureLabel =
    targetSnapshot.pressureAtm === null ? "not set" : `${targetSnapshot.pressureAtm} atm`;
  return {
    status: "applied",
    nextStack,
    nextSettings,
    message: `Rewind applied. Environment restored to T ${temperatureLabel}, P ${pressureLabel}, medium ${targetSnapshot.gasMedium}.`,
  };
}
