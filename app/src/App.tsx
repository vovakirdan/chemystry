import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
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

function formatCommandError(error: CommandErrorV1): string {
  return `${toUserFacingMessageV1(error)} [${error.code}] (ref: ${error.requestId})`;
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [healthMsg, setHealthMsg] = useState("Checking backend health...");
  const [name, setName] = useState("");
  const [featureFlags, setFeatureFlags] = useState<Readonly<FeatureFlags>>(DEFAULT_FEATURE_FLAGS);
  const [featureFlagsMsg, setFeatureFlagsMsg] = useState("Loading feature flags...");
  const [featurePathMsg, setFeaturePathMsg] = useState("");

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

    resolveFeatureFlagsV1().then((result) => {
      if (disposed) {
        return;
      }

      setFeatureFlags(result.flags);
      setFeatureFlagsMsg(
        result.warning
          ? `Feature flags: ${result.source} (ref: ${result.requestId}) - ${result.warning}`
          : `Feature flags: ${result.source} (ref: ${result.requestId})`,
      );
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
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>
      <p>{healthMsg}</p>
      <p>{featureFlagsMsg}</p>
      <p>Simulation: {availabilityLabel(featureFlags.simulation)}</p>
      <p>Import/export: {availabilityLabel(featureFlags.importExport)}</p>
      <p>Advanced precision: {availabilityLabel(featureFlags.advancedPrecision)}</p>

      <div className="row">
        <button type="button" onClick={() => triggerFeaturePath("simulation")}>
          Try simulation path
        </button>
        <button type="button" onClick={() => triggerFeaturePath("importExport")}>
          Try import/export path
        </button>
        <button type="button" onClick={() => triggerFeaturePath("advancedPrecision")}>
          Try advanced precision path
        </button>
      </div>
      <p>{featurePathMsg}</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
