# Private tester readiness — 2026-09-13

The owner requested a production ZIP for private testing before any website
download publication. Bug fixes and tester acceptance precede public release;
Chrome Web Store work is not included. This operational receipt supersedes the
older inactive-policy and pending-production snapshots. Product source is
unchanged by the receipt PR.

## Deployed source and artifact

- Main runtime/extension source: `92659774a2a29d35396964b349f45f52c794a01f`.
- Staging source: `c03b75e0bfd6a80edaa8a55d25efd1a236b7d137`; its product tree
  equals the main source tree.
- Production Vercel deployment `dpl_GZ4VCQcJiahtnHs8ewv7hvrxbVEN` is READY,
  bound to that main commit and `www.anidachi.app` / `anidachi.app`.
- Worker versions at verification: staging
  `e5cad8ca-00f9-4810-8889-7664a8ed66f9`, production
  `36cd97cd-c350-4d5f-9861-2e591ff137e5`, each receiving 100% traffic.
  Both health endpoints returned 200 and `service: anidachi-api`.
- Production extension build:
  `92659774a2a29d35396964b349f45f52c794a01f-production-158`, manifest 0.1.0,
  ID `gpkolofebdhfpapbbgdkdkmlmjfidgmn`, 692378 bytes.
- ZIP SHA-256:
  `f182771ac8f6a26986a569f1c72b79e8b19db7f8fcee4b2decf1a004051834d4`.
  ZIP integrity and production artifact validation passed again. The archive is
  reused unchanged from the successful CI release; no website link was published.

Private handoff location on the owner's checkout:
`artifacts/tester-builds/2026-09-13/AniDachi-0.1.0-test-92659774.zip`.
The adjacent `TESTING-RU.md` contains installation and feedback instructions.
These generated files stay ignored and are not committed.

## Authorized room cleanup and policy activation

The owner explicitly authorized completing 177 old staging test rooms, preserving
accounts/history and adding no usage. The guarded transaction rechecked the
exact count, activity before August 17 and zero active DB assignments. It used
`public.finalize_room_usage(room_id, ended_at, explicit_utc_day, 0)` and compared
full-row digests for 23 account, billing, history and usage tables before commit.
All digests matched. No room rows were deleted.

Staging afterwards: 502 ended rooms, zero non-ended rooms, zero assignments,
62 users, 340 episode-progress rows and 21865 accumulated usage seconds across
20 daily rows. Production had no non-ended legacy rooms to drain. Production
account count was 314 before and after its checks; no account or billing reset
was performed.

This receipt establishes DB finalization, not terminal Worker socket state.
The sensitive staging internal credential could not be exported through Vercel;
it was not changed or exposed. No Worker end requests were issued. An already
connected historical legacy socket is not ruled out by a DB assignment count or
JWT expiry. Ended records reject fresh room admission, and the active legacy
history fence rejects legacy writes. This bounded limitation is accepted for
private testing; it is not a claim of a global WebSocket drain.

The existing one-way operator transaction locked policy version 1, checked the
complete 60-migration schema and absence of non-ended legacy rooms under the
lock, then activated the policy. Independent reads confirmed:

| Environment | Supabase project | Active since (UTC) |
| --- | --- | --- |
| Staging | `cyppqpprkygjloyfvvvj` | 2026-09-13 04:23:31 |
| Production | `bynsjjxzatxndzjkogim` | 2026-09-13 04:26:35 |

Both finish with `{singleton: true, policy_version: 1, active: true}`.
No new flag, migration, env variable, secret or external Stripe mutation was
introduced. Reverting this documentation does not revert the operator action.
After activation, retain compatible v2 code and fix forward; do not switch the
policy back to false or deploy a pre-policy runtime.

## Verification and limits of the evidence

A short transaction used three collision-checked synthetic accounts, temporary
manual plan grants and current public RPCs. Every fixture was rolled back.
The inactive staging precheck and active staging/production checks passed:

- Authoritative caps reject caller-provided higher limits: Free 4 participants /
  4 cameras / 4 microphones; Plus 6 / 4 / 6; Pro 15 / 4 / 8.
- Free personal capture is denied. Paid personal writes persist the user's own
  progress; exact retries retain one receipt.
- Browse works. After paid expiry, saved progress remains readable and privacy
  deletion works without changing another owner's data.
- The active public legacy writer and old room protocol are rejected.
- Repeated quota commits/finalization do not add the same usage twice.
- Expired paid grants deny renewal with a stable closing deadline.

Independent post-transaction reads found zero fixture users, zero unfinished
legacy rooms/assignments, unchanged progress counts and unchanged daily usage
in both environments. Production retains zero progress and usage rows.

Fresh `pnpm harness:rooms`: **39/39 passed**. Fresh local
`HARNESS_MEDIA_V2=15 node tests/e2e/p2p-media-harness.mjs`: **8/8 passed**, with
15 Chromium participants, 4 camera publishers, 8 microphone publishers and
3 receiver-only participants. All 204 expected peer endpoints decoded media;
receiver-only clients made no capture calls. First-video p95 was 3186.1 ms.
This is a single-machine direct host/host test, not physical-device, geographic
or forced-TURN proof. Those checks belong to the upcoming tester phase before
public download acceptance. Manual plan grants test entitlements, not a real
Stripe charge.

Ignored detailed receipts are under `.worktrees/prelaunch-fixes/artifacts/pretest-20260913/`
on the owner's machine. No debug exports, credentials or ZIPs are committed.

## Local workspace and continuation

All 38 original dirty paths were reconciled against the released source. Eleven
were byte-identical; the remainder were earlier integrated or superseded source,
tests, docs and graph snapshots. No approved feature was missing from main.
The exact files and their original ancestry remain in local archive branch
`codex/archive-watch-toolbar-20260913`, commit
`85330b7ced487477ed83f737b761cdc3d1e2837b`; saved Git blobs were verified one by one.
This archive is historical preservation, not a feature awaiting a merge.

The main checkout is clean staging. Standard generated folders were replaced
with byte-verified CI copies, retaining their previous contents in ignored local
artifacts:

- `anidachi-extension-public`: production build 158 above.
- `anidachi-extension-staging`: `c03b75e0bfd6a80edaa8a55d25efd1a236b7d137-staging-157`,
  ZIP SHA-256 `8a53ba2087aae511d629388940ea9ab845aa28179b405d0334daa287e22b28af`.

Graphify was queried for policy/media navigation and source was verified. No
graph regeneration is needed for these dated operational receipts: architecture,
protocol and product source are unchanged. The docs-only PR uses link checks and
`pnpm dev:check`; the substantive runtime/DB evidence is recorded above.
