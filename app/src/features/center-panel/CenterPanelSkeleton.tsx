import { type ReactNode } from "react";

type CenterPanelSkeletonProps = {
  children?: ReactNode;
  controlState: CenterPanelControlState;
  onSimulationControlsChange?: (state: CenterPanelControlState) => void;
  onSimulationStart?: () => void;
  onSimulationPause?: () => void;
  onSimulationReset?: () => void;
  onSimulationTimelinePositionChange?: (timelinePosition: number) => void;
  playBlocked?: boolean;
  playBlockedReason?: string | null;
};

const TIMELINE_MIN = 0;
const TIMELINE_MAX = 100;
const TIMELINE_STEP = 1;
export const CENTER_TIMELINE_INITIAL = 25;

export type CenterPanelControlState = {
  isPlaying: boolean;
  timelinePosition: number;
};

function CenterPanelSkeleton({
  children,
  controlState,
  onSimulationControlsChange,
  onSimulationStart,
  onSimulationPause,
  onSimulationReset,
  onSimulationTimelinePositionChange,
  playBlocked = false,
  playBlockedReason = null,
}: CenterPanelSkeletonProps) {
  const resolvedControlState = controlState;
  const playDisabled = resolvedControlState.isPlaying || playBlocked;
  const playUnavailableHint =
    playBlockedReason ?? "Play is blocked until pre-run checks are fixed.";

  function handlePlayClick(): void {
    if (playBlocked || resolvedControlState.isPlaying) {
      return;
    }

    const nextState: CenterPanelControlState = {
      ...resolvedControlState,
      isPlaying: true,
    };
    onSimulationStart?.();
    onSimulationControlsChange?.(nextState);
  }

  function handlePauseClick(): void {
    if (!resolvedControlState.isPlaying) {
      return;
    }

    const nextState: CenterPanelControlState = {
      ...resolvedControlState,
      isPlaying: false,
    };
    onSimulationPause?.();
    onSimulationControlsChange?.(nextState);
  }

  function handleResetClick(): void {
    const nextState: CenterPanelControlState = {
      isPlaying: false,
      timelinePosition: TIMELINE_MIN,
    };

    onSimulationReset?.();
    onSimulationControlsChange?.(nextState);
  }

  function handleTimelineChange(nextTimelinePosition: number): void {
    if (nextTimelinePosition === resolvedControlState.timelinePosition) {
      return;
    }

    const nextState: CenterPanelControlState = {
      ...resolvedControlState,
      timelinePosition: nextTimelinePosition,
    };
    onSimulationTimelinePositionChange?.(nextTimelinePosition);
    onSimulationControlsChange?.(nextState);
  }

  return (
    <div className="center-panel-skeleton" data-testid="center-panel-skeleton">
      <section
        className="center-render-area"
        aria-label="3D render area"
        data-testid="center-render-area"
      >
        <header className="center-render-header">
          <h2 className="panel-title">3D Renderer</h2>
          <p className="panel-description">
            Placeholder boundary for viewport, camera overlays, and object interaction layers.
          </p>
        </header>

        <div
          className="center-render-canvas-placeholder"
          role="img"
          aria-label="3D viewport placeholder"
          data-testid="center-render-canvas"
        >
          <p className="center-render-hint">3D scene canvas will render here.</p>
        </div>
      </section>

      <section
        className="center-control-card"
        aria-label="Simulation control bar"
        data-testid="center-control-card"
      >
        <h3 className="panel-subtitle">Simulation controls</h3>

        <div
          className="center-control-bar"
          role="group"
          aria-label="Play, pause, reset, and timeline controls"
          data-testid="center-control-bar"
        >
          <div className="center-control-actions">
            <button
              type="button"
              aria-label="Play timeline"
              data-testid="center-control-play"
              onClick={handlePlayClick}
              disabled={playDisabled}
              title={playBlocked ? playUnavailableHint : undefined}
            >
              Play
            </button>
            <button
              type="button"
              aria-label="Pause timeline"
              data-testid="center-control-pause"
              onClick={handlePauseClick}
              disabled={!resolvedControlState.isPlaying}
            >
              Pause
            </button>
            <button
              type="button"
              aria-label="Reset timeline"
              data-testid="center-control-reset"
              onClick={handleResetClick}
            >
              Reset
            </button>
          </div>

          <div className="center-control-timeline">
            <label htmlFor="center-control-timeline-input">Timeline</label>
            <input
              id="center-control-timeline-input"
              type="range"
              min={TIMELINE_MIN}
              max={TIMELINE_MAX}
              step={TIMELINE_STEP}
              value={resolvedControlState.timelinePosition}
              aria-label="Simulation timeline position"
              data-testid="center-control-timeline"
              onChange={(event) => handleTimelineChange(Number(event.currentTarget.value))}
            />
            <output
              htmlFor="center-control-timeline-input"
              aria-live="polite"
              data-testid="center-control-timeline-value"
            >
              {resolvedControlState.timelinePosition}%
            </output>
          </div>
        </div>

        <p className="status-line" aria-live="polite" data-testid="center-control-status">
          Playback:{" "}
          {playBlocked ? "blocked" : resolvedControlState.isPlaying ? "running" : "paused"}
        </p>
        {playBlocked && (
          <p className="status-line" aria-live="polite" data-testid="center-control-blocked-reason">
            Play disabled: {playUnavailableHint}
          </p>
        )}
      </section>

      {children ? <div className="center-panel-content">{children}</div> : null}
    </div>
  );
}

export default CenterPanelSkeleton;
