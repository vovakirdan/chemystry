export type SimulationLoopState = "running" | "paused" | "stopped";

export type TimeStepMode = "fixed" | "hybrid";

export type SimulationLoopStep = {
  stepMs: number;
  frameDeltaMs: number;
  tick: number;
  mode: TimeStepMode;
};

export type SimulationLoopSnapshot = {
  state: SimulationLoopState;
  tick: number;
  droppedSteps: number;
  accumulatorMs: number;
  fixedStepMs: number;
  maxCatchUpSteps: number;
  minFrameIntervalMs: number;
  mode: TimeStepMode;
};

export type AnimationFrameScheduler = {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
};

export type SimulationLoopConfig = {
  fixedStepMs?: number;
  maxCatchUpSteps?: number;
  minFrameIntervalMs?: number;
  mode?: TimeStepMode;
};

type CreateSimulationLoopOptions = SimulationLoopConfig & {
  onStep: (step: SimulationLoopStep) => void;
  onStateChange?: (state: SimulationLoopState) => void;
  now?: () => number;
  scheduler?: AnimationFrameScheduler;
};

export type SimulationLoopController = {
  start: () => void;
  pause: () => void;
  stop: () => void;
  dispose: () => void;
  updateConfig: (config: SimulationLoopConfig) => void;
  getSnapshot: () => SimulationLoopSnapshot;
};

const DEFAULT_FIXED_STEP_MS = 1000 / 60;
const DEFAULT_MAX_CATCH_UP_STEPS = 8;
const DEFAULT_MIN_FRAME_INTERVAL_MS = 0;
const MAX_FRAME_DELTA_MS = 1000;

function sanitizeFixedStepMs(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_FIXED_STEP_MS;
  }

  return value;
}

function sanitizeMaxCatchUpSteps(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_CATCH_UP_STEPS;
  }

  return Math.max(1, Math.floor(value));
}

function sanitizeMinFrameIntervalMs(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return DEFAULT_MIN_FRAME_INTERVAL_MS;
  }

  return value;
}

function sanitizeMode(value: TimeStepMode | undefined): TimeStepMode {
  return value === "fixed" ? "fixed" : "hybrid";
}

export function createSimulationLoop(
  options: CreateSimulationLoopOptions,
): SimulationLoopController {
  const now = options.now ?? (() => performance.now());
  const scheduler: AnimationFrameScheduler = options.scheduler ?? {
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  };

  const config: Required<SimulationLoopConfig> = {
    fixedStepMs: sanitizeFixedStepMs(options.fixedStepMs),
    maxCatchUpSteps: sanitizeMaxCatchUpSteps(options.maxCatchUpSteps),
    minFrameIntervalMs: sanitizeMinFrameIntervalMs(options.minFrameIntervalMs),
    mode: sanitizeMode(options.mode),
  };

  let state: SimulationLoopState = "stopped";
  let disposed = false;
  let frameHandle: number | null = null;
  let lastFrameTimestampMs: number | null = null;
  let accumulatorMs = 0;
  let tick = 0;
  let droppedSteps = 0;

  const emitStateChange = (nextState: SimulationLoopState): void => {
    if (state === nextState) {
      return;
    }

    state = nextState;
    options.onStateChange?.(nextState);
  };

  const cancelScheduledFrame = (): void => {
    if (frameHandle === null) {
      return;
    }

    scheduler.cancelFrame(frameHandle);
    frameHandle = null;
  };

  const scheduleNextFrame = (): void => {
    frameHandle = scheduler.requestFrame(runFrame);
  };

  const runStep = (stepMs: number, frameDeltaMs: number): void => {
    tick += 1;
    options.onStep({
      stepMs,
      frameDeltaMs,
      tick,
      mode: config.mode,
    });
  };

  const runFrame = (): void => {
    frameHandle = null;
    if (disposed || state !== "running") {
      return;
    }

    const currentTimestampMs = now();
    const previousTimestampMs = lastFrameTimestampMs;
    lastFrameTimestampMs = currentTimestampMs;

    if (previousTimestampMs === null) {
      scheduleNextFrame();
      return;
    }

    const rawFrameDeltaMs = currentTimestampMs - previousTimestampMs;
    const frameDeltaMs = Math.max(0, Math.min(MAX_FRAME_DELTA_MS, rawFrameDeltaMs));

    if (frameDeltaMs < config.minFrameIntervalMs) {
      scheduleNextFrame();
      return;
    }

    accumulatorMs += frameDeltaMs;

    let stepsThisFrame = 0;
    while (accumulatorMs >= config.fixedStepMs && stepsThisFrame < config.maxCatchUpSteps) {
      runStep(config.fixedStepMs, frameDeltaMs);
      accumulatorMs -= config.fixedStepMs;
      stepsThisFrame += 1;
    }

    if (config.mode === "hybrid" && stepsThisFrame === 0 && accumulatorMs > 0) {
      runStep(accumulatorMs, frameDeltaMs);
      accumulatorMs = 0;
      stepsThisFrame += 1;
    }

    if (accumulatorMs >= config.fixedStepMs) {
      const dropped = Math.floor(accumulatorMs / config.fixedStepMs);
      droppedSteps += dropped;
      accumulatorMs %= config.fixedStepMs;
    }

    scheduleNextFrame();
  };

  const resetCounters = (): void => {
    tick = 0;
    droppedSteps = 0;
    accumulatorMs = 0;
    lastFrameTimestampMs = null;
  };

  return {
    start: () => {
      if (disposed || state === "running") {
        return;
      }

      if (state === "stopped") {
        resetCounters();
      }

      lastFrameTimestampMs = now();
      emitStateChange("running");
      scheduleNextFrame();
    },
    pause: () => {
      if (disposed || state !== "running") {
        return;
      }

      cancelScheduledFrame();
      emitStateChange("paused");
    },
    stop: () => {
      if (disposed) {
        return;
      }

      cancelScheduledFrame();
      resetCounters();
      emitStateChange("stopped");
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      cancelScheduledFrame();
      resetCounters();
      emitStateChange("stopped");
    },
    updateConfig: (nextConfig) => {
      config.fixedStepMs = sanitizeFixedStepMs(nextConfig.fixedStepMs ?? config.fixedStepMs);
      config.maxCatchUpSteps = sanitizeMaxCatchUpSteps(
        nextConfig.maxCatchUpSteps ?? config.maxCatchUpSteps,
      );
      config.minFrameIntervalMs = sanitizeMinFrameIntervalMs(
        nextConfig.minFrameIntervalMs ?? config.minFrameIntervalMs,
      );
      config.mode = sanitizeMode(nextConfig.mode ?? config.mode);
    },
    getSnapshot: () => ({
      state,
      tick,
      droppedSteps,
      accumulatorMs,
      fixedStepMs: config.fixedStepMs,
      maxCatchUpSteps: config.maxCatchUpSteps,
      minFrameIntervalMs: config.minFrameIntervalMs,
      mode: config.mode,
    }),
  };
}
