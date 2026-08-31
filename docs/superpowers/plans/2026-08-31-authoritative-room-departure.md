# Authoritative Room Departure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit guest departure commit against the durable active-room assignment first, then clean exact live Worker state without allowing cleanup failures to block the user from creating or joining another room.

**Architecture:** Supabase remains the durable authority for account eligibility, the room Durable Object remains the live presence authority, and the extension remains the local media/runtime authority. Web resolves the authenticated user's current assignment, atomically releases the exact guest assignment, and only then sends a bounded exact-session detach command to the Worker. The Worker's 60-second passive grace remains independent; ordinary tab close is local-only, while a late admission committed after tab removal has a persistent background-owned exact retry.

**Tech Stack:** TypeScript, Zod, Next.js route handlers, Supabase RPC, Cloudflare Workers and Durable Objects, WXT Manifest V3 extension, Vitest, Node test runner, Playwright real-WebRTC harness.

**Spec:** `docs/superpowers/specs/2026-08-31-authoritative-room-departure-design.md`

## Global Constraints

- Branch flow remains `codex/redesign-room-departure` -> PR -> `staging`; do not push directly to `main` and do not deploy or promote without explicit approval.
- `public.active_room_sessions` and `release_active_room_session_v1(userId, roomId, participantSessionId)` remain the durable authority and atomic compare-and-delete primitive.
- The Worker's 60-second passive reconnect grace is retained; the removed
  hidden tab-close HTTP accelerator is not part of that normal passive path.
- Do not add a database migration, table, queue, outbox, secret, environment variable, service, CORS path, or extension host permission.
- Guest exact departure must never end a host room, and stale exact identifiers must never affect a newer assignment or socket.
- Worker cleanup success, stale, timeout, and transport failure must not change a successful public result after durable guest release.
- Supabase read or release failure must return typed retryable HTTP `503` and must not authorize local teardown.
- Host departure keeps the existing room-end lifecycle and metered finalization contract.
- Passive disconnect keeps the existing signed Worker-to-Web callback and alarm retry contract.
- The emergency active-session endpoint remains a separately confirmed action; normal departure must never cascade to it automatically.
- Keep the old Worker `/depart` internal operation during the rollout window so an older Web deployment cannot acknowledge a guest leave without releasing durable state.
- Do not commit generated extension folders, zip archives, local browser profiles, secrets, or local-only Graphify outputs.

## Final Review Compatibility Amendment (2026-08-31)

- `RoomDepartureAcknowledgementSchema` and the current extension continue to
  accept `already_departed` for forward compatibility.
- Until version negotiation exists, public Web exact and recovery routes emit
  legacy-compatible `stale` when no assignment remains. This keeps deployed
  strict clients compatible after a lost-response retry.
- Passive tab removal during an in-flight admission must persist one coalesced
  exact retry after unconfirmed compensation. The retry contains only
  `roomId`, `ownerUserId`, `participantSessionId`, and bounded timing metadata;
  it survives Manifest V3 worker/browser restart, waits for the matching
  authenticated account, and never invokes broad active-room recovery.
- The existing `storage` and `alarms` permissions are sufficient. No database
  table, server queue, host permission, token, role, secret, environment
  variable, or service is added.

---

## File Map And Boundaries

| File | Responsibility after this change |
| --- | --- |
| `packages/protocol/src/room-session.ts` | Strict public success/error contracts and exact internal live-detach command/acknowledgement. |
| `packages/protocol/test/room-session.test.ts` | Contract bounds, strictness, and all accepted outcome/error variants. |
| `apps/api/src/index.ts` | Additive internal detach transport and Durable Object live-only cleanup; retain legacy departure and passive callback flows. |
| `apps/api/test/routes.test.ts` | Hono authentication, validation, and forwarding for the new internal detach route. |
| `apps/api/test/runtime/room-hibernation-runtime.ts` | Exact detach, pending-disconnect, stale-session, duplicate, host, and hibernation invariants. |
| `apps/web/lib/anidachi-auth/active-room-session-routes.ts` | Shared exact/recovery domain service and durable-first guest state machine. |
| `apps/web/lib/anidachi-auth/active-room-session-routes.test.ts` | Call-order, idempotency, race, host, recovery, and failure semantics. |
| `apps/web/lib/anidachi-auth/room-lifecycle.ts` | Existing host synchronization plus the new short, abortable Worker detach client. |
| `apps/web/lib/anidachi-auth/room-lifecycle.test.ts` | Detach URL/auth/schema/timeout behavior. |
| `apps/web/app/api/rooms/[roomId]/depart/route.ts` | Authenticate, parse input, and delegate exact departure without room/membership lookups. |
| `apps/web/app/api/rooms/active-session/depart/route.ts` | Authenticate and delegate confirmed server-resolved recovery to the same domain service. |
| `apps/web/lib/staging-access.ts` | Centralized staging-password bypass for bearer-authenticated internal POST traffic. |
| `apps/web/lib/staging-access.test.ts` | Prove internal path coverage and prevent unsafe method/header widening. |
| `apps/web/lib/internal-service-auth.test.ts` | Prove a bearer that passes the staging gate is still rejected unless it exactly matches the internal secret. |
| `apps/extension/src/room-departure.ts` | Exact normal leave, typed server errors, one auth refresh, and explicitly separate emergency recovery. |
| `apps/extension/src/room-departure-retry.ts` | Persistent coalesced exact retry ownership for a late admission committed after passive tab removal. |
| `apps/extension/test/room-departure.test.ts` | Successful local confirmation, missing/stale exact records, typed failures, refresh, and no hidden recovery cascade. |
| `apps/extension/test/room-departure-retry.test.ts` | Storage, restart, alarm, account fencing, bounded backoff, coalescing, and replacement safety. |
| `apps/extension/test/privileged-overlay-wiring.test.tsx` | UI boundary: exact success tears down once, durable failure stays recoverable, emergency remains explicitly confirmed. |
| `docs/current-development-state.md` | Record implemented local behavior and clearly separate it from staging acceptance. |
| `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md` | Add implementation/test evidence to the room hardening progress log. |
| `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md` | Add exact departure acceptance and remaining staging/manual proof. |

---

### Task 1: Define Strict Departure And Live-Detach Protocol Contracts

**Files:**
- Modify: `packages/protocol/src/room-session.ts`
- Modify: `packages/protocol/test/room-session.test.ts`

**Interfaces:**
- Consumes: existing bounded `RoomIdSchema`, `ParticipantIdSchema`, and `ParticipantSessionIdSchema`.
- Produces: `RoomDepartureAcknowledgementSchema`, `RoomDepartureErrorResponseSchema`, `InternalRoomDetachCommandSchema`, `RoomDetachAcknowledgementSchema`, and their inferred TypeScript types.
- Compatibility: retain `InternalRoomDepartureCommandSchema` and its acknowledgement use for the legacy Worker `/depart` operation during rollout.

- [ ] **Step 1: Extend the protocol tests with the exact accepted success and error contracts**

Add imports for the new schemas, add `already_departed` to the success loop, and add these focused assertions:

