# Account Contracts And Popup Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the web account APIs and extension Popup shared runtime-validated read contracts, then guarantee that cached or late data from one AniDachi account can never appear under another account.

**Architecture:** `packages/protocol` becomes the owner of the existing watch-library and social-read response shapes. `apps/web` adds versioned metadata to those read responses without changing database behavior, while `apps/extension` parses every response before use or caching. A small account-generation gate and account-owned state helpers make Popup updates conditional on the currently authenticated user, and social snapshots receive the same account-scoped cache treatment already used by watch history.

**Tech Stack:** TypeScript 6, Zod 4, Next.js route handlers, React, WXT Manifest V3 storage, Vitest, pnpm 11.2.2, Node 22.23.1.

## Global Constraints

- This is rollout slice 1 from `docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md`.
- Do not change database tables, Supabase RPCs, retention rules, limits, friendship transitions, invite transitions, room behavior, provider adapters, P2P media, or the visual in-player panel.
- Keep all changes additive at the HTTP boundary. Existing fields remain present; read responses gain `meta`.
- `AccountResponseMeta.schemaVersion` is exactly `1`; `serverTime` is a UTC ISO-8601 timestamp produced by the server.
- Account identity comes only from the validated extension session. Never infer it from cached payloads or request bodies.
- Previous-account data is hidden immediately when the active user changes or signs out.
- Cached data is usable only when the cache owner equals the active authenticated user and its protocol schema parses successfully.
- Late requests and late mutations from a previous account generation must not update React state, caches, watch stores, busy state, notices, or open tabs.
- The extension must not add permissions or secrets in this slice.
- Branch flow remains feature branch -> PR into `staging` -> staging artifact acceptance -> later promotion to `main`.

---

## File Map

### New files

- `packages/protocol/src/account.ts`: Zod schemas, schema version, and inferred account-read types.
- `packages/protocol/test/account.test.ts`: valid round trips and rejection coverage for account contracts.
- `apps/web/lib/anidachi-auth/account-response.ts`: one pure metadata factory used by account read builders and routes.
- `apps/web/lib/anidachi-auth/account-response.test.ts`: metadata factory tests.
- `apps/extension/src/account-sync.ts`: request-generation gate and account-owned remote-state helpers.
- `apps/extension/test/account-sync.test.ts`: identity-switch, stale-response, and data-visibility tests.
- `apps/extension/src/social-snapshot-cache.ts`: versioned account-scoped cache for validated social read data.
- `apps/extension/test/social-snapshot-cache.test.ts`: owner, corruption, and partition tests.

### Existing files to modify

- `packages/protocol/src/index.ts`: export account contracts.
- `apps/web/lib/anidachi-auth/watch-library.ts`: use shared types and attach response metadata.
- `apps/web/app/api/friends/route.ts`: attach metadata to the friends read response.
- `apps/web/app/api/groups/route.ts`: attach metadata to the groups read response.
- `apps/web/app/api/invites/route.ts`: attach metadata to the invites read response.
- `apps/web/lib/anidachi-auth/watch-library.test.ts`: assert the shared contract parses the real builder result.
- `apps/extension/src/watch-library-client.ts`: replace permissive normalization with Zod parsing and a versioned cache envelope.
- `apps/extension/test/watch-library-client.test.ts`: cover invalid server payloads and old/corrupt caches.
- `apps/extension/src/social-client.ts`: import shared types and parse friends, groups, invite, and entity responses.
- `apps/extension/test/social-client.test.ts`: cover valid and malformed HTTP payloads.
- `apps/extension/src/popup-app.tsx`: activate account generations, use account-owned states, read/write the social cache, and guard every async completion.

---

### Task 1: Shared Account Read Contracts

**Files:**
- Create: `packages/protocol/src/account.ts`
- Create: `packages/protocol/test/account.test.ts`
- Modify: `packages/protocol/src/index.ts`

**Interfaces:**
- Produces: `ACCOUNT_RESPONSE_SCHEMA_VERSION`, `AccountResponseMetaSchema`, `PublicProfileSchema`, `FriendListItemSchema`, `FriendGroupSchema`, `FriendListResponseSchema`, `FriendGroupsResponseSchema`, `InviteTargetsSchema`, `RoomInviteSchema`, `RoomInvitesResponseSchema`, `AcceptedRoomInviteResponseSchema`, `SocialSnapshotSchema`, `WatchLibraryResponseSchema`, and their inferred TypeScript types.
- Consumes: Zod 4 only; this module has no database, React, browser, or provider-observation imports.

- [x] **Step 1: Write failing protocol tests for the canonical fixtures**

Create `packages/protocol/test/account.test.ts` with fixed UUIDs and timestamps. The fixture must exercise a shared watch session, one accepted friend, one active group, one pending room invite, and response metadata:

