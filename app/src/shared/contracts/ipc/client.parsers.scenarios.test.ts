import { describe, expect, it } from "vitest";

import { IPC_CONTRACT_VERSION_V1 } from "./v1";
import { parseLoadScenarioV1Output } from "./client/parsers/scenarios";

describe("ipc client scenario parsers", () => {
  it("normalizes runtime alias fields and nested payload aliases", () => {
    const result = parseLoadScenarioV1Output({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-scenario",
      scenario_id: "scenario-1",
      scenario_name: "Scenario one",
      builder: {
        title: "Hydrogen combustion",
        class: "redox",
        equation: "2H2 + O2 -> 2H2O",
        description: "Builder snapshot",
        participants: [
          {
            id: "participant-1",
            substance_id: "substance-h2",
            role: "reactant",
            stoich_coeff_input: "2",
            phase: "gas",
          },
        ],
      },
      runtime_settings: {
        temperature_c: 25,
        pressure_atm: 1,
        gas_medium: "gas",
        precision_profile: "Balanced",
        fps_limit: 60,
      },
    });

    expect(result.scenarioId).toBe("scenario-1");
    expect(result.payload.builderDraft.reactionClass).toBe("redox");
    expect(result.payload.runtimeSettings.precisionProfile).toBe("Balanced");
  });

  it("rejects unsupported precision profiles", () => {
    expect(() =>
      parseLoadScenarioV1Output({
        version: IPC_CONTRACT_VERSION_V1,
        requestId: "req-scenario-invalid",
        id: "scenario-1",
        name: "Scenario one",
        builderDraft: {
          title: "Hydrogen combustion",
          reactionClass: "redox",
          equation: "2H2 + O2 -> 2H2O",
          description: "Builder snapshot",
          participants: [],
        },
        runtimeSettings: {
          temperatureC: 25,
          pressureAtm: 1,
          gasMedium: "gas",
          precisionProfile: "Ultra",
          fpsLimit: 60,
        },
      }),
    ).toThrow(/unsupported precisionProfile/i);
  });
});
