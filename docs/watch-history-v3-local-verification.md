# Watch History v3 Local Verification

Date: 2026-09-05

Status of this local evidence record: **local, unactivated schema-3 candidate**. Watch History v2 on staging and
technical main is the recorded baseline; this fix wave performed no new deployed
runtime probe and no deployment. This record does not authorize or claim a remote migration,
deployment, tester-folder update, loaded extension, authenticated provider test, or
production acceptance.

The later, separately authorized staging activation is recorded in
`docs/watch-history-v3-staging-verification.md`. It supersedes this record's
deployment status, not its local evidence or incident disclosure. Main/production
and authenticated provider acceptance remain outside that activation.

## Canonical Storage And Transition Boundary

Schema 3 keeps Supabase/Postgres as the only durable account-history authority.
`watch_episode_progress` stores one row per logical provider episode; the latest
actually watched raw content GUID, audio locale, source URL, position, and duration
remain resume metadata on that canonical row. Completion is sticky across variants.
`watch_catalog_snapshots` and `watch_catalog_aliases` hold bounded, account-generation-
scoped catalog evidence and raw-to-canonical identity. Popup and website consume the
same bounded server projection; neither calculates an exact denominator locally.

The reviewed transition is intentionally history-destructive for test data. It:

- clears only the reviewed Watch History progress, session, participant, receipt,
  summary, fence, and catalog state;
- advances the account history generation and installs the schema-3 writer marker;
- preserves users, auth, subscriptions, rooms and room membership, friends, groups,
  invites, Recent People, interface/media settings, YouTube tracking consent, and the
  monotonic history server order;
- makes v2 progress, delete, preference, and read RPCs terminal upgrade failures, so
  stale schema-2 work cannot recreate settings, sessions, participants, or progress;
- requires the matching schema-3 web runtime and extension. A schema-3 staging
  artifact is incompatible with the recorded v2 history backend baseline.

The extension's one-time local-storage transition copies only a validated,
owner/generation-matching YouTube preference state. It does not copy or retag v2
history cache, current observations, catalog state, or outbox work. Room, social,
interface, media, and auth storage are outside this transition. Testers must reload
the exact matching extension only after a separately authorized database/runtime
cutover; updating a tester folder is not authorized by this local record.

## Retained Disposable-Database Proof

The four source-controlled generators under `apps/web/supabase/contracts/` are
narrow acceptance evidence, not a general database framework:

- `watch_history_v3_transition_contract.mjs`;
- `watch_history_v3_rpc_contract.mjs`;
- `watch_history_v3_benchmark_contract.mjs`;
- `watch_history_v3_catalog_read_states_contract.mjs`.

Every generator fails closed unless the caller explicitly supplies a disposable
workdir, project, matching `supabase_db_<project>` container, nondefault host port,
unmistakable acknowledgement/marker, and absolute output path. The guard compares
the supplied identity with the workdir's `project_id` and `[db].port`, the marker,
both Docker labels (`com.supabase.cli.project` and
`com.docker.compose.project`), and the published container port. It refuses default
port `54322`. It also checks the exact pre-transition or final
migration/schema/function prerequisite before inserting fixtures. Child processes,
statements, lock waits, and idle transactions have finite deadlines: the transition
lock holder uses a 45-second statement timeout and 15-second server-side
idle-in-transaction timeout, while old-call workers use a 15-second statement and
10-second lock timeout. Rollback-only generators roll back, and transition/benchmark
cleanup removes only their exact synthetic identities in `finally`.

First initialize a new local Supabase workdir outside the repository, give it a
unique project ID and unused nondefault `[db].port`, expose the other local Supabase
services on unused ports, and make its `supabase/migrations` and `supabase/tests`
resolve to this repository's corresponding `apps/web/supabase/` directories. Start
that new project. Do not reuse another developer project, a linked remote workdir,
or port `54322`.

Then run the following from the repository root with Node 22.23.1 and pnpm 11.2.2.
Replace only the first four values with that newly created local project's actual
absolute workdir, project, container, and nondefault port. The marker is created
before preflight; preflight must succeed before either guarded reset wrapper runs:

