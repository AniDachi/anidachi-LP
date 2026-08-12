# Popup People And Social Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the extension Popup `People` area into a compact, canonical
friends/groups surface with contextual recent co-watchers, and move actionable
friend requests into the existing `Inbox` without changing room, overlay,
provider, playback-sync, or P2P behavior.

**Architecture:** Supabase-backed web services remain authoritative. Shared Zod
schemas in `packages/protocol` define recent people and the richer Popup social
directory. The extension background bridge fetches and validates friends,
groups, and recent people, then the Popup stores one account-owned snapshot with
room invites. Existing `InviteTargets` remains unchanged for the in-player
invite flow. Popup React components render canonical data and invoke existing or
focused HTTP mutations; the web account remains the full management surface.

**Tech Stack:** TypeScript, Zod, React 19, WXT Manifest V3, Next.js 15,
Supabase-backed server services, Vitest, Node test runner, happy-dom.

**Approved product specification:**
`docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md`

## Scope Guardrails

- Do not modify the in-player overlay, room lifecycle, room invites, playback
  synchronization, provider adapters, P2P media, microphone, or camera behavior.
- Preserve `InviteTargetsSchema` and `listInviteTargets()` for existing overlay
  and room-invite consumers.
- Do not add a second recent-people cache or unvalidated Popup fetch.
- Do not add a third permanent People subsection. The only modes are `Friends`
  and `Groups`; recent people is a contextual block inside `Friends`.
- Do not show an aggregate numeric badge on `People`.
- Keep group rename, archive, member editing, and limit management on the web
  account. Popup supports quick creation and read-only group summaries in this
  slice.
- Keep compatibility with persisted `blocked` friendship rows, but do not add
  new block/unblock UI.
- Add no new dependencies.
- Use Node `22.23.1` and pnpm `11.2.2` through
  `fnm exec --using=22.23.1 pnpm ...` when the shell does not activate the repo
  toolchain automatically.

## Task 1: Add Shared Recent-People And Social-Directory Contracts

**Files:**

- Modify: `packages/protocol/src/account.ts`
- Modify: `packages/protocol/test/account.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Add fixtures and assertions proving that:

- `RecentPersonSchema` accepts a public profile, `lastWatchedAt`, and a positive
  `sharedRoomCount`;
- `RecentPeopleResponseSchema` requires versioned account metadata;
- `SocialDirectorySchema` contains `friends`, `incomingRequests`,
  `outgoingRequests`, `groups`, and `recentPeople` exactly once;
- `SocialSnapshotSchema` accepts `{ directory, invites }` and rejects the old
  `{ targets, invites }` shape.

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/protocol test -- account.test.ts
```

Expected: FAIL because the new schemas do not exist and the snapshot still
expects `targets`.

- [ ] **Step 2: Implement additive shared schemas**

Add the following strict schemas after the existing friend/group response
schemas:

```ts
export const RecentPersonSchema = z.strictObject({
  user: PublicProfileSchema,
  lastWatchedAt: TimestampSchema,
  sharedRoomCount: z.number().int().positive(),
});

export const RecentPeopleResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  people: z.array(RecentPersonSchema),
});

export const SocialDirectorySchema = z.strictObject({
  friends: z.array(FriendListItemSchema),
  incomingRequests: z.array(FriendListItemSchema),
  outgoingRequests: z.array(FriendListItemSchema),
  groups: z.array(FriendGroupSchema),
  recentPeople: z.array(RecentPersonSchema),
});
```

Change only the account-scoped Popup snapshot contract:

```ts
export const SocialSnapshotSchema = z.strictObject({
  directory: SocialDirectorySchema,
  invites: RoomInvitesResponseSchema,
});
```

Export the inferred `RecentPerson`, `RecentPeopleResponse`, and
`SocialDirectory` types. Do not change `ACCOUNT_RESPONSE_SCHEMA_VERSION`; this
is an additive HTTP contract plus an extension-local cache migration, not a
global account API break.

