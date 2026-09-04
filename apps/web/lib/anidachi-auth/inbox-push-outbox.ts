import { db } from "./db";
import {
  deliverAccountInboxChanged,
  INBOX_PUSH_DATABASE_TIMEOUT_MS,
  withInboxPushTimeout,
  type AccountInboxPushResult,
} from "./device-push";

export const INBOX_PUSH_DRAIN_BUDGET_MS = 35_000;
const BATCH_SIZE = 8;
const MAX_ACCOUNTS = 100;
const ACCOUNT_DELIVERY_TIMEOUT_MS = 14_000;
// Claim2 + list2 + provider10 + device bookkeeping2 + finish2.
const BATCH_RESERVE_MS = 18_000;

export type InboxPushClaim = { userId: string; revision: number; leaseToken: string };
export type InboxPushCompletion = "completed" | "retry" | "terminal" | "superseded" | "stale";
export interface InboxPushOutboxRepository {
  claimDue(limit: number, recipientUserIds?: readonly string[]): Promise<InboxPushClaim[]>;
  finish(claim: InboxPushClaim, result: AccountInboxPushResult): Promise<InboxPushCompletion>;
}
export type InboxPushDrainSummary = {
  claimed: number;
  completed: number;
  retried: number;
  terminal: number;
  superseded: number;
  stale: number;
  errors: number;
  providerAccepted: number;
  pruned: number;
  noDevices: number;
  batches: number;
  elapsedMs: number;
  stopReason: "empty" | "budget" | "limit" | "database_error";
};
export type InboxPushDrainOptions = {
  /** Omit for global scheduled recovery; [] deliberately does no work. */
  recipientUserIds?: readonly string[];
  repository?: InboxPushOutboxRepository;
  deliver?: (userId: string) => Promise<AccountInboxPushResult>;
  now?: () => number;
};

/** Bounded at-least-once invalidation, not notification receipt/read tracking. */
export async function drainInboxPushOutbox(
  options: InboxPushDrainOptions = {},
): Promise<InboxPushDrainSummary> {
  const now = options.now ?? (() => performance.now());
  const startedAt = now();
  const recipients = options.recipientUserIds && [...new Set(options.recipientUserIds)];
  if (recipients && recipients.length > MAX_ACCOUNTS) throw new Error("inbox_push_recipient_limit");
  const repository = options.repository ?? defaultInboxPushOutboxRepository;
  const deliver = options.deliver ?? deliverAccountInboxChanged;
  const summary: InboxPushDrainSummary = {
    claimed: 0,
    completed: 0,
    retried: 0,
    terminal: 0,
    superseded: 0,
    stale: 0,
    errors: 0,
    providerAccepted: 0,
    pruned: 0,
    noDevices: 0,
    batches: 0,
    elapsedMs: 0,
    stopReason: "empty",
  };
  if (recipients?.length === 0) return summary;
  while (summary.claimed < MAX_ACCOUNTS) {
    if (INBOX_PUSH_DRAIN_BUDGET_MS - (now() - startedAt) < BATCH_RESERVE_MS) {
      summary.stopReason = "budget";
      break;
    }
    let claims: InboxPushClaim[];
    try {
      claims = await withInboxPushTimeout(
        repository.claimDue(Math.min(BATCH_SIZE, MAX_ACCOUNTS - summary.claimed), recipients),
        INBOX_PUSH_DATABASE_TIMEOUT_MS,
      );
    } catch {
      summary.errors++;
      summary.stopReason = "database_error";
      break;
    }
    if (claims.length === 0) break;
    summary.batches++;
    summary.claimed += claims.length;
    await Promise.all(
      claims.map(async (claim) => {
        let result: AccountInboxPushResult;
        try {
          // The production helper bounds each stage. Do not race its final
          // bookkeeping against the same total and discard a known 429 cooldown.
          result = options.deliver
            ? await withInboxPushTimeout(deliver(claim.userId), ACCOUNT_DELIVERY_TIMEOUT_MS)
            : await deliver(claim.userId);
        } catch {
          result = {
            outcome: "retry",
            errorCode: "delivery_unavailable",
            retryAfterSeconds: 0,
            attempted: 0,
            providerAccepted: 0,
            pruned: 0,
            failed: 0,
            noDevices: false,
          };
        }
        summary.providerAccepted += result.providerAccepted;
        summary.pruned += result.pruned;
        if (result.noDevices) summary.noDevices++;
        try {
          const outcome = await withInboxPushTimeout(
            repository.finish(claim, result),
            INBOX_PUSH_DATABASE_TIMEOUT_MS,
          );
          if (outcome === "retry") summary.retried++;
          else summary[outcome]++;
        } catch {
          // A lost response cannot be assumed to have committed. Lease expiry recovers it.
          summary.errors++;
        }
      }),
    );
  }
  if (summary.claimed >= MAX_ACCOUNTS) summary.stopReason = "limit";
  summary.elapsedMs = Math.max(0, now() - startedAt);
  return summary;
}

/** The SQL trigger already enqueued; this only schedules a targeted post-commit drain. */
export function deferInboxPushOutboxDrain(
  recipientUserIds: readonly string[],
  defer: (task: () => Promise<void>) => void,
  options: {
    drain?: typeof drainInboxPushOutbox;
    reportError?: (message: string) => void;
    reportSummary?: (summary: InboxPushDrainSummary) => void;
  } = {},
): boolean {
  const recipients = [...new Set(recipientUserIds)];
  if (recipients.length === 0) return false;
  const reportError =
    options.reportError ?? ((message) => console.error(`[anidachi/inbox-push] ${message}`));
  try {
    defer(async () => {
      try {
        const summary = await (options.drain ?? drainInboxPushOutbox)({
          recipientUserIds: recipients,
        });
        if (options.reportSummary) options.reportSummary(summary);
        else console.info("[anidachi/inbox-push] drain", summary);
      } catch {
        reportError("Inbox push outbox drain unavailable");
      }
    });
    return true;
  } catch {
    reportError("Inbox push outbox scheduling unavailable");
    return false;
  }
}

const defaultInboxPushOutboxRepository: InboxPushOutboxRepository = {
  async claimDue(limit, recipientUserIds) {
    const { data, error } = await db()
      .rpc("claim_account_inbox_push_outbox", {
        p_limit: limit,
        p_recipient_user_ids: recipientUserIds ? [...recipientUserIds] : null,
      })
      .abortSignal(AbortSignal.timeout(INBOX_PUSH_DATABASE_TIMEOUT_MS));
    if (error || !Array.isArray(data)) throw new Error("inbox_push_claim_unavailable");
    return data.map((row) => {
      if (
        typeof row.user_id !== "string" ||
        !Number.isSafeInteger(row.revision) ||
        row.revision <= 0 ||
        typeof row.lease_token !== "string"
      )
        throw new Error("inbox_push_claim_invalid");
      return { userId: row.user_id, revision: row.revision, leaseToken: row.lease_token };
    });
  },
  async finish(claim, result) {
    const { data, error } = await db()
      .rpc("finish_account_inbox_push_outbox", {
        p_user_id: claim.userId,
        p_revision: claim.revision,
        p_lease_token: claim.leaseToken,
        p_outcome: result.outcome,
        p_error_code: result.errorCode,
        p_retry_after_seconds: result.retryAfterSeconds,
      })
      .abortSignal(AbortSignal.timeout(INBOX_PUSH_DATABASE_TIMEOUT_MS));
    if (error || !["completed", "retry", "terminal", "superseded", "stale"].includes(data))
      throw new Error("inbox_push_finish_unavailable");
    return data as InboxPushCompletion;
  },
};