```sh
export ANIDACHI_DISPOSABLE_DB_WORKDIR=/absolute/path/to/disposable-workdir
export ANIDACHI_DISPOSABLE_DB_PROJECT=unique-disposable-project-id
export ANIDACHI_DISPOSABLE_DB_CONTAINER=supabase_db_unique-disposable-project-id
export ANIDACHI_DISPOSABLE_DB_HOST_PORT=55461
export ANIDACHI_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DEDICATED_DISPOSABLE_LOCAL_DATABASE
proof_output_dir="$(mktemp -d /tmp/anidachi-watch-history-v3-proof.XXXXXX)"

fnm exec --using="$(cat .node-version)" node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const marker = {
    acknowledgement: process.env.ANIDACHI_DISPOSABLE_DB_ACK,
    project: process.env.ANIDACHI_DISPOSABLE_DB_PROJECT,
    container: process.env.ANIDACHI_DISPOSABLE_DB_CONTAINER,
    hostPort: Number(process.env.ANIDACHI_DISPOSABLE_DB_HOST_PORT),
  };
  fs.writeFileSync(
    path.join(process.env.ANIDACHI_DISPOSABLE_DB_WORKDIR,
      ".anidachi-watch-history-v3-disposable.json"),
    JSON.stringify(marker) + "\n",
  );
'
fnm exec --using="$(cat .node-version)" node \
  apps/web/supabase/contracts/watch_history_v3_target_preflight.mjs

export ANIDACHI_WATCH_HISTORY_TRANSITION_ACK=RESET_DEDICATED_HISTORY_FIXTURES_ONLY
ANIDACHI_WATCH_HISTORY_RESET_TARGET=pre-transition \
fnm exec --using="$(cat .node-version)" node \
  apps/web/supabase/contracts/watch_history_v3_reset_contract.mjs
ANIDACHI_WATCH_HISTORY_TRANSITION_OUTPUT="$proof_output_dir/transition.json" \
fnm exec --using="$(cat .node-version)" node \
  apps/web/supabase/contracts/watch_history_v3_transition_contract.mjs

ANIDACHI_WATCH_HISTORY_RESET_TARGET=schema-3 \
fnm exec --using="$(cat .node-version)" node \
  apps/web/supabase/contracts/watch_history_v3_reset_contract.mjs
ANIDACHI_WATCH_HISTORY_RPC_OUTPUT="$proof_output_dir/rpc.json" \
fnm exec --using="$(cat .node-version)" node \
  apps/web/supabase/contracts/watch_history_v3_rpc_contract.mjs
ANIDACHI_WATCH_HISTORY_CATALOG_STATES_OUTPUT="$proof_output_dir/catalog-states.json" \
fnm exec --using="$(cat .node-version)" node \
  apps/web/supabase/contracts/watch_history_v3_catalog_read_states_contract.mjs
ANIDACHI_WATCH_HISTORY_BENCHMARK_PAGE_OUTPUT="$proof_output_dir/benchmark-page.json" \
ANIDACHI_WATCH_HISTORY_BENCHMARK_MEASUREMENTS_OUTPUT="$proof_output_dir/benchmark-measurements.json" \
fnm exec --using="$(cat .node-version)" node \
  apps/web/supabase/contracts/watch_history_v3_benchmark_contract.mjs

WATCH_HISTORY_REQUIRE_LOCAL_RPC=1 \
WATCH_HISTORY_LOCAL_RPC_JSON="$(cat "$proof_output_dir/rpc.json")" \
WATCH_HISTORY_REQUIRE_CATALOG_READ_STATES=1 \
WATCH_HISTORY_CATALOG_READ_STATES_JSON="$proof_output_dir/catalog-states.json" \
WATCH_HISTORY_REQUIRE_BENCHMARK=1 \
WATCH_HISTORY_BENCHMARK_JSON="$proof_output_dir/benchmark-page.json" \
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web exec tsx \
  --test lib/anidachi-auth/watch-history-v3.local-rpc.test.ts \
  lib/anidachi-auth/watch-history-v3.catalog-read-states.test.ts \
  lib/anidachi-auth/watch-history-v3.benchmark.test.ts

fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 \
  --workdir "$ANIDACHI_DISPOSABLE_DB_WORKDIR" test db
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 \
  --workdir "$ANIDACHI_DISPOSABLE_DB_WORKDIR" db lint --local --level warning
```

Generated JSON and timing output are local evidence and must not be committed.
The old `watch_history_v2_*` contract scripts are historical migration assertions;
they are not schema-3 acceptance generators and must not be run as v3 proof.

## Prior Local Results (Before Final Review Fixes)

The retained generators were rerun against their final source on the dedicated
container:

- the 38-migration clean chain completed through
  `20260904205540_watch_history_canonical_catalog.sql`;
- populated transition passed: users, rooms, room members and Recent People remained
  byte-equivalent. Before cutover there was one real nonzero progress row, receipt,
  session, participant, title summary, user-session summary, and settings row; after
  cutover every listed history relation was zero while the settings row remained.
  YouTube consent stayed `true`, server order advanced `77 -> 78`, generation advanced
  `1 -> 2`, and three already-entered zero-duration v2 calls (including guessed
  generation 2) failed on the schema marker;
- actual RPC proof produced five pages: clear generation 2, bounded title slice 8,
  detail slices 7 + 5, and historical completion count 6;
