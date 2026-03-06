import type { ScenarioHistoryEntry } from "../../features/right-panel/RightPanelSkeleton";

const SCENARIO_HISTORY_STORAGE_KEY = "chemystery.scenario.history.v1";
const MAX_SCENARIO_HISTORY_ENTRIES = 100;
const GENERATED_SCENARIO_NAME_SUFFIX_PATTERN = /\s\[\d{10,}\]$/;

function createScenarioHistoryId(): string {
  return `history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendScenarioHistoryEntry(
  currentEntries: ReadonlyArray<ScenarioHistoryEntry>,
  entry: Omit<ScenarioHistoryEntry, "id">,
): ReadonlyArray<ScenarioHistoryEntry> {
  const nextEntry: ScenarioHistoryEntry = {
    ...entry,
    id: createScenarioHistoryId(),
  };
  const nextEntries = [nextEntry, ...currentEntries];
  return nextEntries.slice(0, MAX_SCENARIO_HISTORY_ENTRIES);
}

export function stripGeneratedScenarioNameSuffix(name: string): string {
  let normalized = name.trim();
  while (GENERATED_SCENARIO_NAME_SUFFIX_PATTERN.test(normalized)) {
    normalized = normalized.replace(GENERATED_SCENARIO_NAME_SUFFIX_PATTERN, "").trim();
  }
  return normalized;
}

export function parseScenarioHistoryFromStorageValue(
  rawValue: string | null,
): ReadonlyArray<ScenarioHistoryEntry> {
  if (rawValue === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries: ScenarioHistoryEntry[] = [];
    for (const candidate of parsed) {
      if (candidate === null || typeof candidate !== "object") {
        continue;
      }

      const record = candidate as Record<string, unknown>;
      if (
        typeof record.id !== "string" ||
        typeof record.timestampLabel !== "string" ||
        record.category !== "environment" ||
        typeof record.message !== "string"
      ) {
        continue;
      }

      entries.push({
        id: record.id,
        timestampLabel: record.timestampLabel,
        category: "environment",
        message: record.message,
      });

      if (entries.length >= MAX_SCENARIO_HISTORY_ENTRIES) {
        break;
      }
    }

    return entries;
  } catch {
    return [];
  }
}

export function readStoredScenarioHistory(): ReadonlyArray<ScenarioHistoryEntry> {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return parseScenarioHistoryFromStorageValue(
      window.localStorage.getItem(SCENARIO_HISTORY_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

export function persistScenarioHistory(entries: ReadonlyArray<ScenarioHistoryEntry>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SCENARIO_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore localStorage failures to keep UI interactive.
  }
}
