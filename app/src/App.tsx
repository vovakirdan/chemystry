import { useEffect, useState } from "react";
import AppShell from "./app/layout/AppShell";
import reactLogo from "./assets/react.svg";
import LeftPanelSkeleton from "./features/left-panel/LeftPanelSkeleton";
import {
  DEFAULT_LEFT_PANEL_TAB,
  isLeftPanelTabId,
  type LeftPanelPlaceholderState,
  type LeftPanelTabId,
} from "./features/left-panel/model";
import type { FeatureFlagKey, FeatureFlags } from "./shared/config/featureFlags";
import { DEFAULT_FEATURE_FLAGS } from "./shared/config/featureFlags";
import {
  ensureFeatureEnabledV1,
  greetV1,
  healthV1,
  isCommandErrorV1,
  resolveFeatureFlagsV1,
  toUserFacingMessageV1,
} from "./shared/contracts/ipc/client";
import type { CommandErrorV1 } from "./shared/contracts/ipc/v1";
import "./App.css";

const FEATURE_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Simulation",
  importExport: "Import/export",
  advancedPrecision: "Advanced precision",
};

const FEATURE_ACTION_LABEL_BY_KEY: Record<FeatureFlagKey, string> = {
  simulation: "Try simulation path",
  importExport: "Try import/export path",
  advancedPrecision: "Try advanced precision path",
};

const FEATURE_KEYS: ReadonlyArray<FeatureFlagKey> = [
  "simulation",
  "importExport",
  "advancedPrecision",
];

const LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY = "chemystery.leftPanel.activeTab.v1";

const LEFT_PANEL_PLACEHOLDER_STATE_BY_TAB: Readonly<
  Record<LeftPanelTabId, LeftPanelPlaceholderState>
> = {
  library: "loading",
  builder: "empty",
  presets: "error",
};

function readStoredLeftPanelTab(): LeftPanelTabId {
  if (typeof window === "undefined") {
    return DEFAULT_LEFT_PANEL_TAB;
  }

  try {
    const storedTab = window.localStorage.getItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY);

    if (storedTab && isLeftPanelTabId(storedTab)) {
      return storedTab;
    }
  } catch {
    // Ignore localStorage failures and use the default tab.
  }

  return DEFAULT_LEFT_PANEL_TAB;
}

function persistLeftPanelTab(tab: LeftPanelTabId): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LEFT_PANEL_ACTIVE_TAB_STORAGE_KEY, tab);
  } catch {
    // Ignore localStorage failures to keep the shell interactive.
  }
}

function formatCommandError(error: CommandErrorV1): string {
  return `${toUserFacingMessageV1(error)} [${error.code}] (ref: ${error.requestId})`;
}