- [ ] **Step 3: Verify protocol checks**

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/protocol check
fnm exec --using=22.23.1 pnpm --filter @anidachi/protocol test
```

Expected: PASS.

- [ ] **Step 4: Commit the contract**

```bash
git add packages/protocol/src/account.ts packages/protocol/test/account.test.ts
git commit -m "feat(protocol): define popup social directory"
```

## Task 2: Make Recent People Canonical And Duplicate-Free

**Files:**

- Modify: `apps/web/lib/anidachi-auth/social.ts`
- Modify: `apps/web/lib/anidachi-auth/social.test.ts`
- Modify: `apps/web/app/api/recent-people/route.ts`
- Modify: `apps/web/app/friends/friends-client.tsx`

- [ ] **Step 1: Write a failing relationship-eligibility test**

Export a small pure predicate from `social.ts`, for example:

```ts
isRecentRelationshipEligible(status: FriendshipStatus | undefined): boolean
```

Test the required table:

| Relationship | Eligible for Recent |
| --- | --- |
| none | yes |
| declined | yes |
| removed | yes |
| pending | no |
| accepted | no |
| blocked | no |

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/web test -- social.test.ts
```

Expected: FAIL because the predicate does not exist.

- [ ] **Step 2: Filter relationships before aggregation**

Implement the predicate and use it in `listRecentPeople()`. Skip hidden users
and all ineligible relationship states before inserting into the aggregate map.
Keep one row per user, newest shared watch timestamp, and distinct shared room
count. Preserve the current maximum result bound.

The returned wire shape must match shared `RecentPerson`: do not expose
`relationshipStatus`, because ineligible relationships are removed before the
response is built.

- [ ] **Step 3: Version and validate the recent-people route response**

Update `/api/recent-people` to return:

```ts
const response: RecentPeopleResponse = {
  meta: createAccountResponseMeta(),
  people: await listRecentPeople(session.userId),
};
```

Keep existing bearer/cookie authentication and error handling. Do not create a
new public or unauthenticated route.

- [ ] **Step 4: Reuse the shared type in the web account**

Remove the local duplicate `RecentPerson`/response types from
`friends-client.tsx` and import the shared protocol types. Keep the current full
web management controls, including hide, on the web. Adjust any rendering that
expected `relationshipStatus`; Recent now contains only actionable discovery
rows.

- [ ] **Step 5: Verify web behavior**

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/web check
fnm exec --using=22.23.1 pnpm --filter @anidachi/web test
```

Expected: PASS.

- [ ] **Step 6: Commit the server slice**

```bash
git add apps/web/lib/anidachi-auth/social.ts \
  apps/web/lib/anidachi-auth/social.test.ts \
  apps/web/app/api/recent-people/route.ts \
  apps/web/app/friends/friends-client.tsx
git commit -m "feat(web): canonicalize recent people"
```

## Task 3: Add The MV3 Social-Directory And Friend-Request Bridge

**Files:**

- Modify: `apps/extension/src/social-client.ts`
- Modify: `apps/extension/test/social-client.test.ts`

- [ ] **Step 1: Write failing bridge tests**

Cover the following background HTTP commands and public wrappers:

- `list-social-directory` fetches `/api/friends`, `/api/groups`, and
  `/api/recent-people` in parallel;
- every response is parsed with the shared schema before composition;
- archived groups are excluded;
- `send-friend-request` posts `{ userId }` to `/api/friends/requests`;
- `accept-friend-request` and `decline-friend-request` post to the existing
  request-specific endpoints;
- malformed account responses return the existing safe
  `INVALID_ACCOUNT_RESPONSE` behavior instead of raw Zod errors.

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test -- social-client.test.ts
```

Expected: FAIL because the new commands/functions do not exist.

- [ ] **Step 2: Extend the typed message union**

Add commands and matching response variants for:

```txt
list-social-directory -> directory: SocialDirectory
send-friend-request -> request: FriendListItem
accept-friend-request -> request: FriendListItem
decline-friend-request -> request: FriendListItem
```

