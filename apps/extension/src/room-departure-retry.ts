import {
  ActiveRoomRecoveryRequestSchema,
  MAX_PARTICIPANT_ID_CHARS,
  ROOM_CONNECT_ROUTE_MAX_DURATION_SECONDS,
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
const ADMISSION_SETTLEMENT_MARGIN_MS = 15_000;
/**
 * The connect route has a shared 60-second execution cap. Starting this
 * horizon at cancellation and adding 15 seconds of transport/scheduler margin
 * means an orphaned MV3 worker cannot declare `stale` terminal while that
 * canceled request can still commit.
 */
export const ROOM_ADMISSION_SETTLEMENT_HORIZON_MS =
  ROOM_CONNECT_ROUTE_MAX_DURATION_SECONDS * 1_000 +
  ADMISSION_SETTLEMENT_MARGIN_MS;
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
  admissionState: "may-commit" | "settled";
  attempts: number;
  createdAt: number;
  nextAttemptAt: number;
  settleAfter: number;
};

type RoomDepartureRetryState = {
  version: 2;
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
  persistAdmissionIntent(identity: RoomDepartureRetryIdentity): Promise<void>;
  settleAdmission(
    identity: RoomDepartureRetryIdentity,
  ): Promise<RoomTabDepartureOutcome>;
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
    await dependencies.storage.write({ version: 2, jobs });
  };

  const schedule = async (jobs: RoomDepartureRetryJob[]): Promise<void> => {
    await dependencies.scheduler.replace(earliestAttempt(jobs));
  };

  const scheduleForAccount = async (
    jobs: RoomDepartureRetryJob[],
    currentUserId: string | null,
  ): Promise<void> => {
    if (!currentUserId) {
      await dependencies.scheduler.replace(null);
      return;
    }
    await dependencies.scheduler.replace(
      earliestAttempt(jobs.filter((job) => job.ownerUserId === currentUserId)),
    );
  };

  const persistAdmissionIntent = (
    identity: RoomDepartureRetryIdentity,
  ): Promise<void> =>
    runSerialized(async () => {
      const exact = requireIdentity(identity);
      const jobs = normalizeState(await dependencies.storage.read()).jobs;
      if (!jobs.some((job) => sameIdentity(job, exact))) {
        const now = safeNow(dependencies.now);
        jobs.push({
          ...exact,
          admissionState: "may-commit",
          attempts: 0,
          createdAt: now,
          nextAttemptAt: now + INITIAL_RETRY_DELAY_MS,
          settleAfter: now + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS,
        });
        await persist(jobs);
      }
      await schedule(jobs);
    });

  const settleAdmission = (
    identity: RoomDepartureRetryIdentity,
  ): Promise<RoomTabDepartureOutcome> =>
    runSerialized(async () => {
      const exact = requireIdentity(identity);
      const now = safeNow(dependencies.now);
      const jobs = normalizeState(await dependencies.storage.read()).jobs;
      let index = jobs.findIndex((job) => sameIdentity(job, exact));
      if (index < 0) {
        jobs.push({
          ...exact,
          admissionState: "settled",
          attempts: 0,
          createdAt: now,
          nextAttemptAt: now,
          settleAfter: now,
        });
        index = jobs.length - 1;
      } else {
        const job = jobs[index];
        if (job) {
          jobs[index] = {
            ...job,
            admissionState: "settled",
            nextAttemptAt: now,
          };
        }
      }

      // Persist the settlement transition before any auth or network await.
      await persist(jobs);
      const currentUserId = await dependencies.getCurrentUserId().catch(() => null);
      if (!currentUserId || currentUserId !== exact.ownerUserId) {
        await scheduleForAccount(jobs, currentUserId);
        return currentUserId ? "account-changed" : "no-auth";
      }

      const outcome = await dependencies.departExact(exact).catch(
        () => "failed" as const,
      );
      const job = jobs[index];
      if (!job) return outcome;
      if (isTerminalRetryOutcome(outcome)) {
        jobs.splice(index, 1);
      } else {
        jobs[index] = retryJob(job, now);
      }
      await persist(jobs);
      await scheduleForAccount(jobs, currentUserId);
      return outcome;
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
        let job = jobs[index];
        if (!job) break;
        if (!options.force && job.nextAttemptAt > now) {
          index += 1;
          continue;
        }
        if (!currentUserId || currentUserId !== job.ownerUserId) {
          index += 1;
          continue;
        }

        if (job.admissionState === "may-commit" && now >= job.settleAfter) {
          job = { ...job, admissionState: "settled" };
          jobs[index] = job;
          await persist(jobs);
        }

        const outcome = await dependencies.departExact(exactIdentity(job)).catch(
          () => "failed" as const,
        );
        if (
          job.admissionState === "settled" &&
          isTerminalRetryOutcome(outcome)
        ) {
          jobs.splice(index, 1);
          await persist(jobs);
          continue;
        }

        jobs[index] = retryJob(job, now);
        await persist(jobs);
        index += 1;
      }

      await scheduleForAccount(jobs, currentUserId);
    });

  return {
    persistAdmissionIntent,
    settleAdmission,
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

export function persistRoomDepartureAdmissionIntent(
  identity: RoomDepartureRetryIdentity,
): Promise<void> {
  return defaultRoomDepartureRetryCoordinator.persistAdmissionIntent(identity);
}

export function settleRoomDepartureAdmission(
  identity: RoomDepartureRetryIdentity,
): Promise<RoomTabDepartureOutcome> {
  return defaultRoomDepartureRetryCoordinator.settleAdmission(identity);
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
  if (!isObject(value) || !Array.isArray(value.jobs)) {
    return { version: 2, jobs: [] };
  }
  const legacy = value.version === 1;
  if (!legacy && value.version !== 2) return { version: 2, jobs: [] };

  const jobs: RoomDepartureRetryJob[] = [];
  for (const valueJob of value.jobs) {
    const job = normalizeJob(valueJob, legacy);
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
    duplicate.settleAfter = Math.max(duplicate.settleAfter, job.settleAfter);
    if (job.admissionState === "settled") duplicate.admissionState = "settled";
  }
  return { version: 2, jobs };
}

function normalizeJob(
  value: unknown,
  legacy: boolean,
): RoomDepartureRetryJob | null {
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
  if (legacy) {
    return {
      ...identity,
      admissionState: "settled",
      attempts: value.attempts as number,
      createdAt: value.createdAt as number,
      nextAttemptAt: value.nextAttemptAt as number,
      settleAfter: value.createdAt as number,
    };
  }
  if (
    (value.admissionState !== "may-commit" &&
      value.admissionState !== "settled") ||
    !isSafeTimestamp(value.settleAfter)
  ) {
    return null;
  }
  return {
    ...identity,
    admissionState: value.admissionState,
    attempts: value.attempts as number,
    createdAt: value.createdAt as number,
    nextAttemptAt: value.nextAttemptAt as number,
    settleAfter: value.settleAfter,
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

function requireIdentity(value: unknown): RoomDepartureRetryIdentity {
  const identity = normalizeIdentity(value);
  if (!identity) throw new Error("Invalid exact room departure retry identity");
  return identity;
}

function exactIdentity(job: RoomDepartureRetryJob): RoomDepartureRetryIdentity {
  return {
    roomId: job.roomId,
    ownerUserId: job.ownerUserId,
    participantSessionId: job.participantSessionId,
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

function retryJob(
  job: RoomDepartureRetryJob,
  now: number,
): RoomDepartureRetryJob {
  const attempts = job.attempts + 1;
  const delayed = now + retryDelay(attempts);
  return {
    ...job,
    attempts,
    nextAttemptAt:
      job.admissionState === "may-commit" && job.settleAfter > now
        ? Math.min(delayed, job.settleAfter)
        : delayed,
  };
}

function retryDelay(attempts: number): number {
  const index = Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[Math.max(0, index)] ?? RETRY_DELAYS_MS[0];
}

function earliestAttempt(jobs: RoomDepartureRetryJob[]): number | null {
  return jobs.reduce<number | null>(
    (earliest, job) =>
      earliest === null || job.nextAttemptAt < earliest
        ? job.nextAttemptAt
        : earliest,
    null,
  );
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