```ts
const detach = {
  roomId: "room-1",
  userId: "user-1",
  participantSessionId: "session-1",
  requestedAt: 1_000,
} as const;

expect(InternalRoomDetachCommandSchema.parse(detach)).toEqual(detach);
expect(() =>
  InternalRoomDetachCommandSchema.parse({ ...detach, extra: true }),
).toThrow();
expect(() =>
  InternalRoomDetachCommandSchema.parse({
    ...detach,
    participantSessionId: "s".repeat(MAX_SESSION_ID_CHARS + 1),
  }),
).toThrow();

for (const outcome of ["detached", "stale"] as const) {
  expect(RoomDetachAcknowledgementSchema.parse({ ok: true, outcome })).toEqual({
    ok: true,
    outcome,
  });
}

for (const response of [
  { code: "AUTH_REQUIRED", message: "Sign in again." },
  {
    code: "ACTIVE_ROOM_CHANGED",
    message: "Your active room changed.",
  },
  {
    code: "ROOM_DEPARTURE_UNAVAILABLE",
    message: "Could not leave right now.",
    retryable: true,
  },
] as const) {
  expect(RoomDepartureErrorResponseSchema.parse(response)).toEqual(response);
}

expect(() =>
  RoomDepartureErrorResponseSchema.parse({
    code: "AUTH_REQUIRED",
    message: "Sign in again.",
    retryable: true,
  }),
).toThrow();
expect(() =>
  RoomDepartureErrorResponseSchema.parse({
    code: "ROOM_DEPARTURE_UNAVAILABLE",
    message: "Could not leave right now.",
  }),
).toThrow();
```

- [ ] **Step 2: Run the protocol test and verify the new contract names/outcome fail**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol test -- room-session.test.ts
```

Expected: FAIL because the detach/error schemas are not exported and `already_departed` is rejected.

- [ ] **Step 3: Add strict protocol schemas and inferred types**

Add these definitions beside the existing departure contracts:

```ts
export const InternalRoomDetachCommandSchema = z.strictObject({
  roomId: RoomIdSchema,
  userId: ParticipantIdSchema,
  participantSessionId: ParticipantSessionIdSchema,
  requestedAt: z.number().int().nonnegative(),
});

export const RoomDetachAcknowledgementSchema = z.strictObject({
  ok: z.literal(true),
  outcome: z.enum(["detached", "stale"]),
});

export const RoomDepartureAcknowledgementSchema = z.strictObject({
  ok: z.literal(true),
  outcome: z.enum([
    "departed",
    "room_ended",
    "already_departed",
    "stale",
  ]),
});

const RoomDepartureErrorMessageSchema = z.string().min(1).max(300);

export const RoomDepartureErrorResponseSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("AUTH_REQUIRED"),
    message: RoomDepartureErrorMessageSchema,
  }),
  z.strictObject({
    code: z.literal("ACTIVE_ROOM_CHANGED"),
    message: RoomDepartureErrorMessageSchema,
  }),
  z.strictObject({
    code: z.literal("ROOM_DEPARTURE_UNAVAILABLE"),
    message: RoomDepartureErrorMessageSchema,
    retryable: z.literal(true),
  }),
]);

export type InternalRoomDetachCommand = z.infer<
  typeof InternalRoomDetachCommandSchema
>;
export type RoomDetachAcknowledgement = z.infer<
  typeof RoomDetachAcknowledgementSchema
>;
export type RoomDepartureErrorResponse = z.infer<
  typeof RoomDepartureErrorResponseSchema
>;
```

Retain the legacy `InternalRoomDepartureCommand` exports unchanged.

- [ ] **Step 4: Run protocol tests and typecheck**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol check
```

Expected: both commands PASS; strict schemas reject extra fields and all four public success outcomes parse.

- [ ] **Step 5: Commit the protocol contract**

```bash
git add packages/protocol/src/room-session.ts packages/protocol/test/room-session.test.ts
git commit -m "feat(protocol): define authoritative room departure contracts"
```

---

### Task 2: Add Exact Live-Only Guest Detach To The Worker

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/api/test/runtime/room-hibernation-runtime.ts`

**Interfaces:**
- Consumes: `InternalRoomDetachCommand`, `InternalRoomDetachCommandSchema`, and `RoomDetachAcknowledgement` from Task 1.
- Produces: service-authenticated `POST /internal/rooms/:roomId/participants/:userId/detach` and Durable Object `POST /internal/detach`.
- Preserves: legacy `POST .../depart`, `handleParticipantDeparture`, `deliverGuestParticipantDeparture`, passive close/error persistence, and alarm callback retries.

- [ ] **Step 1: Add route-level failing tests for authentication, validation, and exact forwarding**

Add a route test that posts this body to the new endpoint:

```ts
const command = {
  roomId: "room-1",
  userId: "user-1",
  participantSessionId: "session-1",
  requestedAt: 1_000,
};

const response = await app.request(
  "/internal/rooms/room-1/participants/user-1/detach",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer internal-secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  },
  env,
);

