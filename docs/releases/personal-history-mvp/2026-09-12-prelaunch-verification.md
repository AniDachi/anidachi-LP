# Prelaunch remediation verification, September 12

Scope: reviewed fixes from staging `0b2c4e84`, prepared on
`codex/prelaunch-fixes`. Production/main promotion and shared-media activation
remain separately gated. This record describes source and local evidence; the
staging PR carries its exact deployed SHA, workflow links and artifact identity.
A local pass alone is not a deployed or loaded-browser pass.

## Findings and resulting behavior

- YouTube ads previously supplied their own clock/duration to the main video's
  history. Capture now requires confirmed content and its content clock; ads,
  transitions, buffering and unsupported phases suspend observation. Genuine
  content samples and the logical session survive an ad, including cleanup.
- Stripe Sandbox had no usable default cancellation portal. It is configured,
  and an authorized real staging cancellation/restoration completed. Renewal is
  restored; paid access and the original billing period are retained. See the
  [separate receipt](2026-09-12-sandbox-cancellation-verification.md).
- Production has 35 migrations while staging has 60. An unchanged pending
  migration clears legacy history. A private pre-chain archive, durable write
  hold, fixed full-chain rehearsal and source-controlled production deployment
  holds now prepare a safe transition. No production adapter or remote apply is
  authorized. See the [runbook](production-35-to-60-transition.md) and
  [aggregate rehearsal evidence](2026-09-12-production-transition-rehearsal.json).
- The v2 room harness used an ICE host identity inconsistent with its own token
  claims, bypassed relay validation in its v2 branch, and reported TTFM without
  enforcing the approved target. Its correction and synthetic run evidence are
  recorded below; real relay and distributed acceptance remain distinct gates.

The [room harness aggregate receipt](2026-09-12-room-harness-evidence.json)
binds the final synthetic runs to the exact tested harness commit and file hashes.

## Checks and evidence boundaries

| Check | Result | Boundary |
| --- | --- | --- |
| Workspace check for deployment/CI profile | Passed; 6/6 tasks | Final combined source, 4 cached tasks |
| Extension TypeScript and full unit suite | Passed; 128 files, 1902 tests | Runtime at `55cb5219` |
| Additional real YouTube policy/controller lifecycle regressions | Passed; 60 focused tests | Test-only `d2f3a44a`; pre-roll, disposal, midroll and source changes |
| Web TypeScript and unit suite | Passed; 562 passed, 6 opt-in skips, 0 failed | Local; runtime unchanged by this remediation |
| API TypeScript and unit suite | Passed; 20 files, 217 tests | Local Worker/auth unit coverage |
| Actual Worker runtime suite | Passed; 2 files, 61 tests | Isolated local Cloudflare runtime |
| Protocol TypeScript and unit suite | Passed; 15 files, 171 tests | Shared contracts unchanged |
| Local real-Worker room signaling harness | Passed; 39 scenarios | Signaling/reconnect/limits, not physical media |
| V2 real local WebRTC | Passed: 4 / 6 / 15 participants, 8 assertions each | Single-machine Chromium, synthetic camera/audio; 12 / 30 / 204 selected endpoints |
| V2 decoded-video TTFM p95 | 184.10 / 257.70 / 4308.80 ms | Complete 3 / 10 / 56 samples; strict target below 6000 ms |
| Legacy real local WebRTC | Passed; 26 scenarios | Fresh follow-up at `128cdb29`; legacy 8000 ms boundary retained |
| Harness fixture/measurement unit tests | Passed; 3 tests | Bundled actual Worker verifier, p95 and nonempty relay coverage |
| Worker-backed forced relay attempt | Auth accepted; blocked by missing local TURN configuration | No actual relay pass claimed |
| Production transition | Passed; 24 synthetic rehearsal checks and 5 Node checks | Exact bridge/guard files at `3d4263af`; 13 hashes independently matched |
| Stripe cancellation and restoration | Passed via actual staging/Stripe UI and independent API reads | Sandbox only; final renewal restored |

The production rehearsal used a synthetic populated baseline and the actual
pinned CLI/full 25-file pending chain. Failure prefixes 35/37/38/50 preserved the
archive and maintenance; retries continued the unchanged suffix. A complete
baseline dump restored all 34 original public relations and exactly 35 migration
versions in a second disposable database. No real user rows, backups or secrets
are included in this repository receipt.

Task 1 and Task 3 received independent scoped spec/quality reviews. Task 1's two
missing lifecycle test cases were added and its scoped re-review passed. Task 2
also received an independent source/receipt review. Rehearsal execution is the
implementer's recorded result; the reviewer and controller independently matched
its file hashes to the commit, rather than repeating the expensive rehearsal.

The first 15-participant run failed with 203/204 selected candidate pairs while
all 204 endpoints decoded media. The harness now waits up to five seconds for
fresh actual stats to satisfy the same complete 204/204 condition; partial and
empty samples still fail. The rerun passed. Runtime transport behavior and the
6-second media target were not weakened. The original failure is retained in this
record; the final receipt supersedes its reused scratch output path.

Task 4 review identified an unintended change to the old mode's timeout. The
follow-up `128cdb29` restores its existing 8000 ms boundary while retaining v2's
strict p95 below 6000 ms. Focused tests and the legacy 26-scenario browser harness
passed again (first frames 159 ms / 1 ms). Unchanged v2 load runs were not repeated.

## Remaining launch gates

- Verify loaded staging extension behavior on real YouTube content with an ad,
  and MV3 lifecycle as applicable. The provider's phase classification remains
  the authority; synthetic regression tests cannot prove every live ad variant.
- Verify actual selected TURN relay, physical camera/microphone output and
  distributed 15-participant / 4-camera / 8-microphone acceptance. Existing
  Cloudflare key metadata alone is not a credential or relay proof. Local TURN
  bindings were unavailable; no secret stores were searched or new keys created.
- Verify LIVE Stripe configuration and actual end-of-paid-period downgrade.
  Restoring an active Sandbox subscription does not prove period expiry.
- Before production, install/verify external delivery and traffic holds, current
  inventory/schema and deployed-inert legacy history, then review the concrete
  production adapter, backup/restore, privacy retention and runtime release order.
  The source holds do not freeze already queued jobs or external Vercel promotion.
- Shared-media policy activation and C04 recovery still require their own accepted
  evidence. Do not disable policy after activation or restore a legacy Free writer.

The user's previous two-device room test is retained as user-reported baseline
acceptance, not new instrumented relay/load evidence. No old rooms were ended or
removed to make validation pass. All 38 root-checkout WIP file hashes independently match the prerelease audit;
the root HEAD and dirty-file count remain unchanged. They are outside this branch.

The final branch review found a delayed-background-acknowledgement race: an ad's
queued `ended` could be sampled after main content resumed. The final fix binds
provider eligibility, content values and playback state to event arrival, then
checks current authority revision, access and source identity before persistence.
Real YouTube policy/controller regressions first reproduced the defect and now
prove no ad completion, genuine same-session continuation, and rejection across
owner, generation, access/consent epoch, opt-out, lease expiry and source changes.
Extension TypeScript, 149 focused tests and all 1912 extension tests passed.
The uplink sample duration now freezes immediately after its byte snapshot;
a deterministic actual-harness check excludes a subsequent candidate-stats wait.
All four harness tests passed; unchanged 4/6/15 browser loads were not repeated.
This is local source verification; scoped re-review, final artifact validation
and loaded staging acceptance remain separate delivery gates.
