import { useEffect, useRef } from "react";
import { createThreeSceneRuntime } from "./createThreeSceneRuntime";
import {
  mountSceneRuntimeDeferred,
  type SceneRuntime,
  type SceneRuntimeFactory,
} from "./sceneLifecycle";

type SceneViewportProps = {
  runtimeFactory?: SceneRuntimeFactory;
};

function SceneViewport({ runtimeFactory = createThreeSceneRuntime }: SceneViewportProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (canvasHost === null) {
      return undefined;
    }

    const cleanup = mountSceneRuntimeDeferred({
      container: canvasHost,
      runtimeFactory: (container) => {
        const runtime = runtimeFactory(container);
        runtimeRef.current = runtime;
        return runtime;
      },
    });

    return () => {
      cleanup();
      runtimeRef.current = null;
    };
  }, [runtimeFactory]);

  function handleResetCameraClick(): void {
    runtimeRef.current?.resetCamera?.();
  }

  return (
    <div className="center-render-viewport" data-testid="center-render-canvas">
      <div
        ref={canvasHostRef}
        className="center-render-canvas-host"
        data-testid="center-render-canvas-host"
      />

      <div className="center-render-overlay" data-testid="center-render-overlay">
        <span>Ambient + directional lights</span>
        <span>Grid + XYZ axes</span>
        <span>Active frame loop</span>
        <span>Mouse orbit/pan/zoom + keyboard control</span>
        <button
          type="button"
          className="center-render-reset-camera"
          data-testid="center-render-reset-camera"
          onClick={handleResetCameraClick}
        >
          Reset camera (R)
        </button>
      </div>
    </div>
  );
}

export default SceneViewport;