```ts
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_RESPONSE_SCHEMA_VERSION,
  FriendGroupsResponseSchema,
  FriendListResponseSchema,
  RoomInvitesResponseSchema,
  SocialSnapshotSchema,
  WatchLibraryResponseSchema,
} from "../src";

const NOW = "2026-08-06T12:00:00.000Z";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP_ID = "33333333-3333-4333-8333-333333333333";
const GROUP_ID = "44444444-4444-4444-8444-444444444444";
const INVITE_ID = "55555555-5555-4555-8555-555555555555";
const ROOM_ID = "66666666-6666-4666-8666-666666666666";
const SESSION_ID = "77777777-7777-4777-8777-777777777777";

const meta = { serverTime: NOW, schemaVersion: 1 as const };
const userB = { userId: USER_B, handle: "ren", displayName: "Ren", avatarUrl: null };
const friend = {
  friendshipId: FRIENDSHIP_ID,
  user: userB,
  status: "accepted" as const,
  direction: "mutual" as const,
  requestedAt: NOW,
  respondedAt: NOW,
  updatedAt: NOW,
};
const group = {
  id: GROUP_ID,
  name: "Friday anime",
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  members: [{ user: userB, addedAt: NOW }],
};
const invite = {
  id: INVITE_ID,
  roomId: ROOM_ID,
  sender: userB,
  targetKind: "direct" as const,
  targetGroupId: null,
  message: null,
  roomTitle: "One-Punch Man",
  sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  videoFingerprint: "youtube:abcdefghijk",
  createdAt: NOW,
  expiresAt: "2026-08-06T13:00:00.000Z",
  recipients: [{ user: userB, status: "pending" as const, updatedAt: NOW, respondedAt: null }],
};

describe("account response contracts", () => {
  it("round-trips matching social records across the public read schemas", () => {
    const friends = FriendListResponseSchema.parse({
      meta,
      friends: [friend],
      incomingRequests: [],
      outgoingRequests: [],
      blocked: [],
    });
    const groups = FriendGroupsResponseSchema.parse({ meta, groups: [group] });
    const invites = RoomInvitesResponseSchema.parse({ meta, inbox: [invite], sent: [] });

    expect(SocialSnapshotSchema.parse({
      targets: { friends: friends.friends, groups: groups.groups },
      invites,
    })).toEqual({
      targets: { friends: [friend], groups: [group] },
      invites,
    });
    expect(ACCOUNT_RESPONSE_SCHEMA_VERSION).toBe(1);
  });

  it("parses a versioned watch library response", () => {
    expect(() => WatchLibraryResponseSchema.parse({
      meta,
      generatedAt: NOW,
      limits: {
        planCode: "plus",
        maxActiveTrackedTitles: 100,
        activeTrackedTitleCount: 1,
        historyRetentionDays: 90,
        retainedSince: "2026-05-08T12:00:00.000Z",
      },
      items: [{
        provider: "youtube",
        itemKey: "abcdefghijk",
        itemKind: "movie",
        itemTitle: "Demo",
        sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        artworkUrl: null,
        active: true,
        lastWatchedAt: NOW,
        episodes: [{
          episodeKey: "abcdefghijk",
          episodeTitle: "Demo",
          seasonId: null,
          seasonTitle: null,
          seasonNumber: null,
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
          currentTime: 60,
          duration: 600,
          progress: 0.1,
          lastWatchedAt: NOW,
          sessions: [{
            id: SESSION_ID,
            roomId: ROOM_ID,
            hostUserId: USER_A,
            kind: "shared",
            currentTime: 60,
            duration: 600,
            progress: 0.1,
            startedAt: NOW,
            endedAt: null,
            lastWatchedAt: NOW,
            participants: [{
              user: userB,
              role: "viewer",
              currentTime: 60,
              progress: 0.1,
              joinedAt: NOW,
              leftAt: null,
              updatedAt: NOW,
            }],
          }],
        }],
      }],
    })).not.toThrow();
  });
});
```

- [x] **Step 2: Run protocol tests and confirm the new exports are missing**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol test -- account.test.ts
```

Expected: FAIL because `../src` does not export the account schemas.

- [x] **Step 3: Implement bounded Zod schemas and inferred types**

Create `packages/protocol/src/account.ts`. Use strict objects at HTTP boundaries, `z.iso.datetime()` for server timestamps, UUIDs for durable user/friend/group/invite/session identifiers, a bounded string for room IDs, URL validation for non-null URL fields, non-negative finite numbers for playback values, and `z.number().min(0).max(1)` for progress.

The public top-level definitions must have these exact shapes:

```ts
import { z } from "zod";

export const ACCOUNT_RESPONSE_SCHEMA_VERSION = 1 as const;

const TimestampSchema = z.iso.datetime();
const DurableIdSchema = z.uuid();
const RoomIdSchema = z.string().trim().min(1).max(128);
const HttpUrlSchema = z.url({ protocol: /^https?$/ });
const NullableHttpUrlSchema = HttpUrlSchema.nullable();

export const AccountResponseMetaSchema = z.strictObject({
  serverTime: TimestampSchema,
  schemaVersion: z.literal(ACCOUNT_RESPONSE_SCHEMA_VERSION),
});

export const PublicProfileSchema = z.strictObject({
  userId: DurableIdSchema,
  handle: z.string().trim().min(3).max(24).nullable(),
  displayName: z.string().trim().min(1).max(80),
  avatarUrl: NullableHttpUrlSchema,
});

