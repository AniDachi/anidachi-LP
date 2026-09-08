# Personal history MVP staging delivery packet

Prepared 2026-09-08. **PRE_DELIVERY_READY is a local review checkpoint. Task 10
and staging acceptance remain open.** No new runtime has been deployed, no
remote migration or activation applied, and neither established tester folder
has been replaced. Production/main is a separate decision; do not merge PR #247.

The [verification record](../../personal-history-and-plans-mvp-verification.md)
contains the reviewed Tasks 1–9 evidence and every H/E/UI/M/S/C acceptance row.
The [source manifest](source-candidate.json) pins committed runtime source
`d2e32e87494924d73ddb16ed9956490a9f635061`, exact Git objects, all 14 added migration
SHA256 values and the runtime PR path set. It is not a build/deployment manifest.
Its null fields deliberately mean **not performed**, never a successful gate.
Task 9's precommit build version names are not release identities.

## Checkpoint and dependencies

The controller finishes one whole-branch source/docs review, any scoped fixes,
then the final semantic Graphify batch and its health/provenance check before
any push, PR creation, remote merge, DB application or deploy. These local
materials may be reviewed while external devices/Stripe TEST are unavailable.
A newly discovered source fix needs scoped review; metadata-only receipts do
not require another full branch review or another unchanged artifact build.

Read-only `git ls-remote` on September 8 confirmed staging
`a03c0128825c73edcfdf9062a8d85e70148b2423` and main
`54a154b702ea26e85fab2f3259aa7e5b98fa51be`. PR #247 was OPEN, staging → main,
with that staging head and no auto-merge request. Staging CI run 34040724408,
E2E Rooms 34040724511 and E2E P2P Media 34040724451 completed successfully for
that **old** SHA; these are baseline evidence only. Refresh refs and checks at
actual delivery. If staging advances, reconcile the exact split against it and
review any changed runtime/migration bytes before proceeding.

The DB workflow applies every new migration on each staging push using CLI
2.111.0. Worker deployment and extension build also run automatically on their
matching paths. A giant combined merge cannot guarantee DB/Web/Worker ordering.
The existing promotion workflow compares the entire main..staging diff; both
migration and runtime splits require `manual_pr`, including migration paths
outside its safe allowlist. Verify each actual promotion job and that auto-merge
remains disabled; do not change the workflow or enable promotion.

## Ordered staging steps after review

Before rollout, record the selected recovery candidates below, inventory legacy
rooms using authorized aggregate metadata, and let active legacy sessions end
normally (or use their normal explicitly authorized end flow). Recheck this
drain at activation because old clients can still create legacy rooms while
inactive. Do not force-delete rooms or disconnect real users as incidental tests.

1. **Prepare the DB-only PR** using [prerequisites-pr.md](prerequisites-pr.md).
   Start an isolated branch from freshly confirmed staging. Copy only the 14
   exact migration paths from the source manifest, preserving bytes and order;
   do not cherry-pick the original mixed implementation commits. No activation
   migration belongs in this PR. Inspect its full diff and check CI before merge.
   Keep the source worktree, original mixed WIP and r10 testers untouched.
2. **Observe DB deployment before dependent runtime.** Record workflow run,
   target project/environment, ordered revisions and hashes, actual count 55
   through 20260908072249, and policy version 1 inactive. Check functions/grants,
   count preservation and protected private cores as described below. A failed
   migration stops dependent runtime delivery; investigate and fix forward.
   Never reset remote data, edit applied files or mark migrations repaired just
   to hide a failed application.
3. **Prepare the compatible runtime PR** using [runtime-pr.md](runtime-pr.md),
   based on the successful prerequisite merge. Restore the exact manifest
   runtime paths from the reviewed source, including deleted paths, then include
   reviewed canonical docs and the controller's intentional Graphify batch.
   Verify no migration delta remains. Record the resulting PR/merge SHA and
   compare runtime objects to the reviewed source; source divergence needs
   explanation and covering review/checks. Wait for both Vercel Ready and Worker
   deployment success before distributing the matching client. These deployments
   can overlap while policy stays inactive; old clients keep supported legacy
   paths, and new v2 clients must not reach the old Worker during this interval.
4. **Bind the matching extension once.** After review, build in the isolated
   worktree with `fnm exec --using=22.23.1 pnpm build:extension:staging`, then run
   `fnm exec --using=22.23.1 pnpm validate:extension:staging`. Confirm source tree
   equality to the reviewed runtime pin and record build checkout HEAD separately
   from the runtime source pin if intervening commits contain only docs/graph.
   Record exact version_name, package version, manifest/file/zip SHA256 and narrow
   hosts/endpoints. Never substitute the independently generated CI zip without
   binding and validating its own identity. Keep the selected artifact immutable;
   docs/receipt commits do not require rebuilding identical runtime source.
