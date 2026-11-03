# Free20 anti-abuse staging delivery

Status: compatible staging delivery completed on November 3, 2026; anti-abuse
activation and loaded-client acceptance remain pending. See the delivery receipt
below; the ordered procedure still governs activation and later rehearsals.
Parent: [implementation plan](2026-11-03-free20-abuse-adaptation.md).
Contract: [approved design](../specs/2026-11-03-free20-abuse-design.md).
The existing [Free20 activation runbook](2026-11-01-free20-staging-activation-runbook.md)
records environment boundaries. Reconfirm current project IDs, exact revisions,
deployment heads and room state before any hosted operation; historical receipts
are not a current inventory. Main, production, Store and LIVE Stripe are excluded.

## Delivery order

1. Complete protocol, SQL, Web, Worker and extension implementation, independent
   reviews and affected-plane checks. A database-only candidate is incomplete.
   Keep both the new SQL policy and Web environment gate disabled initially.
2. Deliver the reviewed additive migration through the existing staging database
   workflow from a frozen feature ref, using the previously documented schema-first
   exception. Verify exact version/hash, service-only function ACLs, private-table
   access, old-entrypoint fences and the default-off policy before runtime merge.
3. Deliver compatible Web and Worker through the normal staging PR and CI path.
   Check exact deployed heads and that the new internal transfer endpoints are
   present. Existing accounting/budget/settlement gates remain enabled as required
   by the already running Free20 system; do not confuse them with the new gate.
4. Build and validate the matching narrow-permission staging extension. Preserve
   the known unpacked-folder location, back it up and compare every copied file.
   Replacing files is not evidence that Chrome loaded them. The owner chose to
   reload the extension and inspect the interface himself.
5. After the owner confirms reloading the delivered extension, enable
   `ANIDACHI_FREE20_ABUSE_ENABLED=true` only for the exact staging Web
   Preview deployment on exact branch `staging`, never broad Preview or Production,
   and verify it is serving the intended alias. This enables compatible
   enrollment and v5 callers; SQL still decides final admission enforcement.
6. Re-inventory unprotected nonterminal Free20 rooms. Let them close through their
   normal lifecycle; do not rewrite browser ownership, erase usage or force-close
   unrelated rooms. SQL prevents activation while such rooms remain. Concurrent
   admission is serialized against the policy update.
7. Enable only `hosting_commercial_policy.free20_abuse_enabled` in a guarded
   forward policy update using the freshly observed revision and expected flags.
   Preserve original activation, grants, account usage, trial-retirement state
   and existing Free20 accounting. Verify the actual policy and enabled endpoints
   afterward; source configuration alone proves neither.

Do not activate with missing runtime/client support, unknown deployment identity,
an unresolved room drain, or outstanding material review findings. No new account,
subscription, payment, clock or usage modification is required for delivery.

The anti-abuse candidate adds no Worker flag or secret. Reuse existing internal
room credentials and the purpose-separated cookie/installation signing mechanism.
SQL `free20_abuse_enabled` and Web `ANIDACHI_FREE20_ABUSE_ENABLED` are distinct
from the already active base Free20 accounting gates; neither source declaration
nor enabling only one gate proves complete enforcement.

## Preparation snapshot and comparison packet

The read-only preflight at `2026-11-03T11:12:34Z` observed staging `3eeea8bc`,
Web READY `dpl_C3D1yExdG6bbscBv2Xjmbx5NxAvw` at `staging.anidachi.app`, Worker
`db322fb7`, 89 database migrations through `20261101102723`, no new anti-abuse
migration, policy revision 4/free20 true/trials false and one nonterminal
unprotected Free20 room. `artifacts/free20-abuse-20261103/staging-preflight.json`
records this snapshot. Refresh it before any hosted mutation; do not force-close
that room or treat its observed presence as authority to change user data.

Root's `artifacts/free20-abuse-20261103/schema-audit.sql` and
`expected-schema.json` are prepared for later read-only hosted comparison: 30
function bodies/signatures/ACLs, three private tables without direct runtime-role
DML, and the new default-false columns. The candidate's single shared bounded
cleanup runs at 03:17 UTC, removes eligible marker-day history older than seven
UTC days and retains unsettled reservations. An exact local full-file replay
passed 109/109 abuse assertions with users 0, cron off and no network. None of
these local artifacts means the hosted schema has been compared or migrated.

