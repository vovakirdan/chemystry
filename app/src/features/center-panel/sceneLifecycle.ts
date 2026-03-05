export type SceneRuntime = {
  start: () => void;
  dispose: () => void;
  resetCamera?: () => void;
};

export type SceneRuntimeFactory = (container: HTMLElement) => SceneRuntime;

export type AnimationFrameScheduler = {
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
};

const browserAnimationFrameScheduler: AnimationFrameScheduler = {
  requestFrame: (callback) => window.requestAnimationFrame(() => callback()),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
};

type MountSceneRuntimeDeferredOptions = {
  container: HTMLElement;
  runtimeFactory: SceneRuntimeFactory;
  scheduler?: AnimationFrameScheduler;
};

export function mountSceneRuntimeDeferred({
  container,
  runtimeFactory,
  scheduler = browserAnimationFrameScheduler,
}: MountSceneRuntimeDeferredOptions): () => void {
  let runtime: SceneRuntime | null = null;
  let animationFrameHandle: number | null = scheduler.requestFrame(() => {
    if (animationFrameHandle === null) {
      return;
    }

    animationFrameHandle = null;
    runtime = runtimeFactory(container);
    runtime.start();
  });

  return () => {
    if (animationFrameHandle !== null) {
      scheduler.cancelFrame(animationFrameHandle);
      animationFrameHandle = null;
    }

    runtime?.dispose();
    runtime = null;
  };
}
