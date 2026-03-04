import { DEFAULT_FEATURE_FLAGS } from "../../config/featureFlags";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  ensureFeatureEnabledV1,
  getFeatureFlagsV1,
  greetV1,
  healthV1,
  isCommandErrorV1,
  normalizeCommandErrorV1,
  resolveFeatureFlagsV1,
  toUserFacingMessageV1,
} from "./client";
import { IPC_COMMANDS_V1, IPC_CONTRACT_VERSION_V1, type CommandErrorV1 } from "./v1";

describe("ipc v1 client", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("recognizes v1 command errors with requestId", () => {
    const error: CommandErrorV1 = {
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-123",
      category: "validation",
      code: "NAME_REQUIRED",
      message: "`name` must not be empty.",
    };

    expect(isCommandErrorV1(error)).toBe(true);
  });

  it("normalizes unknown errors with an internal category and generated requestId", () => {
    const normalized = normalizeCommandErrorV1(new Error("transport failure"));

    expect(normalized.version).toBe(IPC_CONTRACT_VERSION_V1);
    expect(normalized.category).toBe("internal");
    expect(normalized.code).toBe("IPC_INVOKE_FAILED");
    expect(normalized.requestId).toMatch(/^req-client-/);
    expect(normalized.message).toContain("transport failure");
  });

  it("maps known codes and category fallbacks to user-facing messages", () => {
    const validationError: CommandErrorV1 = {
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-validation",
      category: "validation",
      code: "NAME_REQUIRED",
      message: "`name` must not be empty.",
    };

    const simulationError: CommandErrorV1 = {
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-simulation",
      category: "simulation",
      code: "SIMULATION_DIVERGED",
      message: "raw backend detail",
    };

    expect(toUserFacingMessageV1(validationError)).toBe("Enter a name before greeting.");
    expect(toUserFacingMessageV1(simulationError)).toBe(
      "Simulation failed. Review inputs and retry.",
    );

    expect(
      toUserFacingMessageV1({
        version: IPC_CONTRACT_VERSION_V1,
        requestId: "req-disabled",
        category: "internal",
        code: "FEATURE_DISABLED",
        message: "Feature is disabled.",
      }),
    ).toBe("This module is disabled by configuration.");
  });

  it("wraps invoke failures from greet_v1 using normalized command errors", async () => {
    invokeMock.mockRejectedValueOnce("invoke failed");

    await expect(greetV1({ name: "Ada" })).rejects.toMatchObject({
      version: IPC_CONTRACT_VERSION_V1,
      category: "internal",
      code: "IPC_INVOKE_FAILED",
    });
  });

  it("invokes health_v1 command and returns backend payload", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-health",
      status: "ok",
    });

    await expect(healthV1()).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-health",
      status: "ok",
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.health);
  });

  it("invokes get_feature_flags_v1 and returns backend payload", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-flags",
      featureFlags: {
        simulation: true,
        importExport: false,
        advancedPrecision: true,
      },
    });

    await expect(getFeatureFlagsV1()).resolves.toEqual({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-flags",
      featureFlags: {
        simulation: true,
        importExport: false,
        advancedPrecision: true,
      },
    });

    expect(invokeMock).toHaveBeenCalledWith(IPC_COMMANDS_V1.getFeatureFlags);
  });

  it("resolves feature flags from backend values when available", async () => {
    invokeMock.mockResolvedValueOnce({
      version: IPC_CONTRACT_VERSION_V1,
      requestId: "req-backend-flags",
      featureFlags: {
        simulation: false,
        importExport: true,
        advancedPrecision: false,
      },
    });

    await expect(resolveFeatureFlagsV1()).resolves.toEqual({
      flags: {
        simulation: false,
        importExport: true,
        advancedPrecision: false,
      },
      source: "backend",
      requestId: "req-backend-flags",
    });
  });

  it("falls back to defaults when get_feature_flags_v1 invocation fails", async () => {
    invokeMock.mockRejectedValueOnce("backend offline");

    const resolved = await resolveFeatureFlagsV1();

    expect(resolved.flags).toEqual(DEFAULT_FEATURE_FLAGS);
    expect(resolved.source).toBe("fallback");
    expect(resolved.requestId).toMatch(/^req-client-/);
    expect(resolved.warning).toContain("IPC_INVOKE_FAILED");
  });

  it("throws a typed command error when a feature path is disabled", () => {
    expect(() =>
      ensureFeatureEnabledV1(
        {
          simulation: false,
          importExport: true,
          advancedPrecision: true,
        },
        "simulation",
        "req-disabled-feature",
      ),
    ).toThrowError(
      expect.objectContaining({
        version: IPC_CONTRACT_VERSION_V1,
        requestId: "req-disabled-feature",
        category: "internal",
        code: "FEATURE_DISABLED",
      }),
    );
  });
});
