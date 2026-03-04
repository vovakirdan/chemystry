import { describe, expect, it } from "vitest";
import type { SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";
import {
  LIBRARY_PHASE_FILTER_OPTIONS,
  LIBRARY_SOURCE_FILTER_OPTIONS,
  filterLibrarySubstances,
  normalizeLibrarySearchQuery,
  resolveSelectedLibrarySubstanceId,
} from "./model";

const SAMPLE_SUBSTANCES: ReadonlyArray<SubstanceCatalogEntryV1> = [
  {
    id: "builtin-substance-hydrogen",
    name: "Hydrogen",
    formula: "H2",
    phase: "gas",
    source: "builtin",
    molarMassGMol: 2.01588,
  },
  {
    id: "builtin-substance-water",
    name: "Water",
    formula: "H2O",
    phase: "liquid",
    source: "builtin",
    molarMassGMol: 18.01528,
  },
  {
    id: "custom-substance-salt",
    name: "Sodium Chloride",
    formula: "NaCl",
    phase: "aqueous",
    source: "user",
    molarMassGMol: 58.44277,
  },
];

describe("left panel library model", () => {
  it("normalizes search query using trim and lowercase", () => {
    expect(normalizeLibrarySearchQuery("  H2O  ")).toBe("h2o");
  });

  it("filters substances by search query against name and formula", () => {
    const filtered = filterLibrarySubstances(
      SAMPLE_SUBSTANCES,
      "nacl",
      new Set(LIBRARY_PHASE_FILTER_OPTIONS),
      new Set(LIBRARY_SOURCE_FILTER_OPTIONS),
    );

    expect(filtered).toEqual([SAMPLE_SUBSTANCES[2]]);
  });

  it("filters substances by selected phase and source sets", () => {
    const filtered = filterLibrarySubstances(
      SAMPLE_SUBSTANCES,
      "",
      new Set(["gas", "liquid"]),
      new Set(["builtin"]),
    );

    expect(filtered).toEqual([SAMPLE_SUBSTANCES[0], SAMPLE_SUBSTANCES[1]]);
  });

  it("keeps selected substance when still visible and falls back to first visible item otherwise", () => {
    expect(
      resolveSelectedLibrarySubstanceId("builtin-substance-water", [
        SAMPLE_SUBSTANCES[0],
        SAMPLE_SUBSTANCES[1],
      ]),
    ).toBe("builtin-substance-water");

    expect(resolveSelectedLibrarySubstanceId("missing-substance", [SAMPLE_SUBSTANCES[2]])).toBe(
      "custom-substance-salt",
    );

    expect(resolveSelectedLibrarySubstanceId("any", [])).toBeNull();
  });
});
