import { describe, expect, it } from "vitest";

import { IPC_CONTRACT_VERSION_V1 } from "./v1";
import { parseImportXyzV1Output } from "./client/parsers/imports";

describe("ipc client import parsers", () => {
  it("rejects xyz payloads when inference summaries count mismatches importedCount", () => {
    expect(() =>
      parseImportXyzV1Output({
        version: IPC_CONTRACT_VERSION_V1,
        requestId: "req-xyz",
        importedCount: 1,
        substances: [
          {
            id: "substance-water",
            name: "Water",
            formula: "H2O",
            phase: "liquid",
            source: "builtin",
            molarMassGMol: 18.01528,
          },
        ],
        inferenceSummaries: [],
      }),
    ).toThrow(/inferenceSummaries and importedCount/i);
  });
});
