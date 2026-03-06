import type { CenterPanelControlState } from "../../features/center-panel/CenterPanelSkeleton";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import type { NotificationLevel } from "../../shared/lib/notifications";

export type RuntimeSettingsSyncNotification = {
  level: NotificationLevel;
  message: string;
};

export type RuntimeSettingsSyncDecision = {
  notifications: ReadonlyArray<RuntimeSettingsSyncNotification>;
  historyMessages: ReadonlyArray<string>;
  environmentChanged: boolean;
};

export function decideRuntimeSettingsSyncEffects(
  previousRuntimeSettings: RightPanelRuntimeSettings,
  runtimeSettings: RightPanelRuntimeSettings,
): RuntimeSettingsSyncDecision {
  const notifications: RuntimeSettingsSyncNotification[] = [];
  const historyMessages: string[] = [];
  let environmentChanged = false;

  if (previousRuntimeSettings.precisionProfile !== runtimeSettings.precisionProfile) {
    notifications.push({
      level: "info",
      message: `Precision profile set to ${runtimeSettings.precisionProfile}.`,
    });
  }

  if (previousRuntimeSettings.temperatureC !== runtimeSettings.temperatureC) {
    environmentChanged = true;
    const message =
      runtimeSettings.temperatureC === null
        ? "Environment temperature input cleared."
        : `Environment temperature set to ${runtimeSettings.temperatureC} °C.`;
    notifications.push({ level: "info", message });
    historyMessages.push(message);
  }

  if (previousRuntimeSettings.pressureAtm !== runtimeSettings.pressureAtm) {
    environmentChanged = true;
    const message =
      runtimeSettings.pressureAtm === null
        ? "Environment pressure input cleared."
        : `Environment pressure set to ${runtimeSettings.pressureAtm} atm.`;
    notifications.push({ level: "info", message });
    historyMessages.push(message);
  }

  if (previousRuntimeSettings.gasMedium !== runtimeSettings.gasMedium) {
    environmentChanged = true;
    const message = `Environment gas medium set to ${runtimeSettings.gasMedium}.`;
    notifications.push({ level: "info", message });
    historyMessages.push(message);
  }

  if (previousRuntimeSettings.fpsLimit !== runtimeSettings.fpsLimit) {
    if (runtimeSettings.fpsLimit === null) {
      // Skip notifications while the value is incomplete.
    } else if (runtimeSettings.fpsLimit > 120) {
      notifications.push({
        level: "warn",
        message: `FPS limit ${runtimeSettings.fpsLimit} may reduce stability on low-end hardware.`,
      });
    } else {
      notifications.push({
        level: "info",
        message: `FPS limit set to ${runtimeSettings.fpsLimit}.`,
      });
    }
  }

  return {
    notifications,
    historyMessages,
    environmentChanged,
  };
}

export function resolveSimulationControlStateOnLaunchBlock(
  currentState: CenterPanelControlState,
): CenterPanelControlState {
  if (!currentState.isPlaying) {
    return currentState;
  }

  return {
    ...currentState,
    isPlaying: false,
  };
}
