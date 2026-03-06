import { describe, expect, it, vi } from "vitest";
import type {
  CommandErrorV1,
  PresetCatalogEntryV1,
  ScenarioSummaryV1,
  SubstanceCatalogEntryV1,
} from "../../shared/contracts/ipc/v1";
import { formatCommandError } from "../simulation/lifecycle";
import { runBootstrapData, type UseBootstrapDataParams } from "./useBootstrapData";

type BootstrapDependencies = NonNullable<Parameters<typeof runBootstrapData>[2]>;

const SUBSTANCES: ReadonlyArray<SubstanceCatalogEntryV1> = [
  {
    id: "water",
    name: "Water",
    formula: "H2O",
    phase: "liquid",
    source: "builtin",
    molarMassGMol: 18.015,
  },
];

const PRESETS: ReadonlyArray<PresetCatalogEntryV1> = [
  {
    id: "preset-z",
    title: "Zinc oxidation",
    reactionClass: "redox",
    equation: "Zn + O2 -> ZnO",
    complexity: "intermediate",
    description: "z",
  },
  {
    id: "preset-a",
    title: "Acid neutralization",
    reactionClass: "acid_base",
    equation: "HCl + NaOH -> NaCl + H2O",
    complexity: "basic",
    description: "a",
  },
];

const SCENARIOS: ReadonlyArray<ScenarioSummaryV1> = [
  {
    id: "scenario-old",
    name: "Old",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "scenario-new",
    name: "New",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function createBootstrapParams(): UseBootstrapDataParams {
  return {
    enqueueNotification: vi.fn(),
    setHealthMsg: vi.fn(),
    setFeatureFlags: vi.fn(),
    setFeatureFlagsMsg: vi.fn(),
    setAllSubstances: vi.fn(),
    setAllPresets: vi.fn(),
    setSavedScenarios: vi.fn(),
    setLibraryLoadState: vi.fn(),
    setLibraryLoadError: vi.fn(),
    setPresetsLoadState: vi.fn(),
    setPresetsLoadError: vi.fn(),
  };
}

async function flushBootstrapPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("runBootstrapData", () => {
  it("handles the success path and normalizes sorted bootstrap data", async () => {
    const params = createBootstrapParams();
    const dependencies: BootstrapDependencies = {
      healthV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-health",
        status: "ok",
      }),
      resolveFeatureFlagsV1: vi.fn().mockResolvedValue({
        flags: { simulation: true, importExport: true, advancedPrecision: false },
        source: "backend",
        requestId: "req-flags",
        warning: "advancedPrecision disabled by backend",
      }),
      listSubstancesV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-substances",
        substances: SUBSTANCES,
      }),
      listPresetsV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-presets",
        presets: PRESETS,
      }),
      listScenariosV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-scenarios",
        scenarios: SCENARIOS,
      }),
      isCommandErrorV1: (_value: unknown): _value is CommandErrorV1 => false,
    };

    runBootstrapData(params, () => false, dependencies);
    await flushBootstrapPromises();

    expect(params.setHealthMsg).toHaveBeenCalledWith("Backend ok (v1, ref: req-health)");
    expect(params.setFeatureFlags).toHaveBeenCalledWith({
      simulation: true,
      importExport: true,
      advancedPrecision: false,
    });
    expect(params.setFeatureFlagsMsg).toHaveBeenCalledWith(
      "Feature flags: backend (ref: req-flags) - advancedPrecision disabled by backend",
    );
    expect(params.setAllSubstances).toHaveBeenCalledWith(SUBSTANCES);
    expect(params.setLibraryLoadState).toHaveBeenCalledWith("ready");
    expect(params.setLibraryLoadError).toHaveBeenCalledWith(null);
    expect(params.setAllPresets).toHaveBeenCalledWith([PRESETS[1], PRESETS[0]]);
    expect(params.setPresetsLoadState).toHaveBeenCalledWith("ready");
    expect(params.setPresetsLoadError).toHaveBeenCalledWith(null);
    expect(params.setSavedScenarios).toHaveBeenCalledWith([SCENARIOS[1], SCENARIOS[0]]);

    expect(params.enqueueNotification).toHaveBeenCalledWith("info", "Backend status: ok.");
    expect(params.enqueueNotification).toHaveBeenCalledWith(
      "warn",
      "Feature flag warning: advancedPrecision disabled by backend",
    );
  });

  it("maps command errors through formatCommandError on the bootstrap path", async () => {
    const params = createBootstrapParams();
    const commandError: CommandErrorV1 = {
      version: "v1",
      requestId: "req-health-failed",
      category: "io",
      code: "BACKEND_UNAVAILABLE",
      message: "backend unavailable",
    };
    const dependencies: BootstrapDependencies = {
      healthV1: vi.fn().mockRejectedValue(commandError),
      resolveFeatureFlagsV1: vi.fn().mockResolvedValue({
        flags: { simulation: true, importExport: true, advancedPrecision: true },
        source: "backend",
        requestId: "req-flags",
      }),
      listSubstancesV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-substances",
        substances: [],
      }),
      listPresetsV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-presets",
        presets: [],
      }),
      listScenariosV1: vi.fn().mockResolvedValue({
        version: "v1",
        requestId: "req-scenarios",
        scenarios: [],
      }),
      isCommandErrorV1: (error: unknown): error is CommandErrorV1 => error === commandError,
    };

    runBootstrapData(params, () => false, dependencies);
    await flushBootstrapPromises();

    const expected = `Backend error: ${formatCommandError(commandError)}`;
    expect(params.setHealthMsg).toHaveBeenCalledWith(expected);
    expect(params.enqueueNotification).toHaveBeenCalledWith("error", expected);
  });
});
