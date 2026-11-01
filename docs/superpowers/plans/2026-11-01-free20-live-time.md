# Free20 authoritative extension time

Status: owner approved implementation, checks, PR into staging and refresh of the
existing unpacked staging folder on November 1. Base: staging `48887e75`.
Spec: [daily Free20](../specs/2026-10-30-daily-free20-design.md).

## Global constraints

- Implement the real pre-room, live-room and exhausted displays in the accepted
  overlay. Preserve camera/microphone placement and original action authority.
- The server alone owns 1200 host seconds per UTC day. Solo does not meter;
  host plus guest meters even on pause. No fabricated allowance or unlimited.
- Reuse account hosting status before/after rooms and authoritative DO time in
  rooms. Never substitute the account read for the live room protocol.
- Preserve owner/session/room/generation/sequence/time fences; unknown is not zero.
- No per-tick network/DB writes, playback-driven time broadcasts or new polling.
- Existing strict old clients get their original event shape. Negotiate the new
  display event explicitly; negotiation gives no additional hosting rights.
- Do not change runtime/SQL activation flags, trial issuance, purchase delivery,
  media caps, warning policy, production or Store in this block.

## Task 1: Server time transport

Define an opt-in hosting-time event with authoritative server time, bounded
freshness and the existing HostingTimeSnapshot. Preserve old JOIN and event
compatibility. Persist negotiated support across hibernation and monotonic public
ordering before sending. Project confirmed finite/unlimited/unknown authority;
never infer grant provenance from the pinned media plan. Emit on join, relevant
meter/right/UTC changes and bounded explicit recovery, not playback frames.

Write regression tests first for negotiation, stale/unknown authority, paused and
solo time, UTC and hibernation ordering, old-client silence and economic no-op
behavior. Run protocol/API/web checks and affected tests plus Workers runtime.

## Task 2: Extension consumers

Add the account-bound hosting-status background read and hook. Fall back to the
legacy display only for the explicit disabled-policy response. Integrate live
events through existing authenticated room lifecycle fences, use monotonic local
countdown, hide stale readings on disconnect/sleep/expiry, and request bounded
recovery on resume. Preserve legacy rooms, paid users and guest behavior.

Write regression tests first for owner/session changes and late responses, idle
and paused time, zero/UTC, reconnect/order, unknown-vs-zero and no tick requests.
Run extension checks and full tests. Inspect actual components visually.

## Task 3: Review and staging delivery

Run the room harness and applicable quality gates, document any real-media
exception, update docs and Graphify. Fresh whole-branch review; fix important
findings with failing regressions. Build and validate narrow staging artifact.
Deliver via PR into staging, check CI and deployments/smoke, rebuild the merged
SHA and refresh the existing installed folder. Record exact artifact identity and
remaining loaded-browser acceptance. Main and Store remain separate.

## Review focus

Cross-socket/account leakage, stale time increasing a budget, old clients receiving
unknown events, unbounded recovery traffic, public sequences lost at hibernation,
unknown paid provenance, timer firing server actions, changed media controls.

## Rollback

Before activation revert this block through staging and rebuild the extension.
After activation preserve marker/schema-aware accounting and settlement; disabling
the SQL flag also affects live room admission/renewal and is not seamless rollback.