Keep existing room invite and group commands intact. Validate IDs as part of
message guards in the same style as current social messages.

- [ ] **Step 3: Implement canonical directory composition**

Implement `listSocialDirectoryFromApi(accessToken)` by fetching the three
authenticated routes and parsing them with:

- `FriendListResponseSchema`;
- `FriendGroupsResponseSchema`;
- `RecentPeopleResponseSchema`.

Compose and parse `SocialDirectorySchema` from their canonical arrays. Do not
derive Recent in the extension and do not reuse `InviteTargets` as the Popup
model.

- [ ] **Step 4: Implement friend-request mutations**

Use `createWebsiteRoomHeaders(accessToken)`, existing `socialHttpError()`, and
`FriendListItemSchema`. Return only validated request objects from the bridge.
The Popup will refresh the directory after acknowledgement rather than
optimistically inventing a relationship state.

- [ ] **Step 5: Verify extension bridge checks**

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test -- social-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the bridge slice**

```bash
git add apps/extension/src/social-client.ts apps/extension/test/social-client.test.ts
git commit -m "feat(extension): bridge popup social directory"
```

## Task 4: Migrate The Account-Owned Popup Social Snapshot

**Files:**

- Modify: `apps/extension/src/social-snapshot-cache.ts`
- Modify: `apps/extension/test/social-snapshot-cache.test.ts`
- Modify: `apps/extension/src/popup-app.tsx`

- [ ] **Step 1: Update cache tests first**

Change the valid fixture to `{ directory, invites }` and add regression tests
proving that:

- a snapshot is returned only for the matching authenticated account owner;
- the old `{ targets, invites }` cache shape is rejected and discarded;
- malformed timestamps or missing metadata never leak raw validation details to
  the Popup;
- account switching still hides the previous account immediately.

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test -- social-snapshot-cache.test.ts
```

Expected: FAIL until fixtures and Popup loading use the new directory contract.

- [ ] **Step 2: Load one canonical Popup snapshot**

In the existing account-generation guarded refresh path, replace Popup use of
`listInviteTargets()` with `listSocialDirectory()`. Continue loading room
invites in parallel, parse `{ directory, invites }` with
`SocialSnapshotSchema`, then write through the existing account-scoped cache.

Do not alter the overlay import or use of `listInviteTargets()`.

- [ ] **Step 3: Verify cache and account-isolation behavior**

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test -- social-snapshot-cache.test.ts
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
```

Expected: PASS.

- [ ] **Step 4: Commit the snapshot migration**

```bash
git add apps/extension/src/social-snapshot-cache.ts \
  apps/extension/test/social-snapshot-cache.test.ts \
  apps/extension/src/popup-app.tsx
git commit -m "refactor(extension): migrate popup social snapshot"
```

## Task 5: Build A Defensive People View Model And Focused Component

**Files:**

- Create: `apps/extension/src/popup-people-model.ts`
- Create: `apps/extension/src/popup-people-panel.tsx`
- Create: `apps/extension/test/popup-people-model.test.ts`
- Create: `apps/extension/test/popup-people-panel.test.tsx`
- Modify: `apps/extension/src/popup-styles.ts`

- [ ] **Step 1: Write failing view-model tests**

Define a pure `buildPopupPeopleModel(directory)` and prove that it:

- deduplicates every list by stable user/group ID;
- removes from Recent anyone present in Friends, incoming requests, or outgoing
  requests even if a stale server payload accidentally includes them;
- excludes archived groups;
- preserves server ordering for remaining rows.

This is a rendering safety fence, not an alternative source of truth.

- [ ] **Step 2: Implement the pure model**

Return a minimal immutable model containing accepted friends, incoming/outgoing
request ID sets, active groups, and eligible recent people. Keep relationship
state transitions out of this module.

- [ ] **Step 3: Write failing component tests**

Using the repo's happy-dom/React test pattern, verify:

- `Friends` is the default internal mode;
- only `Friends` and `Groups` mode controls exist;
- `Watched with recently` is absent when empty;
- each recent row has one `Add friend` action;
- `Groups` shows quick creation and summaries but no rename, archive, or member
  editor controls;
- `Open dashboard` is always available;
- signed-out, loading, stale/error, and empty states remain explicit.

- [ ] **Step 4: Implement `PopupPeoplePanel`**

The component owns only local presentation state (`friends` or `groups`). It
receives canonical data and callbacks from `popup-app.tsx`; it performs no auth,
fetching, caching, or Chrome messaging itself.

Use compact rows rather than nested cards. Keep the current dark translucent
Popup language, orange command accent, clear keyboard focus, constrained text,
and stable dimensions. Do not create a decorative redesign unrelated to the
information architecture.

- [ ] **Step 5: Verify focused model/component tests**

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test -- \
  popup-people-model.test.ts popup-people-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the component slice**

```bash
git add apps/extension/src/popup-people-model.ts \
  apps/extension/src/popup-people-panel.tsx \
  apps/extension/test/popup-people-model.test.ts \
  apps/extension/test/popup-people-panel.test.tsx \
  apps/extension/src/popup-styles.ts
git commit -m "feat(extension): add focused popup people panel"
```

## Task 6: Wire People, Groups, And The Unified Inbox

**Files:**

- Modify: `apps/extension/src/popup-app.tsx`
- Modify: `apps/extension/src/popup-styles.ts`
- Modify: `apps/extension/test/popup-people-panel.test.tsx`
- Modify: `apps/extension/test/social-client.test.ts`

- [ ] **Step 1: Add failing Popup integration assertions**

Cover these product rules at the component boundary:

- top navigation labels are `Watch`, `People`, and `Inbox`;
- `People` has no numeric badge;
- `Inbox` count combines pending room invites and incoming pending friend
  requests;
- accepting/declining a friend request refreshes canonical social data;
- adding a recent person sends one request and refreshes canonical social data;
- group quick-create refreshes canonical social data;
- outgoing requests do not create a separate Popup subsection.

- [ ] **Step 2: Replace the monolithic social panel**

Render `PopupPeoplePanel` from `popup-app.tsx`. Remove the Popup-only group
rename/archive/member-editing state and handlers. Do not delete the underlying
social-client functions if they are used by another consumer; remove only dead
Popup wiring after verifying references with `rg`.

- [ ] **Step 3: Extend the existing Inbox panel**

Rename the top label from `Invites` to `Inbox`. Render incoming friend requests
before or beside pending room invites as separate compact sections, with
`Accept` and `Decline` actions. Preserve existing room-invite accept/decline
behavior and links.

The Inbox badge is actionable count only:

```txt
pending incoming friend requests + pending non-expired room invites
```

Do not derive it from total friends, groups, sent invites, or outgoing requests.

- [ ] **Step 4: Finish Popup styling and accessibility**

Add or refine only selectors required by the new People modes, recent rows,
quick group creation, and mixed Inbox sections. Verify:

- keyboard focus remains visible;
- long display names truncate without moving actions;
- controls do not overflow at the fixed Popup width;
- empty/error/loading states do not resize the navigation;
- no card is nested inside another decorative card.

Remove obsolete Popup group-editor selectors only after confirming no remaining
references.

- [ ] **Step 5: Run the full extension test suite**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
```

Expected: PASS.

- [ ] **Step 6: Commit the Popup integration**

```bash
git add apps/extension/src/popup-app.tsx \
  apps/extension/src/popup-styles.ts \
  apps/extension/test/popup-people-panel.test.tsx \
  apps/extension/test/social-client.test.ts
