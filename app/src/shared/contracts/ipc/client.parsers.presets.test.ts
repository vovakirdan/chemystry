import { describe, expect, it } from "vitest";

import { IPC_CONTRACT_VERSION_V1 } from "./v1";
import { parseListPresetsV1Output } from "./client/parsers/presets";

describe("ipc client preset parsers", () => {
  it("accepts legacy alias fields for presets", () => {
    const result = parseListPresetsV1Output({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-presets",
      presets: [
        {
          id: "preset-1",
          title: "Hydrogen combustion",
          reaction_class: "redox",
          equation_balanced: "2H2 + O2 -> 2H2O",
          difficulty: "intro",
          description: "A preset.",
        },
      ],
    });

    expect(result.presets[0]).toMatchObject({
      id: "preset-1",
      reactionClass: "redox",
      equation: "2H2 + O2 -> 2H2O",
      complexity: "intro",
    });
  });
});