expect(response.status).toBe(200);
expect(await response.json()).toEqual({ ok: true, outcome: "detached" });
expect(roomStub.fetch).toHaveBeenCalledWith(
  expect.objectContaining({
    url: expect.stringContaining("/internal/detach"),
    method: "POST",
  }),
);
```

Add this rejection matrix and assert the Durable Object namespace is untouched:

```ts
const rooms = trackingRooms();
for (const request of [
  {
    path: "/internal/rooms/room-1/participants/user-1/detach",
    authorization: undefined,
    body: command,
    status: 401,
  },
  {
    path: "/internal/rooms/room-1/participants/user-1/detach",
    authorization: "Bearer wrong-secret",
    body: command,
    status: 401,
  },
  {
    path: "/internal/rooms/room-2/participants/user-1/detach",
    authorization: "Bearer internal-secret",
    body: command,
    status: 400,
  },
  {
    path: "/internal/rooms/room-1/participants/user-2/detach",
    authorization: "Bearer internal-secret",
    body: command,
    status: 400,
  },
  {
    path: "/internal/rooms/room-1/participants/user-1/detach",
    authorization: "Bearer internal-secret",
    body: { ...command, extra: true },
    status: 400,
  },
] as const) {
  const response = await app.request(
    request.path,
    {
      method: "POST",
      headers: {
        ...(request.authorization
          ? { Authorization: request.authorization }
          : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
    },
    { ...internalEnv, ROOMS: rooms.namespace },
  );
  expect(response.status).toBe(request.status);
}
expect(rooms.calls).toEqual([]);
```

- [ ] **Step 2: Run only the API route test and verify the endpoint is missing**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test -- routes.test.ts
```

Expected: FAIL with `404` for the new `/detach` route.

- [ ] **Step 3: Add failing Durable Object runtime tests for the cleanup state machine**

Add focused runtime cases using the existing `connectRoomClient`,
`readRoomRuntime`, and `stubSuccessfulWebFinalization` helpers:

```ts
it("detaches an exact guest without calling the Web departure callback", async () => {
  const callbackFetch = stubSuccessfulWebFinalization();
  const roomId = `runtime-explicit-detach-${crypto.randomUUID()}`;
  const roomNamespace = (env as unknown as {
    ROOMS: DurableObjectNamespace;
  }).ROOMS;
  const stub = roomNamespace.get(roomNamespace.idFromName(roomId));
  const host = await connectRoomClient(stub, {
    roomId,
    role: "host",
    sessionId: "host-session",
    userId: "host-user",
  });
  await connectRoomClient(stub, {
    roomId,
    role: "member",
    sessionId: "guest-session-1",
    userId: "guest-1",
  });

  const response = await detachParticipant(stub, {
    roomId,
    userId: "guest-1",
    participantSessionId: "guest-session-1",
    requestedAt: 1_000,
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, outcome: "detached" });
  await host.waitFor(
    (event) =>
      event.type === "PARTICIPANT_LEFT" && event.participant.id === "guest-1",
    "exact guest detached",
  );
  expect((await readRoomRuntime(stub)).pendingDisconnect).toBeNull();
  expect(
    callbackFetch.mock.calls.filter(([input]) =>
      String(input).endsWith("/departed"),
    ),
  ).toHaveLength(0);
  host.close();
});
```

Add `detachParticipant` beside the existing legacy `departParticipant` helper:

```ts
async function detachParticipant(
  stub: DurableObjectStub,
  command: {
    roomId: string;
    userId: string;
    participantSessionId: string;
    requestedAt: number;
  },
): Promise<Response> {
  return stub.fetch("https://room.test/internal/detach", {
    method: "POST",
    headers: { Authorization: `Bearer ${INTERNAL_SECRET}` },
    body: JSON.stringify(command),
  });
}
```

Add separate tests with these direct operations and assertions:

```ts
const duplicate = await detachParticipant(stub, command);
expect(duplicate.status).toBe(200);
expect(await duplicate.json()).toEqual({ ok: true, outcome: "stale" });
```

```ts
const oldGuest = await connectRoomClient(stub, {
  roomId,
  role: "member",
  sessionId: "guest-session-old",
  userId: "guest-user",
});
const winningGuest = await connectRoomClient(stub, {
  roomId,
  role: "member",
  sessionId: "guest-session-new",
  userId: "guest-user",
});
await winningGuest.waitFor(
  (event) => event.type === "ROOM_SNAPSHOT",
  "winning guest joined",
);
const stale = await detachParticipant(stub, {
  roomId,
  userId: "guest-user",
  participantSessionId: "guest-session-old",
  requestedAt: Date.now(),
});
expect(await stale.json()).toEqual({ ok: true, outcome: "stale" });
winningGuest.send({ type: "PING", roomId, sentAt: 77 });
await winningGuest.waitFor(
  (event) => event.type === "PONG" && event.sentAt === 77,
  "winning guest survives stale detach",
);
oldGuest.close();
winningGuest.close();
```

```ts
guest.close();
await waitForRoomRuntime(
  stub,
  (value) =>
    value.pendingDisconnect?.records?.some(
      (record) => record.participantSessionId === "guest-session",
    ) === true,
  "guest pending disconnect",
);
await evictDurableObject(stub, { webSockets: "hibernate" });
const pendingDetach = await detachParticipant(stub, {
  roomId,
  userId: "guest-user",
  participantSessionId: "guest-session",
  requestedAt: Date.now(),
});
expect(await pendingDetach.json()).toEqual({ ok: true, outcome: "detached" });
expect((await readRoomRuntime(stub)).pendingDisconnect).toBeNull();
expect(
  callbackFetch.mock.calls.filter(([input]) =>
    String(input).endsWith("/departed"),
  ),
).toHaveLength(0);
```

Capture the exact server socket before live detach, then deliver its late close
callback and prove no pending record is recreated:

```ts
let detachedServerSocket: WebSocket | null = null;
await runInDurableObject(stub, (_instance, state) => {
  detachedServerSocket = state.getWebSockets().find((socket) => {
    const attachment = socket.deserializeAttachment() as {
      participantSessionId?: string;
    } | null;
    return attachment?.participantSessionId === "guest-session";
  }) ?? null;
});
await detachParticipant(stub, command);
if (!detachedServerSocket) throw new Error("Expected exact guest socket");
await runInDurableObject(stub, async (instance) => {
  await (instance as {
    webSocketClose(
      socket: WebSocket,
      code: number,
      reason: string,
      wasClean: boolean,
    ): Promise<void>;
  }).webSocketClose(detachedServerSocket!, 1000, "late close", true);
});
expect((await readRoomRuntime(stub)).pendingDisconnect).toBeNull();
```

Finally, call detach for a live `host-session`, expect HTTP `409`, then prove the
host survives and the room is not ended:

```ts
const hostDetach = await detachParticipant(stub, {
  roomId,
  userId: "host-user",
  participantSessionId: "host-session",
  requestedAt: Date.now(),
});
expect(hostDetach.status).toBe(409);
host.send({ type: "PING", roomId, sentAt: 88 });
await host.waitFor(
  (event) => event.type === "PONG" && event.sentAt === 88,
  "host survives forbidden detach",
);
expect((await readRoomRuntime(stub)).tombstone).toBeNull();
```

- [ ] **Step 4: Run the runtime test and verify live-only detach is unimplemented**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test:runtime -- room-hibernation-runtime.ts
```

Expected: FAIL because `/internal/detach` is not routed and the current explicit departure path performs a reverse Web callback.

- [ ] **Step 5: Add the additive Hono detach route**

Import the new protocol schema and follow the existing manual internal-auth
and forwarding pattern:

```ts
app.post("/internal/rooms/:roomId/participants/:userId/detach", async (c) => {
  const authorization = c.req.header("authorization") ?? null;
  if (!hasValidInternalAuthorization(
    authorization,
    c.env.ANIDACHI_INTERNAL_API_SECRET,
  )) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Invalid internal authorization" },
      401,
    );
  }
  const roomId = c.req.param("roomId");
  const userId = c.req.param("userId");
  if (roomId.length === 0 || roomId.length > MAX_ROOM_ID_CHARS) {
    return c.json({ error: "INVALID_ROOM_ID", message: "Invalid room id" }, 400);
  }
  const command = InternalRoomDetachCommandSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (
    !command.success ||
    command.data.roomId !== roomId ||
    command.data.userId !== userId
  ) {
    return c.json(
      { error: "INVALID_DETACH_COMMAND", message: "Invalid detach command" },
      400,
    );
  }
  const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(roomId));
  return stub.fetch(new Request("https://room.internal/internal/detach", {
    method: "POST",
    headers: {
      Authorization: authorization!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command.data),
  }));
});
```

Keep the legacy `/depart` route directly beside this new route so rollout
compatibility is visible in review.

- [ ] **Step 6: Implement the Durable Object live-only detach handler**

Route `/internal/detach` through the same room-end serialization queue as the
legacy explicit departure, then add this method:

```ts
private async handleParticipantDetach(
  command: InternalRoomDetachCommand,
): Promise<Response> {
  if (this.endedTombstone) return detachResponse("stale");

  const currentSocket = this.socketsByParticipant.get(command.userId);
  const currentSessionId = currentSocket
    ? this.sessionIdBySocket.get(currentSocket)
    : undefined;
  let pending: PendingParticipantDisconnect | undefined;
  if (currentSocket) {
    if (currentSessionId !== command.participantSessionId) {
      return detachResponse("stale");
    }
    if (this.verifiedBySocket.get(currentSocket)?.role === "host") {
      return Response.json(
        { error: "HOST_DETACH_FORBIDDEN" },
        { status: 409 },
      );
    }
    pending = await this.beginParticipantDisconnect(
      currentSocket,
      command.requestedAt,
    ) ?? undefined;
    try {
      currentSocket.close(1000, "Participant left the room");
    } catch {
      /* exact live state is already detached */
    }
  } else {
    const stored = await readStoredParticipantDisconnects(this.state.storage);
    pending = stored?.records.find(
      (record) =>
        record.userId === command.userId &&
        record.participantSessionId === command.participantSessionId,
    );
  }
  if (!pending) return detachResponse("stale");
  if (pending.role === "host") {
    return Response.json(
      { error: "HOST_DETACH_FORBIDDEN" },
      { status: 409 },
    );
  }

  await acknowledgeStoredParticipantDisconnect(
    this.state.storage,
    command.userId,
    command.participantSessionId,
    reconcileStoredRoomAlarm,
  );
  return detachResponse("detached");
}
```

Add the strict DO request boundary before the ended-room/WebSocket branches:

```ts
if (request.method === "POST" && url.pathname === "/internal/detach") {
  if (!hasValidInternalAuthorization(
    request.headers.get("authorization"),
    this.env.ANIDACHI_INTERNAL_API_SECRET,
  )) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const command = InternalRoomDetachCommandSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!command.success || command.data.roomId !== this.room.roomId) {
    return Response.json({ error: "INVALID_DETACH_COMMAND" }, { status: 400 });
  }
  return this.runRoomEndExclusively(
    () => this.handleParticipantDetach(command.data),
  );
}
```

Add a response helper beside `departureResponse`:

```ts
function detachResponse(outcome: "detached" | "stale"): Response {
  return Response.json({ ok: true, outcome });
}
```

When adapting this snippet to existing helpers in `index.ts`, preserve these exact semantics:

- lookup requires both `userId` and `participantSessionId`;
- a socket is removed/broadcast once through the current disconnect primitive;
- stored pending state is acknowledged directly;
- `deliverGuestParticipantDeparture` is never called;
- a later close/error callback for the already-detached socket cannot create a new pending record;
- the current winning socket is never selected by user ID alone.

- [ ] **Step 7: Run API route/runtime tests and verify the passive path still passes**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test -- routes.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test:runtime -- room-hibernation-runtime.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api check
```

