const RUN_HISTORY_STORAGE_KEY = "prompt-please-run-history-v1";

interface RunHistoryRecord {
  deathCount: number;
  lastRecordedFailureRunId: string | null;
}

function getDefaultRunHistory(): RunHistoryRecord {
  return {
    deathCount: 0,
    lastRecordedFailureRunId: null,
  };
}

function canUseLocalStorage() {
  return typeof globalThis !== "undefined" && "localStorage" in globalThis;
}

function readRunHistory(): RunHistoryRecord {
  if (!canUseLocalStorage()) {
    return getDefaultRunHistory();
  }

  try {
    const rawValue = globalThis.localStorage.getItem(RUN_HISTORY_STORAGE_KEY);

    if (!rawValue) {
      return getDefaultRunHistory();
    }

    const parsedValue = JSON.parse(rawValue) as Partial<RunHistoryRecord>;

    return {
      deathCount: Math.max(0, Math.floor(parsedValue.deathCount ?? 0)),
      lastRecordedFailureRunId:
        typeof parsedValue.lastRecordedFailureRunId === "string"
          ? parsedValue.lastRecordedFailureRunId
          : null,
    };
  } catch {
    return getDefaultRunHistory();
  }
}

function writeRunHistory(record: RunHistoryRecord) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    globalThis.localStorage.setItem(
      RUN_HISTORY_STORAGE_KEY,
      JSON.stringify(record),
    );
  } catch {
    // Ignore storage write failures and keep the current session playable.
  }
}

export function getPersistentDeathCount() {
  return readRunHistory().deathCount;
}

export function recordPersistentDeath(runId: string) {
  const currentHistory = readRunHistory();

  if (currentHistory.lastRecordedFailureRunId === runId) {
    return currentHistory.deathCount;
  }

  const nextHistory: RunHistoryRecord = {
    deathCount: currentHistory.deathCount + 1,
    lastRecordedFailureRunId: runId,
  };

  writeRunHistory(nextHistory);

  return nextHistory.deathCount;
}
