import type { MutableRefObject } from "react";
import AppShell from "../layout/AppShell";
import CenterPanelSkeleton, {
  type CenterPanelControlState,
} from "../../features/center-panel/CenterPanelSkeleton";
import type { SceneParticipantVisual } from "../../features/center-panel/sceneLifecycle";
import LeftPanelSkeleton from "../../features/left-panel/LeftPanelSkeleton";
import RightPanelSkeleton from "../../features/right-panel/RightPanelSkeleton";
import NotificationCenter from "../../shared/components/NotificationCenter";
import StatusBar from "../../shared/components/StatusBar";
import type { FeatureFlagKey, FeatureFlags } from "../../shared/config/featureFlags";
import type { AppNotification } from "../../shared/lib/notifications";
import type { BuilderRuntimeSnapshot } from "../simulation/lifecycle";
import type { LaunchValidationModel } from "../validation/launchValidation";
import { FEATURE_ACTION_LABEL_BY_KEY, FEATURE_KEYS, FEATURE_LABEL_BY_KEY } from "./constants";
import LaunchValidationCard from "./LaunchValidationCard";

type LeftPanelProps = React.ComponentProps<typeof LeftPanelSkeleton>;
type RightPanelProps = React.ComponentProps<typeof RightPanelSkeleton>;

type AppOrchestratorLayoutProps = {
  importSdfMolFileInputRef: MutableRefObject<HTMLInputElement | null>;
  importSmilesFileInputRef: MutableRefObject<HTMLInputElement | null>;
  importXyzFileInputRef: MutableRefObject<HTMLInputElement | null>;
  onImportSdfMolFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImportSmilesFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImportXyzFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  notifications: ReadonlyArray<AppNotification>;
  onDismissNotification: (id: number) => void;
  leftPanelProps: LeftPanelProps;
  rightPanelKey: string;
  rightPanelProps: RightPanelProps;
  controlState: CenterPanelControlState;
  onSimulationStart: () => void;
  onSimulationPause: () => void;
  onSimulationReset: () => void;
  onSimulationTimelinePositionChange: (timelinePosition: number) => void;
  playBlocked: boolean;
  playBlockedReason: string | null;
  sceneStateLabel: string;
  sceneParticipants: ReadonlyArray<SceneParticipantVisual>;
  baselineSnapshot: BuilderRuntimeSnapshot | null;
  particleModelEnvironment: {
    temperatureK: number;
    pressureAtm: number;
    medium: string;
  };
  launchValidationModel: LaunchValidationModel;
  healthMsg: string;
  featureFlagsMsg: string;
  featureFlags: Readonly<FeatureFlags>;
  featurePathMsg: string;
  onTriggerFeaturePath: (feature: FeatureFlagKey) => void;
  statusBarFpsLimit: number;
  precisionProfile: string;
};

function availabilityLabel(enabled: boolean): string {
  return enabled ? "available" : "unavailable";
}

