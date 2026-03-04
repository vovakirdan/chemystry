import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  greetV1,
  healthV1,
  isCommandErrorV1,
  normalizeCommandErrorV1,
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
});