export const FriendshipStatusSchema = z.enum([
  "pending", "accepted", "declined", "blocked", "removed",
]);
export const FriendshipDirectionSchema = z.enum([
  "incoming", "outgoing", "mutual", "blocked-by-me", "blocked-me",
]);
export const InviteRecipientStatusSchema = z.enum([
  "pending", "accepted", "declined", "expired",
]);
export const WatchProviderSchema = z.enum(["crunchyroll", "netflix", "youtube", "amazon"]);
export const WatchItemKindSchema = z.enum(["series", "movie"]);
export const AccountPlanCodeSchema = z.enum(["free", "plus", "pro"]);

export const FriendListItemSchema = z.strictObject({
  friendshipId: DurableIdSchema,
  user: PublicProfileSchema,
  status: FriendshipStatusSchema,
  direction: FriendshipDirectionSchema,
  requestedAt: TimestampSchema,
  respondedAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema,
});

export const FriendGroupSchema = z.strictObject({
  id: DurableIdSchema,
  name: z.string().trim().min(1).max(80),
  archivedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  members: z.array(z.strictObject({ user: PublicProfileSchema, addedAt: TimestampSchema })).max(100),
});

export const FriendListResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  friends: z.array(FriendListItemSchema),
  incomingRequests: z.array(FriendListItemSchema),
  outgoingRequests: z.array(FriendListItemSchema),
  blocked: z.array(FriendListItemSchema),
});

export const FriendGroupsResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  groups: z.array(FriendGroupSchema),
});

export const InviteTargetsSchema = z.strictObject({
  friends: z.array(FriendListItemSchema),
  groups: z.array(FriendGroupSchema),
});

export const RoomInviteSchema = z.strictObject({
  id: DurableIdSchema,
  roomId: RoomIdSchema,
  sender: PublicProfileSchema,
  targetKind: z.enum(["direct", "group"]),
  targetGroupId: DurableIdSchema.nullable(),
  message: z.string().trim().max(180).nullable(),
  roomTitle: z.string().trim().max(300).nullable(),
  sourceUrl: NullableHttpUrlSchema,
  videoFingerprint: z.string().trim().max(400).nullable(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
  recipients: z.array(z.strictObject({
    user: PublicProfileSchema,
    status: InviteRecipientStatusSchema,
    updatedAt: TimestampSchema,
    respondedAt: TimestampSchema.nullable(),
  })).max(100),
});

export const RoomInvitesResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  inbox: z.array(RoomInviteSchema),
  sent: z.array(RoomInviteSchema),
});

export const AcceptedRoomInviteResponseSchema = z.strictObject({
  invite: RoomInviteSchema,
  roomId: RoomIdSchema,
  joinUrl: HttpUrlSchema,
});

export const SocialSnapshotSchema = z.strictObject({
  targets: InviteTargetsSchema,
  invites: RoomInvitesResponseSchema,
});
```

Implement the watch-library participant, session, episode, item, limits, and response schemas from the fixture above. Keep `generatedAt` during this additive rollout and require both `generatedAt` and `meta.serverTime` to parse as timestamps. Export every type with `z.infer`, including `AccountResponseMeta`, `PublicProfile`, `FriendListItem`, `FriendGroup`, `FriendListResponse`, `FriendGroupsResponse`, `InviteTargets`, `RoomInvite`, `RoomInvitesResponse`, `AcceptedRoomInviteResponse`, `SocialSnapshot`, `WatchLibraryParticipant`, `WatchLibrarySession`, `WatchLibraryEpisode`, `WatchLibraryItem`, and `WatchLibraryResponse`.

Add this line to `packages/protocol/src/index.ts`:

```ts
export * from "./account";
```

- [x] **Step 4: Add rejection tests for unsafe and incompatible payloads**

Extend `account.test.ts` with assertions that reject:

```ts
it.each([
  { serverTime: NOW, schemaVersion: 2 },
  { serverTime: "not-a-date", schemaVersion: 1 },
])("rejects incompatible account metadata %#", (invalidMeta) => {
  expect(() => FriendGroupsResponseSchema.parse({ meta: invalidMeta, groups: [] })).toThrow();
});

it("rejects unsafe nested records instead of dropping them", () => {
  expect(() => RoomInvitesResponseSchema.parse({
    meta,
    inbox: [{ ...invite, sourceUrl: "javascript:alert(1)" }],
    sent: [],
  })).toThrow();
  expect(() => FriendListResponseSchema.parse({
    meta,
    friends: [{ ...friend, user: { ...userB, userId: "user-b" } }],
    incomingRequests: [],
    outgoingRequests: [],
    blocked: [],
  })).toThrow();
});
```

- [x] **Step 5: Run protocol check and tests**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol test
```

Expected: both commands PASS.

- [x] **Step 6: Commit the protocol boundary**

```bash
git add packages/protocol/src/account.ts packages/protocol/src/index.ts packages/protocol/test/account.test.ts
git commit -m "feat(protocol): add account read contracts"
```

---

### Task 2: Versioned Web Read Responses

**Files:**
- Create: `apps/web/lib/anidachi-auth/account-response.ts`
- Create: `apps/web/lib/anidachi-auth/account-response.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-library.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-library.test.ts`
- Modify: `apps/web/app/api/friends/route.ts`
- Modify: `apps/web/app/api/groups/route.ts`
- Modify: `apps/web/app/api/invites/route.ts`

