import {
  IPC_CONTRACT_VERSION_V1,
  type ListScenariosV1Output,
  type LoadScenarioV1Output,
  type SaveScenarioV1Output,
} from "../../v1";

import { createInvalidScenarioPayloadError } from "../errors";
import { isRecord, readFirstDefined } from "../guards";
import { nextClientRequestId } from "../requestId";
import { parseScenarioPayloadV1 } from "./scenarioPayload";
import { parseScenarioSummaryV1 } from "./scenarioSummary";

export { parseScenarioPayloadV1, parseScenarioSummaryV1 };

export function parseListScenariosV1Output(payload: unknown): ListScenariosV1Output {
  if (!isRecord(payload)) {
    throw createInvalidScenarioPayloadError("Scenario list payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidScenarioPayloadError("Scenario list payload version is invalid.", requestId);
  }

  if (!Array.isArray(payload.scenarios)) {
    throw createInvalidScenarioPayloadError(
      "Scenario list payload is missing scenarios list.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    scenarios: payload.scenarios.map((scenario, index) =>
      parseScenarioSummaryV1(scenario, requestId, `at index ${index.toString()}`),
    ),
  };
}

export function parseSaveScenarioV1Output(payload: unknown): SaveScenarioV1Output {
  if (!isRecord(payload)) {
    throw createInvalidScenarioPayloadError("Save scenario payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidScenarioPayloadError("Save scenario payload version is invalid.", requestId);
  }

  const scenarioId = readFirstDefined(payload, ["scenarioId", "scenario_id", "id"]);
  const scenarioName = readFirstDefined(payload, ["scenarioName", "scenario_name", "name"]);
  const createdAt = readFirstDefined(payload, ["createdAt", "created_at"]);
  const updatedAt = readFirstDefined(payload, ["updatedAt", "updated_at"]);

  if (typeof payload.updated !== "boolean") {
    throw createInvalidScenarioPayloadError(
      "Save scenario payload is missing updated flag.",
      requestId,
    );
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    scenario: parseScenarioSummaryV1(
      {
        id: scenarioId,
        name: scenarioName,
        createdAt,
        updatedAt: updatedAt ?? createdAt,
      },
      requestId,
      "in save output",
    ),
    updated: payload.updated,
  };
}

export function parseLoadScenarioV1Output(payload: unknown): LoadScenarioV1Output {
  if (!isRecord(payload)) {
    throw createInvalidScenarioPayloadError("Load scenario payload is not an object.");
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId : nextClientRequestId();
  if (payload.version !== IPC_CONTRACT_VERSION_V1) {
    throw createInvalidScenarioPayloadError("Load scenario payload version is invalid.", requestId);
  }

  return {
    version: IPC_CONTRACT_VERSION_V1,
    requestId,
    scenarioId: (() => {
      const scenarioId = readFirstDefined(payload, ["scenarioId", "scenario_id", "id"]);
      if (typeof scenarioId !== "string" || scenarioId.trim().length === 0) {
        throw createInvalidScenarioPayloadError(
          "Load scenario payload is missing a valid scenarioId.",
          requestId,
        );
      }
      return scenarioId.trim();
    })(),
    scenarioName: (() => {
      const scenarioName = readFirstDefined(payload, ["scenarioName", "scenario_name", "name"]);
      if (typeof scenarioName !== "string" || scenarioName.trim().length === 0) {
        throw createInvalidScenarioPayloadError(
          "Load scenario payload is missing a valid scenarioName.",
          requestId,
        );
      }
      return scenarioName.trim();
    })(),
    payload: parseScenarioPayloadV1(payload, requestId),
  };
}
