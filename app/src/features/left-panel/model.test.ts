import { describe, expect, it } from "vitest";
import type {
  PresetCatalogEntryV1,
  SubstanceCatalogEntryV1,
  SubstancePhaseV1,
} from "../../shared/contracts/ipc/v1";
import {
  addBuilderDraftParticipant,
  createBuilderDraftFromPreset,
  createUserSubstanceDraftFromCatalogEntry,
  DEFAULT_USER_SUBSTANCE_DRAFT,
  filterLibrarySubstances,
  formatPresetComplexityLabel,
  formatReactionClassLabel,
  isUserSubstanceEditable,
  LIBRARY_PHASE_FILTER_OPTIONS,
  LIBRARY_SOURCE_FILTER_OPTIONS,
  normalizeLibrarySearchQuery,
  parseBuilderDraftFromStorage,
  removeBuilderDraftParticipant,
  resolveSelectedLibrarySubstanceId,
  resolveSelectedPresetId,
  serializeBuilderDraftForStorage,
  updateBuilderDraftField,
  updateBuilderDraftParticipantField,
  validateBuilderDraftForLaunch,
  validateUserSubstanceDraft,
  type BuilderDraftParticipant,
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

function createParticipant(
  id: string,
  overrides: Partial<BuilderDraftParticipant> = {},
): BuilderDraftParticipant {
  return {
    id,
    substanceId: "builtin-substance-hydrogen",
    role: "reactant",
    stoichCoeffInput: "1",
    phase: "gas",
    amountMolInput: "",
    massGInput: "",
    volumeLInput: "",
    ...overrides,
  };
}

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

  it("supports comma decimal and exponent molar mass input normalization", () => {
    const validDraftResult = validateUserSubstanceDraft({
      ...DEFAULT_USER_SUBSTANCE_DRAFT,
      name: "Ethanol",
      formula: "C2H6O",
      phase: "liquid",
      molarMassInput: " 4,606844e1 ",
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
      participants: [],
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

  it("adds, updates, and removes builder participants with new fields", () => {
    const baseDraft = createBuilderDraftFromPreset(SAMPLE_PRESETS[1]);
    const draftWithParticipant = addBuilderDraftParticipant(
      baseDraft,
      createParticipant("participant-1"),
    );

    expect(baseDraft.participants).toEqual([]);
    expect(draftWithParticipant.participants).toEqual([createParticipant("participant-1")]);

    const draftWithUpdates = updateBuilderDraftParticipantField(
      updateBuilderDraftParticipantField(
        updateBuilderDraftParticipantField(
          updateBuilderDraftParticipantField(
            updateBuilderDraftParticipantField(
              updateBuilderDraftParticipantField(
                draftWithParticipant,
                "participant-1",
                "role",
                "product",
              ),
              "participant-1",
              "substanceId",
              "custom-substance-salt",
              SAMPLE_SUBSTANCES,
            ),
            "participant-1",
            "phase",
            "liquid",
          ),
          "participant-1",
          "stoichCoeffInput",
          "3",
        ),
        "participant-1",
        "amountMolInput",
        "2",
        SAMPLE_SUBSTANCES,
      ),
      "participant-1",
      "volumeLInput",
      "0.25",
    );

    expect(draftWithUpdates.participants).toEqual([
      {
        id: "participant-1",
        substanceId: "custom-substance-salt",
        role: "product",
        stoichCoeffInput: "3",
        phase: "liquid",
        amountMolInput: "2",
        massGInput: "116.88554",
        volumeLInput: "0.25",
      },
    ]);

    const draftAfterRemoval = removeBuilderDraftParticipant(draftWithUpdates, "participant-1");
    expect(draftAfterRemoval.participants).toEqual([]);
  });

  it("applies mass<->mol<->volume conversion for gas participants", () => {
    const baseDraft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      createParticipant("participant-2"),
    );

    const amountUpdated = updateBuilderDraftParticipantField(
      baseDraft,
      "participant-2",
      "amountMolInput",
      "2",
      SAMPLE_SUBSTANCES,
    );
    expect(amountUpdated.participants[0]).toMatchObject({
      amountMolInput: "2",
      massGInput: "4.03176",
      volumeLInput: "44.8",
    });

    const massUpdated = updateBuilderDraftParticipantField(
      amountUpdated,
      "participant-2",
      "massGInput",
      "10.0794",
      SAMPLE_SUBSTANCES,
    );
    expect(massUpdated.participants[0]).toMatchObject({
      amountMolInput: "5",
      massGInput: "10.0794",
      volumeLInput: "112",
    });

    const invalidAmount = updateBuilderDraftParticipantField(
      massUpdated,
      "participant-2",
      "amountMolInput",
      "-1",
      SAMPLE_SUBSTANCES,
    );
    expect(invalidAmount.participants[0]).toMatchObject({
      amountMolInput: "-1",
      massGInput: "10.0794",
      volumeLInput: "112",
    });
  });

  it("applies volume->amount->mass for gas and blocks implicit volume conversion for non-gas", () => {
    const gasDraft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      createParticipant("participant-2-volume", {
        amountMolInput: "",
        massGInput: "",
        volumeLInput: "",
      }),
    );

    const gasVolumeUpdated = updateBuilderDraftParticipantField(
      gasDraft,
      "participant-2-volume",
      "volumeLInput",
      "1,12e2",
      SAMPLE_SUBSTANCES,
    );
    expect(gasVolumeUpdated.participants[0]).toMatchObject({
      volumeLInput: "1,12e2",
      amountMolInput: "5",
      massGInput: "10.0794",
    });

    const liquidDraft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      createParticipant("participant-liquid-volume", {
        substanceId: "builtin-substance-water",
        phase: "liquid",
        amountMolInput: "1",
        massGInput: "18.01528",
        volumeLInput: "",
      }),
    );

    const liquidVolumeUpdated = updateBuilderDraftParticipantField(
      liquidDraft,
      "participant-liquid-volume",
      "volumeLInput",
      "22.4",
      SAMPLE_SUBSTANCES,
    );
    expect(liquidVolumeUpdated.participants[0]).toMatchObject({
      phase: "liquid",
      amountMolInput: "1",
      massGInput: "18.01528",
      volumeLInput: "22.4",
    });
  });

  it("ignores invalid participant operations", () => {
    const baseDraft = createBuilderDraftFromPreset(SAMPLE_PRESETS[0]);
    const unchangedAfterAdd = addBuilderDraftParticipant(baseDraft, {
      ...createParticipant("invalid"),
      id: "",
    });
    expect(unchangedAfterAdd).toEqual(baseDraft);

    const draftWithParticipant = addBuilderDraftParticipant(
      baseDraft,
      createParticipant("participant-3"),
    );
    const unchangedAfterInvalidRole = updateBuilderDraftParticipantField(
      draftWithParticipant,
      "participant-3",
      "role",
      "unknown-role",
    );
    expect(unchangedAfterInvalidRole).toEqual(draftWithParticipant);

    const unchangedAfterInvalidPhase = updateBuilderDraftParticipantField(
      draftWithParticipant,
      "participant-3",
      "phase",
      "plasma",
    );
    expect(unchangedAfterInvalidPhase).toEqual(draftWithParticipant);
  });

  it("serializes and safely parses builder draft for local storage", () => {
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      createParticipant("participant-4", {
        amountMolInput: "1",
        massGInput: "2.01588",
        volumeLInput: "1",
      }),
    );

    const serialized = serializeBuilderDraftForStorage(draft);

    expect(parseBuilderDraftFromStorage(serialized)).toEqual(draft);
    expect(parseBuilderDraftFromStorage(null)).toBeNull();
    expect(parseBuilderDraftFromStorage("not-json")).toBeNull();
    expect(
      parseBuilderDraftFromStorage(
        JSON.stringify({
          version: 1,
          draft: {
            title: "bad",
            reactionClass: "redox",
            equation: "a",
            description: "b",
            participants: [
              {
                id: "",
                substanceId: "x",
                role: "reactant",
                stoichCoeffInput: "1",
              },
            ],
          },
        }),
      ),
    ).toBeNull();
    expect(
      parseBuilderDraftFromStorage(
        JSON.stringify({
          version: 1,
          draft: {
            title: "bad-class",
            reactionClass: "toString",
            equation: "x",
            description: "y",
            participants: [],
          },
        }),
      ),
    ).toBeNull();
  });

  it("resolves legacy participant phase from matched substance when context is provided", () => {
    const parsedDraft = parseBuilderDraftFromStorage(
      JSON.stringify({
        version: 1,
        draft: {
          title: "Legacy draft",
          reactionClass: "redox",
          equation: "2H2 + O2 -> 2H2O",
          description: "Stored before participant amount fields existed.",
          participants: [
            {
              id: "legacy-p1",
              substanceId: "builtin-substance-hydrogen",
              role: "reactant",
              stoichCoeffInput: "2",
            },
          ],
        },
      }),
      SAMPLE_SUBSTANCES,
    );

    expect(parsedDraft).toEqual({
      title: "Legacy draft",
      reactionClass: "redox",
      equation: "2H2 + O2 -> 2H2O",
      description: "Stored before participant amount fields existed.",
      participants: [
        {
          id: "legacy-p1",
          substanceId: "builtin-substance-hydrogen",
          role: "reactant",
          stoichCoeffInput: "2",
          phase: "gas",
          amountMolInput: "",
          massGInput: "",
          volumeLInput: "",
        },
      ],
    });
  });

  it("blocks launch when participant numeric fields are negative", () => {
    const participant = createParticipant("participant-negative", {
      phase: "liquid" as SubstancePhaseV1,
      stoichCoeffInput: "-2",
      amountMolInput: "-0.5",
      massGInput: "-3",
      volumeLInput: "-1",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );
    const errors = validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES);

    expect(errors).toContain(
      'Stoich coeff for participant "participant-negative" cannot be negative.',
    );
    expect(errors).toContain(
      'Amount (mol) for participant "participant-negative" cannot be negative.',
    );
    expect(errors).toContain('Mass (g) for participant "participant-negative" cannot be negative.');
    expect(errors).toContain(
      'Volume (L) for participant "participant-negative" cannot be negative.',
    );
  });

  it("blocks launch when mass and amount are dimensionally inconsistent", () => {
    const participant = createParticipant("participant-mass-mismatch", {
      phase: "gas",
      stoichCoeffInput: "1",
      amountMolInput: "1",
      massGInput: "3.2",
      volumeLInput: "22.4",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    const errors = validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES);

    expect(errors).toContain(
      'Mass (g) for participant "participant-mass-mismatch" is inconsistent with Amount (mol) for selected molar mass.',
    );
  });

  it("blocks launch when near-zero mass is inconsistent with zero amount", () => {
    const participant = createParticipant("participant-near-zero-mass-mismatch", {
      phase: "gas",
      stoichCoeffInput: "1",
      amountMolInput: "0",
      massGInput: "0.00009",
      volumeLInput: "0",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    const errors = validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES);

    expect(errors).toContain(
      'Mass (g) for participant "participant-near-zero-mass-mismatch" is inconsistent with Amount (mol) for selected molar mass.',
    );
  });

  it("blocks launch when gas volume and amount are dimensionally inconsistent", () => {
    const participant = createParticipant("participant-volume-mismatch", {
      phase: "gas",
      stoichCoeffInput: "1",
      amountMolInput: "1",
      massGInput: "2.01588",
      volumeLInput: "30",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    const errors = validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES);

    expect(errors).toContain(
      'Volume (L) for participant "participant-volume-mismatch" is inconsistent with Amount (mol) for gas molar volume.',
    );
  });

  it("blocks launch when near-zero gas volume is inconsistent with zero amount", () => {
    const participant = createParticipant("participant-near-zero-volume-mismatch", {
      phase: "gas",
      stoichCoeffInput: "1",
      amountMolInput: "0",
      massGInput: "0",
      volumeLInput: "0.00009",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    const errors = validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES);

    expect(errors).toContain(
      'Volume (L) for participant "participant-near-zero-volume-mismatch" is inconsistent with Amount (mol) for gas molar volume.',
    );
  });

  it("accepts mass and gas-volume values inside dimension tolerance", () => {
    const participant = createParticipant("participant-dimension-within-tolerance", {
      phase: "gas",
      stoichCoeffInput: "1",
      amountMolInput: "1",
      massGInput: "2.01598",
      volumeLInput: "22.401",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    expect(validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES)).toEqual([]);
  });

  it("blocks launch when mass and gas-volume exceed dimension tolerance", () => {
    const participant = createParticipant("participant-dimension-over-tolerance", {
      phase: "gas",
      stoichCoeffInput: "1",
      amountMolInput: "1",
      massGInput: "2.0162",
      volumeLInput: "22.405",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    const errors = validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES);

    expect(errors).toContain(
      'Mass (g) for participant "participant-dimension-over-tolerance" is inconsistent with Amount (mol) for selected molar mass.',
    );
    expect(errors).toContain(
      'Volume (L) for participant "participant-dimension-over-tolerance" is inconsistent with Amount (mol) for gas molar volume.',
    );
  });

  it("blocks launch when mass/amount check cannot resolve molar mass", () => {
    const participant = createParticipant("participant-missing-molar-mass", {
      phase: "gas",
      stoichCoeffInput: "1",
      amountMolInput: "1",
      massGInput: "2",
      volumeLInput: "22.4",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );
    const substancesWithoutMolarMass: ReadonlyArray<SubstanceCatalogEntryV1> = [
      {
        ...SAMPLE_SUBSTANCES[0],
        molarMassGMol: null,
      },
      SAMPLE_SUBSTANCES[1],
      SAMPLE_SUBSTANCES[2],
    ];

    const errors = validateBuilderDraftForLaunch(draft, substancesWithoutMolarMass);

    expect(errors).toContain(
      'Mass (g) for participant "participant-missing-molar-mass" cannot be checked against Amount (mol) because molar mass is missing.',
    );
  });

  it("accepts comma decimal and exponent participant numeric inputs during launch validation", () => {
    const participant = createParticipant("participant-normalized", {
      phase: "gas" as SubstancePhaseV1,
      stoichCoeffInput: "1e1",
      amountMolInput: "1,5",
      massGInput: "3,02382e0",
      volumeLInput: "3,36e1",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    expect(validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES)).toEqual([]);
  });

  it("accepts parser-normalized spaces and exponent formatting when dimensions are consistent", () => {
    const participant = createParticipant("participant-space-normalized", {
      phase: "gas" as SubstancePhaseV1,
      stoichCoeffInput: " 1 e0 ",
      amountMolInput: " 1,5 e0 ",
      massGInput: " 3,02382 ",
      volumeLInput: " 3,36 e1 ",
    });
    const draft = addBuilderDraftParticipant(
      createBuilderDraftFromPreset(SAMPLE_PRESETS[0]),
      participant,
    );

    expect(validateBuilderDraftForLaunch(draft, SAMPLE_SUBSTANCES)).toEqual([]);
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