function App() {
  const [activeLeftPanelTab, setActiveLeftPanelTab] =
    useState<LeftPanelTabId>(readStoredLeftPanelTab);
  const [greetMsg, setGreetMsg] = useState("");
  const [healthMsg, setHealthMsg] = useState("Checking backend health...");
  const [name, setName] = useState("");
  const [featureFlags, setFeatureFlags] = useState<Readonly<FeatureFlags>>(DEFAULT_FEATURE_FLAGS);
  const [featureFlagsMsg, setFeatureFlagsMsg] = useState("Loading feature flags...");
  const [featurePathMsg, setFeaturePathMsg] = useState("");

  useEffect(() => {
    persistLeftPanelTab(activeLeftPanelTab);
  }, [activeLeftPanelTab]);

  useEffect(() => {
    let disposed = false;

    healthV1()
      .then((result) => {
        if (!disposed) {
          setHealthMsg(`Backend ${result.status} (${result.version}, ref: ${result.requestId})`);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          if (isCommandErrorV1(error)) {
            setHealthMsg(`Backend error: ${formatCommandError(error)}`);
            return;
          }

          setHealthMsg(`Backend error ${String(error)}`);
        }
      });

    resolveFeatureFlagsV1()
      .then((result) => {
        if (disposed) {
          return;
        }

        setFeatureFlags(result.flags);
        setFeatureFlagsMsg(
          result.warning
            ? `Feature flags: ${result.source} (ref: ${result.requestId}) - ${result.warning}`
            : `Feature flags: ${result.source} (ref: ${result.requestId})`,
        );
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }

        if (isCommandErrorV1(error)) {
          setFeatureFlagsMsg(`Feature flag error: ${formatCommandError(error)}`);
          return;
        }

        setFeatureFlagsMsg(`Feature flag error: ${String(error)}`);
      });

    return () => {
      disposed = true;
    };
  }, []);

  async function greet() {
    try {
      const result = await greetV1({ name });
      setGreetMsg(`${result.message} (ref: ${result.requestId})`);
    } catch (error: unknown) {
      if (isCommandErrorV1(error)) {
        setGreetMsg(formatCommandError(error));
        return;
      }

      setGreetMsg(`Unexpected error: ${String(error)}`);
    }
  }

  function triggerFeaturePath(feature: FeatureFlagKey) {
    try {
      ensureFeatureEnabledV1(featureFlags, feature);
      setFeaturePathMsg(`${FEATURE_LABEL_BY_KEY[feature]} path is available.`);
    } catch (error: unknown) {
      if (isCommandErrorV1(error)) {
        setFeaturePathMsg(formatCommandError(error));
        return;
      }

      setFeaturePathMsg(`Unexpected error: ${String(error)}`);
    }
  }

  function availabilityLabel(enabled: boolean): string {
    return enabled ? "available" : "unavailable";
  }

  return (
    <div className="app-root">
      <AppShell
        leftPanel={
          <LeftPanelSkeleton
            activeTab={activeLeftPanelTab}
            onTabChange={setActiveLeftPanelTab}
            placeholderStateByTab={LEFT_PANEL_PLACEHOLDER_STATE_BY_TAB}
          />
        }
        centerPanel={
          <>
            <header className="center-header">
              <h1>Welcome to Tauri + React</h1>
              <p>
                The app shell is split into left, center, and right panels while keeping the
                original demo actions available in the center workspace.
              </p>
            </header>

            <div className="logo-row">
              <a href="https://vite.dev" target="_blank" rel="noreferrer">
                <img src="/vite.svg" className="logo vite" alt="Vite logo" />
              </a>
              <a href="https://tauri.app" target="_blank" rel="noreferrer">
                <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
              </a>
              <a href="https://react.dev" target="_blank" rel="noreferrer">
                <img src={reactLogo} className="logo react" alt="React logo" />
              </a>
            </div>

            <section id="backend-health" className="content-card" aria-label="Backend health card">
              <h2>Backend health</h2>
              <p>{healthMsg}</p>
              <p>{featureFlagsMsg}</p>
            </section>

            <section id="feature-flags" className="content-card" aria-label="Feature paths card">
              <h2>Feature paths</h2>
              <ul className="status-list">
                {FEATURE_KEYS.map((feature) => (
                  <li key={feature}>
                    {FEATURE_LABEL_BY_KEY[feature]}: {availabilityLabel(featureFlags[feature])}
                  </li>
                ))}
              </ul>

              <div className="action-row">
                {FEATURE_KEYS.map((feature) => (
                  <button type="button" key={feature} onClick={() => triggerFeaturePath(feature)}>
                    {FEATURE_ACTION_LABEL_BY_KEY[feature]}
                  </button>
                ))}
              </div>

              <p>{featurePathMsg}</p>
            </section>

            <section id="greet-form" className="content-card" aria-label="Greeting demo card">
              <h2>Greeting demo</h2>
              <form
                className="greet-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  greet();
                }}
              >
                <input
                  id="greet-input"
                  onChange={(e) => setName(e.currentTarget.value)}
                  value={name}
                  placeholder="Enter a name..."
                />
                <button type="submit">Greet</button>
              </form>
              <p>{greetMsg}</p>
            </section>
          </>
        }
        rightPanel={
          <>
            <h2 className="panel-title">Status</h2>
            <p className="panel-description">
              Live shell summary for the backend and feature gate state.
            </p>

            <p className="status-line">{healthMsg}</p>
            <ul className="status-list">
              {FEATURE_KEYS.map((feature) => (
                <li key={feature}>
                  {FEATURE_LABEL_BY_KEY[feature]}: {availabilityLabel(featureFlags[feature])}
                </li>
              ))}
            </ul>

            <h3 className="panel-subtitle">Panel shortcuts</h3>
            <ul className="kbd-list" aria-label="Panel keyboard shortcuts">
              <li>
                <span>Left panel</span>
                <kbd>Alt+1</kbd>
              </li>
              <li>
                <span>Center panel</span>
                <kbd>Alt+2</kbd>
              </li>
              <li>
                <span>Right panel</span>
                <kbd>Alt+3</kbd>
              </li>
            </ul>
          </>
        }
      />
    </div>
  );
}

export default App;