- nine rollback-only list/detail states passed, including exact `5 / 13` versus
  historical 6, retained same-region locale bundle, foreign-region partial state,
  later detail-page catalog metadata, and exact zero availability;
- the benchmark used 2,000 logical episodes, 2,031 variants, 100 seasons, and a
  1,029,341-byte normalized snapshot. Before attributing timings, the retained proof
  verified accepted revision 1, complete snapshot/state, a present projection, and
  exactly 2,000 stored episode identities / 2,031 variant aliases. Local commit time
  was 622.305 ms; the 100-title/800-row/20-session page was 499,315 bytes and
  19.148 ms. Large-catalog heartbeats measured 1.16574-1.26267 ms/event. Before the
  controlled comparison, the same account's replacement was verified at accepted
  revision 5,302 with complete state/projection and exactly one episode / 32 aliases;
  heartbeats then measured 0.87122-0.88084 ms/event. These are local wall-clock
  observations, not staging guarantees;
- dedicated pgTAP passed 13 files / 654 assertions. Database lint exited 0 and
  retained the reviewed warnings for intentionally unused terminal-v2 arguments plus
  the two immutable-wrapper/stable-expression notices.

Final retained-source gates passed: disposable-target/acceptance guard tests 8/8,
including a deliberately partial/unaccepted benchmark candidate; Biome on the
eight retained scripts; generated SQL evidence through production parsers 4/4; and
the explicit website TSX suite 15/15. Root `pnpm check` passed all six Turbo tasks.
Root `pnpm test` passed all six tasks and covered protocol 145/145, API 201/201,
extension 1,651/1,651, and Web 425 passed with four explicit opt-in evidence tests
skipped by the default glob; the demo package has no tests. API runtime tests passed
41/41. `pnpm dev:check`, extension staging build/validation, and `git diff --check`
also passed. The artifact build emitted ineffective-dynamic-import warnings for
`auth-tokens.ts`, `auth-client.ts`, and `watch-history-client.ts`; the extension
suite emitted React `act(...)` warnings in `popup-people-panel.test.tsx` and
`active-adapter-playback.test.tsx`. Their baseline provenance was not classified in
this task. Final-source headless UI proof separately passed Popup 6/6 and website
7/7 with the actual SQL DTOs.

The room-signaling and real-WebRTC harnesses were not rerun: this branch changes no
Worker, Durable Object, room event, signaling, or media contract and makes no new
room/media acceptance claim. No remote Worker smoke was run. No root Web build was
run because it invokes the unrelated network-writing `cache:jikan` step.

## Final Review Fixes And Covering Proof

The final review at `ce6cfdb` found three boundary defects; the local fix wave
addresses all three together:

- Website delete/preferences requests now carry `x-anidachi-history-owner` from
  the rendered owner. Cookie routes require a valid UUID and reject an owner
  mismatch before service/store/RPC dispatch. The original header survives a
  401/cookie refresh. Extension bearer requests retain their existing dispatch;
  an explicitly supplied mismatched header is rejected for either session source.
- Forward migration `20260905083000_watch_history_observed_season_fallback.sql`
  replaces only the bounded catalog-read helper and adds an index for one latest
  observed label per requested season. A season absent from a complete current
  catalog retains its observed identity/label and returns current `0 / 0`, progress
  zero and no next episode. Title exact totals and historical completion counts
  remain separate. The original migration is unchanged; reads never parse the full
  snapshot and production builders retain their strict membership validation.
- Existing valid v3 extension roots still retire the exact legacy v2 history key.
  A rejected cleanup promise can retry in the same instance or after restart.
  Retry does not recopy legacy progress or overwrite new v3 consent/progress, and
  the initial transition still saves v3 before removing v2.

The dedicated target was again `anidachi-catalog-v3-79lflf`, container
`supabase_db_anidachi-catalog-v3-79lflf`, host port `55452`, with the same explicit
marker/config/both-label guard. The clean chain now contains 39 migrations through
`20260905083000`. The retained final-state prerequisite requires that exact latest
migration while separately checking the original canonical migration. The
pre-transition prerequisite remains `20260904154732`. The populated transition
generator executes both forward SQL files; the subsequent guarded CLI reset
records the complete migration chain without hand-editing migration bookkeeping.

Executed RED evidence: six owner tests failed on missing owner rejection; two
storage tests failed on the cached rejection/missing restart cleanup; actual old
SQL output failed the production builder with `INVALID_DATABASE_RESPONSE` for an
omitted season. Removing only the website header also made its two new component
regressions fail with `[null, null]` across the retry. GREEN covering commands,
using Node 22.23.1 and pnpm 11.2.2 from the repository root:

