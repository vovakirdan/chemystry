import { describe, expect, it } from "vitest";
import type { CommandErrorV1, SubstanceCatalogEntryV1 } from "../../shared/contracts/ipc/v1";
import { formatCommandError } from "../simulation/lifecycle";
import { mapLibraryImportError, mergeImportedSubstances } from "./useLibraryImportHandlers";

const BASE_SUBSTANCES: ReadonlyArray<SubstanceCatalogEntryV1> = [
  {
    id: "h2o",
    name: "Water",
    formula: "H2O",
    phase: "liquid",
    source: "builtin",
    molarMassGMol: 18.015,
  },
  {
    id: "naoh",
    name: "Sodium hydroxide",
    formula: "NaOH",
    phase: "aqueous",
    source: "imported",
    molarMassGMol: 40,
  },
];

describe("useLibraryImportHandlers helpers", () => {
  it("mergeImportedSubstances replaces duplicates and keeps deterministic name ordering", () => {
    const importedSubstances: ReadonlyArray<SubstanceCatalogEntryV1> = [
      {
        id: "naoh",
        name: "Sodium hydroxide (updated)",
        formula: "NaOH",
        phase: "aqueous",
        source: "imported",
        molarMassGMol: 40,
      },
      {
        id: "co2",
        name: "Carbon dioxide",
        formula: "CO2",
        phase: "gas",
        source: "imported",
        molarMassGMol: 44.01,
      },
    ];

    const merged = mergeImportedSubstances(BASE_SUBSTANCES, importedSubstances);

    expect(merged).toEqual([importedSubstances[1], importedSubstances[0], BASE_SUBSTANCES[0]]);
  });

  it("mapLibraryImportError formats command errors through command formatter", () => {
    const error: CommandErrorV1 = {
      version: "v1",
      requestId: "req-import",
      category: "io",
      code: "IMPORT_FAILED",
      message: "import failed",
    };

    const mapped = mapLibraryImportError(
      "Import SMILES error",
      error,
      (candidate): candidate is CommandErrorV1 => candidate === error,
    );

    expect(mapped).toBe(`Import SMILES error: ${formatCommandError(error)}`);
  });

  it("mapLibraryImportError falls back to string conversion for unknown errors", () => {
    const mapped = mapLibraryImportError(
      "Import XYZ error",
      new Error("broken input"),
      (_candidate: unknown): _candidate is CommandErrorV1 => false,
    );

    expect(mapped).toBe("Import XYZ error: Error: broken input");
  });
});