Expected: PASS, including the pre-existing passive disconnect/alarm callback cases and legacy `/depart` cases.

- [ ] **Step 8: Commit the Worker cleanup boundary**

```bash
git add apps/api/src/index.ts apps/api/test/routes.test.ts apps/api/test/runtime/room-hibernation-runtime.ts
git commit -m "feat(rooms): add exact live participant detach"
```

---

### Task 3: Make Web Guest Departure Durable-First And Idempotent

**Files:**
- Modify: `apps/web/lib/anidachi-auth/active-room-session-routes.ts`
- Modify: `apps/web/lib/anidachi-auth/active-room-session-routes.test.ts`
- Modify: `apps/web/lib/anidachi-auth/room-lifecycle.ts`
- Modify: `apps/web/lib/anidachi-auth/room-lifecycle.test.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/depart/route.ts`
- Modify: `apps/web/app/api/rooms/active-session/depart/route.ts`

**Interfaces:**
- Consumes: Task 1 protocol types, Task 2 internal Worker detach endpoint, existing `getActiveRoomSessionAssignment`, `releaseActiveRoomSession`, `endHostLobbyForActiveSession`, and legacy `syncParticipantDepartureToWorker` for host finalization.
- Produces: `syncParticipantDetachToWorker(command, options)`, durable-first `handlePublicRoomDeparture`, and server-resolved `handleActiveRoomRecoveryDeparture` sharing one private resolved-assignment state machine.
- Public exact request remains `POST /api/rooms/:roomId/depart { participantSessionId }`.
- Emergency request remains `POST /api/rooms/active-session/depart { roomId }`.

- [ ] **Step 1: Replace Worker-first domain tests with authority-order and idempotency tests**

Use a single dependency factory whose calls are observable:

```ts
function departureDependencies(overrides = {}) {
  const calls: string[] = [];
  const events: RoomDepartureTelemetry[] = [];
  type TestAssignment = {
    userId: string;
    roomId: string;
    role: "host" | "member";
    participantSessionId: string;
  };
  let current: TestAssignment | null = {
    userId: USER_ID,
    roomId: ROOM_ID,
    role: "member",
    participantSessionId: SESSION_ID,
  };
  return {
    calls,
    events,
    dependencies: {
      getActiveAssignment: async () => {
        calls.push("read");
        return current;
      },
      releaseGuest: async () => {
        calls.push("release");
        current = null;
        return { outcome: "released" as const };
      },
      detachGuest: async () => {
        calls.push("detach");
        return { ok: true as const, outcome: "detached" as const };
      },
      syncHostDeparture: async () => {
        calls.push("host-worker");
        return { ok: true as const, outcome: "room_ended" as const };
      },
      endHostLobby: async () => {
        calls.push("host-fallback");
        return { outcome: "room_ended" as const };
      },
      report: (event: RoomDepartureTelemetry) => {
        events.push(event);
        calls.push(
          `report:${event.mode}:${event.durable}:${event.cleanup ?? "none"}`,
        );
      },
      ...overrides,
    },
  };
}

const MEMBER_ASSIGNMENT = {
  userId: USER_ID,
  roomId: ROOM_ID,
  role: "member" as const,
  participantSessionId: SESSION_ID,
};

function okResult(
  outcome: "departed" | "room_ended" | "already_departed" | "stale",
) {
  return { status: 200 as const, body: { ok: true as const, outcome } };
}

function unavailableResult() {
  return {
    status: 503 as const,
    body: {
      code: "ROOM_DEPARTURE_UNAVAILABLE" as const,
      message: "Could not leave right now. Please try again.",
      retryable: true as const,
    },
  };
}

async function recover(params: {
  current: typeof MEMBER_ASSIGNMENT | null;
  requestedRoomId?: string;
}) {
  const fixture = departureDependencies({
    getActiveAssignment: async () => params.current,
  });
  return handleActiveRoomRecoveryDeparture({
    userId: USER_ID,
    value: { roomId: params.requestedRoomId ?? ROOM_ID },
    requestedAt: 1_000,
    dependencies: fixture.dependencies,
  });
}
```

Add exact assertions for these independent behaviors:

```ts
assert.deepEqual(success.calls, [
  "read",
  "release",
  "detach",
  "report:exact:departed:detached",
]);
assert.deepEqual(noAssignment.result, {
  status: 200,
  body: { ok: true, outcome: "stale" },
});
assert.deepEqual(staleExact.result, {
  status: 200,
  body: { ok: true, outcome: "stale" },
});
assert.deepEqual(detachFailure.result, {
  status: 200,
  body: { ok: true, outcome: "departed" },
});
assert.deepEqual(detachFailure.events, [{
  mode: "exact",
  durable: "departed",
  cleanup: "failed",
}]);
assert.equal(JSON.stringify(detachFailure.events).includes(USER_ID), false);
assert.equal(JSON.stringify(detachFailure.events).includes(SESSION_ID), false);
assert.deepEqual(unchangedAfterReleaseMiss.result, {
  status: 503,
  body: {
    code: "ROOM_DEPARTURE_UNAVAILABLE",
    message: "Could not leave right now. Please try again.",
    retryable: true,
  },
});
```

For a release RPC returning `stale`, cover all three reread results and assert
cleanup is skipped because this request did not commit a release:

```ts
assert.deepEqual(noAssignmentAfterMiss.result, okResult("stale"));
assert.deepEqual(changedAfterMiss.result, okResult("stale"));
assert.deepEqual(identicalAfterMiss.result, unavailableResult());
assert.equal(noAssignmentAfterMiss.detachCalls, 0);
assert.equal(changedAfterMiss.detachCalls, 0);
assert.equal(identicalAfterMiss.detachCalls, 0);
```

Add database-read and release rejection cases with these exact assertions:

```ts
assert.deepEqual(readFailure.result, unavailableResult());
assert.deepEqual(releaseFailure.result, unavailableResult());
assert.equal(readFailure.detachCalls, 0);
assert.equal(releaseFailure.detachCalls, 0);
```

For a host, assert the legacy Worker path is isolated from guest mutation:

