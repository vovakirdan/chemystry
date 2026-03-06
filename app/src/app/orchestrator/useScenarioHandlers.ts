import { useScenarioControlHandlers } from "./useScenarioControlHandlers";
import { useScenarioPersistenceHandlers } from "./useScenarioPersistenceHandlers";

type UseScenarioHandlersParams = Parameters<typeof useScenarioPersistenceHandlers>[0] &
  Parameters<typeof useScenarioControlHandlers>[0];

export function useScenarioHandlers(params: UseScenarioHandlersParams) {
  // Intent: keep scenario persistence and in-session control flows composed from dedicated hooks
  // so side effects remain unchanged while orchestration stays small and readable.
  const persistenceHandlers = useScenarioPersistenceHandlers(params);
  const controlHandlers = useScenarioControlHandlers(params);

  return {
    ...persistenceHandlers,
    ...controlHandlers,
  };
}
