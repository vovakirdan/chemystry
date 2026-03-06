import type { FeatureFlags } from "../../../config/featureFlags";
import {
  BUILDER_PARTICIPANT_ROLES_V1,
  CALCULATION_RESULT_TYPES_V1,
  GAS_MEDIA_V1,
  PRECISION_PROFILES_V1,
  REACTION_CLASSES_V1,
  SUBSTANCE_PHASES_V1,
  SUBSTANCE_SOURCES_V1,
  type BuilderParticipantRoleV1,
  type CalculationResultTypeV1,
  type GasMediumV1,
  type PrecisionProfileV1,
  type ReactionClassV1,
  type SubstancePhaseV1,
  type SubstanceSourceV1,
} from "../v1";

const SUBSTANCE_PHASE_SET_V1: ReadonlySet<SubstancePhaseV1> = new Set(SUBSTANCE_PHASES_V1);
const SUBSTANCE_SOURCE_SET_V1: ReadonlySet<SubstanceSourceV1> = new Set(SUBSTANCE_SOURCES_V1);
const REACTION_CLASS_SET_V1: ReadonlySet<ReactionClassV1> = new Set(REACTION_CLASSES_V1);
const BUILDER_PARTICIPANT_ROLE_SET_V1: ReadonlySet<BuilderParticipantRoleV1> = new Set(
  BUILDER_PARTICIPANT_ROLES_V1,
);
const GAS_MEDIUM_SET_V1: ReadonlySet<GasMediumV1> = new Set(GAS_MEDIA_V1);
const PRECISION_PROFILE_SET_V1: ReadonlySet<PrecisionProfileV1> = new Set(PRECISION_PROFILES_V1);
export const CALCULATION_RESULT_TYPE_SET_V1: ReadonlySet<CalculationResultTypeV1> = new Set(
  CALCULATION_RESULT_TYPES_V1,
);

export function isFeatureFlags(value: unknown): value is FeatureFlags {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FeatureFlags>;
  return (
    typeof candidate.simulation === "boolean" &&
    typeof candidate.importExport === "boolean" &&
    typeof candidate.advancedPrecision === "boolean"
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readFirstDefined(
  candidate: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): unknown {
  for (const key of keys) {
    if (candidate[key] !== undefined) {
      return candidate[key];
    }
  }

  return undefined;
}

export function parseSubstancePhaseV1(value: unknown): SubstancePhaseV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return SUBSTANCE_PHASE_SET_V1.has(value as SubstancePhaseV1) ? (value as SubstancePhaseV1) : null;
}

// Intent: backend payloads still emit both legacy `user_defined` and modern `user` aliases, so source parsing normalizes both before enum validation.
export function parseSubstanceSourceV1(value: unknown): SubstanceSourceV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedSource = value === "user_defined" ? "user" : value;
  return SUBSTANCE_SOURCE_SET_V1.has(normalizedSource as SubstanceSourceV1)
    ? (normalizedSource as SubstanceSourceV1)
    : null;
}

export function parseSubstanceMolarMassV1(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function parseReactionClassV1(value: unknown): ReactionClassV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return REACTION_CLASS_SET_V1.has(value as ReactionClassV1) ? (value as ReactionClassV1) : null;
}

export function parseBuilderParticipantRoleV1(value: unknown): BuilderParticipantRoleV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return BUILDER_PARTICIPANT_ROLE_SET_V1.has(value as BuilderParticipantRoleV1)
    ? (value as BuilderParticipantRoleV1)
    : null;
}

export function parsePrecisionProfileV1(value: unknown): PrecisionProfileV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return PRECISION_PROFILE_SET_V1.has(value as PrecisionProfileV1)
    ? (value as PrecisionProfileV1)
    : null;
}

export function parseGasMediumV1(value: unknown): GasMediumV1 | null {
  if (typeof value !== "string") {
    return null;
  }

  return GAS_MEDIUM_SET_V1.has(value as GasMediumV1) ? (value as GasMediumV1) : null;
}
