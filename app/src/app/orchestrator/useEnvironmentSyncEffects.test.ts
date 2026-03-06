import { describe, expect, it } from "vitest";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import {
  decideRuntimeSettingsSyncEffects,
  resolveSimulationControlStateOnLaunchBlock,
} from "./useEnvironmentSyncEffects";

const BASE_RUNTIME_SETTINGS: RightPanelRuntimeSettings = {
  temperatureC: 25,
  pressureAtm: 1,
  gasMedium: "gas",
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};

describe("useEnvironmentSyncEffects decisions", () => {
  it("builds notifications/history entries when runtime environment settings change", () => {
    const nextRuntimeSettings: RightPanelRuntimeSettings = {
      ...BASE_RUNTIME_SETTINGS,
      temperatureC: 30,
      pressureAtm: null,
      gasMedium: "liquid",
      precisionProfile: "High Precision",
      fpsLimit: 144,
    };

    const decision = decideRuntimeSettingsSyncEffects(BASE_RUNTIME_SETTINGS, nextRuntimeSettings);

    expect(decision.notifications).toEqual([
      { level: "info", message: "Precision profile set to High Precision." },
      { level: "info", message: "Environment temperature set to 30 °C." },
      { level: "info", message: "Environment pressure input cleared." },
      { level: "info", message: "Environment gas medium set to liquid." },
      {
        level: "warn",
        message: "FPS limit 144 may reduce stability on low-end hardware.",
      },
    ]);
    expect(decision.historyMessages).toEqual([
      "Environment temperature set to 30 °C.",
      "Environment pressure input cleared.",
      "Environment gas medium set to liquid.",
    ]);
    expect(decision.environmentChanged).toBe(true);
  });

  it("keeps environment history unchanged for fps-only updates", () => {
    const nextRuntimeSettings: RightPanelRuntimeSettings = {
      ...BASE_RUNTIME_SETTINGS,
      fpsLimit: 90,
    };

    const decision = decideRuntimeSettingsSyncEffects(BASE_RUNTIME_SETTINGS, nextRuntimeSettings);

    expect(decision.environmentChanged).toBe(false);
    expect(decision.historyMessages).toEqual([]);
    expect(decision.notifications).toEqual([
      {
        level: "info",
        message: "FPS limit set to 90.",
      },
    ]);
  });

  it("pauses simulation only when launch is blocked while currently playing", () => {
    const runningState = { isPlaying: true, timelinePosition: 37 };
    const pausedState = { isPlaying: false, timelinePosition: 37 };

    expect(resolveSimulationControlStateOnLaunchBlock(runningState)).toEqual({
      isPlaying: false,
      timelinePosition: 37,
    });
    expect(resolveSimulationControlStateOnLaunchBlock(pausedState)).toBe(pausedState);
  });
});
