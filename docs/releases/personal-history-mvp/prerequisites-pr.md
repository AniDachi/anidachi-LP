# Delivered PR: Add inactive personal-history and room-policy DB prerequisites

Target: `staging`. Delivered through PR #273; see [actual receipt](delivery-receipt.json).

## Goal and changed areas

Install the 14 additive migration revisions pinned in
[source-candidate.json](source-candidate.json), taking staging from 41 to 55
entries through `20260908072249`. They add durable personal access, independent
paid writes, presence evidence, versioned room capabilities and compatibility
fences while retaining existing progress, completion, consent and social data.
The policy row remains version 1 inactive. No activation SQL or Web/Worker/client
source belongs in this PR.

## Risk and verification

High risk: durable product state and cross-plane prerequisites. Exact migration
bytes are copied from reviewed source `d2e32e87494924d73ddb16ed9956490a9f635061`;
previously applied files are unchanged. The intentionally empty revision
`20260908031435` stays immutable; its following corrective migration is included.
Function replacement/private-schema fencing is additive to durable data, not a
claim that no SQL DROP/ALTER statements exist.

[Local verification](../../personal-history-and-plans-mvp-verification.md) records
actual PostgreSQL suites/concurrency and Task 9 populated 41→55 preservation:
24 old-column count/hash comparisons agree. Five empty fixture subsets are
explicitly empty, not populated preservation proof. Production starts from an
older chain and has no corresponding rehearsal here.

Run `pnpm dev:check` on the assembled split and record its classification; this
command only prints recommended checks. CI, exact remote migration deployment,
functions/grants and sanitized before/after counts must be recorded after merge.
Do not run fixture mutations or a reset against staging. No unchanged runtime
suite is claimed as rerun for this migration-only assembly.

## Release, docs, Graphify and security

Follow [the ordered packet](README.md). Existing staging DB workflow applies all
new revisions automatically on push with CLI 2.111.0; require its success and
55/inactive/grant verification before the runtime PR. The existing promotion
workflow must classify this as manual_pr and leave auto-merge disabled; PR #247
is outside this release. Staging remains gated/noindex.

Canonical docs and semantic Graphify are delivered with the subsequent reviewed
runtime/documentation packet; migration bytes already received scoped review.
No new secrets or env variables, no secret values in this PR. Database owner
privilege is used only by the existing migration workflow; service_role cannot
activate the policy directly. Prices, currencies, Stripe Price IDs and OAuth
redirects are unchanged.

## Rollback

Retain additive schema and data. Stop dependent runtime delivery on failure and
correct through a forward migration; do not reverse applied migrations or reset
epochs. The migration PR never enables policy. Runtime rollback and v2 room drain
are covered by the ordered packet; old staging is not post-activation recovery.

Actual final source includes reviewed test-only R1 at 2bf18fb; runtime merge c7fbdb5.
Migration bytes unchanged. Loaded browser, Stripe TEST, physical/network media and C04
remain open; policy false.
