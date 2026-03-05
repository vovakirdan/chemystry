import { DEFAULT_FEATURE_FLAGS } from "../../config/featureFlags";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  createSubstanceV1,
  deleteSubstanceV1,
  ensureFeatureEnabledV1,
  getFeatureFlagsV1,
  greetV1,
  healthV1,
  isCommandErrorV1,
  listScenariosV1,
  listPresetsV1,
  listSubstancesV1,
  loadScenarioV1,
  normalizeCommandErrorV1,
  resolveFeatureFlagsV1,
  saveScenarioV1,
  toUserFacingMessageV1,
  updateSubstanceV1,
} from "./client";
import { IPC_COMMANDS_V1, IPC_CONTRACT_VERSION_V1, type CommandErrorV1 } from "./v1";

const SAMPLE_SCENARIO_PAYLOAD = {
  builderDraft: {
    title: "Hydrogen combustion",
    reactionClass: "redox" as const,
    equation: "2H2 + O2 -> 2H2O",
    description: "Builder snapshot",
    participants: [
      {
        id: "participant-1",
        substanceId: "builtin-substance-hydrogen",
        role: "reactant" as const,
        stoichCoeffInput: "2",
        phase: "gas" as const,
        amountMolInput: "1",
        massGInput: "2.01588",
        volumeLInput: "22.4",
      },
      {
        id: "participant-2",
        substanceId: "builtin-substance-oxygen",
        role: "reactant" as const,
        stoichCoeffInput: "1",
        phase: "gas" as const,
        amountMolInput: "0.5",
        massGInput: "16",
        volumeLInput: "11.2",
      },
    ],
  },
  runtimeSettings: {
    temperatureC: 25,
    pressureAtm: 1,
    gasMedium: "gas" as const,
    calculationPasses: 250,
    precisionProfile: "Balanced" as const,
    fpsLimit: 60,
  },
};

const SAMPLE_CALCULATION_SUMMARY = {
  version: 1,
  generatedAt: "2026-03-04T09:00:00.000Z",
  inputSignature: "sig-abc",
  entries: [
    {
      resultType: "stoichiometry" as const,
      inputs: {
        participants: [{ id: "participant-1", amountMol: 1 }],
      },
      outputs: {
        reactionExtentMol: 0.5,
      },
      warnings: [],
    },
    {
      resultType: "limiting_reagent" as const,
      inputs: {},
      outputs: {
        limitingReactants: ["participant-1"],
      },
      warnings: [],
    },
    {
      resultType: "yield" as const,
      inputs: {},
      outputs: {
        percentYield: 90,
      },
      warnings: [],
    },
    {
      resultType: "conversion" as const,
      inputs: {},
      outputs: {},
      warnings: ["Ideal-gas approximation"],
    },
    {
      resultType: "concentration" as const,
      inputs: {},
      outputs: {
        concentrations: [],
      },
      warnings: [],
    },
  ],
};

