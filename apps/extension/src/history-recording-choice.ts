import { AUTH_TOKENS_STORAGE_KEY, getStoredAuthTokens } from "./auth-tokens";

let contextRevision = 0;
let changeSource: typeof chrome.storage.onChanged | undefined;
const contextChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
  if (area === "local" && (changes[AUTH_TOKENS_STORAGE_KEY] || Object.keys(changes).some((key) => key.startsWith("anidachi.historyRecordingChoice:")))) ++contextRevision;
};

// Captured before asynchronous work, checked synchronously at dispatch. Covers
// revoke/re-enable and account changes while a storage/session read is pending.
export function historyRecordingContextRevision(): number {
  const source = globalThis.chrome?.storage?.onChanged;
  if (source && source !== changeSource) {
    changeSource?.removeListener(contextChanged);
    source.addListener(contextChanged);
    changeSource = source;
    ++contextRevision;
  }
  return contextRevision;
}

export const HISTORY_RECORDING_NOTICE_VERSION = 1;
export type HistoryRecordingChoice = {
  version: typeof HISTORY_RECORDING_NOTICE_VERSION;
  ownerUserId: string;
  enabled: boolean;
  updatedAt: number;
};

export function historyRecordingChoiceKey(ownerUserId: string): string {
  return `anidachi.historyRecordingChoice:${encodeURIComponent(ownerUserId)}`;
}

export function parseHistoryRecordingChoice(value: unknown, ownerUserId: string): HistoryRecordingChoice | null {
  if (!value || typeof value !== "object") return null;
  const choice = value as Partial<HistoryRecordingChoice>;
  if (choice.version !== HISTORY_RECORDING_NOTICE_VERSION || choice.ownerUserId !== ownerUserId ||
    typeof choice.enabled !== "boolean" || typeof choice.updatedAt !== "number" ||
    !Number.isFinite(choice.updatedAt) || choice.updatedAt <= 0) return null;
  return choice as HistoryRecordingChoice;
}

export async function readHistoryRecordingChoice(ownerUserId: string): Promise<HistoryRecordingChoice | null> {
  const key = historyRecordingChoiceKey(ownerUserId);
  const stored = await chrome.storage.local.get(key);
  return parseHistoryRecordingChoice(stored[key], ownerUserId);
}

export async function hasHistoryRecordingConsent(ownerUserId: string): Promise<boolean> {
  try {
    return (await readHistoryRecordingChoice(ownerUserId))?.enabled === true;
  } catch {
    return false;
  }
}

// Called only by the extension's explicit UI action. An old account's in-flight
// click can never grant permission to the account that replaced it.
export async function setHistoryRecordingChoice(ownerUserId: string, enabled: boolean): Promise<void> {
  if ((await getStoredAuthTokens())?.user.id !== ownerUserId) throw new Error("Your account changed. Please try again.");
  const choice: HistoryRecordingChoice = {
    version: HISTORY_RECORDING_NOTICE_VERSION, ownerUserId, enabled, updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ [historyRecordingChoiceKey(ownerUserId)]: choice });
}

export function subscribeHistoryRecordingChoice(ownerUserId: string, onChange: () => void): () => void {
  const key = historyRecordingChoiceKey(ownerUserId);
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes[key]) onChange();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
