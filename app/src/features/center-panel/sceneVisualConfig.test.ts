import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCENE_COLOR_SCHEME,
  resolveAtomColorByRole,
  resolveSceneColorScheme,
} from "./sceneVisualConfig";

describe("sceneVisualConfig", () => {
  it("merges partial overrides over default color scheme", () => {
    const resolved = resolveSceneColorScheme({
      reactantAtomHex: "#112233",
      bondHex: "#334455",
    });

    expect(resolved.reactantAtomHex).toBe("#112233");
    expect(resolved.bondHex).toBe("#334455");
    expect(resolved.productAtomHex).toBe(DEFAULT_SCENE_COLOR_SCHEME.productAtomHex);
    expect(resolved.selectionEmissiveHex).toBe(DEFAULT_SCENE_COLOR_SCHEME.selectionEmissiveHex);
  });

  it("maps reactant/product roles to color scheme entries", () => {
    const scheme = resolveSceneColorScheme({
      reactantAtomHex: "#c0392b",
      productAtomHex: "#27ae60",
    });

    expect(resolveAtomColorByRole("reactant", scheme)).toBe("#c0392b");
    expect(resolveAtomColorByRole("product", scheme)).toBe("#27ae60");
  });
});
