import assert from "node:assert/strict";
import test from "node:test";
import { deliverAccountInboxChanged, type DevicePushRepository } from "./device-push";
import {
  drainInboxPushOutbox,
  deferInboxPushOutboxDrain,
  type InboxPushOutboxRepository,
} from "./inbox-push-outbox";

const environment = {
  ANIDACHI_VAPID_SUBJECT: "mailto:test@example.test",
  ANIDACHI_VAPID_PUBLIC_KEY: "public",
  ANIDACHI_VAPID_PRIVATE_KEY: "private",
};
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function fixture(count: number, dbDelay = 0) {
  const jobs = new Map(
    Array.from({ length: count }, (_, i) => [`user-${i}`, { state: "due", revision: 1 }]),
  );
  const claims: string[][] = [];
  const repository: InboxPushOutboxRepository = {
    async claimDue(limit, recipientUserIds) {
      if (dbDelay) await pause(dbDelay);
      const selected = [...jobs]
        .filter(
          ([id, job]) =>
            job.state === "due" && (!recipientUserIds || recipientUserIds.includes(id)),
        )
        .slice(0, limit);
      claims.push(selected.map(([id]) => id));
      return selected.map(([userId, job]) => {
        job.state = "leased";
        return { userId, revision: job.revision, leaseToken: `lease-${userId}` };
      });
    },
    async finish(claim, result) {
      if (dbDelay) await pause(dbDelay);
      if (result.outcome === "complete") {
        jobs.delete(claim.userId);
        return "completed";
      }
      const job = jobs.get(claim.userId);
      assert.ok(job);
      job.state = result.outcome;
      return result.outcome === "retry" ? "retry" : "terminal";
    },
  };
  const devices: DevicePushRepository = {
    register: async () => {
      throw new Error("not used");
    },
    revoke: async () => false,
    async listEnabledForUsers(ids) {
      if (dbDelay) await pause(dbDelay);
      const userId = ids[0];
      assert.ok(userId);
      return [
        {
          userId,
          deviceId: userId,
          endpoint: `https://fcm.googleapis.com/${userId}`,
          p256dh: "key",
          auth: "auth",
        },
      ];
    },
    markDelivered: async () => {
      if (dbDelay) await pause(dbDelay);
    },
    markPermanentFailure: async () => {
      if (dbDelay) await pause(dbDelay);
    },
    markTransientFailure: async () => {
      if (dbDelay) await pause(dbDelay);
    },
  };
  return { jobs, claims, repository, devices };
}

test("real dispatcher retires provider-accepted jobs and reschedules failures independently", async () => {
  const f = fixture(10);
  const summary = await drainInboxPushOutbox({
    repository: f.repository,
    deliver: (userId) =>
      deliverAccountInboxChanged(userId, {
        environment,
        repository: f.devices,
        send: async (device) => {
          if (device.endpoint.endsWith("user-0")) throw { statusCode: 503 };
        },
      }),
  });
  assert.equal(summary.completed, 9);
  assert.equal(summary.retried, 1);
  assert.equal(summary.providerAccepted, 9);
  assert.equal("delivered" in summary, false);
  assert.deepEqual([...f.jobs], [["user-0", { state: "retry", revision: 1 }]]);
  assert.ok(f.claims.every((batch) => batch.length <= 8));
});

test("100 healthy immediate recipients finish with nonzero DB latency and at most eight accounts in flight", async () => {
  const f = fixture(101, 200);
  let active = 0;
  let maximum = 0;
  const recipientUserIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);
  const summary = await drainInboxPushOutbox({
    repository: f.repository,
    recipientUserIds: [...recipientUserIds, "user-0"],
    deliver: async (userId) => {
      active++;
      maximum = Math.max(maximum, active);
      try {
        return await deliverAccountInboxChanged(userId, {
          environment,
          repository: f.devices,
          send: async () => undefined,
        });
      } finally {
        active--;
      }
    },
  });
  assert.equal(summary.completed, 100);
  assert.equal(summary.claimed, 100);
  assert.equal(summary.batches, 13);
  assert.equal(maximum, 8);
  assert.equal(f.jobs.get("user-100")?.state, "due", "unrelated backlog is untouched");
});