git commit -m "feat(extension): complete popup people and inbox flow"
```

## Task 7: Cross-Plane Verification, Graph Refresh, And Staging Artifact

**Files:**

- Modify if current truth changed: `docs/current-development-state.md`
- Update intentionally: `graphify-out/graph.json`
- Update intentionally: `graphify-out/GRAPH_REPORT.md`
- Update intentionally: `graphify-out/manifest.json`

- [ ] **Step 1: Run focused cross-plane gates**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/protocol check
fnm exec --using=22.23.1 pnpm --filter @anidachi/protocol test
fnm exec --using=22.23.1 pnpm --filter @anidachi/web check
fnm exec --using=22.23.1 pnpm --filter @anidachi/web test
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
```

Expected: PASS.

- [ ] **Step 2: Run repository quality gates**

```bash
fnm exec --using=22.23.1 pnpm dev:check
git diff --check
```

Run `pnpm check` as well if `dev:check` selects the broad cross-plane profile or
reports that it is required.

- [ ] **Step 3: Build and validate the staging extension**

```bash
fnm exec --using=22.23.1 pnpm build:extension:staging
fnm exec --using=22.23.1 pnpm validate:extension:staging
```

Expected: the generated staging artifact validates with channel-appropriate
permissions and no secrets or local debug exports.

- [ ] **Step 4: Refresh Graphify intentionally**

```bash
fnm exec --using=22.23.1 pnpm graph:update
```

Review graph changes before staging. Commit only the approved team artifacts;
exclude cost, HTML, wiki, cache, and scratch outputs.

- [ ] **Step 5: Perform loaded-artifact acceptance**

Using two authenticated staging accounts where needed, verify:

1. Popup opens on `Watch`; `People` has no number; `Inbox` has the actionable
   count.
2. Friends mode shows accepted friends once and eligible recent co-watchers once.
3. Adding a recent person removes that row after refresh and places the pending
   request in the recipient's Inbox.
4. The recipient can accept or decline; both Popups converge after refresh.
5. Groups mode creates a personal group and lists it, but delegates full editing
   to the dashboard.
6. Existing room invite acceptance/decline still works.
7. Account switch never shows the previous user's social snapshot.
8. Offline/cache state is clearly stale and mutations fail honestly without
   inventing success.
9. Existing overlay invite targets and room/P2P behavior remain unchanged.

Record environment, extension artifact identifier, accounts used, and any
remaining unverified scenario in the PR.

- [ ] **Step 6: Update current-state documentation only if needed**

If staging acceptance changes current implementation truth, add a concise entry
to `docs/current-development-state.md`. Do not duplicate this plan or the
approved product specification.

- [ ] **Step 7: Commit verification artifacts and documentation**

```bash
git add docs/current-development-state.md \
  graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
git commit -m "docs(account): record popup people verification"
```

Skip unchanged files rather than creating empty churn.

## Pull Request And Rollback

- Open one coherent PR from this feature branch into `staging`.
- PR quality-gate profile: `protocol + web account API + extension Popup`.
- Document that no database migration, Worker deploy, room contract, manifest
  permission, overlay, sync, or P2P behavior changed.
- Rollback is code-only: revert the feature commits and rebuild the staging
  extension. The old target-only local social cache is deliberately invalidated
  and safely refetched; no durable server data rollback is needed.
- Promote to `main` only after staging web APIs and the loaded extension artifact
  pass the acceptance scenarios above.

## Final Self-Review Checklist

- [ ] Every value crossing web/extension is parsed by a shared Zod schema.
- [ ] Friends, requests, groups, recent people, and invites remain server-owned.
- [ ] Recent people cannot duplicate accepted or pending relationships.
- [ ] `People` has exactly `Friends` and `Groups`; Recent is contextual.
- [ ] Friend requests are actionable in `Inbox`.
- [ ] Popup group management remains lightweight; full controls remain web-only.
- [ ] Existing `InviteTargets` consumers are unchanged.
- [ ] Account-generation and owner-key cache fences still pass tests.
- [ ] No overlay, room, provider, sync, media, permission, or secret behavior
  changed.
- [ ] Relevant tests, staging build validation, Graphify review, and manual
  evidence are recorded before promotion.