**Interfaces:**
- Consumes: `AccountResponseMeta`, `FriendListResponse`, `FriendGroupsResponse`, `RoomInvitesResponse`, and `WatchLibraryResponse` from `@anidachi/protocol`.
- Produces: `createAccountResponseMeta(now?: Date): AccountResponseMeta` and additive read responses carrying `meta`.

- [x] **Step 1: Write the failing metadata factory test**

Create `apps/web/lib/anidachi-auth/account-response.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AccountResponseMetaSchema } from "@anidachi/protocol";
import { createAccountResponseMeta } from "./account-response";

describe("createAccountResponseMeta", () => {
  it("creates schema version 1 metadata using the supplied server clock", () => {
    const meta = createAccountResponseMeta(new Date("2026-08-06T12:00:00.000Z"));
    expect(meta).toEqual({ serverTime: "2026-08-06T12:00:00.000Z", schemaVersion: 1 });
    expect(() => AccountResponseMetaSchema.parse(meta)).not.toThrow();
  });
});
```

- [x] **Step 2: Run the focused test and confirm the helper is missing**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test -- account-response.test.ts
```

Expected: FAIL because `account-response.ts` does not exist.

- [x] **Step 3: Implement the metadata factory**

Create `apps/web/lib/anidachi-auth/account-response.ts`:

```ts
import {
  ACCOUNT_RESPONSE_SCHEMA_VERSION,
  type AccountResponseMeta,
} from "@anidachi/protocol";

export function createAccountResponseMeta(now = new Date()): AccountResponseMeta {
  return {
    serverTime: now.toISOString(),
    schemaVersion: ACCOUNT_RESPONSE_SCHEMA_VERSION,
  };
}
```

- [x] **Step 4: Make watch-library output use the shared contract**

In `apps/web/lib/anidachi-auth/watch-library.ts`:

1. Import the shared public watch-library types and `WatchLibraryResponseSchema` from `@anidachi/protocol`.
2. Remove the duplicate exported public response type declarations while keeping database row and clean-input types local.
3. In `listWatchLibrary`, create one `now`, set `generatedAt` and `meta.serverTime` from that same value, and return a value satisfying `WatchLibraryResponse`.
4. Parse the final builder result with `WatchLibraryResponseSchema.parse` before returning it. This validates the real server output, not only test fixtures.

The return must be structurally equivalent to:

```ts
const generatedAt = now.toISOString();
return WatchLibraryResponseSchema.parse({
  meta: createAccountResponseMeta(now),
  generatedAt,
  limits: {
    planCode: entitlements.planCode,
    maxActiveTrackedTitles: entitlements.account.maxActiveTrackedTitles,
    activeTrackedTitleCount: activeCount,
    historyRetentionDays: entitlements.account.historyRetentionDays,
    retainedSince,
  },
  items: buildWatchLibraryItems({
    viewerUserId: userId,
    trackedTitles: (trackedData as UserTrackedTitleRow[] | null) ?? [],
    viewerParticipants: participantRows,
    sessions,
    allParticipants,
    profiles,
  }),
});
```

Update `watch-library.test.ts` so every expected library includes `meta`, and add one assertion that `library.meta.serverTime === library.generatedAt`.

- [x] **Step 5: Add metadata to the social read routes**

Modify only the `GET` branches; leave mutations and database calls unchanged.

`apps/web/app/api/friends/route.ts`:

```ts
const data = await listFriends(session.userId);
const response: FriendListResponse = { meta: createAccountResponseMeta(), ...data };
return NextResponse.json(response);
```

`apps/web/app/api/groups/route.ts`:

```ts
const response: FriendGroupsResponse = {
  meta: createAccountResponseMeta(),
  groups: await listFriendGroups(session.userId),
};
return NextResponse.json(response);
```

`apps/web/app/api/invites/route.ts`:

```ts
const data = await listRoomInvites(session.userId);
const response: RoomInvitesResponse = { meta: createAccountResponseMeta(), ...data };
return NextResponse.json(response);
```

Use imported shared response types so a route cannot omit a field silently.

- [x] **Step 6: Run web tests and type checking**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web check
```

Expected: both commands PASS; watch-library tests confirm the canonical builder parses.

- [x] **Step 7: Commit the additive web contract**

```bash
git add apps/web/lib/anidachi-auth/account-response.ts apps/web/lib/anidachi-auth/account-response.test.ts apps/web/lib/anidachi-auth/watch-library.ts apps/web/lib/anidachi-auth/watch-library.test.ts apps/web/app/api/friends/route.ts apps/web/app/api/groups/route.ts apps/web/app/api/invites/route.ts
git commit -m "feat(web): version account read responses"
```

---

### Task 3: Runtime Validation In Extension Clients

**Files:**
- Modify: `apps/extension/src/watch-library-client.ts`
- Modify: `apps/extension/test/watch-library-client.test.ts`
- Modify: `apps/extension/src/social-client.ts`
- Modify: `apps/extension/test/social-client.test.ts`

**Interfaces:**
- Consumes: account schemas and inferred types from `@anidachi/protocol`.
- Produces: validated `WatchLibraryResponse`, `InviteTargets`, `RoomInvitesResponse`, `FriendGroup`, `RoomInvite`, and `AcceptedRoomInviteResponse` values to Popup and overlay callers.

- [x] **Step 1: Write failing tests for malformed server payloads**

