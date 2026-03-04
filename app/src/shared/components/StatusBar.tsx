type StatusBarProps = {
  simulationState: string;
  precisionProfile: string;
  fpsLimit: number;
};

function StatusBar({ simulationState, precisionProfile, fpsLimit }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-label="Simulation status bar" data-testid="status-bar">
      <p className="status-bar-item">
        <span className="status-bar-label">Simulation</span>
        <span className="status-bar-value" data-testid="status-bar-simulation-state">
          {simulationState}
        </span>
      </p>
      <p className="status-bar-item">
        <span className="status-bar-label">Precision</span>
        <span className="status-bar-value" data-testid="status-bar-precision-profile">
          {precisionProfile}
        </span>
      </p>
      <p className="status-bar-item">
        <span className="status-bar-label">FPS limit</span>
        <span className="status-bar-value" data-testid="status-bar-fps-limit">
          {fpsLimit}
        </span>
      </p>
    </footer>
  );
}

export default StatusBar;
