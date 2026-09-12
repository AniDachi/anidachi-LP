import { storage } from "wxt/utils/storage";
import { getStoredAuthTokens } from "./auth-tokens";

const RETRY_KEY = "local:anidachi.roomInviteNotifications.retry.v1" as const;
export const ROOM_INVITE_NOTIFICATION_RETRY_ALARM = "anidachi-room-invite-notifications-retry";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;
type Lane = "inbox" | "subscription";

export type NotificationRetryIntent = {
  id: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  notify: boolean;
};
type RetryRecord = {
  userId: string;
  inbox?: NotificationRetryIntent;
  subscription?: NotificationRetryIntent;
};

// The two runtime lanes share storage but not completion. Serialize their short
// read/modify/write operations; never hold this lock across HTTP or browser push.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.catch(() => undefined).then(work);
  queue = run;
  return run;
}

function normalizeIntent(value: unknown): NotificationRetryIntent | undefined {
  if (!value || typeof value !== "object") return;
  const intent = value as Partial<NotificationRetryIntent>;
  if (
    typeof intent.id !== "string" || !intent.id ||
    typeof intent.createdAt !== "number" || !Number.isFinite(intent.createdAt) ||
    typeof intent.nextAttemptAt !== "number" || !Number.isFinite(intent.nextAttemptAt) ||
    typeof intent.attempts !== "number" || !Number.isInteger(intent.attempts) ||
    intent.attempts < 0 || intent.attempts > MAX_ATTEMPTS ||
    typeof intent.notify !== "boolean"
  ) return;
  return intent as NotificationRetryIntent;
}

async function readRecord(): Promise<RetryRecord | null> {
  const value = await storage.getItem<RetryRecord>(RETRY_KEY);
  if (!value || typeof value.userId !== "string") return null;
  return {
    userId: value.userId,
    inbox: normalizeIntent(value.inbox),
    subscription: normalizeIntent(value.subscription),
  };
}

function expired(intent: NotificationRetryIntent): boolean {
  return Date.now() - intent.createdAt >= MAX_AGE_MS || intent.createdAt > Date.now();
}

async function saveRecord(record: RetryRecord | null): Promise<void> {
  if (!record?.inbox && !record?.subscription) {
    await storage.removeItem(RETRY_KEY);
    await chrome.alarms.clear(ROOM_INVITE_NOTIFICATION_RETRY_ALARM);
    return;
  }
  await storage.setItem(RETRY_KEY, record);
  const next = Math.min(...[record.inbox, record.subscription]
    .filter((intent): intent is NotificationRetryIntent => Boolean(intent))
    .map((intent) => Math.min(intent.nextAttemptAt, intent.createdAt + MAX_AGE_MS)));
  await chrome.alarms.create(ROOM_INVITE_NOTIFICATION_RETRY_ALARM, {
    when: Math.max(Date.now() + 1_000, next),
  });
}

function newIntent(notify: boolean): NotificationRetryIntent {
  return { id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0,
    nextAttemptAt: Date.now() + 30_000, notify };
}

export function beginNotificationRetry(userId: string, notify: boolean): Promise<boolean> {
  return serialized(async () => {
    if ((await getStoredAuthTokens())?.user.id !== userId) return false;
    const stored = await readRecord();
    const record: RetryRecord = stored?.userId === userId ? stored : { userId };
    // A new external invalidation owns a fresh revision. An older completion
    // must not erase it, and a silent refresh must not demote a pending alert.
    record.inbox = newIntent(notify || Boolean(record.inbox && !expired(record.inbox) && record.inbox.notify));
    if (!record.subscription || expired(record.subscription) || record.subscription.attempts >= MAX_ATTEMPTS) {
      record.subscription = newIntent(false);
    }
    await saveRecord(record);
    return true;
  });
}

export function claimNotificationRetry(
  userId: string,
  lane: Lane,
  dueOnly: boolean,
): Promise<NotificationRetryIntent | null> {
  return serialized(async () => {
    const record = await readRecord();
    if (record?.userId !== userId || (await getStoredAuthTokens())?.user.id !== userId) return null;
    const intent = record[lane];
    if (!intent) return null;
    if (expired(intent) || intent.attempts >= MAX_ATTEMPTS) {
      delete record[lane];
      await saveRecord(record);
      return null;
    }
    if (dueOnly && intent.nextAttemptAt > Date.now()) return null;
    const claimed = { ...intent, attempts: intent.attempts + 1,
      nextAttemptAt: Date.now() + Math.min(30_000 * 2 ** intent.attempts, 3_600_000) };
    record[lane] = claimed;
    // Persist both the attempt budget and its one-shot wakeup before side effects.
    await saveRecord(record);
    return claimed;
  });
}

export function completeNotificationRetry(userId: string, lane: Lane, id: string): Promise<void> {
  return serialized(async () => {
    const record = await readRecord();
    if (record?.userId !== userId || record[lane]?.id !== id) return;
    delete record[lane];
    await saveRecord(record);
  });
}

export function clearNotificationRetryAccount(userId: string): Promise<void> {
  return serialized(async () => {
    if ((await readRecord())?.userId === userId) await saveRecord(null);
  });
}

// Called after worker recreation as well as online/alarm events. Only current
// account work survives. Re-arming never resets its age, attempts or alert flag.
export function restoreNotificationRetryRecord(): Promise<RetryRecord | null> {
  return serialized(async () => {
    const record = await readRecord();
    const userId = (await getStoredAuthTokens())?.user.id;
    if (!record || record.userId !== userId) {
      await saveRecord(null);
      return null;
    }
    for (const lane of ["inbox", "subscription"] as const) {
      const intent = record[lane];
      if (intent && (expired(intent) || intent.attempts >= MAX_ATTEMPTS)) delete record[lane];
    }
    await saveRecord(record);
    return record.inbox || record.subscription ? record : null;
  });
}