5. **Preserve and load only at the coordinated delivery step.** Immediately
   recheck the original source preservation receipt and every file in the two
   established tester directories against their baseline hashes (12 files each,
   version_name `9ee74a7c-staging-title-outline-20260906-r10`). Back up both exact
   directories independently into ignored task storage, verify backup hashes,
   then sync only the agreed artifact and verify both destination file sets and
   hashes against it. Stop on unexpected drift. Record the Chrome AniDachi Test
   extension reload and loaded version separately, then reload affected test
   provider tabs. Folder synchronization is not Chrome reload or provider proof.
   Do not restart Chrome, manipulate profiles or activate user hardware.
6. **Accept inactive compatible stack and recovery.** Use authorized synthetic
   accounts/devices. Verify explicit paid personal/catalog requests, both
   mixed-plan guest directions, Free+Free Recent People, old/new negotiation and
   legacy-room drain. The personal writer is paid even with policy inactive;
   old envelopes/read contracts remain legacy until activation. Preserve original
   eligibility/epochs when draining eligible paid queues. Unproven old envelopes
   are retired once with non-success accounting, never relabeled as paid/Synced.
   Keep all unverified provider/MV3/media/Stripe and C04 gates explicit.
7. **Activate only after dependent acceptance is satisfied.** Wait for active
   legacy rooms to finish or end them through their normal authorized lifecycle;
   do not reinterpret legacy snapshots as v2 or erase room state. Attach the
   completed identity, queue, compatibility, preservation and recovery receipts.
   The reviewed one-way transaction below is a separate operator action, never
   a prerequisite migration. Confirm policy true and run the post-cutover checks.
   Missing hardware, Stripe TEST or two-network proof blocks the dependent
   activation/acceptance claim; it does not prevent earlier authorized staging
   preparation and controlled inactive testing.

## DB verification and one-way cutover material

Before any remote action confirm the actual staging project from its authorized
connection/workflow, not a remembered hostname or a copied credential. Do not
print secrets or row-level account history. Capture aggregate before/after counts
and the exact installed revision list; a live system can receive legitimate
writes, so explain changes instead of asserting byte preservation from equal
counts. The Task 9 populated 41→55 receipt is the controlled preservation proof.
The production 35→55 chain is not covered by it.

Check policy with `select singleton, policy_version, active from
public.personal_history_policy;`. Exactly one row must be true/1/false before
cutover. Inspect `pg_proc`/`pg_namespace` and `has_function_privilege` for the
public personal writer, policy/access functions, catalog wrappers, presence,
media leases and usage functions installed by the exact migration list. Public
wrappers are service-role only; anon/authenticated cannot execute; service_role
cannot directly execute private canonical history/room cores or update the
policy row. Reuse the reviewed SQL contract assertions in
`apps/web/supabase/tests/` on the guarded disposable DB; do not execute their
synthetic mutations wholesale on staging. Record each real staging grant and
function check rather than labeling the existence of 55 revisions sufficient.

The following is **review-only operator material, not executed or automatically
applied**. After verifying project, complete migration set, exact deployed
identities and all acceptance/recovery gates, use the authorized DB owner
connection. Service role intentionally cannot activate. No new feature flag,
RPC, scheduler or authority is introduced. The row update serializes against
existing operation share locks. Finite timeout failure leaves policy unchanged;
read it back before deciding whether a retry is needed. The drain assertion runs
**after** the exclusive policy lock in the same transaction. A create committed
while activation waited is then visible and aborts activation. Drain normally and
retry; never delete live rooms to bypass this assertion. Actual room statuses are
`lobby`, `live`, `ended`; physically deleted rows are absent, while age or invite
expiration does not make a non-ended room safe to exclude.

```sql
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
do $$
begin
  if (select count(*) from public.personal_history_policy) <> 1 then
    raise exception 'Unexpected policy row count';
  end if;
  perform 1 from public.personal_history_policy
    where singleton and policy_version = 1 and not active for update;
  if not found then raise exception 'Expected inactive policy version 1'; end if;
  -- This read must follow the exclusive lock: a racing legacy create may
  -- have committed while we waited. Lobby rows count; age alone does not mean ended.
  if exists (select 1 from public.rooms
    where status <> 'ended' and media_lease is null) then
    raise exception 'Legacy rooms remain: drain normally and retry';
  end if;
  update public.personal_history_policy set active = true
    where singleton and policy_version = 1 and not active;
end $$;
select singleton, policy_version, active from public.personal_history_policy;
commit;
```