export default function AppOrchestratorLayout({
  importSdfMolFileInputRef,
  importSmilesFileInputRef,
  importXyzFileInputRef,
  onImportSdfMolFileChange,
  onImportSmilesFileChange,
  onImportXyzFileChange,
  notifications,
  onDismissNotification,
  leftPanelProps,
  rightPanelKey,
  rightPanelProps,
  controlState,
  onSimulationStart,
  onSimulationPause,
  onSimulationReset,
  onSimulationTimelinePositionChange,
  playBlocked,
  playBlockedReason,
  sceneStateLabel,
  sceneParticipants,
  baselineSnapshot,
  particleModelEnvironment,
  launchValidationModel,
  healthMsg,
  featureFlagsMsg,
  featureFlags,
  featurePathMsg,
  onTriggerFeaturePath,
  statusBarFpsLimit,
  precisionProfile,
}: AppOrchestratorLayoutProps) {
  return (
    <div className="app-root">
      <input
        ref={importSdfMolFileInputRef}
        type="file"
        accept=".sdf,.mol"
        style={{ display: "none" }}
        data-testid="library-import-file-input"
        onChange={onImportSdfMolFileChange}
      />
      <input
        ref={importSmilesFileInputRef}
        type="file"
        accept=".smi,.smiles,.txt"
        style={{ display: "none" }}
        data-testid="library-import-smiles-file-input"
        onChange={onImportSmilesFileChange}
      />
      <input
        ref={importXyzFileInputRef}
        type="file"
        accept=".xyz"
        style={{ display: "none" }}
        data-testid="library-import-xyz-file-input"
        onChange={onImportXyzFileChange}
      />
      <NotificationCenter notifications={notifications} onDismiss={onDismissNotification} />
      <AppShell
        leftPanel={<LeftPanelSkeleton {...leftPanelProps} />}
        centerPanel={
          <CenterPanelSkeleton
            controlState={controlState}
            onSimulationStart={onSimulationStart}
            onSimulationPause={onSimulationPause}
            onSimulationReset={onSimulationReset}
            onSimulationTimelinePositionChange={onSimulationTimelinePositionChange}
            playBlocked={playBlocked}
            playBlockedReason={playBlockedReason}
            sceneStateLabel={sceneStateLabel}
            sceneParticipants={sceneParticipants}
          >
            <header className="center-header">
              <h1>Simulation workspace</h1>
              <p>
                Validate launch readiness, control simulation lifecycle, and monitor session state
                from a single control surface.
              </p>
            </header>

            <section
              id="simulation-workspace-summary"
              className="content-card"
              aria-label="Simulation session summary card"
              data-testid="simulation-workspace-summary"
            >
              <h2>Simulation session</h2>
              <p data-testid="simulation-workspace-state">State: {sceneStateLabel}</p>
              <p data-testid="simulation-workspace-timeline">
                Timeline: {controlState.timelinePosition}%
              </p>
              <p data-testid="simulation-workspace-environment-sync">
                Engine environment sync: T {particleModelEnvironment.temperatureK.toFixed(2)} K, P{" "}
                {particleModelEnvironment.pressureAtm.toFixed(3)} atm, medium{" "}
                {particleModelEnvironment.medium}.
              </p>
              <p data-testid="simulation-workspace-baseline">
                {baselineSnapshot === null
                  ? "Baseline snapshot is not set. Reset returns timeline and runtime controls to defaults."
                  : "Baseline snapshot is set. Reset restores Builder draft, timeline, and runtime controls."}
              </p>
            </section>

            <LaunchValidationCard model={launchValidationModel} />

            <section id="backend-health" className="content-card" aria-label="Backend health card">
              <h2>Backend health</h2>
              <p>{healthMsg}</p>
              <p>{featureFlagsMsg}</p>
            </section>

            <section
              id="feature-flags"
              className="content-card"
              aria-label="Capability checks card"
            >
              <h2>Capability checks</h2>
              <ul className="status-list">
                {FEATURE_KEYS.map((feature) => (
                  <li key={feature}>
                    {FEATURE_LABEL_BY_KEY[feature]}: {availabilityLabel(featureFlags[feature])}
                  </li>
                ))}
              </ul>

              <div className="action-row">
                {FEATURE_KEYS.map((feature) => (
                  <button type="button" key={feature} onClick={() => onTriggerFeaturePath(feature)}>
                    {FEATURE_ACTION_LABEL_BY_KEY[feature]}
                  </button>
                ))}
              </div>

              <p>{featurePathMsg}</p>
            </section>
          </CenterPanelSkeleton>
        }
        rightPanel={<RightPanelSkeleton key={rightPanelKey} {...rightPanelProps} />}
      />
      <StatusBar
        simulationState={sceneStateLabel}
        precisionProfile={precisionProfile}
        fpsLimit={statusBarFpsLimit}
      />
    </div>
  );
}
