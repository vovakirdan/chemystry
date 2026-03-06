import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalculationSummaryV1 } from "../../shared/contracts/ipc/v1";
import {
  createCalculationExportFileName,
  exportCalculationSummary,
  toSafeCalculationExportFileNameSegment,
} from "./exportCalculationSummary";

const SUMMARY: CalculationSummaryV1 = {
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  inputSignature: "sig-1",
  entries: [],
};

describe("exportCalculationSummary helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sanitizes export filename segments", () => {
    expect(toSafeCalculationExportFileNameSegment(" Lab Run #1 ")).toBe("lab-run-1");
    expect(toSafeCalculationExportFileNameSegment(" !!! ")).toBe("scenario");
  });

  it("creates deterministic UTC filename with timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T08:00:09.000Z"));

    const fileName = createCalculationExportFileName("Acid Base");

    expect(fileName).toBe("chemystery-calculation-summary-acid-base-20260306-080009.json");
  });

  it("throws explicit error when DOM export APIs are unavailable", () => {
    const originalDocument = (globalThis as Record<string, unknown>).document;
    const originalUrl = (globalThis as Record<string, unknown>).URL;

    // Simulate non-browser runtime.
    delete (globalThis as Record<string, unknown>).document;
    delete (globalThis as Record<string, unknown>).URL;

    try {
      expect(() => exportCalculationSummary(SUMMARY, "Scenario")).toThrow(
        "Local export is unavailable in the current environment.",
      );
    } finally {
      if (originalDocument !== undefined) {
        (globalThis as Record<string, unknown>).document = originalDocument;
      }
      if (originalUrl !== undefined) {
        (globalThis as Record<string, unknown>).URL = originalUrl;
      }
    }
  });

  it("exports summary through browser download primitives and payload contract", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T08:00:09.000Z"));

    const anchor = {
      href: "",
      download: "",
      rel: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const append = vi.fn();
    let exportedBlob: unknown = null;
    const createObjectURL = vi.fn((blob: unknown) => {
      exportedBlob = blob;
      return "blob://export";
    });
    const revokeObjectURL = vi.fn();

    const originalDocument = (globalThis as Record<string, unknown>).document;
    const originalUrl = (globalThis as Record<string, unknown>).URL;

    (globalThis as Record<string, unknown>).document = {
      body: { append },
      createElement: vi.fn(() => anchor),
    };
    (globalThis as Record<string, unknown>).URL = {
      createObjectURL,
      revokeObjectURL,
    };

    try {
      exportCalculationSummary(SUMMARY, "Acid Base");

      expect(anchor.download).toBe("chemystery-calculation-summary-acid-base-20260306-080009.json");
      expect(anchor.rel).toBe("noopener");
      expect(append).toHaveBeenCalledWith(anchor);
      expect(anchor.click).toHaveBeenCalledTimes(1);
      expect(anchor.remove).toHaveBeenCalledTimes(1);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob://export");
      expect(exportedBlob).not.toBeNull();

      if (exportedBlob === null) {
        throw new Error("Expected export blob to be created.");
      }

      const payload = JSON.parse(
        await (exportedBlob as { text: () => Promise<string> }).text(),
      ) as Record<string, unknown>;
      expect(payload.version).toBe(1);
      expect(payload.scenario).toEqual({ name: "Acid Base", inputSignature: "sig-1" });
      expect(payload.entries).toEqual([]);
      expect(typeof payload.exportedAt).toBe("string");
    } finally {
      if (originalDocument !== undefined) {
        (globalThis as Record<string, unknown>).document = originalDocument;
      } else {
        delete (globalThis as Record<string, unknown>).document;
      }
      if (originalUrl !== undefined) {
        (globalThis as Record<string, unknown>).URL = originalUrl;
      } else {
        delete (globalThis as Record<string, unknown>).URL;
      }
    }
  });
});
