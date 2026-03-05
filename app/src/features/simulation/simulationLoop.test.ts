import { describe, expect, it, vi } from "vitest";
import {
  createSimulationLoop,
  type AnimationFrameScheduler,
  type SimulationLoopStep,
  type SimulationLoopState,
} from "./simulationLoop";

type SchedulerHarness = {
  scheduler: AnimationFrameScheduler;
  requestFrameSpy: ReturnType<typeof vi.fn<(callback: () => void) => number>>;
  cancelFrameSpy: ReturnType<typeof vi.fn<(handle: number) => void>>;
  flushFrame: (handle: number) => void;
  latestHandle: () => number;
};

function createSchedulerHarness(): SchedulerHarness {
  const callbacksByHandle = new Map<number, () => void>();
  let currentHandle = 0;

  const requestFrameSpy = vi.fn<(callback: () => void) => number>((callback) => {
    currentHandle += 1;
    callbacksByHandle.set(currentHandle, callback);
    return currentHandle;
  });

  const cancelFrameSpy = vi.fn<(handle: number) => void>((handle) => {
    callbacksByHandle.delete(handle);
  });

  return {
    scheduler: {
      requestFrame: requestFrameSpy,
      cancelFrame: cancelFrameSpy,
    },
    requestFrameSpy,
    cancelFrameSpy,
    flushFrame: (handle) => {
      const callback = callbacksByHandle.get(handle);
      if (callback === undefined) {
        throw new Error(`Animation frame ${handle.toString()} is not scheduled.`);
      }

      callbacksByHandle.delete(handle);
      callback();
    },
    latestHandle: () => {
      const latestResult = requestFrameSpy.mock.results[requestFrameSpy.mock.results.length - 1];
      const latest = latestResult?.value;
      if (typeof latest !== "number") {
        throw new Error("No scheduled frame handle available.");
      }

      return latest;
    },
  };
}

describe("createSimulationLoop", () => {
  it("manages running/paused/stopped transitions and preserves tick counter on pause", () => {
    const schedulerHarness = createSchedulerHarness();
    const stateChanges: SimulationLoopState[] = [];
    const stepEvents: SimulationLoopStep[] = [];
    let nowMs = 0;

    const loop = createSimulationLoop({
      scheduler: schedulerHarness.scheduler,
      now: () => nowMs,
      onStateChange: (state) => {
        stateChanges.push(state);
      },
      onStep: (step) => {
        stepEvents.push(step);
      },
    });

    expect(loop.getSnapshot().state).toBe("stopped");

    loop.start();
    expect(loop.getSnapshot().state).toBe("running");
    expect(stateChanges).toEqual(["running"]);

    nowMs = 16;
    schedulerHarness.flushFrame(schedulerHarness.latestHandle());
    expect(stepEvents.length).toBeGreaterThan(0);
    const tickAfterFirstRun = loop.getSnapshot().tick;
    expect(tickAfterFirstRun).toBeGreaterThan(0);

    loop.pause();
    expect(loop.getSnapshot().state).toBe("paused");
    expect(stateChanges).toEqual(["running", "paused"]);

    loop.start();
    expect(loop.getSnapshot().state).toBe("running");
    expect(stateChanges).toEqual(["running", "paused", "running"]);

    nowMs = 32;
    schedulerHarness.flushFrame(schedulerHarness.latestHandle());
    expect(loop.getSnapshot().tick).toBeGreaterThan(tickAfterFirstRun);

    loop.stop();
    expect(loop.getSnapshot().state).toBe("stopped");
    expect(loop.getSnapshot().tick).toBe(0);
    expect(loop.getSnapshot().droppedSteps).toBe(0);
    expect(stateChanges).toEqual(["running", "paused", "running", "stopped"]);
  });

  it("caps catch-up work and drops excess lag to avoid runaway frame debt", () => {
    const schedulerHarness = createSchedulerHarness();
    const stepEvents: SimulationLoopStep[] = [];
    let nowMs = 0;

    const loop = createSimulationLoop({
      scheduler: schedulerHarness.scheduler,
      now: () => nowMs,
      mode: "fixed",
      fixedStepMs: 10,
      maxCatchUpSteps: 3,
      onStep: (step) => {
        stepEvents.push(step);
      },
    });

    loop.start();

    nowMs = 100;
    schedulerHarness.flushFrame(schedulerHarness.latestHandle());

    expect(stepEvents).toHaveLength(3);
    expect(loop.getSnapshot().tick).toBe(3);
    expect(loop.getSnapshot().droppedSteps).toBeGreaterThan(0);
  });

  it("runs a hybrid step for sub-fixed delta after switching mode from fixed to hybrid", () => {
    const schedulerHarness = createSchedulerHarness();
    const stepEvents: SimulationLoopStep[] = [];
    let nowMs = 0;

    const loop = createSimulationLoop({
      scheduler: schedulerHarness.scheduler,
      now: () => nowMs,
      mode: "fixed",
      fixedStepMs: 20,
      onStep: (step) => {
        stepEvents.push(step);
      },
    });

    loop.start();

    nowMs = 10;
    schedulerHarness.flushFrame(schedulerHarness.latestHandle());
    expect(stepEvents).toHaveLength(0);

    loop.updateConfig({ mode: "hybrid" });

    nowMs = 15;
    schedulerHarness.flushFrame(schedulerHarness.latestHandle());
    expect(stepEvents).toHaveLength(1);
    expect(stepEvents[0].mode).toBe("hybrid");
    expect(stepEvents[0].stepMs).toBeCloseTo(15, 5);
  });

  it("ignores invalid config updates and keeps sanitized runtime config", () => {
    const schedulerHarness = createSchedulerHarness();
    const nowMs = 0;
    const loop = createSimulationLoop({
      scheduler: schedulerHarness.scheduler,
      now: () => nowMs,
      onStep: () => {
        // no-op for config assertions
      },
    });

    loop.updateConfig({
      fixedStepMs: Number.NaN,
      maxCatchUpSteps: -4,
      minFrameIntervalMs: -10,
    });

    const snapshot = loop.getSnapshot();
    expect(snapshot.fixedStepMs).toBeGreaterThan(0);
    expect(snapshot.maxCatchUpSteps).toBeGreaterThanOrEqual(1);
    expect(snapshot.minFrameIntervalMs).toBeGreaterThanOrEqual(0);
  });
});
