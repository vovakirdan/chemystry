import AppOrchestrator, { LaunchValidationCard } from "./AppOrchestrator";
import type { BuilderDraft } from "./features/left-panel/model";

type AppProps = {
  initialBuilderDraft?: BuilderDraft | null;
};

function App({ initialBuilderDraft = null }: AppProps) {
  return <AppOrchestrator initialBuilderDraft={initialBuilderDraft} />;
}

export default App;
export { LaunchValidationCard };
/* eslint-disable react-refresh/only-export-components */
export { buildLaunchValidationModel } from "./app/validation/launchValidation";
export { applySimulationLifecycleCommand } from "./app/simulation/lifecycle";
export {
  createCalculationInputSignature,
  isCalculationSummaryStale,
} from "./app/calculations/signature";
export { anchorEnvironmentRewindStack, rewindEnvironmentStep } from "./app/environment/rewind";
export { parseScenarioHistoryFromStorageValue } from "./app/persistence/scenarioHistoryStorage";
export { parseEnvironmentRewindStackFromStorageValue } from "./app/persistence/environmentRewindStorage";
/* eslint-enable react-refresh/only-export-components */
