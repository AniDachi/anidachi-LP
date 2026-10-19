# Netflix Staging Verification

Candidate checkpoint: October 8, 2026. Scope is staging only. This record separates
local evidence from delivered behavior. Pending tables describe this source
checkpoint; the feature PR description and controller release report will retain
the final immutable deployment/artifact receipt after successful delivery. No
docs-only deployment loop is needed to fill source placeholders. Earlier source implementation commits
are `9f93e7f3` (server/SQL), `7c94241b` (adapter/compatibility) and `fc7bb3e8`
(library/copy). See [adapter notes](netflix-adapter-notes.md) and
[the approved plan](superpowers/plans/2026-10-08-netflix-staging.md).

## Local evidence

All project commands use Node 22.23.1 / pnpm 11.2.2; automated shells prefix them
with `fnm exec --using="$(cat .node-version)"`. The listed broad evidence was run
by prior tasks, not repeated by final integration when source stayed unchanged.
Local logs/reports live under ignored `tmp/netflix-sdd/` and are not public
release artifacts.

| Surface / command | Observed result and boundary |
| --- | --- |
| Disposable baseline + `supabase --workdir tmp/netflix-db migration up --local`; SQL runner | 70 migration versions, ending at `20261007235706`; 1,421 passing assertions (1,409 ordinary including 61 Netflix, plus 12 separately guarded concurrency). The broad CLI exits 1 solely for the intentionally refused unflagged concurrency file; the explicit disposable guarded run exits 0. No remote DB claim. |
| `pnpm --filter @anidachi/protocol check` and `test` | Latest Task 3 protocol evidence: 20 files / 245 tests pass, including legacy namespaced read-key compatibility. |
| `pnpm --filter @anidachi/api check` and `test` | 24 files / 253 tests pass; source normalization/provider pinning covered. |
| `pnpm --filter @anidachi/api test:runtime`; `pnpm harness:rooms` | Controller at `7c94241b`: workerd 5 files / 96 tests and local room-signaling 39/39 pass. This is neither distributed media nor two-client Netflix proof. |
| `pnpm --filter @anidachi/web check` and `test` | Task 4 final typecheck pass; 982 tests, 976 pass / 6 existing external/benchmark skips. Focused 47/47 pass. Existing test diagnostics/lint warnings remain. |
| `pnpm --filter @anidachi/extension check`; `test --exclude test/release-channel-build.test.ts` | Task 4 final typecheck pass; 141 files / 2,177 tests pass. Local exclusion is deliberate: the release fixture writes production artifacts. Only narrow staging fixture was selected earlier; public fixtures belong in disposable CI. |
| `pnpm --filter @anidachi/extension exec vitest run test/source-adapters/netflix.test.ts` | Final integration 14/14 pass, including real bridge/client DOM replacement, delayed old result, stale command rejection, replacement resume and cleanup. |
| `pnpm build:extension:staging`; `pnpm validate:extension:staging` | Task 3 local narrow artifact passed at `7c94241b`. It is not the final Task 4/integration artifact. Final delivered-source build/validation remain required; existing dynamic-import/chunk warnings are not claimed fixed. |
| Workflow guard / docs sanity / `pnpm dev:check` | Final integration verifies exact guard offline for empty/wrong/correct refs, checks local links and whitespace, and records recommended profiles. `dev:check` recommends commands; it does not execute them or prove delivery. |

Disposable DB target was explicitly isolated as `anidachi-netflix-20261008`,
container `supabase_db_anidachi-netflix-20261008`, host port `55481`; no existing
provider data, earlier migrations, authority epochs or settings were rewritten.
Security advisors reported no issues before/after. Existing routine ACL/security
properties were preserved; the two new RPCs are service-only security invoker
with empty search_path. v1 capacity definition remained byte-for-byte unchanged.

Controller observed responsive local homepage desktop/mobile presentation, not
populated Watch Library/popup or delivered staging UI. The currently authenticated
staging account is Free with empty history, so recording proof requires an
existing eligible tester; this plan authorizes no entitlement change.

## Ordered staging delivery

1. Freeze and review the complete feature branch, including workflow, docs and
   final safe Graphify semantic update. Open the PR into `staging`, wait for all
   required CI and inspect the exact reviewed source/migration diff.
2. Verify the named staging Supabase project `cyppqpprkygjloyfvvvj` and migration
   state. The approved ordered-delivery exception allows `db-staging.yml` on the
   reviewed frozen feature ref before runtime merge, using only STAGING secrets.
   Its exact project-ref equality guard precedes `supabase link` and refuses an
   empty/wrong target without printing credentials. Check the dry-run and apply
   the additive `20261007235706_netflix_history_and_room_sources.sql` only to
   that staging project, then verify remote migration history.
3. Merge through the normal staging PR path after schema verification. Verify
   matching staging Vercel Web and Worker revisions, Worker health/ICE auth smoke,
   password gate, noindex/robots and sitemap exclusion. Run protected web smoke
   through the existing staging workflow with environment-scoped secrets; an
   automatic smoke on an earlier deployment is not delivered-revision evidence.
