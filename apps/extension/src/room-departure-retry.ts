import {
  ActiveRoomRecoveryRequestSchema,
  MAX_PARTICIPANT_ID_CHARS,
  RoomDepartureRequestSchema,
} from "@anidachi/protocol";
import { storage } from "wxt/utils/storage";
import { getStoredAuthTokens } from "./auth-tokens";
import {
  departExactRoomSession,
  type RoomTabDepartureOutcome,
} from "./room-departure";

export const ROOM_DEPARTURE_RETRY_ALARM = "anidachi-room-departure-retry-v1";
const ROOM_DEPARTURE_RETRY_STORAGE_KEY =
  "local:anidachi.roomDepartureRetries.v1" as const;
const INITIAL_RETRY_DELAY_MS = 30_000;
const AUTH_RECHECK_DELAY_MS = 5 * 60_000;
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
] as const;

export type RoomDepartureRetryIdentity = {
  roomId: string;
  ownerUserId: string;
  participantSessionId: string;
};

type RoomDepartureRetryJob = RoomDepartureRetryIdentity & {
  attempts: number;
  createdAt: number;
  nextAttemptAt: number;
};

type RoomDepartureRetryState = {
  version: 1;
  jobs: RoomDepartureRetryJob[];
};

export interface RoomDepartureRetryStorage {
  read(): Promise<unknown>;
  write(value: RoomDepartureRetryState): Promise<void>;
  clear(): Promise<void>;
}

export interface RoomDepartureRetryScheduler {
  replace(when: number | null): Promise<void>;
}

export interface RoomDepartureRetryCoordinatorDependencies {
  storage: RoomDepartureRetryStorage;
  scheduler: RoomDepartureRetryScheduler;
  getCurrentUserId(): Promise<string | null>;
  departExact(
    identity: RoomDepartureRetryIdentity,
  ): Promise<RoomTabDepartureOutcome>;
  now(): number;
}

export interface RoomDepartureRetryCoordinator {
  enqueue(identity: RoomDepartureRetryIdentity): Promise<void>;
  drain(options?: { force?: boolean }): Promise<void>;
  handleAlarm(name: string): Promise<boolean>;
}

export function createRoomDepartureRetryCoordinator(
  dependencies: RoomDepartureRetryCoordinatorDependencies,
): RoomDepartureRetryCoordinator {
  let queue: Promise<void> = Promise.resolve();

  const runSerialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const persist = async (jobs: RoomDepartureRetryJob[]): Promise<void> => {
    if (jobs.length === 0) {
      await dependencies.storage.clear();
      return;
    }
    await dependencies.storage.write({ version: 1, jobs });
  };

  const schedule = async (jobs: RoomDepartureRetryJob[]): Promise<void> => {
    const nextAttemptAt = jobs.reduce<number | null>(
      (earliest, job) =>
        earliest === null || job.nextAttemptAt < earliest
          ? job.nextAttemptAt
          : earliest,
      null,
    );
    await dependencies.scheduler.replace(nextAttemptAt);
  };

  const enqueue = (identity: RoomDepartureRetryIdentity): Promise<void> =>
    runSerialized(async () => {
      const exact = normalizeIdentity(identity);
      if (!exact) throw new Error("Invalid exact room departure retry identity");
      const jobs = normalizeState(await dependencies.storage.read()).jobs;
      const duplicate = jobs.some((job) => sameIdentity(job, exact));
      if (!duplicate) {
        const now = safeNow(dependencies.now);
        jobs.push({
          ...exact,
          attempts: 0,
          createdAt: now,
          nextAttemptAt: now + INITIAL_RETRY_DELAY_MS,
        });
        await persist(jobs);
      }
      await schedule(jobs);
    });

  const drain = (options: { force?: boolean } = {}): Promise<void> =>
    runSerialized(async () => {
      const jobs = normalizeState(await dependencies.storage.read()).jobs;
      if (jobs.length === 0) {
        await dependencies.storage.clear();
        await dependencies.scheduler.replace(null);
        return;
      }

      const now = safeNow(dependencies.now);
      const currentUserId = await dependencies.getCurrentUserId().catch(() => null);
      for (let index = 0; index < jobs.length;) {
        const job = jobs[index];
        if (!job) break;
        if (!options.force && job.nextAttemptAt > now) {
          index += 1;
          continue;
        }

        if (!currentUserId || currentUserId !== job.ownerUserId) {
          jobs[index] = {
            ...job,
            nextAttemptAt: now + AUTH_RECHECK_DELAY_MS,
          };
          await persist(jobs);
          index += 1;
          continue;
        }

        const outcome = await dependencies.departExact({
          roomId: job.roomId,
          ownerUserId: job.ownerUserId,
          participantSessionId: job.participantSessionId,
        }).catch(() => "failed" as const);
        if (isTerminalRetryOutcome(outcome)) {
          jobs.splice(index, 1);
          await persist(jobs);
          continue;
        }

        const attempts = job.attempts + 1;
        jobs[index] = {
          ...job,
          attempts,
          nextAttemptAt: now + retryDelay(attempts),
        };
        await persist(jobs);
        index += 1;
      }

      await schedule(jobs);
    });

  return {
    enqueue,
    drain,
    async handleAlarm(name) {
      if (name !== ROOM_DEPARTURE_RETRY_ALARM) return false;
      await drain();
      return true;
    },
  };
}