describe("ipc v1 client", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("recognizes v1 command errors with requestId", () => {
    const error: CommandErrorV1 = {
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-123",
      category: "validation",
      code: "NAME_REQUIRED",
      message: "`name` must not be empty.",
    };

    expect(isCommandErrorV1(error)).toBe(true);
  });

  it("normalizes unknown errors with an internal category and generated requestId", () => {
    const normalized = normalizeCommandErrorV1(new Error("transport failure"));

    expect(normalized.version).toBe(IPC_CONTRACT_VERSION_V1);
    expect(normalized.category).toBe("internal");
    expect(normalized.code).toBe("IPC_INVOKE_FAILED");
    expect(normalized.requestId).toMatch(/^req-client-/);
    expect(normalized.message).toContain("transport failure");
  });

  it("maps known codes and category fallbacks to user-facing messages", () => {
    const validationError: CommandErrorV1 = {
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-validation",
      category: "validation",
      code: "NAME_REQUIRED",
      message: "`name` must not be empty.",
    };

    const simulationError: CommandErrorV1 = {
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-simulation",
      category: "simulation",
      code: "SIMULATION_DIVERGED",
      message: "raw backend detail",
    };

    expect(toUserFacingMessageV1(validationError)).toBe("Enter a name before greeting.");
    expect(toUserFacingMessageV1(simulationError)).toBe(
      "Simulation failed. Review inputs and retry.",
    );

    expect(
      toUserFacingMessageV1({
        version: IPC_CONTRACT_VERSION_V1,
        requestId: "req-disabled",
        category: "internal",
        code: "FEATURE_DISABLED",
        message: "Feature is disabled.",
      }),
    ).toBe("This module is disabled by configuration.");
  });

  it("wraps invoke failures from greet_v1 using normalized command errors", async () => {
    invokeMock.mockRejectedValueOnce("invoke failed");

    await expect(greetV1({ name: "Ada" })).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      category: "internal",
      code: "IPC_INVOKE_FAILED",
    });
  });

  it("invokes health_v1 command and returns backend payload", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-health",
      status: "ok",
    });

    await expect(healthV1()).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-health",
      status: "ok",
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.health);
  });

  it("invokes get_feature_flags_v1 and returns backend payload", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-flags",
      featureFlags: {
        simulation: true,
        importExport: false,
        advancedPrecision: true,
      },
    });

    await expect(getFeatureFlagsV1()).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-flags",
      featureFlags: {
        simulation: true,
        importExport: false,
        advancedPrecision: true,
      },
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.getFeatureFlags);
  });

  it("invokes query_substances_v1 with empty input and normalizes source/field aliases", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-library",
      substances: [
        {
          id: "builtin-substance-hydrogen",
          name: "Hydrogen",
          formula: "H2",
          phaseDefault: "gas",
          sourceType: "builtin",
          molarMassGMol: 2.01588,
        },
        {
          id: "custom-substance-1",
          name: "Methane",
          formula: "CH4",
          phase_default: "gas",
          source_type: "user_defined",
          molar_mass_g_mol: 16.0425,
        },
      ],
    });

    await expect(listSubstancesV1()).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-library",
      substances: [
        {
          id: "builtin-substance-hydrogen",
          name: "Hydrogen",
          formula: "H2",
          phase: "gas",
          source: "builtin",
          molarMassGMol: 2.01588,
        },
        {
          id: "custom-substance-1",
          name: "Methane",
          formula: "CH4",
          phase: "gas",
          source: "user",
          molarMassGMol: 16.0425,
        },
      ],
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.listSubstances, {
      input: {},
    });
  });

  it("rejects query_substances_v1 payloads with invalid records", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-library-invalid",
      substances: [
        {
          id: "broken-substance",
          name: "Broken",
          formula: "Br",
          phase: "plasma",
          source: "builtin",
        },
      ],
    });

    await expect(listSubstancesV1()).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-library-invalid",
      category: "internal",
      code: "INVALID_SUBSTANCE_PAYLOAD",
    });
  });

  it("invokes list_presets_v1 with empty input and parses preset metadata", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-presets",
      presets: [
        {
          id: "builtin-preset-hydrogen-combustion-v1",
          title: "Hydrogen combustion",
          reaction_class: "redox",
          equation_balanced: "2H2 + O2 -> 2H2O",
          complexity: "intro",
          description: "Preset combustion template for hydrogen oxidation.",
        },
      ],
    });

    await expect(listPresetsV1()).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-presets",
      presets: [
        {
          id: "builtin-preset-hydrogen-combustion-v1",
          title: "Hydrogen combustion",
          reactionClass: "redox",
          equation: "2H2 + O2 -> 2H2O",
          complexity: "intro",
          description: "Preset combustion template for hydrogen oxidation.",
        },
      ],
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.listPresets, {
      input: {},
    });
  });

  it("rejects list_presets_v1 payloads with invalid reaction class", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-presets-invalid",
      presets: [
        {
          id: "broken-preset",
          title: "Broken preset",
          reactionClass: "nuclear",
          equation: "X -> Y",
          complexity: "intro",
          description: "Broken payload.",
        },
      ],
    });

    await expect(listPresetsV1()).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-presets-invalid",
      category: "internal",
      code: "INVALID_PRESET_PAYLOAD",
    });
  });

  it("invokes list_scenarios_v1 and normalizes summary aliases", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-scenarios",
      scenarios: [
        {
          id: "scenario-run-1",
          name: "Hydrogen what-if",
          created_at: "2026-03-04T09:00:00Z",
          updated_at: "2026-03-04T09:10:00Z",
        },
      ],
    });

    await expect(listScenariosV1()).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-scenarios",
      scenarios: [
        {
          id: "scenario-run-1",
          name: "Hydrogen what-if",
          createdAt: "2026-03-04T09:00:00Z",
          updatedAt: "2026-03-04T09:10:00Z",
        },
      ],
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.listScenarios, {
      input: {},
    });
  });

  it("rejects list_scenarios_v1 payloads with invalid summary format", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-scenarios-invalid",
      scenarios: [
        {
          id: "scenario-run-invalid",
          name: "",
          createdAt: "2026-03-04T09:00:00Z",
          updatedAt: "2026-03-04T09:10:00Z",
        },
      ],
    });

    await expect(listScenariosV1()).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-scenarios-invalid",
      category: "internal",
      code: "INVALID_SCENARIO_PAYLOAD",
    });
  });

  it("invokes save_scenario_draft_v1 with mapped input payload and parses summary", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-save-scenario",
      scenarioId: "scenario-run-saved",
      scenarioName: "Hydrogen what-if [1741089000000]",
      createdAt: "2026-03-04T09:00:00Z",
      updated: false,
    });

    await expect(
      saveScenarioV1({
        name: "Hydrogen what-if",
        payload: {
          ...SAMPLE_SCENARIO_PAYLOAD,
          calculationSummary: SAMPLE_CALCULATION_SUMMARY,
        },
      }),
    ).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-save-scenario",
      scenario: {
        id: "scenario-run-saved",
        name: "Hydrogen what-if [1741089000000]",
        createdAt: "2026-03-04T09:00:00Z",
        updatedAt: "2026-03-04T09:00:00Z",
      },
      updated: false,
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.saveScenario, {
      input: {
        scenarioName: "Hydrogen what-if",
        builder: SAMPLE_SCENARIO_PAYLOAD.builderDraft,
        runtime: SAMPLE_SCENARIO_PAYLOAD.runtimeSettings,
        calculationSummary: SAMPLE_CALCULATION_SUMMARY,
      },
    });
  });

  it("rejects save_scenario_v1 payloads with invalid response format", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-save-scenario-invalid",
      scenarioId: "",
      scenarioName: "Hydrogen what-if",
      createdAt: "2026-03-04T09:00:00Z",
      updated: false,
    });

    await expect(
      saveScenarioV1({
        name: "Hydrogen what-if",
        payload: SAMPLE_SCENARIO_PAYLOAD,
      }),
    ).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-save-scenario-invalid",
      category: "internal",
      code: "INVALID_SCENARIO_PAYLOAD",
    });
  });

  it("invokes load_scenario_draft_v1 and parses scenario payload snapshot", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario",
      scenarioId: "scenario-run-saved",
      scenarioName: "Hydrogen what-if",
      builder: SAMPLE_SCENARIO_PAYLOAD.builderDraft,
      runtime: SAMPLE_SCENARIO_PAYLOAD.runtimeSettings,
      calculationSummary: SAMPLE_CALCULATION_SUMMARY,
    });

    await expect(loadScenarioV1({ id: "scenario-run-saved" })).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario",
      scenarioId: "scenario-run-saved",
      scenarioName: "Hydrogen what-if",
      payload: {
        ...SAMPLE_SCENARIO_PAYLOAD,
        calculationSummary: SAMPLE_CALCULATION_SUMMARY,
      },
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.loadScenario, {
      input: {
        scenarioId: "scenario-run-saved",
      },
    });
  });

  it("rejects load_scenario_v1 payloads with invalid runtime precision profile", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario-invalid",
      scenarioId: "scenario-run-saved",
      scenarioName: "Hydrogen what-if",
      builder: SAMPLE_SCENARIO_PAYLOAD.builderDraft,
      runtime: {
        ...SAMPLE_SCENARIO_PAYLOAD.runtimeSettings,
        precisionProfile: "Ultra Precision",
      },
    });

    await expect(loadScenarioV1({ id: "scenario-run-saved" })).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario-invalid",
      category: "internal",
      code: "INVALID_SCENARIO_PAYLOAD",
    });
  });

  it("rejects load_scenario_v1 payloads with invalid gas medium", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario-invalid-gas-medium",
      scenarioId: "scenario-run-saved",
      scenarioName: "Hydrogen what-if",
      builder: SAMPLE_SCENARIO_PAYLOAD.builderDraft,
      runtime: {
        ...SAMPLE_SCENARIO_PAYLOAD.runtimeSettings,
        gasMedium: "plasma",
      },
    });

    await expect(loadScenarioV1({ id: "scenario-run-saved" })).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario-invalid-gas-medium",
      category: "internal",
      code: "INVALID_SCENARIO_PAYLOAD",
    });
  });

  it("rejects load_scenario_v1 payloads with invalid calculation summary shape", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario-invalid-summary",
      scenarioId: "scenario-run-saved",
      scenarioName: "Hydrogen what-if",
      builder: SAMPLE_SCENARIO_PAYLOAD.builderDraft,
      runtime: SAMPLE_SCENARIO_PAYLOAD.runtimeSettings,
      calculationSummary: {
        version: 1,
        generatedAt: "2026-03-04T09:00:00.000Z",
        inputSignature: "sig-abc",
        entries: [
          {
            resultType: "unsupported",
            inputs: {},
            outputs: {},
            warnings: [],
          },
        ],
      },
    });

    await expect(loadScenarioV1({ id: "scenario-run-saved" })).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-load-scenario-invalid-summary",
      category: "internal",
      code: "INVALID_SCENARIO_PAYLOAD",
    });
  });

  it("invokes create_substance_v1 with { input } and parses returned substance payload", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-create-substance",
      substance: {
        id: "user-substance-ethanol",
        name: "Ethanol",
        formula: "C2H6O",
        phase_default: "liquid",
        source_type: "user_defined",
        molar_mass_g_mol: "46.06844",
      },
    });

    await expect(
      createSubstanceV1({
        name: "Ethanol",
        formula: "C2H6O",
        phase: "liquid",
        molarMassGMol: 46.06844,
      }),
    ).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-create-substance",
      substance: {
        id: "user-substance-ethanol",
        name: "Ethanol",
        formula: "C2H6O",
        phase: "liquid",
        source: "user",
        molarMassGMol: 46.06844,
      },
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.createSubstance, {
      input: {
        name: "Ethanol",
        formula: "C2H6O",
        phase: "liquid",
        molarMassGMol: 46.06844,
      },
    });
  });

  it("rejects create_substance_v1 payloads with invalid response shape", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-create-invalid",
      substance: null,
    });

    await expect(
      createSubstanceV1({
        name: "Broken",
        formula: "Br",
        phase: "solid",
        molarMassGMol: 1,
      }),
    ).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-create-invalid",
      category: "internal",
      code: "INVALID_SUBSTANCE_PAYLOAD",
    });
  });

  it("invokes update_substance_v1 with { input } and parses returned substance payload", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-update-substance",
      substance: {
        id: "user-substance-ethanol",
        name: "Ethanol (Updated)",
        formula: "C2H6O",
        phase: "liquid",
        source: "user",
        molarMassGMol: 46.06844,
      },
    });

    await expect(
      updateSubstanceV1({
        id: "user-substance-ethanol",
        name: "Ethanol (Updated)",
        formula: "C2H6O",
        phase: "liquid",
        molarMassGMol: 46.06844,
      }),
    ).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-update-substance",
      substance: {
        id: "user-substance-ethanol",
        name: "Ethanol (Updated)",
        formula: "C2H6O",
        phase: "liquid",
        source: "user",
        molarMassGMol: 46.06844,
      },
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.updateSubstance, {
      input: {
        id: "user-substance-ethanol",
        name: "Ethanol (Updated)",
        formula: "C2H6O",
        phase: "liquid",
        molarMassGMol: 46.06844,
      },
    });
  });

  it("invokes delete_substance_v1 with { input } and validates deleted flag", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-delete-substance",
      deleted: true,
    });

    await expect(deleteSubstanceV1({ id: "user-substance-ethanol" })).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-delete-substance",
      deleted: true,
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.deleteSubstance, {
      input: {
        id: "user-substance-ethanol",
      },
    });
  });

  it("rejects delete_substance_v1 payloads with invalid deleted flag", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-delete-invalid",
      deleted: "yes",
    });

    await expect(deleteSubstanceV1({ id: "user-substance-ethanol" })).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-delete-invalid",
      category: "internal",
      code: "INVALID_SUBSTANCE_PAYLOAD",
    });
  });

  it("resolves feature flags from backend values when available", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-backend-flags",
      featureFlags: {
        simulation: false,
        importExport: true,
        advancedPrecision: false,
      },
    });

    await expect(resolveFeatureFlagsV1()).resolves.toEqual({
      flags: {
        simulation: false,
        importExport: true,
        advancedPrecision: false,
      },
      source: "backend",
      requestId: "req-backend-flags",
    });
  });

  it("falls back to defaults when get_feature_flags_v1 invocation fails", async () => {
    invokeMock.mockRejectedValueOnce("backend offline");

    const resolved = await resolveFeatureFlagsV1();

    expect(resolved.flags).toEqual(DEFAULT_FEATURE_FLAGS);
    expect(resolved.source).toBe("fallback");
    expect(resolved.requestId).toMatch(/^req-client-/);
    expect(resolved.warning).toContain("IPC_INVOKE_FAILED");
  });

  it("throws a typed command error when a feature path is disabled", () => {
    expect(() =>
      ensureFeatureEnabledV1(
        {
          simulation: false,
          importExport: true,
          advancedPrecision: true,
        },
        "simulation",
        "req-disabled-feature",
      ),
    ).toThrowError(
      expect.objectContaining({
        version: IPC_CONTRACT_VERSION_V1,
        requestId: "req-disabled-feature",
        category: "internal",
        code: "FEATURE_DISABLED",
      }),
    );
  });
});