In `watch-library-client.test.ts`, add a mocked successful HTTP response with `schemaVersion: 2` and assert `listWatchLibraryFromApi` rejects. Add another response whose nested participant has an invalid user ID and assert rejection.

In `social-client.test.ts`, add these cases:

```ts
it("rejects a friends response without account metadata", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ friends: [] }));
  fetchMock.mockResolvedValueOnce(jsonResponse({
    meta: { serverTime: NOW, schemaVersion: 1 },
    groups: [],
  }));
  await expect(listInviteTargetsFromApi("access-1")).rejects.toThrow();
});

it("rejects an invalid invite nested inside a successful response", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({
    meta: { serverTime: NOW, schemaVersion: 1 },
    inbox: [{ id: "not-a-uuid" }],
    sent: [],
  }));
  await expect(listRoomInvitesFromApi("access-1")).rejects.toThrow();
});
```

- [x] **Step 2: Run focused extension tests and confirm permissive parsing fails the assertions**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- watch-library-client.test.ts social-client.test.ts
```

Expected: FAIL because the clients currently cast or normalize malformed bodies.

- [x] **Step 3: Replace duplicate read DTOs and permissive watch normalization**

In `watch-library-client.ts`:

1. Import `WatchLibraryResponseSchema` and public watch-library types from `@anidachi/protocol`.
2. Remove duplicate `WatchLibraryParticipant`, `WatchLibrarySession`, `WatchLibraryEpisode`, `WatchLibraryItem`, and `WatchLibraryResponse` declarations.
3. Re-export the imported types if existing callers depend on this module's exports.
4. Replace `normalizeWatchLibraryResponse(value)` with:

```ts
function parseWatchLibraryResponse(value: unknown): WatchLibraryResponse {
  return WatchLibraryResponseSchema.parse(value);
}
```

5. Use `parseWatchLibraryResponse` for list, clear, reconcile, bridge responses, and cache reads.
6. Change the watch-library cache storage key from `anidachi.watchLibraryCache.v1` to `anidachi.watchLibraryCache.v2`. Do not migrate or display the unvalidated v1 snapshot; leave it inert so the new cache can be rolled back independently.
7. Parse the cache envelope structurally, require `userId`, `cachedAt`, and a valid `WatchLibraryResponse`, and return `null` on any cache parse failure.

- [x] **Step 4: Parse social read responses and shared entities**

In `social-client.ts`:

1. Import and re-export the shared social types.
2. Parse `/api/friends` with `FriendListResponseSchema`.
3. Parse `/api/groups` with `FriendGroupsResponseSchema`.
4. Return accepted friends from `friendsResponse.friends` and active groups from `groupsResponse.groups.filter((group) => !group.archivedAt)`.
5. Parse `/api/invites` with `RoomInvitesResponseSchema`.
6. Parse mutation entities with `FriendGroupSchema` or `RoomInviteSchema` instead of casting. Parse the accepted-invite envelope with `AcceptedRoomInviteResponseSchema`.
7. Preserve existing HTTP error mapping and bridge command behavior.

Do not change overlay UI or room-invite behavior; this task changes validation only.

- [x] **Step 5: Run extension client tests and checks**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- watch-library-client.test.ts social-client.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: focused tests and extension type checking PASS.

- [x] **Step 6: Commit validated extension clients**

```bash
git add apps/extension/src/watch-library-client.ts apps/extension/test/watch-library-client.test.ts apps/extension/src/social-client.ts apps/extension/test/social-client.test.ts
git commit -m "feat(extension): validate account api responses"
```

---

### Task 4: Account Generation And Owned State Primitives

**Files:**
- Create: `apps/extension/src/account-sync.ts`
- Create: `apps/extension/test/account-sync.test.ts`

**Interfaces:**
- Produces: `AccountRequestToken`, `createAccountRequestGate`, `AccountOwnedState<T>`, `accountLoadingState`, `accountReadyState`, `accountErrorState`, and `signedOutAccountState`.
- Consumes: authenticated AniDachi user IDs from extension auth; it does not inspect access-token strings.

- [x] **Step 1: Write failing identity and stale-response tests**

Create `apps/extension/test/account-sync.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  accountErrorState,
  accountLoadingState,
  accountReadyState,
  createAccountRequestGate,
  signedOutAccountState,
} from "../src/account-sync";

describe("account request gate", () => {
  it("invalidates captured work when the active account changes", () => {
    const gate = createAccountRequestGate();
    gate.activate("user-a");
    const requestA = gate.capture("user-a");
    expect(requestA).not.toBeNull();

    gate.activate("user-b");
    expect(gate.isCurrent(requestA!)).toBe(false);
    expect(gate.capture("user-a")).toBeNull();
    expect(gate.isCurrent(gate.capture("user-b")!)).toBe(true);
  });

  it("invalidates captured work on sign-out", () => {
    const gate = createAccountRequestGate("user-a");
    const request = gate.capture("user-a")!;
    gate.activate(null);
    expect(gate.isCurrent(request)).toBe(false);
  });
});

