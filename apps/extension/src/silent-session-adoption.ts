import type { CurrentParticipantResult } from "./user-identity";

export type SilentSessionAdoptionReason =
  | "initial"
  | "current-session"
  | "current-miss"
  | "silent-sign-in"
  | "silent-miss"
  | "cancelled";

export interface SilentSessionAdoptionResult {
  reason: SilentSessionAdoptionReason;
  result: CurrentParticipantResult | null;
}

interface SilentSessionAdoptionOptions {
  initialResult: CurrentParticipantResult;
  readCurrentIdentity: () => Promise<CurrentParticipantResult>;
  trySilentSignIn: () => Promise<CurrentParticipantResult | null>;
  shouldContinue: () => boolean;
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  onAttempt?: (result: SilentSessionAdoptionResult) => void;
}

const DEFAULT_SILENT_ADOPTION_DELAYS_MS = [250, 700, 1400] as const;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function report(
  onAttempt: SilentSessionAdoptionOptions["onAttempt"],
  reason: SilentSessionAdoptionReason,
  result: CurrentParticipantResult | null,
): SilentSessionAdoptionResult {
  const event = { reason, result };
  onAttempt?.(event);
  return event;
}

function isTerminalIdentityResult(result: CurrentParticipantResult | null): boolean {
  return Boolean(result?.authenticated || result?.requiresPageReload);
}

export async function adoptWebsiteSessionWithRetry({
  initialResult,
  readCurrentIdentity,
  trySilentSignIn,
  shouldContinue,
  delaysMs = DEFAULT_SILENT_ADOPTION_DELAYS_MS,
  sleep = defaultSleep,
  onAttempt,
}: SilentSessionAdoptionOptions): Promise<SilentSessionAdoptionResult> {
  if (isTerminalIdentityResult(initialResult)) {
    return report(onAttempt, "initial", initialResult);
  }

  report(onAttempt, "initial", initialResult);

  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    if (!shouldContinue()) {
      return report(onAttempt, "cancelled", null);
    }

    const silent = await trySilentSignIn();
    if (isTerminalIdentityResult(silent)) {
      return report(onAttempt, "silent-sign-in", silent);
    }
    report(onAttempt, "silent-miss", silent);

    if (attempt >= delaysMs.length) {
      break;
    }

    await sleep(delaysMs[attempt]);
    if (!shouldContinue()) {
      return report(onAttempt, "cancelled", null);
    }

    const current = await readCurrentIdentity();
    if (isTerminalIdentityResult(current)) {
      return report(onAttempt, "current-session", current);
    }
    report(onAttempt, "current-miss", current);
  }

  return report(onAttempt, "silent-miss", null);
}
