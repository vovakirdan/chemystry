import { describe, expect, it } from "vitest";

import { IPC_CONTRACT_VERSION_V1 } from "./v1";
import {
  parseDeleteSubstanceV1Output,
  parseListSubstancesV1Output,
} from "./client/parsers/substances";

describe("ipc client substance parsers", () => {
  it("normalizes substance alias fields into the current DTO shape", () => {
    const result = parseListSubstancesV1Output({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-substances",
      substances: [
        {
          id: "substance-water",
          name: "Water",
          formula: "H2O",
          phase_default: "liquid",
          source_type: "user_defined",
          molar_mass_g_mol: 18.01528,
          smiles: "O",
        },
      ],
    });

    expect(result.substances).toEqual([
      {
        id: "substance-water",
        name: "Water",
        formula: "H2O",
        phase: "liquid",
        source: "user",
        molarMassGMol: 18.01528,
        smiles: "O",
      },
    ]);
  });

  it("rejects delete payloads without a boolean deleted flag", () => {
    expect(() =>
      parseDeleteSubstanceV1Output({
        version: IPC_CONTRACT_VERSION_V1,
        requestId: "req-delete",
        deleted: "yes",
      }),
    ).toThrow(/deleted flag/i);
  });
});
