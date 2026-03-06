import {
  CENTER_TIMELINE_INITIAL,
  type CenterPanelControlState,
} from "../../features/center-panel/CenterPanelSkeleton";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { RightPanelRuntimeSettings } from "../../features/right-panel/RightPanelSkeleton";
import type {
  CalculationSummaryV1,
  CommandErrorV1,
  ScenarioPayloadV1,
  ScenarioSummaryV1,
} from "../../shared/contracts/ipc/v1";
import { toUserFacingMessageV1 } from "../../shared/contracts/ipc/client";

export type BuilderRuntimeSnapshot = {
  builderDraft: BuilderDraft;
  runtimeSettings: RightPanelRuntimeSettings;
  simulationControlState: CenterPanelControlState;
};

export type SimulationLifecycleCommand = "start" | "pause" | "reset";

export type SimulationLifecycleCommandInput = {
  command: SimulationLifecycleCommand;
  simulationControlState: CenterPanelControlState;
  runtimeSettings: RightPanelRuntimeSettings;
  builderDraft: BuilderDraft | null;
  launchBlocked: boolean;
  baselineSnapshot: BuilderRuntimeSnapshot | null;
};

export type SimulationLifecycleCommandResult = {
  simulationControlState: CenterPanelControlState;
  runtimeSettings: RightPanelRuntimeSettings;
  builderDraft: BuilderDraft | null;
  runtimeSettingsChanged: boolean;
  builderDraftChanged: boolean;
};

export const DEFAULT_CENTER_PANEL_STATE: Readonly<CenterPanelControlState> = {
  isPlaying: false,
  timelinePosition: CENTER_TIMELINE_INITIAL,
};

export const RESET_CENTER_PANEL_STATE: Readonly<CenterPanelControlState> = {
  isPlaying: false,
  timelinePosition: 0,
};

export const DEFAULT_RUNTIME_SETTINGS: Readonly<RightPanelRuntimeSettings> = {
  temperatureC: 25,
  pressureAtm: 1,
  gasMedium: "gas",
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};

function cloneBuilderDraft(draft: BuilderDraft): BuilderDraft {
  return { ...draft, participants: draft.participants.map((participant) => ({ ...participant })) };
}

function cloneRuntimeSettings(settings: RightPanelRuntimeSettings): RightPanelRuntimeSettings {
  return { ...settings };
}

function cloneSimulationControlState(state: CenterPanelControlState): CenterPanelControlState {
  return { ...state };
}

function createPausedSimulationControlState(
  state: CenterPanelControlState,
): CenterPanelControlState {
  return { ...cloneSimulationControlState(state), isPlaying: false };
}

function areSimulationControlStatesEqual(
  left: CenterPanelControlState,
  right: CenterPanelControlState,
): boolean {
  return left.isPlaying === right.isPlaying && left.timelinePosition === right.timelinePosition;
}

function areRuntimeSettingsEqual(
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

function areBuilderDraftsEqual(left: BuilderDraft | null, right: BuilderDraft | null): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return left === right;
  }
  if (
    left.title !== right.title ||
    left.reactionClass !== right.reactionClass ||
    left.equation !== right.equation ||
    left.description !== right.description ||
    left.participants.length !== right.participants.length
  ) {
    return false;
  }

  return left.participants.every((participant, index) => {
    const candidate = right.participants[index];
    return (
      candidate !== undefined &&
      participant.id === candidate.id &&
      participant.substanceId === candidate.substanceId &&
      participant.role === candidate.role &&
      participant.stoichCoeffInput === candidate.stoichCoeffInput &&
      participant.phase === candidate.phase &&
      participant.amountMolInput === candidate.amountMolInput &&
      participant.massGInput === candidate.massGInput &&
      participant.volumeLInput === candidate.volumeLInput
    );
  });
}

