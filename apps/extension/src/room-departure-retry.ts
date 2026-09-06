import {
  ActiveRoomRecoveryRequestSchema,
  MAX_PARTICIPANT_ID_CHARS,
  ROOM_CONNECT_REQUEST_TIMEOUT_MS,
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
 * After Web admission succeeds, the overlay has one bounded minute to open the
 * room socket and receive its first authoritative ROOM_SNAPSHOT. This covers
 * the existing 45-second socket liveness timeout, the maximum 8-second overlay
 * reconnect delay, and 7 seconds of message/scheduler margin. A newer
 * preparation creates a fresh participantSessionId, so an expired handoff can
 * be cleaned exactly without touching a successor.
 */
export const ROOM_ADMISSION_HANDOFF_TIMEOUT_MS = 60_000;
/**
 * The client aborts admission after 60 seconds and the connect route has a
 * separate 60-second execution cap. Starting this combined bound at
 * admission start and adding 15 seconds of transport/scheduler margin means
 * an orphaned MV3 worker cannot declare `stale` terminal while that request
 * can still commit.
 */
export const ROOM_ADMISSION_SETTLEMENT_HORIZON_MS =
  ROOM_CONNECT_REQUEST_TIMEOUT_MS +
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

export type RoomDepartureRetryOperation = RoomDepartureRetryIdentity & {
  generation: number;
};

export function isRoomDepartureRetryOperation(
  value: unknown,
): value is RoomDepartureRetryOperation {
  try {
    requireOperation(value);
    return true;
  } catch {
    return false;
  }
}

export type RoomDepartureRetryAttemptOutcome =
  | RoomTabDepartureOutcome
  | "operation-superseded";

type RoomDepartureRetryJob = RoomDepartureRetryIdentity & {
  admissionState: "handoff-pending" | "may-commit" | "settled";
  attempts: number;
  cleanupRequested: boolean;
  createdAt: number;
  generation: number;
  nextAttemptAt: number;
  settleAfter: number;
};

type RoomDepartureRetryState = {
  version: 5;
  lastGeneration: number;
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
  renewAdmissionIntent(
    identity: RoomDepartureRetryIdentity,
  ): Promise<RoomDepartureRetryOperation>;
  requestAdmissionCleanup(
    operation: RoomDepartureRetryOperation,
  ): Promise<boolean>;
  markAdmissionHandoff(operation: RoomDepartureRetryOperation): Promise<boolean>;
  acknowledgeAdmissionHandoff(
    operation: RoomDepartureRetryOperation,
  ): Promise<boolean>;
  claimAdmissionHandoffCleanup(
    identity: RoomDepartureRetryIdentity,
  ): Promise<RoomDepartureRetryOperation | null>;
  retryAdmission(
    operation: RoomDepartureRetryOperation,
  ): Promise<RoomDepartureRetryAttemptOutcome>;
  settleAdmission(
    operation: RoomDepartureRetryOperation,
  ): Promise<RoomDepartureRetryAttemptOutcome>;
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

  const persist = async (state: RoomDepartureRetryState): Promise<void> => {
    if (state.jobs.length === 0 && state.lastGeneration === 0) {
      await dependencies.storage.clear();
      return;
    }
    await dependencies.storage.write(state);
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

  const renewAdmissionIntent = (
    identity: RoomDepartureRetryIdentity,
  ): Promise<RoomDepartureRetryOperation> =>
    runSerialized(async () => {
      const exact = requireIdentity(identity);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      const now = safeNow(dependencies.now);
      const index = jobs.findIndex((job) => sameIdentity(job, exact));
      if (state.lastGeneration >= Number.MAX_SAFE_INTEGER) {
        throw new Error("Room departure retry generation is exhausted");
      }
      const operation: RoomDepartureRetryOperation = {
        ...exact,
        generation: state.lastGeneration + 1,
      };
      state.lastGeneration = operation.generation;
      const renewed: RoomDepartureRetryJob = {
        ...operation,
        admissionState: "may-commit",
        attempts: 0,
        cleanupRequested: false,
        createdAt: now,
        nextAttemptAt: now + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS,
        settleAfter: now + ROOM_ADMISSION_SETTLEMENT_HORIZON_MS,
      };
      if (index < 0) jobs.push(renewed);
      else jobs[index] = renewed;
      await persist(state);
      await schedule(jobs);
      return operation;
    });

  const requestAdmissionCleanup = (
    operation: RoomDepartureRetryOperation,
  ): Promise<boolean> =>
    runSerialized(async () => {
      const exact = requireOperation(operation);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      const index = jobs.findIndex((job) => sameIdentity(job, exact));
      const current = jobs[index];
      if (!current || current.generation !== exact.generation) return false;
      if (!current.cleanupRequested) {
        const now = safeNow(dependencies.now);
        jobs[index] = {
          ...current,
          admissionState:
            current.admissionState === "handoff-pending"
              ? "settled"
              : current.admissionState,
          cleanupRequested: true,
          nextAttemptAt: Math.min(current.nextAttemptAt, now + INITIAL_RETRY_DELAY_MS),
        };
        await persist(state);
      }
      // Duplicate cancellation signals also repair a missing one-shot alarm
      // after a prior scheduler failure.
      await schedule(jobs);
      return true;
    });

  const markAdmissionHandoff = (
    operation: RoomDepartureRetryOperation,
  ): Promise<boolean> =>
    runSerialized(async () => {
      const exact = requireOperation(operation);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      const index = jobs.findIndex((job) => sameIdentity(job, exact));
      const current = jobs[index];
      if (
        !current ||
        current.generation !== exact.generation ||
        current.cleanupRequested
      ) {
        return false;
      }
      const now = safeNow(dependencies.now);
      jobs[index] = {
        ...current,
        admissionState: "handoff-pending",
        nextAttemptAt: now + ROOM_ADMISSION_HANDOFF_TIMEOUT_MS,
        settleAfter: now + ROOM_ADMISSION_HANDOFF_TIMEOUT_MS,
      };
      await persist(state);
      await schedule(jobs);
      return true;
    });

  const acknowledgeAdmissionHandoff = (
    operation: RoomDepartureRetryOperation,
  ): Promise<boolean> =>
    runSerialized(async () => {
      const exact = requireOperation(operation);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      const index = jobs.findIndex((job) => sameIdentity(job, exact));
      const current = jobs[index];
      if (
        !current ||
        current.generation !== exact.generation ||
        current.admissionState !== "handoff-pending" ||
        current.cleanupRequested
      ) {
        return false;
      }
      jobs.splice(index, 1);
      await persist(state);
      await schedule(jobs).catch(() => undefined);
      return true;
    });

  const claimAdmissionHandoffCleanup = (
    identity: RoomDepartureRetryIdentity,
  ): Promise<RoomDepartureRetryOperation | null> =>
    runSerialized(async () => {
      const exact = requireIdentity(identity);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      const index = jobs.findIndex((job) => sameIdentity(job, exact));
      const current = jobs[index];
      if (!current || current.admissionState !== "handoff-pending") return null;
      const now = safeNow(dependencies.now);
      const claimed: RoomDepartureRetryJob = {
        ...current,
        admissionState: "settled",
        cleanupRequested: true,
        nextAttemptAt: now,
      };
      jobs[index] = claimed;
      await persist(state);
      await dependencies.scheduler.replace(now);
      return exactOperation(claimed);
    });

  const settleAdmission = (
    operation: RoomDepartureRetryOperation,
  ): Promise<RoomDepartureRetryAttemptOutcome> =>
    runSerialized(async () => {
      const exact = requireOperation(operation);
      const now = safeNow(dependencies.now);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      const index = jobs.findIndex((job) => sameIdentity(job, exact));
      const current = jobs[index];
      if (
        !current ||
        current.generation !== exact.generation ||
        !current.cleanupRequested
      ) {
        return "operation-superseded";
      }
      jobs[index] = {
        ...current,
        admissionState: "settled",
        nextAttemptAt: now,
      };

      // Persist the settlement transition before any auth or network await.
      await persist(state);
      // Re-arm at the settled job before the network drain. If MV3 suspends at
      // the next await, Chrome still owns a wake-up for the persisted identity.
      await dependencies.scheduler.replace(now);
      const currentUserId = await dependencies.getCurrentUserId().catch(() => null);
      if (!currentUserId || currentUserId !== exact.ownerUserId) {
        await scheduleForAccount(jobs, currentUserId);
        return currentUserId ? "account-changed" : "no-auth";
      }

      const outcome = await dependencies.departExact(exactIdentity(exact)).catch(
        () => "failed" as const,
      );
      const job = jobs[index];
      if (!job) return outcome;
      if (isTerminalRetryOutcome(outcome)) {
        jobs.splice(index, 1);
      } else {
        jobs[index] = retryJob(job, now);
      }
      await persist(state);
      await scheduleForAccount(jobs, currentUserId);
      return outcome;
    });

  const retryAdmission = (
    operation: RoomDepartureRetryOperation,
  ): Promise<RoomDepartureRetryAttemptOutcome> =>
    runSerialized(async () => {
      const exact = requireOperation(operation);
      const now = safeNow(dependencies.now);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      const index = jobs.findIndex((job) => sameIdentity(job, exact));
      let job = jobs[index];
      if (
        !job ||
        job.generation !== exact.generation ||
        !job.cleanupRequested
      ) {
        return "operation-superseded";
      }

      // Preserve a Chrome-owned wake before auth/network awaits, including
      // when an earlier auth-blocked drain cleared the prior alarm.
      await dependencies.scheduler.replace(now);
      const currentUserId = await dependencies.getCurrentUserId().catch(() => null);
      if (!currentUserId || currentUserId !== exact.ownerUserId) {
        await scheduleForAccount(jobs, currentUserId);
        return currentUserId ? "account-changed" : "no-auth";
      }

      if (job.admissionState === "may-commit" && now >= job.settleAfter) {
        job = { ...job, admissionState: "settled" };
        jobs[index] = job;
        await persist(state);
      }
      const outcome = await dependencies.departExact(exactIdentity(exact)).catch(
        () => "failed" as const,
      );
      if (job.admissionState === "settled" && isTerminalRetryOutcome(outcome)) {
        jobs.splice(index, 1);
      } else {
        jobs[index] = retryJob(job, now);
      }
      await persist(state);
      await scheduleForAccount(jobs, currentUserId);
      return outcome;
    });

  const drain = (options: { force?: boolean } = {}): Promise<void> =>
    runSerialized(async () => {
      const now = safeNow(dependencies.now);
      // A one-shot Chrome alarm has already been consumed when this path is
      // entered. Install a watchdog before storage/auth/network awaits so an
      // MV3 suspension cannot leave a persisted exact job without a wake.
      await dependencies.scheduler.replace(now + INITIAL_RETRY_DELAY_MS);
      const state = normalizeState(await dependencies.storage.read());
      const jobs = state.jobs;
      if (jobs.length === 0) {
        await persist(state);
        await dependencies.scheduler.replace(null);
        return;
      }
      const currentUserId = await dependencies.getCurrentUserId().catch(() => null);
      for (let index = 0; index < jobs.length;) {
        let job = jobs[index];
        if (!job) break;
        if (!job.cleanupRequested && now < job.settleAfter) {
          index += 1;
          continue;
        }
        if (!job.cleanupRequested) {
          job = {
            ...job,
            admissionState: "settled",
            cleanupRequested: true,
            nextAttemptAt: now,
          };
          jobs[index] = job;
          await persist(state);
        }
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
          await persist(state);
        }

        const outcome = await dependencies.departExact(exactIdentity(job)).catch(
          () => "failed" as const,
        );
        if (
          job.admissionState === "settled" &&
          isTerminalRetryOutcome(outcome)
        ) {
          jobs.splice(index, 1);
          await persist(state);
          continue;
        }

        jobs[index] = retryJob(job, now);
        await persist(state);
        index += 1;
      }

      await scheduleForAccount(jobs, currentUserId);
    });

  return {
    renewAdmissionIntent,
    requestAdmissionCleanup,
    markAdmissionHandoff,
    acknowledgeAdmissionHandoff,
    claimAdmissionHandoffCleanup,
    retryAdmission,
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

export function renewRoomDepartureAdmissionIntent(
  identity: RoomDepartureRetryIdentity,
): Promise<RoomDepartureRetryOperation> {
  return defaultRoomDepartureRetryCoordinator.renewAdmissionIntent(identity);
}

/**
 * Persists exact cleanup ownership before attempting a real closed-tab
 * departure. A non-terminal result remains scheduled for an alarm-driven
 * retry, while a terminal acknowledgement retires the exact job.
 */
export async function departPersistedRoomSession(
  identity: RoomDepartureRetryIdentity,
  coordinator: RoomDepartureRetryCoordinator =
    defaultRoomDepartureRetryCoordinator,
): Promise<RoomTabDepartureOutcome> {
  const operation = await coordinator.renewAdmissionIntent(identity);
  const owned = await coordinator.requestAdmissionCleanup(operation);
  if (!owned) return "active-room-changed";
  const outcome = await coordinator.settleAdmission(operation);
  return outcome === "operation-superseded"
    ? "active-room-changed"
    : outcome;
}

export function settleRoomDepartureAdmission(
  operation: RoomDepartureRetryOperation,
): Promise<RoomDepartureRetryAttemptOutcome> {
  return defaultRoomDepartureRetryCoordinator.settleAdmission(operation);
}

export function retryRoomDepartureAdmission(
  operation: RoomDepartureRetryOperation,
): Promise<RoomDepartureRetryAttemptOutcome> {
  return defaultRoomDepartureRetryCoordinator.retryAdmission(operation);
}

export function requestRoomDepartureAdmissionCleanup(
  operation: RoomDepartureRetryOperation,
): Promise<boolean> {
  return defaultRoomDepartureRetryCoordinator.requestAdmissionCleanup(operation);
}

export function markRoomDepartureAdmissionHandoff(
  operation: RoomDepartureRetryOperation,
): Promise<boolean> {
  return defaultRoomDepartureRetryCoordinator.markAdmissionHandoff(operation);
}

export function acknowledgeRoomDepartureAdmissionHandoff(
  operation: RoomDepartureRetryOperation,
): Promise<boolean> {
  return defaultRoomDepartureRetryCoordinator.acknowledgeAdmissionHandoff(
    operation,
  );
}

export function claimRoomDepartureAdmissionHandoffCleanup(
  identity: RoomDepartureRetryIdentity,
): Promise<RoomDepartureRetryOperation | null> {
  return defaultRoomDepartureRetryCoordinator.claimAdmissionHandoffCleanup(
    identity,
  );
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
    return { version: 5, lastGeneration: 0, jobs: [] };
  }
  const version = value.version;
  if (
    version !== 1 &&
    version !== 2 &&
    version !== 3 &&
    version !== 4 &&
    version !== 5
  ) {
    return { version: 5, lastGeneration: 0, jobs: [] };
  }

  const jobs: RoomDepartureRetryJob[] = [];
  for (const valueJob of value.jobs) {
    const job = normalizeJob(valueJob, version);
    if (!job) continue;
    const duplicateIndex = jobs.findIndex((current) => sameIdentity(current, job));
    const duplicate = jobs[duplicateIndex];
    if (!duplicate) {
      jobs.push(job);
      continue;
    }
    if (job.generation > duplicate.generation) {
      jobs[duplicateIndex] = job;
      continue;
    }
    if (job.generation < duplicate.generation) continue;
    duplicate.attempts = Math.max(duplicate.attempts, job.attempts);
    duplicate.createdAt = Math.min(duplicate.createdAt, job.createdAt);
    duplicate.nextAttemptAt = Math.min(
      duplicate.nextAttemptAt,
      job.nextAttemptAt,
    );
    duplicate.settleAfter = Math.max(duplicate.settleAfter, job.settleAfter);
    if (
      job.admissionState === "settled" ||
      (job.admissionState === "handoff-pending" &&
        duplicate.admissionState === "may-commit")
    ) {
      duplicate.admissionState = job.admissionState;
    }
    if (job.cleanupRequested) duplicate.cleanupRequested = true;
  }
  const highestJobGeneration = jobs.reduce(
    (highest, job) => Math.max(highest, job.generation),
    0,
  );
  const storedLastGeneration =
    (version === 4 || version === 5) &&
    Number.isSafeInteger(value.lastGeneration) &&
    (value.lastGeneration as number) >= 0
      ? (value.lastGeneration as number)
      : 0;
  return {
    version: 5,
    lastGeneration: Math.max(storedLastGeneration, highestJobGeneration),
    jobs,
  };
}

function normalizeJob(
  value: unknown,
  version: 1 | 2 | 3 | 4 | 5,
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
  if (version === 1) {
    return {
      ...identity,
      admissionState: "settled",
      attempts: value.attempts as number,
      cleanupRequested: true,
      createdAt: value.createdAt as number,
      generation: 1,
      nextAttemptAt: value.nextAttemptAt as number,
      settleAfter: value.createdAt as number,
    };
  }
  if (
    (value.admissionState !== "handoff-pending" &&
      value.admissionState !== "may-commit" &&
      value.admissionState !== "settled") ||
    !isSafeTimestamp(value.settleAfter)
  ) {
    return null;
  }
  const generation =
    version === 3 || version === 4 || version === 5 ? value.generation : 1;
  if (!Number.isSafeInteger(generation) || (generation as number) < 1) {
    return null;
  }
  const cleanupRequested =
    version === 4 || version === 5 ? value.cleanupRequested : true;
  if (typeof cleanupRequested !== "boolean") return null;
  return {
    ...identity,
    admissionState: value.admissionState,
    attempts: value.attempts as number,
    cleanupRequested,
    createdAt: value.createdAt as number,
    generation: generation as number,
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

function requireOperation(value: unknown): RoomDepartureRetryOperation {
  const identity = normalizeIdentity(value);
  if (
    !identity ||
    !isObject(value) ||
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 1
  ) {
    throw new Error("Invalid exact room departure retry operation");
  }
  return { ...identity, generation: value.generation as number };
}

function exactIdentity(
  job: RoomDepartureRetryIdentity,
): RoomDepartureRetryIdentity {
  return {
    roomId: job.roomId,
    ownerUserId: job.ownerUserId,
    participantSessionId: job.participantSessionId,
  };
}

function exactOperation(
  job: RoomDepartureRetryJob,
): RoomDepartureRetryOperation {
  return {
    ...exactIdentity(job),
    generation: job.generation,
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
