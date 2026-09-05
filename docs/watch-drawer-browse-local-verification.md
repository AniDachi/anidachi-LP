# Watch Drawer Browse Local Verification

Date: 2026-09-05.

Status: the extension/UI candidate remains verified at source
`bf260d7e858bbd721820a2c7a4ee5532ac924542`; the later server-only episode-label
search fix is `a92dbdc6bf631af775742014246b1fb97f151e84`. The strongest-model
final source review and the scoped re-review of that fix approved the complete
local source with no remaining finding; local implementation and handoff are
complete. This receipt is not evidence of a push, PR, merge, remote migration,
deployment, tester-folder update, browser reload, authenticated staging
acceptance, production promotion, or Chrome Web Store publication.

The approved scope is
`docs/superpowers/specs/2026-09-05-watch-drawer-browse-design.md`; execution is
tracked in `docs/superpowers/plans/2026-09-05-watch-drawer-browse.md`.

## Local Automated Evidence

All commands used repository Node `22.23.1` and pnpm `11.2.2`.

```sh
fnm exec --using="$(cat .node-version)" pnpm check
fnm exec --using="$(cat .node-version)" pnpm test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test:runtime
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web exec tsx \
  --test app/account/watch-library/watch-library-client.test.tsx
fnm exec --using="$(cat .node-version)" pnpm dev:check
git diff --check origin/staging...HEAD
```

Results:

- root check: 6/6 Turbo tasks successful; only the unchanged demo task replayed
  cache;
- root test: 6/6 Turbo tasks successful; protocol 148/148, API 201/201,
  extension 1,715/1,715, and Web 436 passed with five explicit local-integration
  skips; only the unchanged demo task replayed cache;
- separate fresh extension rerun: 117 files / 1,715 tests passed;
- API Workers-runtime suite: 2 files / 41 tests passed;
- retained website watch-library component suite: 19/19 tests passed;
- `pnpm dev:check`: exit 0; it classified extension, Web, docs, API, and rooms
  profiles because the shared protocol index changed;
- branch and working-tree whitespace checks: clean before the documentation
  checkpoint.

Changed-path Biome lint processed 28 production/new test paths with no diagnostics.
The retained large `popup-watch-history.test.tsx` fixture still reports 62
`noNonNullAssertion` warnings, all pre-existing-style debt intentionally left
unformatted. The lightly changed canonical Web builder also retains eight existing
non-null warnings. Across all 30 changed TypeScript paths there are 70 warnings and
zero errors; this receipt does not claim lint is globally pristine. An initial zsh
newline-variable invocation passed the changed-path list as one filename and
processed zero files; the recorded result is the corrected NUL-delimited `xargs`
rerun.

## Database Evidence

Final review found that the common SQL eligibility predicate searched observed and
canonical title labels but not the episode label displayed by browse responses.
The popup fixture's own episode-title filtering had masked that transport gap. A
focused pgTAP red run on the guarded target failed the five new episode-title cases
and passed the other 49 assertions. The minimal fix searches the same canonical
episode label used for display, with the observed `episode_title` as fallback.

After the fix, the dedicated target guard passed again and an exact fresh reset
replayed all 39 migrations through the unpublished `20260905084800` migration. The
retained canonical, resource-bound, catalog, invitation, and browse files then
passed 5 files / 336 assertions. A fresh enabled production RPC parser passed 1/1,
including the requester-relative session date assertion; its populated eligibility
plan still used indexes. Security advisors reported no finding. The regression
covers mixed-case search inside a Unicode-bearing canonical label, observed-label
fallback, a title beyond the first page, an episode beyond the first eight, and a
matching session beyond the first 20. It also compares the filtered response with
the canonical unfiltered observed-episode count.

Only the named disposable Colima project/container on host port `55562` was reset
and accessed. No shared default-local, staging, or production database was accessed
or changed. Expected PostgreSQL extension notices and the Supabase CLI update
notice were informational. A fresh Web TypeScript check, focused Biome lint, and
fix-path whitespace check also passed; unchanged full extension and visual suites
were not repeated for this server-only predicate fix. The controller then stopped
the dedicated database and its isolated Colima runtime; its backups remain
preserved.

## Isolated Staging-channel Artifact

The destructive default staging-copy script was not invoked. The same explicit
narrow staging channel values were used for `check:extension:icons` and the WXT
production build; `.output/chrome-mv3` was copied into a newly created ignored
candidate directory and validated directly:

```txt
source: bf260d7e858bbd721820a2c7a4ee5532ac924542
candidate: artifacts/watch-drawer-browse-bf260d7e.4MX9DB
manifest version_name: bf260d7e-staging-20260905175943
candidate file-list digest: ed85dd35c1ac17d4feba80c33d26ec912a61700393ba71d67fb334f6a57b6882
```

