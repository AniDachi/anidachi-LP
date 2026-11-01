# Free20 staging activation runbook

Status: controlled staging delivery procedure. Parent: [readiness plan, Task6](2026-11-01-free20-staging-readiness.md). [PR490](https://github.com/AniDachi/anidachi-LP/pull/490) records the schema delivery and subsequent runtime/activation receipts; this procedure alone does not establish the current flag values or completed acceptance. Owner authorized staging transition; production/main/Store/LIVE Stripe/campaigns remain excluded. Re-read actual targets and policy immediately before mutation.

## Exact environment and initial pre-cutover evidence

- Supabase staging: `cyppqpprkygjloyfvvvj`.
- Vercel project: `prj_E6UFEzEZYaarqkbfLRJFS1lHzNER`, `v0-anime-app-landing-page`, team slug `georges-projects-8c4bc43a`. Current staging alias is a Preview deployment from exact branch `staging`; it is not a Custom environment. Inventory observed READY `dpl_4e34pa5rC8v5QWhLyvxdjdQtt6r5`, commit `dfeeae17`, aliased by `staging.anidachi.app`. These are pre-candidate references, not future acceptance.
- Worker: `anidachi-api-staging`; internal Web origin `https://staging.anidachi.app`. Production Worker is a different script and must not be changed.
- Stripe: **AniDachi sandbox**, `acct_1RlmiIPQIEOqG7pr`, `livemode=false`. No LIVE operation.
- SQL policy observed revision3, activation_at `2026-09-29T15:48:48.80082Z`, free20=false, trials=true, cardless_trials=true. Both runtime Free20 flags absent. No marked rooms; three unended rows are not proof of live sockets or inactivity.
- Four known historical Sandbox Checkout states reconciled on November1 at09:53UTC via existing guarded RPC: complete3/expired1, no new payment or rights change. Unknown old pending5 remain held. Re-inventory before cutoff; never retry an expired idempotency key to recreate an unknown operation.

## Preconditions

- [ ] All readiness code tasks independently reviewed; whole candidate checks and Graphify/docs complete.
- [ ] Additive schema delivered before runtime enablement: billingv4/outbox, trial guard, warning claim and host client-gate signatures/grants verified.
- [ ] Current capable extension built/validated and installed folder all-file hashes match. The owner explicitly chose to Reload and inspect the interface himself after the folder update; that visible acceptance follows controlled staging enablement and remains required before production. Do not treat file copying as loaded proof. Archived0.1.4 staging ZIP is distinct from production Store ZIP.
- [ ] Expected staging SHA, Web alias and Worker version known; no competing deploy/migration can silently supersede them during rehearsal.
- [ ] Staging gate/noindex/sitemap protection intact, correct Sandbox/DB/Worker targets verified without printing secrets.
- [ ] Accepted/pending operations inventoried; current paid/trial/manual rights, original activation timestamp, usage, assignments and room markers preserved.

## Runtime flags first, SQL last

Schema ordering precedes this list. The staging DB, Vercel and Worker workflows
start independently after a staging push; their triggers do not prove that DB
finishes before Web starts calling the new v4 admission RPCs. After the exact
readiness PR head is reviewed and its required CI is green, dispatch only the
existing `db-staging.yml` workflow from that frozen feature ref. Verify the run's
exact head SHA and the workflow's fixed staging-project guard; keep the ref
unchanged through completion. Its dry-run must list only this candidate's new
additive migrations in filename order, with Free20 still off. Record
names/hashes and verify new signatures/grants plus old-wrapper compatibility
before merging runtime code. The later normal staging DB workflow should then
be a no-op. This narrowly documented schema-only exception preserves exact
repository migration versions; the connected apply-migration tool has no
explicit version argument and cannot by itself establish matching CLI history.
Do not manually rewrite migration history to make the tools agree.
This bounded schema-first step is part of the owner-authorized staging cutover;
it does not dispatch feature-branch Web/Worker releases or touch production.

1. Coordinate a quiet staging admission period for the controlled rehearsal. Keep webhooks, billing recovery, internal budget/lifecycle callbacks and existing rooms serviceable. Do not toggle global maintenance as a drain-only switch: Web/Worker maintenance blocks internal callbacks too. Do not claim universal traffic drain from an arbitrary sleep or an alias change; older immutable preview URLs still exist. If broader uncontrolled staging traffic needs a formal ingress barrier, design one narrowly before claiming that guarantee.
2. Add `ANIDACHI_FREE20_ACCOUNTING_ENABLED="true"` **only** to `apps/api/wrangler.toml` `[env.staging.vars]` in the reviewed activation/config commit and deploy the exact staging SHA. Production remains absent/off. Plain dashboard variables would be overwritten by later plain Wrangler CI deploys; do not solve this with global keep_vars or a fake secret.
3. Verify Worker deployment/config while SQL remains off. It chooses Free20 from the authenticated SQL room marker, not merely Free plan/env. Constructor restores existing persisted accounting only; unmarked old rooms are not adopted. The flag does enable existing retry/internal paths, so this preparation is not entirely inert.
4. Set the Web flag to exact `true` in **Preview + gitBranch staging only**, then deploy the accepted SHA. Existing deployments do not acquire new env values. Once PR490's compatible schema/runtime is verified, the branch-scoped Web variable may be prepared immediately before merging the reviewed Worker activation/config PR, so its ordinary Git-triggered Web deployment acquires the new value. Worker and Web deployment jobs may finish in either order; verify both before SQL cutover. Do not rely on inherited environment values in an unverified redeployment. Verify alias READY, commit and effective behavior; do not set broad Preview or Production values. SQLoff still returns explicit disabled account status and retains existing admission. Webflag also selects billingv4/outbox; that schema must already exist.
5. Validate the reviewed staging extension artifact, back up and update the owner's existing unpacked folder, and compare every relative file/hash. If the later activation commit changes only Worker configuration and docs, prove unchanged extension/protocol/build inputs before reusing PR490's staging artifact and record its component SHA honestly. Recheck marker counts, expected policy and client-gate availability. Old public RPC wrappers must remain unsupported; mediaProtocol3 alone is not Free20 support. Complete or safely retain accepted external operations; do not clear unknown ledgers for a clean demo.
6. Perform the following **policy-only conditional transaction**, replacing expected values only after a fresh reviewed inventory. Do not call per-account/room/Stripe functions while holding this policy update lock: issuance takes account then policy SHARE.

```sql
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
do $$ declare changed integer; begin
 update public.hosting_commercial_policy
 set free20_enabled=true,trials_enabled=false,revision=revision+1
 where singleton and revision=3
   and activation_at=timestamptz '2026-09-29T15:48:48.80082Z'
   and free20_enabled=false and trials_enabled=true
   and cardless_trials_enabled=true;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'FREE20_POLICY_EXPECTATION_CHANGED'; end if;
end $$;
commit;
```

7. Re-read row/flags/version and record exact server time. Timeout or changed expectation means re-read, never unconditional retry. Preserve activation_at, cardless mode, all usage/rights/rooms and accepted trial identity. No historical activate_paid_hosting_v1, ledger reset or bulk room closure.

## Rehearsal and evidence

Local SQL/runtime/unit tests prove their scenarios only. Smoke proves health/auth guards, not live billing or two participants. Real UI uses existing Google/Discord login and normal extension connection; never forge hosted JWT or fabricate a guest.

The owner will perform Chrome Reload, video-tab refresh and interface acceptance himself after the folder update. No automated browser inspection, authenticated account test or Sandbox purchase is implied by deployment/configuration checks. Record these as pending until the owner actually completes them.

Owner currently has no second participant. Continue code, delivery and available solo checks; record two-participant metering/pause, once/day warning in a real group, purchase while that meter is spending, and mixed-client scenarios as **pending** until a distinct authenticated participant is available. A real UTC boundary is also pending unless actually observed. These limits prevent full production acceptance; they do not require stopping independent staging preparation.

A solo-host Sandbox checkout can separately verify real checkout/webhook delivery
and the same-room display changing to confirmed paid time, if a normally
authenticated suitable test account is available. It does not prove upgrading
an actively spending two-participant meter. Preserve existing subscriptions,
manual grants and unknown pending operations; do not alter them merely to make
a purchase fixture. Record the exact solo/joint distinction in the receipt.

Available checks: current user sign-in/owner, truthful remaining or unavailable, solo no-spend, supported create/end, local reaction/settings/dock layout and exact loaded build. Joint checks later: guest budget independence, metering while paused, reconnect, 300-second notice/dismiss/dedup, server exhaustion, UTC reset, same-room paid upgrade retaining caps and late payment never reviving ended generation. Keep original daily usage; do not alter clocks/ledgers to stage a test.

At completion end only authorized rehearsal rooms via normal flow and verify settlement/assignment/outbox state. Update user's existing unpacked folder only from reviewed build, with backup and every-file hash proof. Browser Reload plus video-tab refresh is separate from file copying.

## Rollback limits

Before SQLcutover, with fresh zero-marked/in-flight proof, remove/revert runtime preparation through ordinary deployments; additive schema and accepted operations remain. After cutover, SQLoff can deny renewal/close marked rooms, Weboff breaks budget callbacks and Workeroff disables internal status/refresh. None is a graceful admission-only switch.

Keep compatible runtime and all gates on while controlled testers stop creating and existing marked rooms drain normally. Unknown pending ACK/terminal state means drain unproven. Only after verified drain may a conditional **forward** revision disable Free20, retaining trials=false and marker-aware readers for late receipts. Never rewind revision/activation, erase usage or reopen trials casually. A wider uncontrolled rollout needs a separate admission-stop/drain procedure; global maintenance is a disruptive incident action, not the normal rollback.

## References

Mode ownership: Worker `index.ts` restored accounting and authenticated room admission; SQL `20261031074738_daily_free20_room_admission.sql` insert/immutable-marker triggers. Config source: `.github/workflows/deploy-api.yml` and `apps/api/wrangler.toml`. [Cloudflare configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) describes vars ownership; [Vercel environment variables](https://vercel.com/docs/environment-variables) describes deployment-scoped values.

Warning outer SQL bound was checked through staging role configuration: authenticator statement_timeout8s, service_role no override and no database-specific override. [Supabase timeouts](https://supabase.com/docs/guides/database/postgres/timeouts) documents the service_role fallback and REST function settings. This is configuration-backed evidence, not a deliberately delayed hosted RPC experiment.