describe("account-owned state", () => {
  it("preserves cached data only for the same owner", () => {
    const readyA = accountReadyState("user-a", { friends: ["a"] });
    expect(accountLoadingState("user-a", readyA).data).toEqual({ friends: ["a"] });
    expect(accountLoadingState("user-b", readyA).data).toBeNull();
    expect(accountErrorState("user-b", readyA, "offline").data).toBeNull();
  });

  it("represents sign-out without an owner or data", () => {
    expect(signedOutAccountState()).toEqual({
      status: "signed-out",
      ownerUserId: null,
      data: null,
      error: null,
    });
  });
});
```

- [x] **Step 2: Run the test and confirm the module is missing**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- account-sync.test.ts
```

Expected: FAIL because `account-sync.ts` does not exist.

- [x] **Step 3: Implement a gate that cannot reactivate a stale caller**

Create `apps/extension/src/account-sync.ts` with this public contract:

```ts
export type AccountRequestToken = Readonly<{
  userId: string;
  generation: number;
}>;

export type AccountRequestGate = {
  activate(userId: string | null): void;
  capture(userId: string): AccountRequestToken | null;
  isCurrent(token: AccountRequestToken): boolean;
  currentUserId(): string | null;
};

export function createAccountRequestGate(initialUserId: string | null = null): AccountRequestGate {
  let activeUserId = initialUserId;
  let generation = 0;
  return {
    activate(userId) {
      if (userId === activeUserId) return;
      activeUserId = userId;
      generation += 1;
    },
    capture(userId) {
      return userId === activeUserId ? { userId, generation } : null;
    },
    isCurrent(token) {
      return token.userId === activeUserId && token.generation === generation;
    },
    currentUserId() {
      return activeUserId;
    },
  };
}
```

Do not make `capture` activate an account. Only the auth/session owner may call `activate`; otherwise an old async caller could make itself current again.

Implement the state union and helpers:

```ts
export type AccountOwnedState<T> =
  | { status: "loading"; ownerUserId: string; data: T | null; error: null }
  | { status: "ready"; ownerUserId: string; data: T; error: null }
  | { status: "error"; ownerUserId: string; data: T | null; error: string }
  | { status: "signed-out"; ownerUserId: null; data: null; error: null };
```

`accountLoadingState` and `accountErrorState` preserve `current.data` only when `current.ownerUserId === userId`. `accountReadyState` always sets the supplied owner. `signedOutAccountState` removes both owner and data.

- [x] **Step 4: Run the focused test and extension check**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- account-sync.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS.

- [x] **Step 5: Commit the account-sync primitive**

```bash
git add apps/extension/src/account-sync.ts apps/extension/test/account-sync.test.ts
git commit -m "feat(extension): add account request generation gate"
```

---

### Task 5: Account-Scoped Social Snapshot Cache

**Files:**
- Create: `apps/extension/src/social-snapshot-cache.ts`
- Create: `apps/extension/test/social-snapshot-cache.test.ts`

**Interfaces:**
- Consumes: `SocialSnapshotSchema` and `SocialSnapshot` from `@anidachi/protocol`; WXT `storage`.
- Produces: `getCachedSocialSnapshotForUser(userId)`, `setCachedSocialSnapshotForUser(userId, data)`, `clearCachedSocialSnapshotForUser(userId)`, `isSocialSnapshotCacheFresh(cache, nowMs?)`, and `socialSnapshotCacheKeyForUser(userId)`.

- [x] **Step 1: Write failing cache partition and corruption tests**

Create `apps/extension/test/social-snapshot-cache.test.ts` using the same mocked `wxt/utils/storage` pattern as `watch-library-client.test.ts`. Cover these exact behaviors:

```ts
it("uses a different durable key for each account", () => {
  expect(socialSnapshotCacheKeyForUser("user-a"))
    .not.toBe(socialSnapshotCacheKeyForUser("user-b"));
});

it("returns only a valid snapshot owned by the requested account", async () => {
  await setCachedSocialSnapshotForUser("user-a", socialSnapshotFixture);
  expect((await getCachedSocialSnapshotForUser("user-a"))?.data)
    .toEqual(socialSnapshotFixture);
  expect(await getCachedSocialSnapshotForUser("user-b")).toBeNull();
});

it("discards corrupt and incompatible cache entries", async () => {
  storageMap.set(socialSnapshotCacheKeyForUser("user-a"), {
    schemaVersion: 1,
    userId: "user-a",
    cachedAt: NOW,
    data: { targets: { friends: [{ friendshipId: "bad" }], groups: [] }, invites: {} },
  });
  expect(await getCachedSocialSnapshotForUser("user-a")).toBeNull();
});
```

- [x] **Step 2: Run the focused test and confirm the cache module is missing**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- social-snapshot-cache.test.ts
```

Expected: FAIL because `social-snapshot-cache.ts` does not exist.

- [x] **Step 3: Implement the versioned cache envelope**

Create `apps/extension/src/social-snapshot-cache.ts` with:

```ts
import { SocialSnapshotSchema, type SocialSnapshot } from "@anidachi/protocol";
import { z } from "zod";
import { storage } from "wxt/utils/storage";

const SOCIAL_CACHE_VERSION = 1 as const;
const SOCIAL_CACHE_MAX_AGE_MS = 60_000;

const SocialSnapshotCacheSchema = z.strictObject({
  schemaVersion: z.literal(SOCIAL_CACHE_VERSION),
  userId: z.string().min(1),
  cachedAt: z.iso.datetime(),
  data: SocialSnapshotSchema,
});

