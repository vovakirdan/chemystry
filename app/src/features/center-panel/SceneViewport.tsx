import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createThreeSceneRuntime } from "./createThreeSceneRuntime";
import {
  mountSceneRuntimeDeferred,
  type SceneParticipantVisual,
  type SceneRuntime,
  type SceneRuntimeFactory,
  type SceneSelectionDetails,
} from "./sceneLifecycle";
import type { SceneColorScheme } from "./sceneVisualConfig";

type SceneViewportProps = {
  runtimeFactory?: SceneRuntimeFactory;
  participants?: ReadonlyArray<SceneParticipantVisual>;
  colorScheme?: Partial<SceneColorScheme>;
  simulationStateLabel?: string;
  timelinePosition?: number;
};

function SceneViewport({
  runtimeFactory,
  participants = [],
  colorScheme,
  simulationStateLabel = "Paused",
  timelinePosition = 0,
}: SceneViewportProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const [selectedObject, setSelectedObject] = useState<SceneSelectionDetails | null>(null);

  const handleSelectionChange = useCallback((nextSelection: SceneSelectionDetails | null) => {
    setSelectedObject(nextSelection);
  }, []);

  const resolvedRuntimeFactory = useMemo<SceneRuntimeFactory>(() => {
    if (runtimeFactory !== undefined) {
      return runtimeFactory;
    }

    return (container) =>
      createThreeSceneRuntime(container, {
        participants,
        colorScheme,
        onSelectionChange: handleSelectionChange,
      });
  }, [colorScheme, handleSelectionChange, participants, runtimeFactory]);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (canvasHost === null) {
      return undefined;
    }

    const cleanup = mountSceneRuntimeDeferred({
      container: canvasHost,
      runtimeFactory: (container) => {
        const runtime = resolvedRuntimeFactory(container);
        runtimeRef.current = runtime;
        return runtime;
      },
    });

    return () => {
      cleanup();
      runtimeRef.current = null;
      setSelectedObject(null);
    };
  }, [resolvedRuntimeFactory]);

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

      <section className="center-render-hud" aria-label="Scene HUD" data-testid="center-render-hud">
        <p data-testid="center-render-hud-state">State: {simulationStateLabel}</p>
        <p data-testid="center-render-hud-timeline">Timeline: {timelinePosition}%</p>
        <p data-testid="center-render-hud-objects">Participants: {participants.length}</p>
        {selectedObject === null ? (
          <p data-testid="center-render-selection-empty">
            Click an atom or bond to inspect metadata.
          </p>
        ) : (
          <div className="center-render-selection-card" data-testid="center-render-selection-card">
            <p data-testid="center-render-selection-kind">Kind: {selectedObject.kind}</p>
            <p data-testid="center-render-selection-label">Label: {selectedObject.label}</p>
            <p data-testid="center-render-selection-formula">Formula: {selectedObject.formula}</p>
            <p data-testid="center-render-selection-role">Role: {selectedObject.role}</p>
            <p data-testid="center-render-selection-phase">Phase: {selectedObject.phase}</p>
            {selectedObject.linkedParticipantLabel !== null ? (
              <p data-testid="center-render-selection-linked">
                Linked to: {selectedObject.linkedParticipantLabel}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

export default SceneViewport;