```sh
fnm exec --using="$(cat .node-version)" pnpm check:extension:icons
WXT_EXTENSION_CHANNEL=staging NODE_ENV=production \
WXT_EXTENSION_VERSION=0.1.0 \
WXT_WEB_HTTP_BASE=https://staging.anidachi.app \
WXT_API_HTTP_BASE=https://anidachi-api-staging.vladislav-gul7.workers.dev \
WXT_API_WS_BASE=wss://anidachi-api-staging.vladislav-gul7.workers.dev \
WXT_BUILD_ID=bf260d7e-staging-20260905175943 \
WXT_BROAD_HOST_PERMISSIONS=false \
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension build
fnm exec --using="$(cat .node-version)" node \
  scripts/validate-extension-artifact.mjs --channel staging \
  --dir artifacts/watch-drawer-browse-bf260d7e.4MX9DB
```

Validation passed with `Anidachi Staging`, version `0.1.0`, the approved staging
identity/endpoints, and narrow YouTube, Crunchyroll, staging Web, and staging Worker
hosts. No zip was created or distributed. Existing dynamic-import and chunk-size
build warnings remain nonblocking. The two established tester folders were not
touched.

## Real-component Visual Evidence

Fresh local headless checks ran the actual production Popup components/styles with
schema-validated synthetic DTOs at 420 px and 340 px widths:

```sh
node /tmp/anidachi-browse-ui.nQGAp3/verify-ui.mjs
node /tmp/anidachi-browse-ui.nQGAp3/verify-stability.mjs
node /tmp/anidachi-browse-ui.nQGAp3/validate-contracts.mjs
```

All three passed. Evidence is in
`/tmp/anidachi-browse-ui.nQGAp3/controller-visual-evidence.md`, with final images
`current.png`, `filters-420.png`, `filters-340.png`, `together-340.png`,
`rtl-340.png`, and `settings.png` in the same directory. It covers narrow/RTL
layout, actual filter payloads, a 23-hour daylight-saving day, stable scroll/focus/
order/disclosure, canonical aggregates, retry states, History preference mutation,
reduced motion, DTO contracts, and no page errors. It uses synthetic account data;
it is not authenticated or provider-loaded staging acceptance.

The controller later copied the final images, three verification scripts, fixture,
and local server source into the ignored durable local archive
`artifacts/watch-drawer-browse-evidence.PPXwrM`. The originals were left untouched;
this archive is not a new UI run, tester-folder update, or staging acceptance. The
local QA server is stopped. Both this evidence archive and the isolated extension
candidate remain ignored local artifacts.

## Knowledge Graph Maintenance

Graphify is maintained alongside this handoff through the code AST update and
Codex semantic extraction. The accompanying graph-only checkpoint records the final
AST/semantic refresh and freshness verification for this source. Graph maintenance
is complete only with that checkpoint. Measured agent usage is unavailable.
Numerical graph metrics remain in `graphify-out/GRAPH_REPORT.md`; they are not
duplicated in semantic input docs to avoid self-churn.

## Review And Gate Exceptions

Independent Task 1–3 reviews found and closed their scoped Important issues before
this checkpoint. The Task 4 whole-branch read checked cross-account ownership,
request/query/cursor/generation isolation, requester-relative session timestamps,
invitation-plus-participation provenance, immutable historical group labels,
canonical aggregate truthfulness, deletion/generation fences, YouTube consent
ownership, drawer deletion removal, website management retention, and narrow UI
behavior. After the episode-label fix, the strongest-model final source review and
its scoped re-review approved the complete local source with no remaining Critical
or Important finding.

No room or P2P harness, real-WebRTC run, remote Worker smoke, or authenticated
provider flow was added for Task 4. The protocol change exports history browse DTOs;
it does not change room wire events, Durable Object behavior, signaling, media,
capture, or Worker deployment. Root API checks/tests and the 41-test Workers-runtime
suite passed. The retained invitation SQL is included in the exact 336-assertion
database evidence. Remote checks would violate the local-only authorization.

## Activation, Acceptance And Rollback

Staging currently contains the accepted Watch History v3 and PR `#267` refresh/
cover baseline at `f2fafb29`; it does not contain this migration, routes, or drawer.
Technical `main` remains at `54a154b7` with Watch History v2.

Separate authorization is required for each rollout stage:

1. apply the additive browse migration to staging;
2. deploy the reviewed matching Web runtime;
3. build and synchronize the exact matching narrow staging extension;
4. reload it and complete authenticated staging acceptance with newly organized
   group viewing plus actual participation, combined group/participant/date/search
   filters, deep pagination, account/generation/deletion isolation, and the existing
   YouTube preference authority.

Old ambiguous sessions remain ordinary Together history; there is no group
backfill. Old v3 readers stay compatible with the additive database prerequisite.
Rollback restores the previous v3 Web/extension consumers while retaining additive
data and canonical history. If the writer entry point must be restored, use a
reviewed forward migration. Never drop or rewrite Watch History as rollback.