4. Build/validate the normal narrow staging extension from the delivered staging
   revision, with identifiable source SHA/build ID. Record folder/ZIP hashes in
   the feature PR description and controller release report after building;
   embedding a final source hash in the same
   source would change that hash. Verify manifest identity, endpoints, permission
   sets and MAIN Netflix script. No production/public/local-broad package is part
   of this delivery.
5. Reload the final unpacked artifact and refresh Netflix, then perform the
   acceptance matrix below. The official browser connector rejected
   `chrome://extensions`; artifact loading therefore needs user action. Do not
   bypass that restriction through another control surface.

This is a specific DB-before-runtime staging exception to generic release-ref
guidance, not permission for arbitrary feature-ref releases. Web, Worker and
extension release artifacts still deliver from `staging`. No `main` promotion,
production deploy/migration, Store publication, billing or entitlement change.

## Delivery state at source checkpoint

This table is a dated source checkpoint, not an assertion that these operations
remain pending after delivery. The feature PR description and controller release
report are the final immutable receipt for matching deployment IDs/revisions,
workflow results, artifact hashes and subsequently observed acceptance. Updating
this table is not a prerequisite for deploying the same frozen source.

| Evidence | State |
| --- | --- |
| PR / frozen feature SHA / required CI / merge SHA | Pending controller delivery |
| Exact staging project / remote migration `20261007235706` | Preflight project association verified; migration application pending |
| Web deployment ID/source and Worker workflow/source | Pending |
| Worker smoke and protected staging web smoke | Baseline passed; delivered-source proof pending |
| Staging folder/ZIP source, build ID, SHA-256, manifest validation | Final artifact pending |
| Loaded browser artifact identity / date / testers | Pending user reload and controller acceptance |

## Manual acceptance matrix

Every row needs the delivered build ID, test date and observed result before
being marked accepted. Unit/component/mock evidence cannot complete these rows.

| Scenario | Required observation | Current state |
| --- | --- | --- |
| Narrow artifact / existing providers | Exact staging identity/endpoints; YouTube and Crunchyroll overlay, history and room controls retain expected behavior | Pending |
| Netflix browse/detail previews | No overlay recording or persisted history from autoplay previews | Pending loaded artifact |
| Primary movie / supplemental opening | Movie has its own key and null season; trailer/recap/supplemental content suspends until coherent main content | Pending loaded artifact; API research only |
| Series / native next episode | Stable series/season/episode IDs; old video removal and replacement stop old controls/recording; new identity resumes and room association stays correct | Pending live; local DOM fencing passes |
| Playback | Play/pause/seek observed via API with sane seconds; route/player mismatch or unavailable API fails safely without raw seek | Pending loaded artifact; real API research only |
| Chat / fullscreen | Open, type, Enter/send, empty send, cancel/Escape, platform shortcuts and fullscreen placement; record Chrome-owned Escape caveat | Pending |
| Ads / ambiguous phases | Suspend capture/control and safely recover; ad-enabled account tested explicitly before claiming ad-plan support | Pending; real ad-plan unverified |
| Eligible personal history | Existing paid/trial viewer saves own movie/series/season/episode progress and poster; no Netflix bookmarks/history imported; Free viewer gains no recording | Pending eligible tester |
| Library / Resume / catalog | Popup/site show correct provider/artwork, standalone movies and real seasons; Resume confirmed; unknown/partial catalog stays truthful | Pending populated/live evidence |
| Pagination / search | 20 initial titles per provider, independent load-more and full-history search; current-account authority maintained | Local component coverage; real populated acceptance pending |
| Host / guest shared room | Two authenticated Netflix clients agree on pause/seek/source transition; guest joins without paid access | Pending two clients |
| Delivery controls | Gate/noindex/sitemap, exact migration/runtime/artifact source, protected smoke and recovery path verified | Pending delivered revision |

## Compatibility and rollback

Default capacity v1 contains exactly YouTube/Crunchyroll. Explicit capacity v2
adds Netflix's 200-title bucket without plan/pricing changes. Default all-provider
reads remain v1; `providerVersion=2` (including SSR, search/options/cursors) or
explicit Netflix filter opts in. Filtering precedes counts/pagination/facets and
session enrichment, so old clients can read their original providers after
Netflix rows exist. Missing v2 capacity is unavailable, not zero usage.

Recover by withdrawing/reverting Netflix consumers and coordinating compatible
Web/Worker/client runtime rollback while retaining the additive migration, saved
history, receipts and all authority epochs. Old clients intentionally hide
Netflix rows; a compatible client can recover them. Never remove constraints
while Netflix rows exist, delete history to fit old code, restore old writers
over current epochs or reset the database. Active rooms and source generations
need coordinated staging recovery validation; SQL pass alone is insufficient.
