# Vercel request-cost optimization design

Status: owner approved implementation and staging delivery on 2026-10-14.
Production promotion and Chrome Web Store publication remain separate decisions.

## Evidence and scope

The read-only audit is preserved locally in
`artifacts/vercel-cost-audit-2026-10-14/diagnosis.md` in the original checkout.
The 6–13 October partial-day request sample contained 1,058,592 invocations:
576,833 history-access and 341,686 account reads (86.77% combined).
This is a request distribution, not a promised reduction in the total invoice.
The measured full seven-day bill was USD15.597244 and included subscription,
observability, builds and other charges that these fixes do not eliminate.

Controlled baseline: a paused tab with free access, local recording off,
YouTube consent off or unavailable authority reloaded preferences 361 times/hour;
a valid allowed lease used 13. Background auth-change and flush paths invoked
network-capable session resolution 19 and 14 times respectively in empty-history
fixtures. Twenty parallel session reads invoked 20 network resolvers.
One long-ended production room generated 22,657 source 409 responses in the sample.
Its pending Worker source tuple was not captured, so no automatic recovery of
that exact production room is claimed by this implementation.

## Required behavior

1. History authority: local recording and YouTube opt-out stop autonomous
   authority polling. Settings/account/provider changes can explicitly refresh.
   Valid denied leases retain their expiry; unavailable authority uses bounded
   retries. Never extend a server lease or record after expiry/revocation.
   Preserve owner, access epoch and consent epoch fencing. Read local recording
   choice before bootstrap even without a history partition. Unknown local choice
   fails closed and can be retried on explicit recovery.
2. Account resolution: local ownership checks use stored session identity;
   authenticated HTTP requests and 401 recovery retain server validation. Reuse
   no completed validation result across requests; introduce no authorization TTL
   or public caching of `/api/me`. Global singleflight is deferred until a separate
   account-invalidation epoch can protect logout/login with an identical token.
3. Account route: reuse the already loaded trusted user snapshot for profile
   repair; preserve response shape, missing-user 401/404 semantics and avatar/
   profile repair. Never accept a client-supplied user snapshot.
4. Closed rooms: only acknowledge an ended-room source when explicit durable
   canonical columns prove the same tuple/generation or a newer same-provider
   generation. Missing/conflicting/newer pending sources remain unresolved.
   Initial terminal delivery may force once; retries respect persisted source
   backoff while retaining the terminal fence, accounting and presence work.
   Do not clear an outbox on arbitrary 409 or use a generic `/ended` receipt as
   source-persistence proof.

## Boundaries

No pricing, paid quota, plan rights, auth trust, monitoring subscription or
analytics delivery changes. No production orphan mutation. No schema migration
for the initial proof-based source recovery. A genuinely newer pending source
may require a separately reviewed terminal reconciliation contract; document
that remaining case rather than treating it as successful persistence.

## Delivery and success

Branch from staging d6696693df261a34927fd2aea96ad6f842872e87. Independent commits
for history, session resolution, account DB reads and terminal recovery.
Tests must show fewer calls under equivalent user behavior and unchanged
failure/identity/lease semantics. Web and Worker are compatible in either staging
deployment order: the ACK schema is unchanged, and old Web's 409 remains retryable
without losing durable work. Build the matching narrow extension and verify the
loaded artifact before final release acceptance.
Old Store extensions keep their old polling until updated; staging code alone
cannot establish production savings. After eventual release, compare same-length
traffic-normalized periods and separate functions from observability/base fees.