The Task 4 ignored narrow candidate and identity receipt are recorded in the
[implementation plan](2026-11-03-free20-abuse-adaptation.md#execution-evidence-and-remaining-delivery-gates-november-3-2026).
It was built from the base plus dirty-source fingerprint; a delivery artifact must
be rebuilt from the final reviewed frozen source and validated before replacement.
Build output included ineffective dynamic imports and oversized-chunk warnings;
their baseline ancestry was not independently verified. The stable working folder
was left unchanged. Keep backup, exact source/build identity and all-file copy
comparison receipts when a later authorized compatible delivery replaces it.

## Authorized delivery receipt, November 3, 2026

The owner authorized staging delivery and updating the same extension folder.
The frozen reviewed head was `8a4e479cfa1509db3be644edb8322291a9208e49`.
The schema-first workflow
[41640338430](https://github.com/AniDachi/anidachi-LP/actions/runs/41640338430)
applied only `20261103120000_free20_abuse.sql` to staging project
`cyppqpprkygjloyfvvvj`, before [PR502](https://github.com/AniDachi/anidachi-LP/pull/502)
merged as `03efd89983ff06cbba1651f63e073f5f21b06fe1`.
Migration SHA-256 is
`7b467d18d0b9b2e2f57238a694d0c7a9091e4b5ddc3e382a24cdba8d371fcdf8`.

The hosted database has 90 migrations; all 30 checked function identities,
definition hashes and ACLs, three private-table protections, both default-false
columns and the 03:17 UTC cleanup job exactly match the local reviewed schema.
Security advisors added only the expected informational no-policy entries for
the three private tables; direct anon/authenticated/service-role table access is
denied, with access through the checked functions. Policy revision 4, original
activation and existing Free20/trial flags remain unchanged. The new SQL gate
is false; no protected rooms or bindings existed in the post-migration readback.
The new Web gate is absent from the project's environment variables. No runtime
anti-abuse activation is claimed.

Web READY deployment `dpl_GgJ8Gdzf1afeeFBaAS6VVdWBVKzY` serves the staging alias
from `03efd899`. Worker workflow
[41640597041](https://github.com/AniDachi/anidachi-LP/actions/runs/41640597041)
deployed `f39a67e5-8a95-4e47-8916-cea88b720361` at 100%, retaining existing
accounting and the staging internal Web origin. CI `41640597001`, extension
build `41640597196`, staging smoke `41641051077` and the direct Worker smoke
passed. Unauthenticated Web probes are stopped by the staging access gate;
the new Worker transfer route returns 401. This is delivery/auth-boundary
evidence, not authenticated enrollment or transfer acceptance.

CI artifact `13231299833` is the narrow staging extension with build ID
`03efd89983ff06cbba1651f63e073f5f21b06fe1-staging-246`. Its inner ZIP SHA-256 is
`16881a1c727c0552085dd6cf73200343136feeecdefaa1fb4bd36728ceff2b28`.
The existing primary folder
`/Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging` and its
same-named worktree mirror were backed up separately and replaced. Their previous
builds differed; both now match all 13 CI file hashes, with the existing public
manifest key, extension ID and narrow permissions retained. No Chrome reload or
loaded-artifact acceptance was performed by the agent.

Receipts and backups are in ignored
`artifacts/free20-abuse-staging-delivery-20261103/`. Main remains `9da93cd9`,
production Web remains `dpl_6FTnPJHmRWPZ4hX9LLZRuF9VaBke` and production Worker
remains `3ea773eb-f258-4713-a314-9abeb4012f49`. Promotion PR471 remains unmerged
with auto-merge disabled. No account, grant, usage, LIVE Stripe or Store change
was part of delivery. Continue from step 5 only after the owner's reload; refresh
room/policy/deployment state again before activation.

## Acceptance and evidence

Record exact commits/deployments, migration hash, gate values and extension build
identity. Keep local synthetic evidence separate from authenticated acceptance.

- A spends time, then B in the same browser gets only the shared remainder.
  The same account on another device retains its own spent time.
- Replacing one marker retains the surviving marker's consumption; replacing
  markers in alternation cannot wash out the inherited floor. Resetting both
  markers plus a new account remains the stated design limit.
- While another account holds the same browser/installation reservation, the
  reply is neutral busy, without leaking that account or room.
- Same-context reconnect preserves the room. A new verified context stops host
  spending, settles the old interval, attaches scopes and durably installs the
  effective budget before host admission resumes. Retry/restart cannot detach a
  replacement host twice or revive a terminal room.
- Paid/trial/manual access and ordinary guest entry do not require Free20 proof
  or show free-only controls. UTC reset, paid expiry and paid upgrade preserve
  accounting. Unknown proof does not become a successful full or zero allowance.
- Cookie policy failure is retryable unavailable, never cookie-only proof or
  newly minted time. Context/keys/marker values stay out of URLs and logs.

The synthetic actual-handler/P-256 test uses a simulated cookie jar; it does not
prove Chrome delivers the cookie under the owner's browser policy. Existing silent
PKCE auth has no equivalent first-party proof POST/result handoff, so no such
fallback is claimed. Privacy copy is conditional on enabled daily protection and
keeps the older trial-specific optional-proof/365-day disclosure separate.

Actual two-account browser use, two-participant spending, loaded extension,
purchase during spending and real UTC rollover remain pending unless observed.
The owner's lack of a second participant does not invalidate synthetic tests,
but those tests cannot be relabeled as live acceptance or production readiness.

## Rollback

Retain the additive schema, cumulative usage, all room bindings and compatible
runtime readers. The new admission flag can be disabled deliberately to weaken
new shared-scope admission temporarily; already protected rooms must continue
using their bound effective allowance through terminal settlement, even while
the new gate is off. Do not downgrade to a runtime that ignores those bindings.

Keep compatible Web/Worker and existing Free20 accounting available until protected
rooms and pending transfers/ACKs are durably terminal. A missing room/account row
is not proof that unsettled marker ownership can be released. Never manually clear
reservations or decrement usage to make a retry pass. Preserve the existing trial
retirement and paid grants during any rollback.

Account-data deletion remains the existing support/email request. Operational
deletion must settle rooms first; orphan unsettled reservations intentionally hold
until independently verified settlement, rather than cleanup inferring completion
from a missing account or room. Do not use deletion or manual ledger edits as
rollback, acceptance setup or a way to recover allowance.
