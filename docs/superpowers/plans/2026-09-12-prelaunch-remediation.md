# Prelaunch remediation

Approved scope: fix the issues identified in the September 11–12 prerelease audit,
prepare verified staging delivery, and retain separate approval for production
activation/promotion. The initial audit found an ad-history capture leak, missing Sandbox portal
configuration, a destructive unguarded production migration chain, and gaps in
the v2 ICE/media harness. Current evidence is retained in
[`docs/releases/personal-history-mvp/`](../../releases/personal-history-mvp/README.md).
Baseline: staging `0b2c4e84a1c041fc7ead7a504880ec47f2af31e2`.

## Global Constraints

- Preserve the root worktree and existing user data. No resets, eviction, or
  edits to applied migration bytes; no secret exports.
- Personal history only; Free retains read/Resume/delete, paid capture/editor;
  existing consent, owner/epoch fences, capacity and completion rules remain.
- Keep the current UI, provider support, host controls and room contracts.
- Feature branch -> reviewed PR -> staging. Do not merge main, deploy production,
  activate shared media policy, or alter live subscriptions in this work.
- Test Stripe configuration is authorized. An actual subscription cancellation
  needs a concretely identified authorized test subscription; never cancel a
  production subscription or assume portal return proves cancellation.
- Do not claim simulated media tests prove physical output, selected TURN,
  multiple networks or distributed 15/4/8 acceptance.
- Independent review follows each implementation task and final integration;
  run only justified checks, with full affected gates at delivery.
- Primary specs: `2026-09-08-personal-history-and-plans-mvp-design.md` and its
  plan/amendments; the current implementation supersedes historical rollout IDs.

## Task 1: Exclude YouTube advertisements from personal history

Read the audit billing-history review and reproducible ad probe in the audit
directory, current YouTube adapter/progress policy and history controller/listeners.
The confirmed bug queues 10/30 heartbeat and 30/30 ended for the main video while
the adapter reports interstitial. Existing ad guards protect sync, not raw history.

Implement a minimal provider-bound fix: only confirmed main content contributes
position/duration/completion. Preserve the last genuine content sample safely;
ad ended, buffering/unknown phases and stale previous-video snapshots must not
complete a title or create a new fictitious session. Tracking must resume correctly
when actual content returns. Do not change playback sync or shared protocol merely
to fix history. Inspect before/during/after transitions and meaningful-progress
accounting, including already-started playback and a video switch.

Add failing meaningful regression tests first, then fix and run targeted YouTube
policy/controller tests plus extension check. Whole extension tests/build are the
integration gate after review. Scope: extension source and covering tests only;
controller owns shared docs, graph, release assets and Stripe. Do not edit generated
artifacts, change settings or use the user's browser. Commit only this task's files.

## Task 2: Restore test subscription cancellation

Verify selected Stripe Sandbox identity and current configuration with the API.
Create or update the active default portal with subscription cancellation enabled
at_period_end, preserving unrelated settings and avoiding prices/products changes.
Verify ownership/mode checks stay strict; inspect a real portal handoff without
confirming cancellation unless the identified test subscription is authorized.
Collect cancellation/return/status and retained-paid-period evidence when possible;
record LIVE access or test-account gaps precisely. No live Stripe mutations.

## Task 3: Prepare safe production database transition

Production is at 35 migrations through 20260823132355; staging is at 60 through
20260911070906. The pending 20260904205540 migration deletes history, and main push
auto-runs db-production.yml independently of Web/Worker. Six session rows and six
participant rows exist in production; their data must be treated as real.

Design and implement a tested preservation/rollout boundary for the complete
pending chain. Inspect actual schema dependencies before selecting the migration
strategy. Preserve original data and user-visible progress; never append a late
restore assuming earlier deleted data is recoverable. Do not modify applied files,
mark versions repaired, or apply anything remotely to prove a hypothesis. Use an
isolated local database with representative populated fixtures at the production
baseline; prove ordered transition, data retention, safe failure and recovery.
Add an explicit fail-closed production release guard/order where needed so a
routine main push cannot silently execute the destructive unaccepted chain.
Record material technical decisions and remaining operator prerequisites.

## Task 4: Repair room validation and acceptance instructions

Fix the v2 Worker ICE harness host mismatch: v2 signer hostUserId=p0 while ICE lookup
uses sub=host. Keep production JWT verification strict. Add regression for the
fixture/real verifier boundary and assert actual selected relay candidates for v2.
Run supported local 4/6/15 scenarios and forced relay only with existing authorized
TURN resources; retain physical/distributed proof as a separate requirement.
Update stale activation/recovery wording: Free read/Resume/delete succeeds, new
capture/editor writes do not. Preserve policy/epoch/recovery/drain safeguards.
Do not activate policy or end legacy rooms as incidental test setup.

## Task 5: Integrate, review and deliver to staging

Reconcile all task changes, update canonical status and release notes, intentionally
refresh Graphify once for the combined semantic/code delta. Check policy and tests
across affected consumers, run dev:check and required web/API/extension gates, and
build/validate the staging artifact. Final independent branch review must cover
preservation, ad transitions, billing configuration and harness boundaries.
Push a coherent PR to staging and verify CI/deploys before replacing the tester
artifact with a backed-up validated build. No main promotion. User's previously
passed basic two-device flow is a baseline, not proof of changed v2 limits.