export type CachedSocialSnapshot = z.infer<typeof SocialSnapshotCacheSchema>;

export function socialSnapshotCacheKeyForUser(userId: string): `local:${string}` {
  return `local:anidachi.socialSnapshot.v1.${encodeURIComponent(userId)}`;
}
```

`getCachedSocialSnapshotForUser` must parse with `safeParse`, verify `parsed.data.userId === userId`, remove the corrupt partition on parse or owner failure, and return `null`. It must never read a global fallback key. `setCachedSocialSnapshotForUser` writes only after `SocialSnapshotSchema.parse(data)`. `isSocialSnapshotCacheFresh` compares `cachedAt` against 60 seconds.

- [x] **Step 4: Run the cache tests and extension check**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- social-snapshot-cache.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS.

- [x] **Step 5: Commit the social cache**

```bash
git add apps/extension/src/social-snapshot-cache.ts apps/extension/test/social-snapshot-cache.test.ts
git commit -m "feat(extension): cache social snapshots per account"
```

---

### Task 6: Popup Account Isolation Integration

**Files:**
- Modify: `apps/extension/src/popup-app.tsx`
- Modify: `apps/extension/src/account-sync.ts`
- Modify: `apps/extension/src/watch-progress.ts`
- Modify: `apps/extension/test/account-sync.test.ts`
- Modify: `apps/extension/test/watch-progress.test.ts`

**Interfaces:**
- Consumes: the account request gate, account-owned state helpers, validated clients, and social snapshot cache.
- Produces: Popup behavior where only the active account can own visible social/watch data or complete account actions.

**Implementation finding:** the initial audit found additional account-owned async paths outside
the first draft of this task. The implementation therefore also gates the local watch store,
parallel auth flows, bootstrap, poster hydration, history clearing, storage events, account
dashboard opening, and room creation from history. Social group mutations now refresh the
validated snapshot instead of applying cross-generation optimistic rollbacks. Popup snapshot
I/O no longer claims the active playback owner, so late background work cannot change the
owner selected by the player overlay.

- [x] **Step 1: Extend the pure state tests for the Popup transition sequence**

Add this transition test to `account-sync.test.ts`:

```ts
it("hides account A data before account B finishes loading", () => {
  const readyA = accountReadyState("user-a", { items: ["a"] });
  const loadingB = accountLoadingState("user-b", readyA);
  expect(loadingB).toEqual({
    status: "loading",
    ownerUserId: "user-b",
    data: null,
    error: null,
  });
});
```

- [x] **Step 2: Replace unowned Popup remote states**

In `popup-app.tsx`:

1. Replace `SocialPanelState` and `WatchLibraryState` with `AccountOwnedState<SocialSnapshot>` and `AccountOwnedState<WatchLibraryResponse>`.
2. Initialize both with `signedOutAccountState()`; the outer auth state already communicates initial account loading.
3. Remove `watchLibraryUserIdRef`; state ownership and the request gate replace it.
4. Add one stable gate:

```ts
const accountGateRef = useRef(createAccountRequestGate());
```

5. Add `activateAccount(userId)` that calls `accountGateRef.current.activate(userId)`, immediately replaces social/watch state with loading states for a user or signed-out states for `null`, clears account-specific notices and busy identifiers, and returns a captured request token for authenticated users.

The account switch must occur before starting account reads. Do not wait for `ensureStoreForUser` or cache I/O before hiding previous-account state.

- [x] **Step 3: Make social loading cache-first and generation-safe**

Refactor `loadSocialForTokens` to this sequence:

1. Capture a token from `accountGateRef.current.capture(tokens.user.id)`; return if it is `null`.
2. Read `getCachedSocialSnapshotForUser(tokens.user.id)`.
3. If still current and the cache exists, set ready or loading state for that same owner depending on freshness.
4. Fetch validated invite targets and invites concurrently.
5. Build `const snapshot = SocialSnapshotSchema.parse({ targets, invites })`.
6. Check `isCurrent` before writing cache.
7. Write cache.
8. Check `isCurrent` again before setting ready state.
9. On error, set an account-owned error state only if the captured token remains current.

An old request must not write a cache after the account changed.

- [x] **Step 4: Guard every watch-library side effect**

At the start of `loadWatchLibraryForTokens`, capture an account request token. Check it before and after every awaited side effect that can write account state:

- applying cached library to the local watch store;
- marking sync entries;
- reconciling or listing server data;
- writing the watch-library cache;
- applying server data to local progress;
- setting ready or error state.

Retain `storeUserIdRef` only for the local watch-progress partition because that store already uses it. The request gate is the authority for remote response freshness.

- [x] **Step 5: Activate identity from one auth flow**

In `syncPopupData`:

1. Cached tokens may render the matching cache quickly, but call `activateAccount(cachedTokens.user.id)` before using them.
2. When current/silent/interactive auth returns tokens, call `activateAccount(tokens.user.id)` before `ensureStoreForUser` and before remote loads.
3. When no tokens are returned, call `activateAccount(null)` before loading the anonymous local watch store.
4. In the outer catch, never restore arbitrary `current.data`. Show a cached session only when its user ID is still the gate's current user; otherwise use signed-out/error states without old data.

The auth effect and storage/session listeners must use the same activation helper, not mutate owner refs independently.

- [x] **Step 6: Guard social mutations and post-action effects**

For accept/decline invite, group create/update/archive/member changes, and invite creation:

1. Resolve the current session.
2. Activate only through the central auth flow; mutation handlers call `capture(tokens.user.id)` and abort if it returns `null`.
3. After the mutation resolves, check `isCurrent` before setting notices, clearing busy state, refreshing social data, or opening an accepted invite URL.
4. In `finally`, clear a busy state only when the captured token is still current; account activation already clears busy state for a new account.

This prevents a late accepted invite from account A opening a room after the Popup has switched to account B.

- [x] **Step 7: Run focused and full extension tests**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- account-sync.test.ts social-snapshot-cache.test.ts watch-library-client.test.ts social-client.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: all commands PASS.

- [x] **Step 8: Commit Popup isolation**

```bash
git add apps/extension/src/account-sync.ts apps/extension/src/popup-app.tsx apps/extension/src/watch-progress.ts apps/extension/test/account-sync.test.ts apps/extension/test/watch-progress.test.ts docs/superpowers/plans/2026-08-06-account-contracts-and-popup-isolation.md
git commit -m "fix(extension): isolate popup data by account"
```

---

### Task 7: Cross-Plane Verification And Staging Evidence

**Files:**
- Modify only if required by actual results: `docs/current-development-state.md`
- Modify: `graphify-out/graph.json`
- Modify: `graphify-out/manifest.json`

**Interfaces:**
- Consumes: completed Tasks 1-6.
- Produces: one reviewable branch and staging artifact with documented two-account evidence.

- [x] **Step 1: Run cross-plane automated checks**

Run in this order:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm dev:check
git diff --check
```