```ts
assert.deepEqual(hostWorkerSuccess.calls, ["read", "host-worker"]);
assert.deepEqual(hostWorkerSuccess.result, okResult("room_ended"));
assert.deepEqual(hostWorkerStale.calls, [
  "read",
  "host-worker",
  "host-fallback",
]);
assert.deepEqual(hostWorkerStale.result, okResult("room_ended"));
```

- [ ] **Step 2: Add recovery-mode race tests**

Add tests with server-selected session identity:

```ts
assert.deepEqual(await recover({ current: null }), {
  status: 200,
  body: { ok: true, outcome: "stale" },
});

assert.deepEqual(await recover({
  requestedRoomId: ROOM_ID,
  current: { ...MEMBER_ASSIGNMENT, roomId: "new-room" },
}), {
  status: 409,
  body: {
    code: "ACTIVE_ROOM_CHANGED",
    message: "Your active room changed. Nothing was removed.",
  },
});
```

Simulate a matching initial assignment followed by a changed assignment after a
stale release RPC and assert the mode-specific result:

```ts
assert.deepEqual(recoveryRace.result, {
  status: 409,
  body: {
    code: "ACTIVE_ROOM_CHANGED",
    message: "Your active room changed. Nothing was removed.",
  },
});
assert.deepEqual(exactRace.result, {
  status: 200,
  body: { ok: true, outcome: "stale" },
});
```

- [ ] **Step 3: Run the Web domain test and verify old Worker-first expectations fail**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test -- active-room-session-routes.test.ts
```

Expected: FAIL because current code calls Worker before the release and has no
legacy-compatible no-assignment acknowledgement, typed `503`, or `detachGuest`
dependency.

- [ ] **Step 4: Implement one resolved-assignment departure state machine**

Use explicit modes and dependency types:

```ts
type DepartureMode = "exact" | "confirmed_recovery";

export type RoomDepartureTelemetry = {
  mode: DepartureMode;
  durable: "departed" | "already_departed" | "stale" | "failed";
  cleanup?: "detached" | "stale" | "timeout" | "failed";
};

type DepartureDependencies = {
  getActiveAssignment(userId: string): Promise<CurrentAssignment | null>;
  releaseGuest(
    assignment: ExactAssignment,
  ): Promise<{ outcome: "released" | "stale" }>;
  detachGuest(
    command: InternalRoomDetachCommand,
  ): Promise<RoomDetachAcknowledgement>;
  syncHostDeparture(
    command: InternalRoomDepartureCommand,
  ): Promise<RoomDepartureAcknowledgement>;
  endHostLobby(
    command: ExactAssignment & { endedAt: string },
  ): Promise<{ outcome: "room_ended" | "stale" }>;
  report(event: RoomDepartureTelemetry): void;
};

export function reportRoomDepartureOutcome(
  event: RoomDepartureTelemetry,
): void {
  console.info("[anidachi/room-departure]", JSON.stringify(event));
}

const unavailable = (): RouteResult => ({
  status: 503,
  body: {
    code: "ROOM_DEPARTURE_UNAVAILABLE",
    message: "Could not leave right now. Please try again.",
    retryable: true,
  },
});
```

The public exact handler must:

```ts
const assignment = await dependencies
  .getActiveAssignment(userId)
  .catch(() => undefined);
if (assignment === undefined) return unavailable();
if (!assignment) return ok("stale");
if (
  assignment.roomId !== roomId ||
  assignment.participantSessionId !== request.data.participantSessionId
) {
  return ok("stale");
}
return departResolvedAssignment({
  assignment,
  requestedAt,
  mode: "exact",
  dependencies,
});
```

The private resolver must branch host before guest release. For a member:

```ts
const exact = {
  userId: assignment.userId,
  roomId: assignment.roomId,
  participantSessionId: assignment.participantSessionId,
};
const released = await dependencies.releaseGuest(exact).catch(() => null);
if (!released) return unavailable();

if (released.outcome === "released") {
  const command = InternalRoomDetachCommandSchema.parse({
    ...exact,
    requestedAt,
  });
  let cleanup: RoomDepartureTelemetry["cleanup"];
  try {
    cleanup = (await dependencies.detachGuest(command)).outcome;
  } catch (error) {
    cleanup = error instanceof Error && error.name === "AbortError"
      ? "timeout"
      : "failed";
  }
  dependencies.report({ mode, durable: "departed", cleanup });
  return ok("departed");
}

const current = await dependencies
  .getActiveAssignment(assignment.userId)
  .catch(() => undefined);
if (current === undefined) return unavailable();
if (!current) return ok("stale");
if (!sameAssignment(current, assignment)) {
  return mode === "confirmed_recovery" ? activeRoomChanged() : ok("stale");
}
return unavailable();
```

The host branch must keep existing behavior:

```ts
try {
  const worker = await dependencies.syncHostDeparture(
    InternalRoomDepartureCommandSchema.parse({ ...exact, requestedAt }),
  );
  if (worker.outcome === "room_ended") return { status: 200, body: worker };
  if (worker.outcome !== "stale") return unavailable();
} catch {
  return unavailable();
}

const ended = await dependencies
  .endHostLobby({
    ...exact,
    endedAt: new Date(requestedAt).toISOString(),
  })
  .catch(() => null);
return ended ? ok(ended.outcome) : unavailable();
```

Call `dependencies.report` once for each guest terminal branch: durable
`already_departed`, `stale`, or `failed` has no cleanup field; durable
`departed` has `detached`, `stale`, `timeout`, or `failed`. Do not include room,
user, session, source, token, name, or content fields. Host branches keep the
existing room-end telemetry and do not emit guest-departure telemetry.

The recovery handler validates `{ roomId }`, reads the assignment once, returns
legacy-compatible `stale` for null, returns typed `409` for a different room,
then calls the same resolver with `mode: "confirmed_recovery"`. It never calls
the public exact handler and never trusts a client-selected session ID.

- [ ] **Step 5: Add failing lifecycle-client tests for exact URL, schema, and abort timeout**

Add these tests to `room-lifecycle.test.ts`:

```ts
const command = {
  roomId: "room-1",
  userId: "user-1",
  participantSessionId: "session-1",
  requestedAt: 1_000,
};
const acknowledgement = await syncParticipantDetachToWorker(command, {
  baseUrl: "https://worker.test",
  secret: "internal-secret",
  timeoutMs: 25,
  fetch: async (input, init) => {
    assert.equal(
      input.toString(),
      "https://worker.test/internal/rooms/room-1/participants/user-1/detach",
    );
    assert.equal(init?.method, "POST");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer internal-secret",
    );
    return Response.json({ ok: true, outcome: "detached" });
  },
});
assert.deepEqual(acknowledgement, { ok: true, outcome: "detached" });
```

Add invalid acknowledgement and HTTP `500` cases:

```ts
await assert.rejects(
  syncParticipantDetachToWorker(command, {
    baseUrl: "https://worker.test",
    secret: "internal-secret",
    fetch: async () => Response.json({ ok: true, outcome: "departed" }),
  }),
  /invalid response/i,
);
await assert.rejects(
  syncParticipantDetachToWorker(command, {
    baseUrl: "https://worker.test",
    secret: "internal-secret",
    fetch: async () => new Response(null, { status: 500 }),
  }),
  /failed \(500\)/i,
);
```

Add an abort-aware fetch and assert the configured timeout reaches its signal:

```ts
let aborted = false;
await assert.rejects(
  syncParticipantDetachToWorker(command, {
    baseUrl: "https://worker.test",
    secret: "internal-secret",
    timeoutMs: 25,
    fetch: async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      }),
  }),
  /aborted/i,
);
assert.equal(aborted, true);
```

- [ ] **Step 6: Implement the bounded Worker detach client**

Add a dedicated default and always clean up its timer:

```ts
const PARTICIPANT_DETACH_TIMEOUT_MS = 1_000;

