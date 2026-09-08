# PR draft: Unify personal history and negotiate independent room media limits

Target: `staging`, after the prerequisite PR has applied and been verified.
Local draft only; no PR has been opened.

## Goal and changed areas

Plus/Pro viewers record their own playback in solo and rooms, including as a
guest of a Free host. Free clients stop history observation/catalog/outbox;
Recent People instead uses actual co-presence. Unified Watch/Resume uses retained
personal progress. Host plans define 4/6/15 participants, four cameras and 4/6/8
microphones; reception is independent of publication. Worker quota snapshots
preserve authoritative Free remaining time and legacy-client behavior.

This high-risk PR affects Web, Worker, extension and protocol. Assemble the
exact `runtimeSplitChanges` paths from [the source pin](source-candidate.json),
then include reviewed current docs and the intentional final semantic Graphify
batch. Source is `d2e32e87494924d73ddb16ed9956490a9f635061`; any later runtime
changes require a revised pin and scoped review. No migration or activation
change remains in this split. Do not push the original mixed-WIP checkout.

## Verification and limits

[Tasks 1–9 evidence and matrix](../../personal-history-and-plans-mvp-verification.md)
record reviewed actual SQL, protocol/Web/API/extension checks, mounted UI and
Worker behavior. Task 9 recorded protocol169/API217/Worker-runtime61/room-harness39
passing cases. Its later legacy quota fix passed the covering50 extension cases,
check and narrow build/validation. Task 8 actual-controller local4/6/15 receipts
prove permitted decode with synthetic devices; no forced relay or distributed
acceptance is inferred. These historical receipts are reused. The final I1–I3 correction additionally
passes Web476/6skip, API217, Worker61, extension1816 plus final drawer51, room39,
covering type checks and narrow staging build/validation. The exact README
activation transaction has a guarded real-Postgres create/lock race regression.
Source coverage now contains 159 runtime paths and 14 immutable migration paths
(173 total, disjoint); eight Git objects bind the source above.

Record assembled-PR `pnpm dev:check` output and actual CI checks separately.
The command classifies/recommends; it does not execute tests. Preserve disclosed
ineffective dynamic-import and large-chunk build warnings; no unrelated bundle
change is included. Capture final committed-source narrow build identity once
review completes. Build success does not prove a loaded extension.

## Staging release and required manual acceptance

Policy remains inactive through compatible Web/Worker deployment and matching
client delivery. Wait for both runtimes; old Worker rejects signed v2 tokens,
so do not distribute new client during mixed deployment. Explicit new personal
writes are already paid-gated while inactive, allowing controlled acceptance.
Legacy paths remain until the separate coordinated activation; no public
pre-release feature flag or pricing availability note is introduced.

Use [the delivery/recovery packet](README.md) for exact identities, retained
backups, tester hashes/reload and C03/C04. Real Stripe TEST, loaded MV3/provider
and browser-kill, physical media/output, forced TURN, two-network and remote-
country proofs remain explicit gates. No activation or main/production acceptance
is claimed by this PR; new public media/pricing claims wait for matching accepted
runtime and separate production decision. Verify staging password/noindex and
the promotion workflow's manual_pr/no-auto-merge result; do not merge PR #247.

## Docs, Graphify, security and rollback

Canonical current state, architecture, pricing, P2P progress and verification are
updated; final semantic Graphify and the whole-branch review precede delivery.
No new secrets, Stripe prices or OAuth redirects; narrow extension permissions
and canonical staging endpoints remain required. No real subscriptions,
notifications, invites or user hardware are used as incidental tests.

Before activation, preserve DB and drain any v2 rooms before a verified legacy
runtime recovery. After activation, policy stays true; only tested compatible
personal/v2 runtime or a reviewed fail-closed forward fix is acceptable. The
first cutover has no prior accepted v2 deployment: exact candidate/rehearsal
remains C04, not an assumed rollback to a03c012. Never reset data or epochs.