const defaultRoomDepartureRetryCoordinator =
  createRoomDepartureRetryCoordinator({
    storage: {
      read: () => storage.getItem<unknown>(ROOM_DEPARTURE_RETRY_STORAGE_KEY),
      write: (value) => storage.setItem(ROOM_DEPARTURE_RETRY_STORAGE_KEY, value),
      clear: () => storage.removeItem(ROOM_DEPARTURE_RETRY_STORAGE_KEY),
    },
    scheduler: {
      async replace(when) {
        if (when === null) {
          await chrome.alarms.clear(ROOM_DEPARTURE_RETRY_ALARM);
          return;
        }
        await chrome.alarms.create(ROOM_DEPARTURE_RETRY_ALARM, { when });
      },
    },
    async getCurrentUserId() {
      return (await getStoredAuthTokens())?.user.id ?? null;
    },
    departExact(identity) {
      return departExactRoomSession({
        version: 1,
        revision: 1,
        ...identity,
        cameraEnabled: false,
        voiceMode: "push-to-talk",
      });
    },
    now: () => Date.now(),
  });

export function enqueueRoomDepartureRetry(
  identity: RoomDepartureRetryIdentity,
): Promise<void> {
  return defaultRoomDepartureRetryCoordinator.enqueue(identity);
}

export function drainRoomDepartureRetries(options?: {
  force?: boolean;
}): Promise<void> {
  return defaultRoomDepartureRetryCoordinator.drain(options);
}

export function handleRoomDepartureRetryAlarm(name: string): Promise<boolean> {
  return defaultRoomDepartureRetryCoordinator.handleAlarm(name);
}

export function isRoomDepartureRetryAlarm(name: string): boolean {
  return name === ROOM_DEPARTURE_RETRY_ALARM;
}

function normalizeState(value: unknown): RoomDepartureRetryState {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.jobs)) {
    return { version: 1, jobs: [] };
  }
  const jobs: RoomDepartureRetryJob[] = [];
  for (const valueJob of value.jobs) {
    const job = normalizeJob(valueJob);
    if (!job) continue;
    const duplicate = jobs.find((current) => sameIdentity(current, job));
    if (!duplicate) {
      jobs.push(job);
      continue;
    }
    duplicate.attempts = Math.max(duplicate.attempts, job.attempts);
    duplicate.createdAt = Math.min(duplicate.createdAt, job.createdAt);
    duplicate.nextAttemptAt = Math.min(
      duplicate.nextAttemptAt,
      job.nextAttemptAt,
    );
  }
  return { version: 1, jobs };
}

function normalizeJob(value: unknown): RoomDepartureRetryJob | null {
  if (!isObject(value)) return null;
  const identity = normalizeIdentity(value);
  if (
    !identity ||
    !Number.isSafeInteger(value.attempts) ||
    (value.attempts as number) < 0 ||
    !isSafeTimestamp(value.createdAt) ||
    !isSafeTimestamp(value.nextAttemptAt)
  ) {
    return null;
  }
  return {
    ...identity,
    attempts: value.attempts as number,
    createdAt: value.createdAt as number,
    nextAttemptAt: value.nextAttemptAt as number,
  };
}

function normalizeIdentity(value: unknown): RoomDepartureRetryIdentity | null {
  if (!isObject(value)) return null;
  if (
    !ActiveRoomRecoveryRequestSchema.safeParse({ roomId: value.roomId }).success ||
    !RoomDepartureRequestSchema.safeParse({
      participantSessionId: value.participantSessionId,
    }).success ||
    typeof value.ownerUserId !== "string" ||
    value.ownerUserId.length < 1 ||
    value.ownerUserId.length > MAX_PARTICIPANT_ID_CHARS
  ) {
    return null;
  }
  return {
    roomId: value.roomId as string,
    ownerUserId: value.ownerUserId,
    participantSessionId: value.participantSessionId as string,
  };
}

function sameIdentity(
  left: RoomDepartureRetryIdentity,
  right: RoomDepartureRetryIdentity,
): boolean {
  return left.roomId === right.roomId &&
    left.ownerUserId === right.ownerUserId &&
    left.participantSessionId === right.participantSessionId;
}

function isTerminalRetryOutcome(outcome: RoomTabDepartureOutcome): boolean {
  return outcome === "departed" ||
    outcome === "room_ended" ||
    outcome === "already_departed" ||
    outcome === "stale" ||
    outcome === "active-room-changed";
}

function retryDelay(attempts: number): number {
  const index = Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[Math.max(0, index)] ?? RETRY_DELAYS_MS[0];
}

function safeNow(now: () => number): number {
  const value = now();
  return Number.isSafeInteger(value) && value >= 0 ? value : Date.now();
}

function isSafeTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