test("slow work stops before claiming a batch that cannot finish in the remaining budget", async () => {
  const f = fixture(100);
  let elapsed = 0;
  let done = 0;
  const summary = await drainInboxPushOutbox({
    repository: f.repository,
    now: () => elapsed,
    deliver: async (userId) => {
      const result = await deliverAccountInboxChanged(userId, {
        environment,
        repository: f.devices,
        send: async () => {
          throw { statusCode: 503 };
        },
      });
      if (++done % 8 === 0) elapsed += 18000;
      return result;
    },
  });
  assert.equal(summary.claimed, 8);
  assert.equal(summary.retried, 8);
  assert.equal(summary.stopReason, "budget");
  assert.equal([...f.jobs.values()].filter((job) => job.state === "due").length, 92);
});

test("database completion failure leaves the job leased for recovery while peers retire", async () => {
  const f = fixture(2);
  const finish = f.repository.finish;
  f.repository.finish = (claim, result) =>
    claim.userId === "user-0" ? Promise.reject(new Error("private")) : finish(claim, result);
  const summary = await drainInboxPushOutbox({
    repository: f.repository,
    deliver: (userId) =>
      deliverAccountInboxChanged(userId, {
        environment,
        repository: f.devices,
        send: async () => undefined,
      }),
  });
  assert.equal(summary.completed, 1);
  assert.equal(summary.errors, 1);
  assert.equal(f.jobs.get("user-0")?.state, "leased");
});

test("empty immediate targeting cannot accidentally drain global work", async () => {
  const f = fixture(1);
  const summary = await drainInboxPushOutbox({ repository: f.repository, recipientUserIds: [] });
  assert.equal(summary.claimed, 0);
  assert.equal(f.claims.length, 0);
});

test("post-commit scheduling targets unique recipients and contains scheduler failures", async () => {
  const tasks: Array<() => Promise<void>> = [];
  const targets: string[][] = [];
  const errors: string[] = [];
  deferInboxPushOutboxDrain(["user-0", "user-0"], (task) => tasks.push(task), {
    drain: async (options) => {
      targets.push([...(options?.recipientUserIds ?? [])]);
      throw new Error("private details");
    },
    reportError: (message) => errors.push(message),
  });
  assert.equal(targets.length, 0);
  assert.ok(tasks[0]);
  await tasks[0]();
  assert.deepEqual(targets, [["user-0"]]);
  assert.deepEqual(errors, ["Inbox push outbox drain unavailable"]);
  assert.doesNotThrow(() =>
    deferInboxPushOutboxDrain(
      ["user-0"],
      () => {
        throw new Error("scheduler stopped");
      },
      { reportError: (message) => errors.push(message) },
    ),
  );
});

test("unresponsive claim has a bounded deadline and exposes no private database error", async () => {
  const f = fixture(1);
  f.repository.claimDue = () => new Promise(() => undefined);
  const started = Date.now();
  const summary = await drainInboxPushOutbox({ repository: f.repository });
  assert.equal(summary.stopReason, "database_error");
  assert.equal(summary.errors, 1);
  assert.equal(summary.claimed, 0);
  assert.ok(Date.now() - started < 5000);
});

test("production RPC adapter targets only committed recipients and fences completion", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://outbox-db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  let claimed = false;
  let retired = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "outbox-db.example.test");
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    if (url.pathname.endsWith("claim_account_inbox_push_outbox")) {
      assert.deepEqual(body, { p_limit: 8, p_recipient_user_ids: ["user-0"] });
      if (claimed) return Response.json([]);
      claimed = true;
      return Response.json([{ user_id: "user-0", revision: 7, lease_token: "opaque-lease" }]);
    }
    assert.ok(url.pathname.endsWith("finish_account_inbox_push_outbox"));
    assert.deepEqual(body, {
      p_user_id: "user-0",
      p_revision: 7,
      p_lease_token: "opaque-lease",
      p_outcome: "complete",
      p_error_code: null,
      p_retry_after_seconds: 0,
    });
    retired = true;
    return Response.json("completed");
  });
  const f = fixture(1);
  f.devices.listEnabledForUsers = async () => [];
  const summary = await drainInboxPushOutbox({
    recipientUserIds: ["user-0", "user-0"],
    deliver: (userId) => deliverAccountInboxChanged(userId, { environment, repository: f.devices }),
  });
  assert.equal(retired, true);
  assert.equal(summary.completed, 1);
  assert.equal(summary.noDevices, 1);
  assert.equal(summary.providerAccepted, 0);
});
