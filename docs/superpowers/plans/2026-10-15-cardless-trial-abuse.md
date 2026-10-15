# Cardless Trial Abuse Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; TDD and one final independent review.

**Goal:** Prevent repeated cardless trials using account, cookie and optional installation markers.

**Architecture:** Browser context/proof is verified by Web. PostgreSQL reserves markers atomically with existing account authority; Stripe recovery remains unchanged.

**Tech Stack:** Next.js, TypeScript, Web Crypto P-256, PostgreSQL, WXT MV3.

**Spec:** ../specs/2026-10-15-cardless-trial-abuse-design.md

## Global Constraints

- Staging only; preserve root design checkout. No mandatory extension, added broad permissions, polling or paid-access restrictions.
- Markers last 365 days after verified creation; unknown reservations never time out into a new grant.
- Keep existing activation recovery and old extension compatibility; no secrets or identifiers in logs/URLs.

## Interfaces

- `TrialAbuseMarkers`: server-only `{browser: string; installation?: string}` digests.
- Shared `TrialInstallationProof`: version 1, challenge, SPKI public key, P-256 signature. Strict schemas and bounds.
- POST `/api/billing/trial/context`: owner/CSRF-bound cookie bootstrap plus request-bound challenge.
- Start service receives a lazy context resolver used only before a new reservation.
- `reserve_cardless_trial_v2`: original reservation parameters plus browser/installation digests; exact replay preserves frozen terms.

## Review Focus

- Account switch while an extension response is late must not authorize the new account.
- Cookie erased between display/activation must not create an unbound claim.
- Parallel accounts sharing either marker must yield only one Stripe creation.
- Stripe timeout and account deletion must not free an unknown reservation.
- Old app rollback must not mint trials around an enabled database guard.

### Task 1: Atomic durable marker claims

Files: new migration, supabase/tests/cardless_trial_abuse.test.sql and disposable contract runner.
- [ ] Write failing SQL contracts for shared marker/replay/old-server guard/ACL/deletion/failure.
- [ ] Implement additive columns, private ledger, sorted locks, v2 reservation and state-trigger reconciliation.
- [ ] Run real PostgreSQL contracts and parallel connections; commit.

### Task 2: Cookie and optional extension proof

Files: packages/protocol/src/trial-abuse.ts; web lib/anidachi-auth/trial-abuse.ts; extension src/trial-installation.ts and bridge/background/manifest integration.
- [ ] Write failing crypto, bounds, sender/channel, persistence and timeout tests.
- [ ] Implement purpose/origin-bound cookie/challenge and install-key signing, narrow external messaging.
- [ ] Run focused tests/checks; commit.

### Task 3: Trial route and confirmation integration

Files: cardless-trial service/server/routes; trial/context route; trial-abuse-client; checkout continuation; trial-client.
- [ ] Write failing activation, recovery, cookie-only and UI business-state tests.
- [ ] Wire lazy verification to v2 reservation, cookie bootstrap and optional bounded proof.
- [ ] Keep used/retry distinct and paid/recovery paths unchanged; run full affected suites; commit.

### Task 4: Review and staging delivery

- [ ] Update current docs, privacy disclosure and release channel/runbook.
- [ ] Review whole branch independently; address important findings with regression tests.
- [ ] Checks, SQL contracts, extension artifact validation and local UI inspection.
- [ ] Graphify semantic update or precise failure record; dev:check; PR into staging, CI, migration/deploy, enable staging guard, verify.
- [ ] Exact tested ZIP and delivery receipt; no production promotion.