export async function syncParticipantDetachToWorker(
  command: InternalRoomDetachCommand,
  options: {
    baseUrl?: string;
    secret?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<RoomDetachAcknowledgement> {
  const parsed = InternalRoomDetachCommandSchema.parse(command);
  const baseUrl = options.baseUrl ?? process.env.ANIDACHI_API_INTERNAL_BASE_URL;
  const secret = options.secret ?? process.env.ANIDACHI_INTERNAL_API_SECRET;
  if (!baseUrl || !secret) {
    throw new Error("Participant detach Worker synchronization is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? PARTICIPANT_DETACH_TIMEOUT_MS,
  );
  try {
    const response = await (options.fetch ?? fetch)(
      new URL(
        `/internal/rooms/${encodeURIComponent(parsed.roomId)}` +
          `/participants/${encodeURIComponent(parsed.userId)}/detach`,
        baseUrl,
      ),
      {
        method: "POST",
        headers: {
          Authorization: internalServiceAuthorization(secret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Worker participant detach failed (${response.status})`);
    }
    const acknowledgement = RoomDetachAcknowledgementSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!acknowledgement.success) {
      throw new Error("Worker participant detach returned an invalid response");
    }
    return acknowledgement.data;
  } finally {
    clearTimeout(timeout);
  }
}
```

Keep `syncParticipantDepartureToWorker` unchanged for the host/legacy path.

- [ ] **Step 7: Simplify both route handlers around server-owned assignment state**

In the exact route, remove `getRoomById` and `isRoomMember`. Pass these dependencies:

```ts
dependencies: {
  getActiveAssignment: getActiveRoomSessionAssignment,
  releaseGuest: releaseActiveRoomSession,
  detachGuest: syncParticipantDetachToWorker,
  syncHostDeparture: syncParticipantDepartureToWorker,
  endHostLobby: endHostLobbyForActiveSession,
  report: reportRoomDepartureOutcome,
}
```

Return typed auth before domain delegation:

```ts
if (!session) {
  return NextResponse.json(
    { code: "AUTH_REQUIRED", message: "Sign in again before leaving." },
    { status: 401 },
  );
}
```

Use the same dependency object in the emergency route. Do not call one public route from the other.

- [ ] **Step 8: Run focused Web tests, then the full Web gate**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test -- active-room-session-routes.test.ts room-lifecycle.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web check
```

Expected: PASS; tests prove database release precedes detach and every post-commit detach result still returns HTTP `200 departed`.

- [ ] **Step 9: Commit the durable Web authority change**

```bash
git add \
  apps/web/lib/anidachi-auth/active-room-session-routes.ts \
  apps/web/lib/anidachi-auth/active-room-session-routes.test.ts \
  apps/web/lib/anidachi-auth/room-lifecycle.ts \
  apps/web/lib/anidachi-auth/room-lifecycle.test.ts \
  'apps/web/app/api/rooms/[roomId]/depart/route.ts' \
  apps/web/app/api/rooms/active-session/depart/route.ts
git commit -m "fix(rooms): commit guest departure before live cleanup"
```

---

### Task 4: Centralize The Staging Internal-Service Boundary

**Files:**
- Modify: `apps/web/lib/staging-access.ts`
- Modify: `apps/web/lib/staging-access.test.ts`
- Create: `apps/web/lib/internal-service-auth.test.ts`

**Interfaces:**
- Consumes: existing `canBypassStagingGate` bearer-presence check and `hasValidInternalServiceAuthorization` exact constant-time secret verification.
- Produces: one staging-password bypass rule for bearer-authenticated `POST /api/internal/**`; route-level internal secret authorization remains mandatory.

- [ ] **Step 1: Add failing staging-boundary tests**

Add a matrix that proves path generality without widening method/header semantics:

```ts
for (const pathname of [
  "/api/internal/rooms/room-1/ended",
  "/api/internal/rooms/room-1/source",
  "/api/internal/rooms/room-1/participants/user-1/departed",
  "/api/internal/future/nested/callback",
]) {
  assert.equal(
    canBypassStagingGate({
      pathname,
      method: "POST",
      authorization: "Bearer service-token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({ pathname, method: "POST" }),
    false,
  );
  assert.equal(
    canBypassStagingGate({
      pathname,
      method: "GET",
      authorization: "Bearer service-token",
    }),
    false,
  );
}
```

Add a new auth-helper test:

```ts
assert.equal(
  hasValidInternalServiceAuthorization(
    "Bearer exact-secret",
    "exact-secret",
  ),
  true,
);
assert.equal(
  hasValidInternalServiceAuthorization(
    "Bearer arbitrary-bypass-token",
    "exact-secret",
  ),
  false,
);
assert.equal(
  hasValidInternalServiceAuthorization(null, "exact-secret"),
  false,
);
```

- [ ] **Step 2: Run focused Web tests and verify the missing participant callback bypass fails**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test -- staging-access.test.ts internal-service-auth.test.ts
```

Expected: FAIL because the participant callback and future nested internal path are absent from the current per-route list.

- [ ] **Step 3: Replace internal per-route exceptions with one transport rule**

At the top of `canBearerBypassStagingGate`, after method normalization, add:

```ts
if (pathname.startsWith("/api/internal/") && method === "POST") {
  return true;
}
```

Remove the individual `/api/internal/rooms/:roomId/ended` and `/source` regex branches. Do not bypass `GET`, non-bearer requests, `/api/internal` without the trailing slash, or any non-internal path beyond its existing rules.

- [ ] **Step 4: Run staging/auth tests and the full Web gate**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test -- staging-access.test.ts internal-service-auth.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web check
```

Expected: PASS; a bearer reaches the internal route through the human staging gate, while an arbitrary token still fails exact service authentication.

- [ ] **Step 5: Commit the centralized staging boundary**

```bash
git add apps/web/lib/staging-access.ts apps/web/lib/staging-access.test.ts apps/web/lib/internal-service-auth.test.ts
git commit -m "fix(staging): centralize internal callback bypass"
```

---

### Task 5: Keep Normal Extension Leave Exact And Preserve Typed Failures

**Files:**
- Modify: `apps/extension/src/room-departure.ts`
- Modify: `apps/extension/test/room-departure.test.ts`
- Modify: `apps/extension/test/privileged-overlay-wiring.test.tsx`

**Interfaces:**
- Consumes: Task 1 public acknowledgement/error schemas and existing background tab `RoomSessionRecord`.
- Produces: exact normal leave that never calls emergency recovery, typed `RoomDepartureRequestResult`, and local teardown for all four successful outcomes.
- Preserves: one auth-refresh retry for explicit requests, Worker-owned passive
  socket-close grace, the separately confirmed `requestActiveRoomRecovery`,
  and exact local tab-record clearing.

- [ ] **Step 1: Add failing tests for all success outcomes and typed failures**

Expand the success table:

```ts
for (const outcome of [
  "departed",
  "room_ended",
  "already_departed",
  "stale",
] as const) {
  const onConfirmed = vi.fn();
  await expect(
    confirmExplicitRoomDeparture({
      requestDeparture: async () => outcome,
      onConfirmed,
    }),
  ).resolves.toBe(outcome);
  expect(onConfirmed).toHaveBeenCalledOnce();
  expect(onConfirmed).toHaveBeenCalledWith(outcome);
}
```

Add fetch-response parsing tests:

```ts
expect(await departWebsiteRoomFromApi(record, token, signal, fetch503)).toEqual({
  kind: "retryable",
  code: "ROOM_DEPARTURE_UNAVAILABLE",
  message: "Could not leave right now. Please try again.",
});
expect(await departWebsiteRoomFromApi(record, token, signal, fetch409)).toEqual({
  kind: "active-room-changed",
  message: "Your active room changed. Nothing was removed.",
});
expect(await departWebsiteRoomFromApi(record, token, signal, fetch401)).toEqual({
  kind: "unauthorized",
});
```

Add exact no-cascade assertions:

```ts
const recoverActiveDeparture = vi.fn();
await expect(
  handleExplicitRoomDeparture(16, "room-a", "user-a", {
    loadRoomSession: async () => null,
    recoverActiveDeparture,
  }),
).resolves.toBe("no-session");
expect(recoverActiveDeparture).not.toHaveBeenCalled();

const depart = vi.fn().mockResolvedValue({ kind: "ack", outcome: "stale" });
await expect(
  handleExplicitRoomDeparture(16, "room-a", "user-a", {
    loadRoomSession: async () => record,
    depart,
    recoverActiveDeparture,
  }),
).resolves.toBe("stale");
expect(recoverActiveDeparture).not.toHaveBeenCalled();
```

Keep a separate test proving only the explicit recovery runtime command invokes
the emergency endpoint:

```ts
const recoverActiveDeparture = vi.fn().mockResolvedValue({
  kind: "ack",
  outcome: "departed",
});
await expect(
  handleActiveRoomRecovery("room-a", "user-a", {
    getStoredSession: async () => authSession(),
    refreshSession: async () => null,
    recoverActiveDeparture,
  }),
).resolves.toBe("departed");
expect(recoverActiveDeparture).toHaveBeenCalledOnce();
```

Replace the closed-tab accelerator tests with a passive-close boundary test:

```ts
it("clears only local tab state and leaves passive departure to the Worker", async () => {
  const requestDeparture = vi.fn();
  const recoverActiveDeparture = vi.fn();
  const clearRoomSession = vi.fn(async () => true);

  await expect(
    handleRoomTabDeparture(11, {
      loadRoomSession: async () => roomSession(),
      requestDeparture,
      recoverActiveDeparture,
      clearRoomSession,
    }),
  ).resolves.toBe("closed");

  expect(requestDeparture).not.toHaveBeenCalled();
  expect(recoverActiveDeparture).not.toHaveBeenCalled();
  expect(clearRoomSession).toHaveBeenCalledWith(11, roomSession());
});
```

Keep separate missing-record and storage-read-failure tests with these
assertions:

```ts
await expect(handleRoomTabDeparture(12, {
  loadRoomSession: async () => null,
  requestDeparture,
  recoverActiveDeparture,
  clearRoomSession,
})).resolves.toBe("no-session");
expect(clearRoomSession).toHaveBeenCalledWith(12, null);

await expect(handleRoomTabDeparture(13, {
  loadRoomSession: async () => { throw new Error("storage unavailable"); },
  requestDeparture,
  recoverActiveDeparture,
  clearRoomSession,
})).resolves.toBe("failed");
expect(clearRoomSession).toHaveBeenCalledWith(13, null);
expect(requestDeparture).not.toHaveBeenCalled();
expect(recoverActiveDeparture).not.toHaveBeenCalled();
```

- [ ] **Step 2: Add UI wiring tests for recoverable failure versus confirmed success**

In `privileged-overlay-wiring.test.tsx`, assert the leave action follows these two paths:

```ts
expect(source).toContain(
  "requestCurrentRoomDeparture(activeRoomId, expectedUserId)",
);
expect(source).toContain(
  "onConfirmed: () => resetLocalRoomSession(undefined, true)",
);
expect(source).toContain("roomReconnectSuppressedRef.current = false");
expect(source).toContain('scheduleRoomReconnect("leave-failed")');
```

Slice the source between handler declarations and assert emergency recovery is
absent from normal leave:

```ts
const recoverySlice = source.slice(
  source.indexOf("const handleRecoverActiveRoom"),
  source.indexOf("const handleEndRoom"),
);
const leaveSlice = source.slice(
  source.indexOf("const handleLeaveRoom"),
  source.indexOf("const reloadPage"),
);
expect(recoverySlice).toContain("requestActiveRoomRecovery(");
expect(recoverySlice).toContain("activeRoomRecoveryConfirmationPending");
expect(leaveSlice).not.toContain("requestActiveRoomRecovery(");
```

- [ ] **Step 3: Run focused extension tests and verify current recovery fallback fails the new assertions**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- room-departure.test.ts privileged-overlay-wiring.test.tsx
```

Expected: FAIL because missing exact records and stale exact responses currently
invoke active-session recovery, closed tabs still call the exact public route,
and `already_departed` is not accepted.

- [ ] **Step 4: Introduce typed request results and error mapping**

Use these request-result variants:

```ts
export type RoomDepartureRequestResult =
  | { kind: "ack"; outcome: RoomDepartureAcknowledgement["outcome"] }
  | { kind: "unauthorized" }
  | { kind: "active-room-changed"; message: string }
  | {
      kind: "retryable";
      code: "ROOM_DEPARTURE_UNAVAILABLE";
      message: string;
    }
  | { kind: "failed" };

type ConfirmedRoomDepartureOutcome =
  RoomDepartureAcknowledgement["outcome"];
```

Parse non-success bodies before generic failure:

```ts
const body = await response.json().catch(() => null);
if (response.ok) {
  const acknowledgement = RoomDepartureAcknowledgementSchema.safeParse(body);
  return acknowledgement.success
    ? { kind: "ack", outcome: acknowledgement.data.outcome }
    : { kind: "failed" };
}

const error = RoomDepartureErrorResponseSchema.safeParse(body);
if (response.status === 401 && error.success && error.data.code === "AUTH_REQUIRED") {
  return { kind: "unauthorized" };
}
if (
  response.status === 409 &&
  error.success &&
  error.data.code === "ACTIVE_ROOM_CHANGED"
) {
  return { kind: "active-room-changed", message: error.data.message };
}
if (
  response.status === 503 &&
  error.success &&
  error.data.code === "ROOM_DEPARTURE_UNAVAILABLE"
) {
  return {
    kind: "retryable",
    code: error.data.code,
    message: error.data.message,
  };
}
return { kind: "failed" };
```

Map the typed retryable result to its bounded user message and keep the current single refresh only for `unauthorized`.

- [ ] **Step 5: Remove the hidden exact-to-emergency cascade**

Change normal explicit departure to return a local-state outcome when the exact record is unavailable:

```ts
if (!record) return "no-session";
if (record.ownerUserId !== expectedUserId) return "account-changed";
if (record.roomId !== requestedRoomId) return "failed";
return notifyBoundedDeparture(record, dependencies);
```

Remove the `recoverStale` parameter from `notifyBoundedDeparture` and `notifyExactDeparture`. An exact `stale` acknowledgement is a successful local-tab outcome and must be returned directly. Keep `notifyBoundedActiveDeparture` reachable only through `handleActiveRoomRecovery` and the `recover-active` runtime command.

Do not clear the background record or local media on `retryable`, `failed`, timeout, auth failure, or account change. `confirmExplicitRoomDeparture` must call `onConfirmed` only for protocol acknowledgements.

Make tab close a local-only operation so WebSocket close/error starts the
existing Worker grace path:

```ts
export async function handleRoomTabDeparture(
  tabId: number,
  dependencies: RoomTabDepartureDependencies = {},
): Promise<"closed" | "no-session" | "failed"> {
  const loadRoomSession = dependencies.loadRoomSession ?? loadRoomSessionForTab;
  const clearRoomSession =
    dependencies.clearRoomSession ?? clearRoomSessionForClosedTab;
  let record: RoomSessionRecord | null;
  try {
    record = await loadRoomSession(tabId);
  } catch {
    await clearRoomSession(tabId, null).catch(() => false);
    return "failed";
  }
  await clearRoomSession(tabId, record).catch(() => false);
  return record ? "closed" : "no-session";
}
```

Do not refresh auth or call `departWebsiteRoomFromApi` from this tab-close
handler. The content script's socket disappearance is the passive signal; the
Durable Object owns pending persistence, same-session reconnect cancellation,
the 60-second deadline, and signed callback retries.

- [ ] **Step 6: Run extension tests and typecheck**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- room-departure.test.ts privileged-overlay-wiring.test.tsx
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS; all four acknowledgements tear down once, retryable failure keeps state, and normal leave never requests emergency recovery.

- [ ] **Step 7: Commit the exact extension departure behavior**

```bash
git add apps/extension/src/room-departure.ts apps/extension/test/room-departure.test.ts apps/extension/test/privileged-overlay-wiring.test.tsx
git commit -m "fix(extension): keep room leave exact and recoverable"
```

---

### Task 6: Cross-Plane Regression Gates, Documentation, And Staging Candidate

**Files:**
- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- Conditionally modify after one intentional refresh: `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/manifest.json`

**Interfaces:**
- Consumes: completed Tasks 1-5 and the approved design spec.
- Produces: reproducible automated evidence, a validated local staging extension artifact, honest documentation of remaining two-profile staging acceptance, and one final semantic graph refresh.
- Does not produce: a production deployment, `main` promotion, public extension release, committed zip, or committed generated extension directory.

- [ ] **Step 1: Run plane-specific checks before the broad suite**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test:runtime
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
```

Expected: all commands PASS. If a failure appears, stop this task, fix the owning task with a focused regression test, rerun that plane, and only then resume this gate.

- [ ] **Step 2: Run room signaling and real-WebRTC harnesses**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm harness:rooms
npm --prefix tests/e2e install
npm --prefix tests/e2e exec playwright install chromium
npm --prefix tests/e2e run harness:p2p
```

Expected: both room signaling and real-WebRTC harnesses PASS without reconnect, camera, microphone, or participant-presence regressions.

- [ ] **Step 3: Run repository room-profile gates**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm check
fnm exec --using="$(cat .node-version)" pnpm test
fnm exec --using="$(cat .node-version)" pnpm dev:check -- --profile rooms
```

Expected: PASS. Record command names and pass counts in the implementation handoff; do not claim browser/staging acceptance from automated output.

- [ ] **Step 4: Build and validate the local staging extension artifact**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
```

Expected: PASS with narrow staging permissions. Leave `anidachi-extension-staging/` and any zip untracked/ignored; do not add them to Git.

- [ ] **Step 5: Perform the loaded two-profile staging acceptance after deployment is explicitly authorized**

Use one host and one guest profile on both YouTube and Crunchyroll. Record each exact result:

```txt
[ ] Guest normal leave -> immediate create succeeds
[ ] Guest double leave -> no error and no active-room conflict
[ ] Worker detach forced unavailable after durable release -> local teardown and create still succeed
[ ] Old same-room tab leaves -> winning tab remains connected
[ ] Confirmed emergency action clears a genuinely lost local assignment
[ ] Passive guest tab close -> release occurs after 60-second grace and host room remains
[ ] Host close/end -> existing room-end behavior and usage finalization remain
[ ] Valid internal callback crosses staging gate
[ ] Invalid internal bearer reaches route but receives 401
[ ] Camera, microphone, participant volume, reactions, pills, and layout remain stable
```

This step is intentionally pending until Web, Worker, and extension staging deployment is approved. A local green build is not a substitute.

- [ ] **Step 6: Update canonical state and active room plans without overstating acceptance**

Add a dated entry containing these exact facts:

```md
- Explicit guest departure now commits the exact Supabase active-room release
  before bounded live Worker cleanup. Worker cleanup failure no longer blocks a
  durable leave. The Worker 60-second passive alarm callback is retained; the
  hidden tab-close HTTP accelerator was removed and ordinary tab close is local-only.
- Normal extension leave stays exact and no longer invokes confirmed active-room
  recovery automatically. Public Web uses `stale` for no-assignment
  idempotency so deployed strict clients remain compatible; the shared schema
  and current extension still accept `already_departed` for forward compatibility.
- A late admission after passive tab removal persists a background-owned exact
  retry only when the first compensation is unconfirmed. It coalesces,
  survives restart, waits for matching auth, and cannot touch a replacement.
- Automated protocol/Web/API/runtime/extension/room/WebRTC gates: [record actual
  command results from Steps 1-4].
- Staging two-profile YouTube/Crunchyroll acceptance: pending until the candidate
  is deployed and manually exercised.
```

Do not mark the roadmap item production-ready or accepted until Step 5 is actually completed.

- [ ] **Step 7: Refresh Graphify once for the completed code-and-doc change**

Invoke the project Graphify skill for `.` with `--update` so semantic docs and code are refreshed together. Include only these team artifacts if the refresh changes them:

```bash
git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
```

Do not add `graphify-out/cost.json`, HTML/wiki exports, cache files, or scoped scratch graphs. If the graph refresh produces no meaningful tracked change, leave Graphify files untouched and record that status in the handoff.

- [ ] **Step 8: Run final repository hygiene checks**

Run:

```bash
git diff --check
git status --short
git diff --stat origin/staging...HEAD
git log --oneline --decorate origin/staging..HEAD
```

Expected: no whitespace errors, no secrets/generated artifacts/local profiles, and only the spec, plan, product code, tests, canonical docs, and intentional team Graphify artifacts are present.

- [ ] **Step 9: Commit documentation and intentional graph evidence**

If Graphify changed meaningfully:

```bash
git add \
  docs/current-development-state.md \
  docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md \
  docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md \
  graphify-out/graph.json \
  graphify-out/GRAPH_REPORT.md \
  graphify-out/manifest.json
git commit -m "docs(rooms): record authoritative departure evidence"
```

If Graphify did not change:

```bash
git add \
  docs/current-development-state.md \
  docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md \
  docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md
git commit -m "docs(rooms): record authoritative departure evidence"
```

- [ ] **Step 10: Prepare the staging PR handoff without publishing it automatically**

Summarize:

```txt
Root cause: reverse Worker-to-Web callback was rejected by the staging gate.
Architecture: exact durable guest release first, bounded live detach second.
Compatibility: legacy Worker /depart retained; Worker 60-second passive alarm
callback retained; hidden tab-close HTTP accelerator removed/local-only; public
no-assignment acknowledgement remains legacy-compatible stale.
Automated proof: list every command and actual result from Steps 1-4.
Manual proof: list completed or pending items from Step 5.
Environment impact: no migration, secret, env var, permission, or new service.
Rollback: redeploy prior Web/Worker/extension artifacts together; no data rollback.
Graphify: record refreshed/not needed and the query used.
```

Wait for explicit approval before push, PR creation, staging deployment, merge, zip creation, or production promotion.
