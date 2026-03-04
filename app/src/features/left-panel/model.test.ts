import { describe, expect, it } from "vitest";
import type { PresetCatalogEntryV1, SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";
import {
  createBuilderDraftFromPreset,
  DEFAULT_USER_SUBSTANCE_DRAFT,
  LIBRARY_PHASE_FILTER_OPTIONS,
  LIBRARY_SOURCE_FILTER_OPTIONS,
  createUserSubstanceDraftFromCatalogEntry,
  filterLibrarySubstances,
  formatPresetComplexityLabel,
  formatReactionClassLabel,
  isUserSubstanceEditable,
  normalizeLibrarySearchQuery,
  resolveSelectedPresetId,
  resolveSelectedLibrarySubstanceId,
  updateBuilderDraftField,
  validateUserSubstanceDraft,
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

const SAMPLE_PRESETS: ReadonlyArray<PresetCatalogEntryV1> = [
  {
    id: "builtin-preset-hydrogen-combustion-v1",
    title: "Hydrogen combustion",
    reactionClass: "redox",
    equation: "2H2 + O2 -> 2H2O",
    complexity: "intro_level",
    description: "Preset combustion template for hydrogen oxidation.",
  },
  {
    id: "builtin-preset-acid-base-neutralization-v1",
    title: "Strong acid/base neutralization",
    reactionClass: "acid_base",
    equation: "HCl + NaOH -> NaCl + H2O",
    complexity: "intermediate",
    description: "Preset neutralization template for common aqueous media.",
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

  it("validates draft fields before submit and rejects invalid payloads", () => {
    const invalidDraftResult = validateUserSubstanceDraft({
      ...DEFAULT_USER_SUBSTANCE_DRAFT,
      name: "   ",
      formula: "",
      molarMassInput: "-5",
    });

    expect(invalidDraftResult.input).toBeNull();
    expect(invalidDraftResult.errors).toEqual([
      "Name is required.",
      "Formula is required.",
      "Molar mass must be a positive number.",
    ]);
  });

  it("requires molar mass before submit", () => {
    const invalidDraftResult = validateUserSubstanceDraft({
      ...DEFAULT_USER_SUBSTANCE_DRAFT,
      name: "Methane",
      formula: "CH4",
      phase: "gas",
      molarMassInput: "   ",
    });

    expect(invalidDraftResult.input).toBeNull();
    expect(invalidDraftResult.errors).toEqual(["Molar mass is required."]);
  });

  it("normalizes valid draft values for create/update payloads", () => {
    const validDraftResult = validateUserSubstanceDraft({
      ...DEFAULT_USER_SUBSTANCE_DRAFT,
      name: "  Ethanol ",
      formula: " C2H6O ",
      phase: "liquid",
      molarMassInput: "46.06844",
    });

    expect(validDraftResult.errors).toEqual([]);
    expect(validDraftResult.input).toEqual({
      name: "Ethanol",
      formula: "C2H6O",
      phase: "liquid",
      molarMassGMol: 46.06844,
    });
  });

  it("marks builtin/imported as read-only and user entries as editable", () => {
    expect(isUserSubstanceEditable(SAMPLE_SUBSTANCES[0])).toBe(false);
    expect(isUserSubstanceEditable(SAMPLE_SUBSTANCES[2])).toBe(true);
    expect(isUserSubstanceEditable(null)).toBe(false);
  });

  it("creates edit draft values from selected catalog entry", () => {
    expect(createUserSubstanceDraftFromCatalogEntry(SAMPLE_SUBSTANCES[2])).toEqual({
      name: "Sodium Chloride",
      formula: "NaCl",
      phase: "aqueous",
      molarMassInput: "58.44277",
    });
  });

  it("creates builder draft values from selected preset and keeps edits isolated", () => {
    const draft = createBuilderDraftFromPreset(SAMPLE_PRESETS[0]);

    expect(draft).toEqual({
      title: "Hydrogen combustion",
      reactionClass: "redox",
      equation: "2H2 + O2 -> 2H2O",
      description: "Preset combustion template for hydrogen oxidation.",
    });

    draft.title = "Custom title";
    expect(SAMPLE_PRESETS[0].title).toBe("Hydrogen combustion");
  });

  it("updates builder draft fields and rejects unknown reaction class values", () => {
    const baseDraft = createBuilderDraftFromPreset(SAMPLE_PRESETS[0]);

    expect(updateBuilderDraftField(baseDraft, "equation", "H2 + O2 -> H2O")).toEqual({
      ...baseDraft,
      equation: "H2 + O2 -> H2O",
    });

    expect(updateBuilderDraftField(baseDraft, "reactionClass", "equilibrium")).toEqual({
      ...baseDraft,
      reactionClass: "equilibrium",
    });

    expect(updateBuilderDraftField(baseDraft, "reactionClass", "unknown_class")).toEqual(baseDraft);
  });

  it("resolves selected preset id and formats metadata labels", () => {
    expect(
      resolveSelectedPresetId("builtin-preset-acid-base-neutralization-v1", SAMPLE_PRESETS),
    ).toBe("builtin-preset-acid-base-neutralization-v1");
    expect(resolveSelectedPresetId("missing", SAMPLE_PRESETS)).toBe(
      "builtin-preset-hydrogen-combustion-v1",
    );
    expect(resolveSelectedPresetId("any", [])).toBeNull();

    expect(formatReactionClassLabel("organic_basic")).toBe("Organic Basic");
    expect(formatPresetComplexityLabel("intro_level")).toBe("Intro Level");
  });
});
