import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App, { buildLaunchValidationModel } from "./App";
import type { BuilderDraft } from "./features/left-panel/model";
import type { RightPanelRuntimeSettings } from "./features/right-panel/RightPanelSkeleton";
import type { SubstanceCatalogEntryV1 } from "./shared/contracts/ipc/v1";

const VALID_RUNTIME_SETTINGS: RightPanelRuntimeSettings = {
  temperatureC: 25,
  pressureAtm: 1,
  calculationPasses: 250,
  precisionProfile: "Balanced",
  fpsLimit: 60,
};

const SAMPLE_SUBSTANCES: ReadonlyArray<SubstanceCatalogEntryV1> = [
  {
    id: "builtin-substance-hydrogen",
    name: "Hydrogen",
    formula: "H2",
    phase: "gas",
    source: "builtin",
    molarMassGMol: 2.01588,
  },
];

function createBuilderDraftWithRawId(overrides: Partial<BuilderDraft> = {}): BuilderDraft {
  return {
    title: "Hydrogen setup",
    reactionClass: "inorganic",
    equation: "H2 -> H2",
    description: "Validation draft",
    participants: [
      {
        id: "participant-3b81de34-e5c9-4fc1-8fff-1234567890ab",
        substanceId: "builtin-substance-hydrogen",
        role: "reactant",
        stoichCoeffInput: "-1",
        phase: "gas",
        amountMolInput: "1",
        massGInput: "",
        volumeLInput: "22.4",
      },
      {
        id: "participant-2",
        substanceId: "builtin-substance-hydrogen",
        role: "product",
        stoichCoeffInput: "1",
        phase: "gas",
        amountMolInput: "1",
        massGInput: "2.01588",
        volumeLInput: "22.4",
      },
    ],
    ...overrides,
  };
}

describe("App pre-run validation", () => {
  it("renders grouped validation sections and blocks Play when checks fail", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('data-testid="launch-validation-card"');
    expect(html).toContain('data-testid="launch-validation-section-builder"');
    expect(html).toContain('data-testid="launch-validation-section-environment"');
    expect(html).toContain('data-testid="launch-validation-section-calculations"');
    expect(html).toContain(
      "Load a preset in Builder, then add participants before pressing &quot;Play&quot;.",
    );
    expect(html).toContain('data-testid="launch-validation-ok-environment"');
    expect(html).toContain('data-testid="launch-validation-ok-calculations"');
    expect(html).toContain('data-testid="center-control-play" disabled=""');
  });

  it("keeps validation text user-friendly and actionable", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Play is blocked until the issues below are fixed.");
    expect(html).toContain("Load a preset in Builder");
    expect(html).not.toContain("Stoich coeff");
  });

  it("uses human-friendly participant labels and does not leak raw participant ids", () => {
    const validation = buildLaunchValidationModel(
      createBuilderDraftWithRawId(),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );
    const builderErrors =
      validation.sections.find((section) => section.id === "builder")?.errors ?? [];

    expect(builderErrors.length).toBeGreaterThan(0);
    expect(builderErrors.some((message) => message.includes("Participant 1 (Hydrogen):"))).toBe(
      true,
    );
    expect(
      builderErrors.some((message) => message.includes("participant-3b81de34-e5c9-4fc1-8fff")),
    ).toBe(false);
  });

  it("opens launch gate after fixing runtime and builder errors", () => {
    const invalidValidation = buildLaunchValidationModel(
      createBuilderDraftWithRawId(),
      {
        ...VALID_RUNTIME_SETTINGS,
        temperatureC: null,
      },
      SAMPLE_SUBSTANCES,
    );
    expect(invalidValidation.hasErrors).toBe(true);

    const validValidation = buildLaunchValidationModel(
      createBuilderDraftWithRawId({
        participants: [
          {
            id: "participant-raw-id-1",
            substanceId: "builtin-substance-hydrogen",
            role: "reactant",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "22.4",
          },
          {
            id: "participant-raw-id-2",
            substanceId: "builtin-substance-hydrogen",
            role: "product",
            stoichCoeffInput: "1",
            phase: "gas",
            amountMolInput: "1",
            massGInput: "2.01588",
            volumeLInput: "22.4",
          },
        ],
      }),
      VALID_RUNTIME_SETTINGS,
      SAMPLE_SUBSTANCES,
    );

    expect(validValidation.hasErrors).toBe(false);
    expect(validValidation.firstError).toBeNull();
  });
});