```sh
fnm exec --using=22.23.1 pnpm --filter @anidachi/web exec tsx --test \
  lib/anidachi-auth/watch-history-v3-owner.test.ts \
  lib/anidachi-auth/watch-history-v3-routes.test.ts \
  lib/anidachi-auth/watch-history-v3.test.ts \
  app/account/watch-library/watch-library-client.test.tsx
fnm exec --using=22.23.1 pnpm --filter @anidachi/web check
fnm exec --using=22.23.1 pnpm --filter @anidachi/web test
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/watch-history-storage.test.ts
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
fnm exec --using=22.23.1 node --test \
  apps/web/supabase/contracts/watch_history_v3_disposable_target.test.mjs
```

Results: focused web route/helper/service/component suite 90/90 (including 17
website TSX cases), web check passed, full web 431 passed plus four explicit SQL
evidence skips, storage 13/13, extension check passed, full extension 1,653/1,653,
and disposable prerequisite guards 8/8. Dedicated pgTAP passed 13 files / 654
assertions. The retained commands above were rerun for populated transition, five
RPC pages, 13 catalog list/detail states and the bounded benchmark, followed by
their four production-consumer tests. The four added states cover catalog
replacement omitting a watched season and new-season progress before refresh,
each through both SQL list and detail producers. Current title totals stay exactly
3 completed / 7 available while historical completions stay 6, then advance to 7;
missing seasons are exactly 0/0. Floating progress uses a `1e-12` tolerance for
PostgreSQL JSON numeric serialization, with exact integer count assertions.

The final benchmark again verified accepted complete inventory before timing:
2,000 episodes / 2,031 aliases, 1,029,341 snapshot bytes, 616.899 ms commit,
17.802 ms for 100 titles / 800 observed rows / 20 session IDs (498,415 SQL JSON
bytes), and 1.18374–1.25545 ms per large-catalog heartbeat. The same account's
accepted one-episode / 32-alias replacement measured 0.88001–0.88974 ms per
heartbeat. These remain local observations. SQL lint exited zero with only the
previously recorded terminal-v2/immutable-wrapper notices; the new read helper
produced no lint finding. Changed retained scripts pass Biome.

This wave did not change the shared body protocol or Worker/media contracts.
At product commit `4d7f395`, the controller reran root `pnpm check` and `pnpm test`:
both passed all six Turbo tasks (the changed web/extension tasks executed; four
unchanged tasks reused the local cache). Counts were protocol 145, API 201,
extension 1,653, and web 431 passed / four explicit opt-in skips. A separate fresh
API runtime run passed 41/41. `pnpm dev:check` passed. The matching staging-channel
extension was rebuilt and validated locally, without synchronization or loading
against the recorded v2 backend. Real-component, local-origin-only headless proof
was rerun against current components: Popup 6/6 and website 7/7, zero console/runtime
errors, including exact/unknown/zero states, Arabic titles, keyboard disclosure,
search, disjoint detail pages and detail invalidation. These checks are not an
authenticated loaded-extension test. Earlier results above remain attributed to
their earlier source. Graphify/plan closeout is a separate local commit gate.
Authenticated provider, loaded extension and matching staging acceptance remain
open. Existing P3 warning/lint hygiene is still deferred and is not silently muted.

## Local Harness Incident Disclosure

The initial baseline pgTAP run before this retained proof used existing tests with a
fixed dblink destination at local port `54322`. Ancillary synthetic setup, cleanup,
and maintenance therefore reached the preexisting local instance while the primary
test connection targeted the dedicated instance. No remote database was reached.
The prior state was not captured, so the exact synthetic or expired-row impact cannot
be reconstructed; this record does not claim that instance remained untouched.
Subsequent source corrections use the current server DSN, and every retained schema-3
reset/mutation above is guarded to the dedicated project at port `55452`.

## Activation And Rollback

Before any separately authorized remote transition, record the exact environment,
reviewed history-table counts, inbound foreign keys/triggers, migration list, current
web/extension versions, backup/rollback anchor, and preservation checks. Quiesce only
history writes, apply both reviewed forward migrations, activate the matching v3 web runtime,
verify surrounding product state, then ask testers to reload the exact matching
extension. Old cached work must receive a terminal upgrade response. Do not introduce
dual models to hide the short history-only upgrade state.

The history reset is intentionally irreversible without an explicitly approved
backup. Deploying the previous Web runtime alone is not a rollback after schema 3;
use a reviewed forward migration and matching runtime, or an approved scoped restore
that protects newer unrelated product data. Never reset the whole remote database.

Authenticated Crunchyroll provider/UI acceptance, matching staging activation,
loaded-extension acceptance, and Popup/website comparison on that environment remain
open. Sanitized fixtures, SQL DTOs, component/headless rendering, and a validated
local staging artifact do not satisfy those gates.