After commit independently re-read policy. Verify Free reads/writes deny with
403, old writer/alias/replay and unsupported room creation return explicit 426,
new paid own-player writes persist, and delete remains available to Free.
Check Recent People with actual co-presence, both guest tariff directions,
quota/reservation/reconnect behavior and allowed media reception/publication.
Record expected 403/426 separately from unexpected increases; 503 is retryable
unavailable, never a downgrade or permission to use legacy fallback. Attach
sanitized command/workflow evidence to each gate; do not log tokens or user IDs.

## Recovery: exact candidates and limits

**Before activation:** original staging source `a03c0128825c73edcfdf9062a8d85e70148b2423`
is the legacy source candidate, with additive DB retained. Baseline Vercel
`dpl_ByCL5o34p44oJE3ZHk8rdReL9EiD` was Ready for that SHA in the September 8
read-only inventory. Baseline Worker deployment
`540ccd03-8071-4d4c-a0bf-8986eaf791c7` used version
`0b860918-eb5d-4fe5-8fda-6fdfe48ace3d`; provider metadata did not include a Git
SHA, so do not invent that mapping. The preserved r10 folders are backups, not
proof that this exact old three-plane rollback stack was rehearsed. Drain v2
rooms before considering legacy rollback: old Web claims refuse stored v2 rooms,
and old Worker must never reinterpret their caps. Verify the selected legacy
stack before restoring it, keeping policy inactive and all additive data intact.

**After activation:** the exact committed v2 source pin in source-candidate.json
is a *proposed compatible recovery source*, not yet an operationally accepted
rollback. Build/deploy it, record recoverable Vercel deployment and Worker version
IDs plus immutable extension hashes, then rehearse recovery using synthetic
records with policy true: Free writes/reads still denied, legacy aliases/replays
terminal, paid personal writes still work, and history/generations/access/consent
epochs remain intact across recovery and the subsequent forward fix. An inactive
re-deploy or source tests alone do not close C04. Perform an active-policy
rehearsal first on a guarded disposable environment; actual retained staging
identities still require delivery evidence.

This is the first v2 cutover: there is no previously accepted deployed v2 release
to fall back to. Re-deploying the same candidate can recover an infrastructure
failure but cannot fix a defect in that candidate. If no separately verified
compat runtime exists, keep activation blocked. If a regression occurs after
activation, stop new affected work fail-closed and prepare a scoped reviewed
forward fix; do not present an unimplemented emergency switch as available.
For media regression, suspend new v2 room creation through an explicitly reviewed
operational action/fix and let existing rooms finish/end normally. Never set
policy false, restore a Free/host-dependent writer, reset epochs/data, downgrade
schema, or treat v2 rooms as legacy maxMediaSeats. Any emergency source change
requires the controller's contract ruling and scoped review.

## Open acceptance gates and next handoff

- Controller semantic Graphify and whole-branch review: pending at this checkpoint.
- New DB/Web/Worker deployment, exact final artifact, both backed-up tester syncs
  and Chrome loaded/reload identity: not performed.
- C04 compatible active-policy recovery rehearsal and retained deployment pair:
  not performed; the source pin above is not recovery proof.
- Real Stripe TEST checkout/subscription/webhook transitions: not run; prior
  connector discovery returned USER_NOT_LOGGED_IN. Discover TEST availability
  again when needed, never use LIVE as fallback or mutate real subscriptions.
- Loaded provider playback/ads/Resume, actual MV3/browser termination and account
  switches: not run. Storage recreation fixtures do not close H12.
- Forced relay with selected `relay` candidate proof, different networks/devices,
  physical output/permission/PTT and remote-country acceptance: not run. Task 8
  actual-controller 4/6/15 local synthetic receipts remain useful direct-path
  evidence; they do not prove the roadmap's 99% or endurance SLOs.

The delivery receipt must name migration PR/revisions, Web commit/deployment,
Worker commit/deployment/version, extension source/build/version/hash and loaded
identity, policyVersion 1, captureVersion 1, mediaProtocolVersion 2, activation
state/time, recovery candidate/test and each acceptance outcome. Until these are
recorded, Task 10 remains open even if local preparation is committed. No new
production pricing claims or main promotion are authorized by this packet.
