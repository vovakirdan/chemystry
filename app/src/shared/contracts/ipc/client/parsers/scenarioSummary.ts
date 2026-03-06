import { type ScenarioSummaryV1 } from "../../v1";

import { createInvalidScenarioPayloadError } from "../errors";
import { isRecord, readFirstDefined } from "../guards";

export function parseScenarioSummaryV1(
  candidate: unknown,
  requestId: string,
  context: string,
): ScenarioSummaryV1 {
  if (!isRecord(candidate)) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary ${context} is not an object.`,
      requestId,
    );
  }

  const id = candidate.id;
  const name = candidate.name;
  const createdAt = readFirstDefined(candidate, ["createdAt", "created_at"]);
  const updatedAt = readFirstDefined(candidate, ["updatedAt", "updated_at"]);

  if (typeof id !== "string" || id.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary ${context} is missing a valid id.`,
      requestId,
    );
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary "${id}" is missing a valid name.`,
      requestId,
    );
  }

  if (typeof createdAt !== "string" || createdAt.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary "${id}" is missing a valid createdAt.`,
      requestId,
    );
  }

  const resolvedUpdatedAt = updatedAt === undefined || updatedAt === null ? createdAt : updatedAt;
  if (typeof resolvedUpdatedAt !== "string" || resolvedUpdatedAt.trim().length === 0) {
    throw createInvalidScenarioPayloadError(
      `Scenario summary "${id}" is missing a valid updatedAt.`,
      requestId,
    );
  }

  return {
    id: id.trim(),
    name: name.trim(),
    createdAt: createdAt.trim(),
    updatedAt: resolvedUpdatedAt.trim(),
  };
}
