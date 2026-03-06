import { describe, expect, it, vi } from "vitest";
import type { BuilderDraft } from "../../features/left-panel/model";
import type { CalculationSummaryV1 } from "../../shared/contracts/ipc/v1";
import {
  executeCalculationSummaryExport,
  resolveCalculationExportBaseName,
} from "./useSimulationHandlers";

const BUILDER_DRAFT: BuilderDraft = {
  title: " Builder Title ",
  reactionClass: "inorganic",
  equation: "A -> B",
  description: "",
  participants: [],
};

const SUMMARY: CalculationSummaryV1 = {
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  inputSignature: "sig-42",
  entries: [],
};

describe("useSimulationHandlers export helpers", () => {
  it("resolveCalculationExportBaseName prioritizes scenario name, then builder title, then default", () => {
    const deps = {
      exportCalculationSummary: vi.fn(),
      stripGeneratedScenarioNameSuffix: (value: string) => value.replace(/\s\[\d+\]$/u, "").trim(),
    };

    expect(resolveCalculationExportBaseName("Scenario [1700]", BUILDER_DRAFT, deps)).toBe(
      "Scenario",
    );
    expect(resolveCalculationExportBaseName("   ", BUILDER_DRAFT, deps)).toBe("Builder Title");
    expect(resolveCalculationExportBaseName("   ", null, deps)).toBe("scenario");
  });

  it("executeCalculationSummaryExport notifies warn when summary is unavailable", () => {
    const enqueueNotification = vi.fn();

    executeCalculationSummaryExport({
      calculationSummary: null,
      scenarioNameInput: "Scenario",
      builderDraft: BUILDER_DRAFT,
      setLastPersistedCalculationInputSignature: vi.fn(),
      enqueueNotification,
    });

    expect(enqueueNotification).toHaveBeenCalledWith(
      "warn",
      "Calculation summary is unavailable. Complete required inputs before exporting.",
    );
  });

  it("executeCalculationSummaryExport maps success and failure notifications", () => {
    const setSignature = vi.fn();
    const enqueueNotification = vi.fn();
    const exportFn = vi.fn();

    executeCalculationSummaryExport(
      {
        calculationSummary: SUMMARY,
        scenarioNameInput: "Scenario [1700]",
        builderDraft: BUILDER_DRAFT,
        setLastPersistedCalculationInputSignature: setSignature,
        enqueueNotification,
      },
      {
        exportCalculationSummary: exportFn,
        stripGeneratedScenarioNameSuffix: (value: string) =>
          value.replace(/\s\[\d+\]$/u, "").trim(),
      },
    );

    expect(exportFn).toHaveBeenCalledWith(SUMMARY, "Scenario");
    expect(setSignature).toHaveBeenCalledWith("sig-42");
    expect(enqueueNotification).toHaveBeenCalledWith(
      "info",
      'Calculation summary exported for "Scenario".',
    );

    const enqueueError = vi.fn();
    executeCalculationSummaryExport(
      {
        calculationSummary: SUMMARY,
        scenarioNameInput: "Scenario [1700]",
        builderDraft: BUILDER_DRAFT,
        setLastPersistedCalculationInputSignature: vi.fn(),
        enqueueNotification: enqueueError,
      },
      {
        exportCalculationSummary: () => {
          throw new Error("download failed");
        },
        stripGeneratedScenarioNameSuffix: (value: string) =>
          value.replace(/\s\[\d+\]$/u, "").trim(),
      },
    );

    expect(enqueueError).toHaveBeenCalledWith(
      "error",
      "Calculation summary export failed: Error: download failed",
    );
  });
});
