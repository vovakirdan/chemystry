import { describe, expect, it, vi } from "vitest";
import {
  mountSceneRuntimeDeferred,
  type AnimationFrameScheduler,
  type SceneRuntime,
  type SceneRuntimeFactory,
} from "./sceneLifecycle";

type SchedulerHarness = {
  scheduler: AnimationFrameScheduler;
  flushFrame: (handle: number) => void;
  requestFrameSpy: ReturnType<typeof vi.fn<(callback: () => void) => number>>;
  cancelFrameSpy: ReturnType<typeof vi.fn<(handle: number) => void>>;
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
    flushFrame: (handle) => {
      const callback = callbacksByHandle.get(handle);
      if (callback === undefined) {
        throw new Error(`Animation frame ${handle.toString()} not scheduled.`);
      }

      callbacksByHandle.delete(handle);
      callback();
    },
    requestFrameSpy,
    cancelFrameSpy,
  };
}

describe("mountSceneRuntimeDeferred", () => {
  it("defers runtime mount to animation frame to keep render path responsive", () => {
    const schedulerHarness = createSchedulerHarness();
    const startSpy = vi.fn<SceneRuntime["start"]>();
    const disposeSpy = vi.fn<SceneRuntime["dispose"]>();

    const runtimeFactory: SceneRuntimeFactory = vi.fn(() => ({
      start: startSpy,
      dispose: disposeSpy,
    }));

    const cleanup = mountSceneRuntimeDeferred({
      container: {} as HTMLElement,
      runtimeFactory,
      scheduler: schedulerHarness.scheduler,
    });

    expect(runtimeFactory).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();

    const frameHandle = schedulerHarness.requestFrameSpy.mock.results[0]?.value;
    expect(typeof frameHandle).toBe("number");

    schedulerHarness.flushFrame(frameHandle as number);

    expect(runtimeFactory).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledTimes(1);

    cleanup();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it("cancels scheduled initialization when unmounted before first frame", () => {
    const schedulerHarness = createSchedulerHarness();
    const startSpy = vi.fn<SceneRuntime["start"]>();
    const disposeSpy = vi.fn<SceneRuntime["dispose"]>();

    const runtimeFactory: SceneRuntimeFactory = vi.fn(() => ({
      start: startSpy,
      dispose: disposeSpy,
    }));

    const cleanup = mountSceneRuntimeDeferred({
      container: {} as HTMLElement,
      runtimeFactory,
      scheduler: schedulerHarness.scheduler,
    });

    cleanup();

    expect(schedulerHarness.cancelFrameSpy).toHaveBeenCalledTimes(1);
    expect(runtimeFactory).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
    expect(disposeSpy).not.toHaveBeenCalled();
  });
});