export function applySimulationLifecycleCommand(
  input: SimulationLifecycleCommandInput,
): SimulationLifecycleCommandResult {
  // Intent: keep start/pause idempotent and enforce reset parity with baseline/default snapshots.
  if (input.command === "start") {
    if (input.launchBlocked || input.simulationControlState.isPlaying) {
      return {
        simulationControlState: input.simulationControlState,
        runtimeSettings: input.runtimeSettings,
        builderDraft: input.builderDraft,
        runtimeSettingsChanged: false,
        builderDraftChanged: false,
      };
    }

    return {
      simulationControlState: { ...input.simulationControlState, isPlaying: true },
      runtimeSettings: input.runtimeSettings,
      builderDraft: input.builderDraft,
      runtimeSettingsChanged: false,
      builderDraftChanged: false,
    };
  }

  if (input.command === "pause") {
    if (!input.simulationControlState.isPlaying) {
      return {
        simulationControlState: input.simulationControlState,
        runtimeSettings: input.runtimeSettings,
        builderDraft: input.builderDraft,
        runtimeSettingsChanged: false,
        builderDraftChanged: false,
      };
    }

    return {
      simulationControlState: { ...input.simulationControlState, isPlaying: false },
      runtimeSettings: input.runtimeSettings,
      builderDraft: input.builderDraft,
      runtimeSettingsChanged: false,
      builderDraftChanged: false,
    };
  }

  const resetSimulationTarget =
    input.baselineSnapshot?.simulationControlState ?? RESET_CENTER_PANEL_STATE;
  const resetRuntimeTarget = input.baselineSnapshot?.runtimeSettings ?? DEFAULT_RUNTIME_SETTINGS;
  const resetBuilderTarget = input.baselineSnapshot?.builderDraft ?? input.builderDraft;

  const simulationControlState = areSimulationControlStatesEqual(
    input.simulationControlState,
    createPausedSimulationControlState(resetSimulationTarget),
  )
    ? input.simulationControlState
    : createPausedSimulationControlState(resetSimulationTarget);
  const runtimeSettings = areRuntimeSettingsEqual(input.runtimeSettings, resetRuntimeTarget)
    ? input.runtimeSettings
    : cloneRuntimeSettings(resetRuntimeTarget);
  const builderDraft = areBuilderDraftsEqual(input.builderDraft, resetBuilderTarget)
    ? input.builderDraft
    : resetBuilderTarget === null
      ? null
      : cloneBuilderDraft(resetBuilderTarget);

  return {
    simulationControlState,
    runtimeSettings,
    builderDraft,
    runtimeSettingsChanged: runtimeSettings !== input.runtimeSettings,
    builderDraftChanged: builderDraft !== input.builderDraft,
  };
}

export function resolveSimulationState(state: CenterPanelControlState): string {
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

export function createBuilderRuntimeSnapshot(
  draft: BuilderDraft,
  runtimeSettings: RightPanelRuntimeSettings,
  simulationControlState: CenterPanelControlState,
): BuilderRuntimeSnapshot {
  return {
    builderDraft: cloneBuilderDraft(draft),
    runtimeSettings: cloneRuntimeSettings(runtimeSettings),
    simulationControlState: createPausedSimulationControlState(simulationControlState),
  };
}

export function createScenarioPayloadFromSnapshot(
  snapshot: BuilderRuntimeSnapshot,
  calculationSummary?: CalculationSummaryV1,
): ScenarioPayloadV1 {
  return {
    builderDraft: cloneBuilderDraft(snapshot.builderDraft),
    runtimeSettings: cloneRuntimeSettings(snapshot.runtimeSettings),
    calculationSummary,
  };
}

export function createSnapshotFromScenarioPayload(
  payload: ScenarioPayloadV1,
): BuilderRuntimeSnapshot {
  return {
    builderDraft: cloneBuilderDraft(payload.builderDraft),
    runtimeSettings: cloneRuntimeSettings(payload.runtimeSettings),
    simulationControlState: cloneSimulationControlState(RESET_CENTER_PANEL_STATE),
  };
}

function parseScenarioTimestamp(value: string): number {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return 0;
  }
  if (/^\d+$/u.test(normalized)) {
    const unixMillis = Number(normalized);
    return Number.isFinite(unixMillis) ? unixMillis : 0;
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortScenariosByUpdatedAt(
  scenarios: ReadonlyArray<ScenarioSummaryV1>,
): ReadonlyArray<ScenarioSummaryV1> {
  return [...scenarios].sort((left, right) => {
    const updatedOrder =
      parseScenarioTimestamp(right.updatedAt) - parseScenarioTimestamp(left.updatedAt);
    if (updatedOrder !== 0) {
      return updatedOrder;
    }

    const nameOrder = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (nameOrder !== 0) {
      return nameOrder;
    }

    return left.id.localeCompare(right.id, undefined, { sensitivity: "base" });
  });
}

export function formatCommandError(error: CommandErrorV1): string {
  return `${toUserFacingMessageV1(error)} [${error.code}] (ref: ${error.requestId})`;
}
