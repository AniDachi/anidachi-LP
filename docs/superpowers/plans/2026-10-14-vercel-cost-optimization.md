# Vercel Cost Optimization Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or subagent-driven-development. Preserve task ownership; steps are tracked below.

**Goal:** Reduce avoidable calls without weakening authorization, history or room finalization, and deliver the fixes to staging.
**Architecture:** Keep existing Web/Worker/extension contracts. Use local identity for local guards and existing server validation for requests; reconcile terminal receipts only with durable source proof.
**Tech Stack:** TypeScript, Next.js 15, WXT/MV3, Cloudflare Durable Objects, pnpm 11.2.2, Node 22.23.1.
**Spec:** [Approved design](../specs/2026-10-14-vercel-cost-optimization-design.md).

## Global Constraints

- Isolated `codex/vercel-cost-optimization`, fresh staging d6696693.
- Preserve original dirty UI/onboarding checkout and unrelated collaborators.
- No main deployment, Store publication, live data changes or new feature flags.
- Preserve response compatibility, server lease expiry and owner/epoch guards.
- Do not claim a production cost result from synthetic or staging evidence.

## Review Focus

- Account/token changes during an in-flight request must never commit old identity.
- Revoked/expired history permission must stop capture even when polling backs off.
- Restart/lost ACK must retain source and usage until explicit durable proof.
- A pending source newer than the ended DB row cannot be falsely acknowledged.
- Older extensions must continue to understand Web/Worker responses.

## Task 1: Stop authority polling in blocked history states

Files: extension `src/watch-history-controller.ts`, preference listener and minimal
`overlay-app.tsx` preference wiring; controller/listener tests.
Consumes existing access lease, consent and current-owner callbacks. Produces
an explicit optional local recording preference and unchanged capture contract.

- [x] Add fake-clock tests for paused free/local-off/YouTube-off/unavailable states,
  expiry, explicit settings/account/provider refresh and revocation; run RED.
- [x] Honor denied lease expiry, stop local-disabled polling, bound retry on
  unavailable authority; keep permission checks on every observation.
- [x] Run controller/listener tests GREEN, then extension checks/full tests.
- [x] Record request-count before/after and commit this independent block.

## Task 2: Remove repeated network session resolution

Files: extension `src/watch-history-client.ts` and background auth tests.
Consumes stored tokens and existing network request-session resolver. Produces
the same session API without repeated server resolution for local guards.

- [x] Add RED tests counting real resolver/HTTP work for background auth-change,
  empty flush, 401 recovery, token rotation and account switches.
- [x] Match the established foreground wiring: stored-token reads for local guards,
  explicit network resolver for authenticated recovery.
- [x] Run GREEN tests plus extension checks/full suite; record counts and commit.

Global auth singleflight is deferred. Matching an account/token string alone
cannot detect logout followed by login to the same account with the same token.
It needs a separate invalidation epoch and review; this change does not add an
authorization cache or modify `auth-client.ts`.

## Task 3: Reuse trusted account data on `/api/me`

Files: Web `app/api/me/route.ts`, `lib/anidachi-auth/social.ts`, focused tests.
Consumes server-loaded user snapshot. Produces unchanged public account/profile.

- [x] Add RED coverage showing only one user read, unchanged JSON and missing-user
  response, preserved missing-profile and avatar repair, snapshot owner mismatch.
- [x] Allow profile ensuring to reuse a trusted matching loaded snapshot; all other
  callers retain existing lookup behavior. No cross-request account cache.
- [x] Run GREEN focused tests and Web checks/full tests; commit independently.

## Task 4: Recover proven terminal source delivery and honor retry backoff

Files: Web `lib/anidachi-auth/room-source.ts`, `db.ts`, related tests;
Worker source/terminal scheduling in `src/index.ts` and related tests.
Consumes existing source ACK schema. Produces only existing persisted/stale ACKs.

- [x] RED tests for lost ACK after DB end, exact proof, newer durable generation,
  conflicting/missing/invalid proof and pending newer source.
- [x] Recover only proven persistence; preserve all other failures.
- [x] RED runtime tests for one initial forced attempt, durable retry deadlines,
  repeated End/restart, usage/presence independence and no post-finalization calls.
- [x] Respect source backoff on retries, preserving initial accounting order and
  terminal fence. Do not silently discard unresolved pending work.
- [x] Web/API checks/tests, runtime tests and room harness GREEN; commit.

## Task 5: Review, staging delivery and acceptance

- [x] Independent review of identity/lease/terminal invariants; fix substantive findings.
- [x] Run `pnpm dev:check`, affected checks/tests, API runtime and `pnpm harness:rooms`.
- [ ] Update docs + Graphify through semantic fragments/safe adapter; record evidence.
- [ ] PR into staging; verify exact Web and Worker revisions. Either deployment
  order is compatible: response schemas are unchanged, old Web keeps returning
  409 for unresolved delivery, and the new Worker backs off without discarding it.
- [x] Build/validate narrow staging extension into its own artifact directory.
- [ ] Re-run equivalent count scenarios, Worker smoke and loaded-client auth/history
  smoke; record any human acceptance still required separately from automated proof.
- [ ] Use the [combined release plan](2026-10-14-integrated-product-release.md) for
  subsequent UI import, final acceptance and eventual approved production rollout.

## Local evidence (2026-10-14)

Controlled one-hour cases include initial startup and 720 five-second ticks;
they do not predict the production invoice or include repeated explicit focus.

| Case | Before | After |
| --- | ---: | ---: |
| Valid Free/denied history lease | 361 authority loads | 13 |
| Local recording / YouTube consent off after bootstrap | 361 | 1 |
| Persisted local OFF, no partition, unavailable server | 15 in initial fix | 0 after review fix |
| Unavailable authority | 361 | 15 |
| Background auth-change | 19 redundant `/api/me` calls | 0 |
| Warm empty background flush | 8 redundant `/api/me` calls | 0 |
| Ended room, retryable source failure | 122 source calls/hour | at most 18 |

History HTTP calls and 401 refresh remain in place. `/api/me` ordinary profile
reads use one user query instead of two; insert-race repair also reuses that user.
Cold persisted OFF loads the local choice independently of server bootstrap.
Unknown local choice fails closed and explicit recovery retries the local read;
delayed startup or storage recovery cannot override account changes or revocation.

Extension: 2241 tests; Web: 1171 passed / 6 skipped plus 5 subsequent route tests;
API: 253 unit / 98 runtime; room harness: 39; real WebRTC harness: 26. All affected
type checks passed. These are local results, not loaded-artifact acceptance.

Committed blocks: account read `513d84c9`, background guards `a41e1d49`, Web proof
recovery `f7b7352d`, Worker retry `cc6c7ada`, history controller `7dbcb406`.
Independent review identified the cold-OFF gap; regression coverage was added
and re-review found no further blockers before staging delivery.

The isolated staging extension was built and validated at runtime source
`7dbcb406`; its folder/ZIP are local artifacts, not changes to the user's design
folder or a Store package. The PR and deployment receipts will record the final
docs/graph-inclusive SHA and exact staging deployment IDs.

The unknown pending tuple of the audited production room is still not established.
A genuinely newer pending source remains retained and retries with backoff; no
live orphan repair, migration, monitoring disablement or cost guarantee is claimed.
