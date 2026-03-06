import { GAS_MEDIA_V1, type GasMediumV1 } from "../../shared/contracts/ipc/v1";
import type { EnvironmentStepSnapshot } from "../environment/rewind";

const ENVIRONMENT_REWIND_STACK_STORAGE_KEY = "chemystery.environment.rewind.v1";
const MAX_SCENARIO_HISTORY_ENTRIES = 100;

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseGasMediumFromStorage(value: unknown): GasMediumV1 | null {
  if (typeof value !== "string") {
    return null;
  }
  return GAS_MEDIA_V1.includes(value as GasMediumV1) ? (value as GasMediumV1) : null;
}

function parseEnvironmentStepSnapshot(candidate: unknown): EnvironmentStepSnapshot | null {
  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const gasMedium = parseGasMediumFromStorage(record.gasMedium);
  if (gasMedium === null) {
    return null;
  }
  if (!isNullableFiniteNumber(record.temperatureC) || !isNullableFiniteNumber(record.pressureAtm)) {
    return null;
  }

  return {
    temperatureC: record.temperatureC,
    pressureAtm: record.pressureAtm,
    gasMedium,
  };
}

export function parseEnvironmentRewindStackFromStorageValue(
  rawValue: string | null,
): ReadonlyArray<EnvironmentStepSnapshot> {
  if (rawValue === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries: EnvironmentStepSnapshot[] = [];
    for (const candidate of parsed) {
      const snapshot = parseEnvironmentStepSnapshot(candidate);
      if (snapshot === null) {
        continue;
      }

      entries.push(snapshot);
      if (entries.length >= MAX_SCENARIO_HISTORY_ENTRIES) {
        break;
      }
    }

    return entries;
  } catch {
    return [];
  }
}

export function readStoredEnvironmentRewindStack(): ReadonlyArray<EnvironmentStepSnapshot> {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return parseEnvironmentRewindStackFromStorageValue(
      window.localStorage.getItem(ENVIRONMENT_REWIND_STACK_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

export function persistEnvironmentRewindStack(
  entries: ReadonlyArray<EnvironmentStepSnapshot>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ENVIRONMENT_REWIND_STACK_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore localStorage failures to keep UI interactive.
  }
}