Expected: every check PASS and `git diff --check` prints nothing.

Result: protocol `35/35`, web `102/102`, and extension `938/938` tests pass;
all three typechecks, `pnpm dev:check`, and `git diff --check` pass. The
additional API `95/95`, Workers runtime `11/11`, and room harness `39/39`
checks also pass because the shared protocol export is consumed cross-plane.

- [x] **Step 2: Build and validate the staging extension artifact**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
```

Expected: staging artifact builds and validates without added permissions.

Result: the staging artifact built from `e9ce77c` and passed the channel
validator without permission changes.

- [ ] **Step 3: Deploy the additive web response before loading the new extension**

Open the feature PR into `staging`, allow the staging web deployment to complete, then load the extension artifact built from the same commit. The old extension remains compatible because new web fields are additive; the new extension intentionally requires schema-versioned web responses.

- [ ] **Step 4: Perform the two-account Popup acceptance test**

Use two real AniDachi accounts in separate authenticated browser profiles:

1. Open Popup as account A and confirm resources, friends, groups, and invites load.
2. Disconnect the network, reopen Popup, and confirm only account A's validated cache appears with a stale/error state.
3. Restore the network and start a refresh for account A.
4. Before it resolves, sign out and authenticate as account B.
5. Confirm account A data disappears immediately.
6. Confirm a late account A response does not reappear, write a visible notice, open a tab, or populate account B's cache.
7. Reopen Popup as account B offline and confirm account A cache is never shown.
8. Switch back to account A and confirm its own cache remains available.
9. Confirm the in-player panel, room sync, camera, microphone, Crunchyroll adapter, and YouTube adapter behavior are unchanged.

Record the two profile names, deployed staging commit, extension artifact version, and result in the PR staging-evidence section. Do not record emails, tokens, or full user IDs.

- [x] **Step 5: Refresh Graphify after the code shape is final**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm graph:update
git diff --check
```

Review `graphify-out/graph.json` and `graphify-out/manifest.json`; do not add local Graphify outputs.

Result: the AST graph rebuilt to 7,823 nodes and 16,960 edges. The review query
traced versioned account responses through protocol validation, extension
generation gating, and account-scoped social/watch caches.

- [ ] **Step 6: Commit intentional docs or graph changes**

If current process truth changed, update `docs/current-development-state.md` with only the new implemented state. Then commit the approved generated graph artifacts separately:

```bash
git add docs/current-development-state.md
git commit -m "docs: record account contract foundation"
git add graphify-out/graph.json graphify-out/manifest.json
git commit -m "chore(graphify): refresh account sync graph"
```

If the current-state doc did not need a change, omit the first commit. Never commit `graphify-out/cost.json`, HTML, wiki, cache, or scratch outputs.

- [ ] **Step 7: Final branch and PR audit**

Run:

```bash
git status --short --branch
git log --oneline origin/staging..HEAD
fnm exec --using="$(cat .node-version)" pnpm dev:check
```

Expected: clean worktree, only coherent account-contract/isolation commits, and a green final development check. In the PR template record:

- affected planes: protocol, web, extension;
- quality profile: cross-plane account/auth data;
- docs updated or not needed with reason;
- Graphify updated and the query used;
- staging artifact and two-account evidence;
- rollback: revert application commits; additive response metadata and inert v1 cache entries require no database rollback.

---

## Completion Boundary

This plan is complete only when the first rollout slice works in staging. It does not claim that canonical reconcile, solo/shared history redesign, transactional social mutations, durable inbox counters, browser notifications, or full Popup/web product surfaces are finished. Those remain separate plans and PRs in the order recorded by the approved design.
