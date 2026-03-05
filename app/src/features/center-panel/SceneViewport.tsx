import { useEffect, useRef } from "react";
import { createThreeSceneRuntime } from "./createThreeSceneRuntime";
import { mountSceneRuntimeDeferred, type SceneRuntimeFactory } from "./sceneLifecycle";

type SceneViewportProps = {
  runtimeFactory?: SceneRuntimeFactory;
};

function SceneViewport({ runtimeFactory = createThreeSceneRuntime }: SceneViewportProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (canvasHost === null) {
      return undefined;
    }

    return mountSceneRuntimeDeferred({
      container: canvasHost,
      runtimeFactory,
    });
  }, [runtimeFactory]);

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
      </div>
    </div>
  );
}

export default SceneViewport;
