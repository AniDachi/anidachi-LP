# Current Development State

Last updated: 2026-09-05.

This is the short operational source of truth for the current Anidachi setup.
Historical plans in `docs/superpowers/plans/` are useful context, but they can
contain old paths, old domains, or old decisions. When release channels,
endpoints, branch protection, or store workflow changes, update this document in
the same PR.

## Repository

Canonical GitHub repository:

```txt
AniDachi/anidachi-LP
```

Local clone placeholder used in docs:

```txt
<repo>
```

`<repo>` means the folder where a developer cloned `AniDachi/anidachi-LP` on
their own machine. Do not assume any specific absolute path. Older pre-monorepo
local folders are legacy context only and should not be used for new product
development.

## Branches And Protection

`staging` is the fast integration branch for tester builds.

- Required status checks enforced by GitHub: none currently
- Additional non-required release workflow: `build-extension`
- Additional non-required deploy workflow: `deploy-api`
- Required PR reviews enforced by GitHub: none currently
- CODEOWNERS review requirement: off; CODEOWNERS is advisory on this branch
- Force pushes: blocked
- Branch deletion: blocked
- Admin enforcement: on

The project workflow still requires feature PRs, `check-and-test`, and the
change-specific quality gates before merging to `staging`; GitHub does not yet
enforce those checks on this branch. Aligning the live protection with the
documented workflow is a separate process follow-up, not part of a product or
release PR.

`main` is the production branch.

- Required status check: `check-and-test`
- Additional non-required release workflow: `build-extension`
- Additional non-required deploy workflow: `deploy-api`
- Required approvals: `0`
- Dismiss stale approvals: on
- Strict up-to-date branch requirement: on
- Conversation resolution requirement: off
- CODEOWNERS review requirement: off; CODEOWNERS is advisory on this branch
- Repository auto-merge: enabled
- Force pushes: blocked
- Branch deletion: blocked
- Admin enforcement: on

Normal flow:

```txt
feature branch -> PR -> staging -> tester build -> PR/promotion -> main -> public build
```

Site-only auto-promotion:

- Pushes to `staging` run `Promote Site Staging to Main`.
- The workflow compares the full `main..staging` diff.
- If the diff contains only safe site/docs paths, it creates or updates a PR
  from `staging` to `main` and enables auto-merge.
- If the diff includes extension, API, workflow, package, auth, room, checkout,
  or other sensitive paths, promotion is skipped and must be handled manually.
- Workflow changes under `.github/**` are intentionally never auto-promoted; the
  auto-promotion workflow itself must be installed in `main` manually once.

## Development Quality System

Every contributor and AI worker should start from root `AGENTS.md`. It points to
the required docs, the active plan, the git flow, and the verification commands.
Plane-specific instructions now live in:

- `apps/web/AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/extension/AGENTS.md`
- `packages/protocol/AGENTS.md`

Use `docs/development-quality-gates.md` as the central map from change type to
required checks, staging evidence, docs updates, Graphify updates, and PR notes.

Before opening a PR, run:

```bash
pnpm dev:check
```

This prints the focused check profile for the files changed against
`origin/staging`. High-risk profiles can also be inspected explicitly, for
example `pnpm dev:check -- --profile rooms` or
`pnpm dev:check -- --profile extension`.

Project-aware review is configured in `.coderabbit.yaml`. CodeRabbit is
advisory: it should catch Anidachi-specific risks, but it does not replace CI,
staging acceptance, or human/agent review. PRs should use the root
`.github/pull_request_template.md` and include verification, staging impact,
security/env impact, docs status, Graphify status, and rollback notes.

Local development and CI use the exact Node version from `.node-version`
(`22.23.1`) with pnpm `11.2.2` and `pnpm install --frozen-lockfile`.
`package.json` and `pnpm-workspace.yaml` enforce that toolchain. Do not churn
`pnpm-lock.yaml` unless dependency changes are intentional and reviewed.

Graphify is the project knowledge graph for agent orientation. Commit only the
team graph artifacts documented in `docs/project-knowledge-map.md`; keep local
cost files, HTML exports, scoped scratch graphs, and other generated outputs
ignored.

Graphify is now available through repo scripts:

```bash
pnpm graph:baseline
pnpm graph:update:code
pnpm graph:watch
pnpm graph:hook:install
pnpm graph:query "Trace room token flow from web to Worker WebSocket join."
```

`pnpm graph:update` remains a compatibility alias for the code-only command.
After changing docs, plans, images, PDFs, or other semantic inputs, use
`$graphify . --update` inside Codex; it uses Codex subagents and does not need a
separate provider API key.

Use it before cross-plane work, especially room/P2P/auth/Worker/CI changes. Do
not promote Graphify to a required CI check unless the team explicitly accepts
the runtime and backend requirements.

## Main Technical Baseline Promotion

The accepted foundation was promoted to `main` on 2026-08-23 through the
database-first, runtime-second procedure in
`docs/superpowers/plans/2026-08-22-safe-staging-main-foundation-promotion.md`.
This established a clean technical baseline; it was not a public launch,
Chrome Web Store publication, UI/UX-completion, or market-readiness decision.

- Frozen `staging` candidate:
  `4104d4bd2fe33d3d7700fafd6c45a4fed20215d8`.
- Migration-only PR `#227` merged as
  `2d12b67bc53ac516066661013ab3714836a3047c`. Production workflow
  `32616586863` applied all 13 ordered migrations successfully while the old
  web runtime stayed healthy. Its rollback-point web deployment was
  `dpl_Ch1aPbRhbiKZYye4hViMGxo7Fc5m`.
- Runtime PR `#228` contained no migration diff, and its tree was byte-identical
  to the frozen candidate. It merged as final `main` SHA
  `20c37893b7bdd52d9f10cff254fb541580ce99de`.
- Runtime workflows succeeded: CI `32617261509`, production migration no-op
  `32617261512`, Worker deploy `32617261521`, and extension artifact build
  `32617261508`. The no-op migration dry run and apply both reported the remote
  database up to date.
- Vercel production deployment `dpl_DcH4fdkGWLb5zdvbWWZ3GCeHzyHn` is Ready;
  `/` and `/login` returned HTTP 200. The production Worker smoke passed after
  deployment `31286574-55be-4769-8bf9-0107602a400f`, version
  `93fa62a0-4dad-4321-977e-5a67e7a3281f`.
- Production retains all 13 migration records. The service role has full CRUD
  on 33/33 public tables and execute on 37/37 public routines, with public
  schema usage but no schema-create privilege. Control counts for rooms,
  Watch History sessions, and legacy checkpoints remained unchanged through
  the promotion.
- The hourly bounded auth-artifact cleanup first ran successfully at
  `2026-08-23 04:00 UTC`. Legacy refresh rows decreased from 293 to 200; every
  remaining row was already expired or revoked and the active legacy count was
  zero. This is the designed cleanup of unusable artifacts, not deletion of an
  active session. The clean auth-channel cutover may still require one new
  sign-in; no authenticated production acceptance is claimed here.
- The private production extension artifact is named `Anidachi`, version
  `0.1.0`, `version_name`
  `20c37893b7bdd52d9f10cff254fb541580ce99de-production-124`, with ZIP SHA-256
  `294927fb301b1533401f621597fa6612641f35f890c84d303467eaad190edeae`.
  Its host permissions are limited to YouTube, Crunchyroll, the production web
  origin, and the production Worker. It was validated but was not loaded,
  uploaded, or published to Chrome Web Store. Production extension connection
  remains intentionally fail-closed until a public extension identity is
  approved.
- Immediately after the runtime promotion, `origin/staging` was an ancestor of
  `origin/main`, and their trees matched at
  `2927c30bb89531eb7e44ee7dcde62d784fcee962`. Old aggregate PR `#174` was
  closed without merge as superseded by PRs `#227` and `#228`.

Deferred boundaries remain explicit. The shared `PRIVATE_INTEGRATION_BLOB_*`
configuration and unrelated integration data were not changed; those non-core
paths remain fail-closed. The waitlist/Kreatli CRM is not one of those non-core
paths: the homepage counter and public survey, contact, and feature-request
forms depend on its durable data. TURN was already configured and was not
modified. Automated room and real-WebRTC gates
passed, but a manual relay proof across two separate networks remains deferred
until public extension-release preparation. The previous rollback anchors are
web deployment `dpl_Ch1aPbRhbiKZYye4hViMGxo7Fc5m`, Worker deployment
`5da7e90e-dcb1-42c3-8ea3-92bb5f121e2b` / version
`471fa2a3-0e08-41f1-b2bd-fd55042e431f`, and post-migration Git SHA
`2d12b67bc53ac516066661013ab3714836a3047c`.

## Waitlist And Public-Form CRM Recovery

The 2026-08-23 production inspection found a promotion regression, not deleted
data. The retained legacy public CRM object contains 683 contacts, including
682 survey leads. The existing private snapshot contains 644 contacts,
including 643 survey leads, and was verified as a conflict-free older subset at
inspection time. Production `/api/waitlist-stats` returned zero because the web
runtime had no private CRM authority and silently fell back to an empty,
read-only deployment filesystem. Three later survey requests returned optimistic
HTTP success but logged failed filesystem persistence.

The completed repair record is
`docs/superpowers/plans/2026-08-23-waitlist-crm-durable-storage-recovery.md`.
Its CRM-specific private Blob authority was first accepted on `staging` and then
promoted through PR `#240` to `main` as
`8cc5e4e6641ca55f0b62a320e8726de67900ce34`. It does not enable the shared
deferred integration boundary, fails closed on Vercel when its narrow authority
is absent, conditionally updates Blob objects by ETag, reports public-form
success only after durable storage, and provides a five-object dry-run-first
reconciliation tool.

Staging acceptance completed on 2026-08-24. The lossless reconciliation started
from 683 contacts and 682 survey leads; all three retained failed submissions
were recovered without printing PII, producing 685 survey leads. A repeated
same-email submission was idempotent, controlled contact and feature-request
submissions returned HTTP 200 without changing the waitlist count, and fresh
deployment `dpl_AnAzpf8XTHUcCrYMz19TDkQ2y3rq` still rendered and returned 685.
The private authority now contains 687 contacts in total because the controlled
`@example.com` acceptance identity is retained as a non-waitlist test record.
Fresh staging runtime logs contain no EROFS, Blob-auth, or CRM-persistence
failure.

The legacy public objects remain untouched as rollback evidence;
`kreatli-crm/gmail-tokens.json` is outside the recovery inventory. Production
received only the narrow `KREATLI_CRM_BLOB_READ_WRITE_TOKEN`; the shared
`PRIVATE_INTEGRATION_BLOB_*` authority and unrelated integrations were not
enabled. Production migration workflow `32656249908` and main CI workflow
`32656249981` succeeded. Deployment `dpl_3v2H5pk4v5muknJvpyKjXZpJHEXX`
returned and rendered 685; an idempotent replay kept the existing position 683,
and controlled contact/feature submissions returned HTTP 200 without changing
the count. Fresh redeploy `dpl_DCt6ocJBbEJ848rfaC38W5bhbdyg` again returned
and rendered 685, proving persistence across instances. Production logs contain
no EROFS, Blob-auth, CRM-persistence, fake-success, or PII-log failure; optional
Gmail-not-configured warnings do not affect durable writes. The private store
contained 687 contacts total and 685 survey leads at the controlled acceptance
checkpoint. A later distinct public signup returned HTTP 200, created position
686, and moved the observed live store to 688 contacts / 686 survey leads;
docs-triggered Production deployment `dpl_HcqvVAnF9V4EnSHjYekrpmKfQEUY`
immediately returned and rendered 686. Pre-cutover deployment
`dpl_AX8MKEAcgjAXJpPnVUXZgqfNN14D` remains the deployment rollback anchor. The
recovery plan records exact acceptance-time and post-signup data anchors; live
counts are expected to continue growing.

## Pre-release Security Readiness

Waves 1-3 of the now-historical pre-release security plan retain their staging
evidence. Wave 1 completed at merge
`07dfaf4a8bd0c192e21fd381f4350ab88cdab322` (PRs `#192`-`#195`). The web runtime
uses Next.js `15.5.23`, the public media route accepts only exact public media
identifiers, and sensitive integration/CRM Blob paths are excluded from public
media access. The CRM recovery above adds its own narrow private-store runtime
authority; unrelated integration credentials keep the shared private boundary.
The temporary staging compatibility flag
has been removed; the retained public legacy objects are not a runtime fallback
and were not deleted or changed during cutover. On 2026-08-21 the broad program
was closed by explicit scope disposition, not by claiming that all original
tasks were implemented; the focused successor is named below.

The live staging deployment is `dpl_B6dD3YJdGJrkBfkppQGsXH9PdaBL`. Both staging
aliases, CI, deployment smoke, noindex/no-store behavior, the bounded private
snapshot manifest, and the affected TikTok test-account health checks passed.
An unrelated internal YouTube publishing test credential requires manual
reconnection later; it does not affect product auth, rooms, Watch History, or
the extension.

Wave 2 Task 5 is deployed on `staging` at merge
`d330be47cb23ee58eeba3e0db18ec1f2f2e86e21` (PR `#197`). Browser Google and
Discord login now use random one-time state, an independent browser-correlation
secret, S256 PKCE, provider-bound atomic consumption, and transaction-scoped
cookie cleanup. Migration `20260818131602_oauth_login_transactions.sql` is
applied; the linked migration dry run is empty. Local web/pgTAP gates,
independent and CodeRabbit review, GitHub CI, migration deployment, rooms/P2P
E2E, Vercel deployment, and staging smoke passed.

Task 5's attended provider gate is accepted.
On 2026-08-20, real Google and real Discord consent/callback flows
succeeded on staging inside the enforced initial ten-minute OAuth transaction
window. Exact elapsed times and screenshots are not claimed. Task 6 now has
stable,
repository-controlled unpacked local and staging identities, exact per-channel
callback binding, S256 PKCE, atomic one-time exchange, and fail-closed
production. When extension connection needs website login, the validated
request crosses browser OAuth only inside a ten-minute authenticated-encryption
envelope derived from the existing server JWT secret; the durable OAuth row and
browser-visible login return path contain only that opaque envelope. The
approved local ID is `nkinhhgigcflmfhilmcakbkongcpkfnl`; the
approved staging ID is `ndkfphbchhfephdodcpehdcoclojagje`. This source work is
locally verified in PR `#199`. Its additive migration is already applied on
staging, the linked dry run is empty, and Vercel Preview branch `staging` has
the exact staging client ID. Task 6 is merged to `staging`; the exact merged
narrow artifact has now been loaded in both established staging test profiles;
the user confirmed both profiles successfully authorized and loaded it. That
two-profile confirmation is distinct from the one first-profile MV3-worker
proof: its exact `/auth` callback was state-matched, wrong verifier -> 401
`invalid_grant`, the same still-usable code with its correct verifier -> 200,
and consumed-code replay -> 401 `invalid_grant`. That worker also completed the
real `/extension/logout` flow: its exact callback had the approved Chromium
host, `/logout` path, matching state, `signed_out=1`, and exactly the expected
parameters. Separately, the issued test refresh token from the PKCE/replay proof
was revoked through the supported extension logout endpoint (200), and an
immediate refresh attempt was rejected (401 `Invalid refresh token`). All
code/state/verifier/access/refresh values stayed in process memory and were
cleared without being printed or persisted. This closes the Task 6 staging
connection, verifier, replay, browser-logout-callback, and issued-session-
revocation evidence. The rollout order remains additive migration first,
application second, then exact unpacked staging acceptance. Legacy rows survive
with null binding columns, but the new RPCs cannot consume them. If the new app
must be rolled back after bound issuance, stop issuance and drain for more than
five minutes (or remove only unconsumed bound rows) before restoring the old
exchange, which cannot enforce PKCE. Staging/public release scripts force their
canonical web/API/WS endpoints and narrow mode, and artifact validation rejects
any extra host permission or content-script match. Broad staging remains a
separate explicit local testing command and output path.

Task 7 reached staging through PR #201 and merge commit `13a30fa`. The additive
migration `20260819133849_auth_channel_rotation.sql` is applied to staging and
creates service-role-only website/extension refresh families and hash-only
consumed-token lineage; raw or encrypted refresh tokens are not stored. Access tokens require
exact scalar issuer/audience/type channel claims. Refresh rotation is atomic,
uses a ten-second concurrency-reuse interval, expires after 90 consecutive days
without refresh and after an immutable 365-day maximum, and revokes the active
family on any other known replay. The extension serializes sign-in, refresh
persistence, and invalid-session clearing so an old response cannot overwrite a
new account. Local database reset, 180 pgTAP assertions, web/extension suites and
checks, staging artifact build/validation, independent task review, scoped fix
re-reviews, and the final CodeRabbit review with zero findings passed. The
migration-first staging deployment, post-merge CI, Rooms/P2P, extension build,
Vercel status, and staging smoke passed. Both established test profiles completed
the forced reauthentication; the user confirmed correct website/Popup accounts,
single-profile extension logout isolation, and successful reconnect. Task 7 is
staging-accepted.

Task 8 reached staging through PR #203 and merge commit `e8c5519`. Migration
`20260820040229_auth_artifact_cleanup.sql` is applied and installs one active
hourly Supabase Cron job, `anidachi-auth-artifact-cleanup-hourly`, which invokes
the service-role-only bounded cleanup function. Each call deletes at most 100
physical expired, revoked, consumed, or otherwise unusable auth-artifact rows;
active refresh families, live OAuth transactions, and unexpired extension codes
are not eligible. Successful extension-code exchange now deletes its exact code
atomically instead of retaining a consumed row. There is no Vercel cleanup
route, new secret, queue, worker, dashboard, polling loop, or user-visible
setting.

Local verification includes a fresh database reset, 226/226 pgTAP assertions,
the exact production-statement normal-planner contract, full web/extension/
protocol tests and checks, database lint/advisors, repeatability, concurrent
lock-progress coverage, independent review, and CodeRabbit review. Post-merge
database deployment, CI, Rooms/P2P, Vercel, and staging smoke passed. One
attended bounded staging invocation removed exactly 100 eligible rows (47
expired extension codes, 5 expired OAuth transactions, 46 expired/revoked
legacy refresh rows, and 2 unusable refresh families) while all 7 active refresh
families remained. Task 8 is staging-accepted; the hourly job will drain the
remaining eligible backlog in bounded calls. Its first scheduled execution at
`2026-08-20 07:00 UTC` succeeded and removed another 100 eligible rows while
the active-family count remained 7.

Wave 2 is complete and staging-accepted: Tasks 5-8 satisfy their staging
acceptance boundaries, and the Wave 2 Stop is closed. Wave 3 may proceed from
current `staging`. These changes are now also contained in the technical `main`
baseline recorded above. That Git promotion does not turn the historical
staging evidence into authenticated production or public-release acceptance.

Wave 3 is green and the Wave 3 Stop is closed for staging readiness. Task 10's
WebSocket-admission change merged in PR `#208` at
`1707703efb6ec5e85b6a3c40fc9192134f23be3a` on 2026-08-21. Post-merge CI, API
deploy, migration workflow, Rooms E2E, P2P E2E, Vercel, and staging smoke
passed. Manual staging acceptance with two authenticated browser profiles passed
host room creation, guest join, synchronized play/pause/seek, and guest
reload/reconnect without duplicate or ghost participants. This proves the normal
two-profile join/reconnect path only; it is not a two-network/TURN, production,
or exhaustive adversarial-traffic result. Task 11 PR `#210` merged to staging
at `ae9022b1a5667654e69e1348633721037dcb63dc`; final local evidence was 98 files
and 1,250/1,250 extension tests plus extension check, changed-path lint,
staging build/validation, and `pnpm dev:check`. Post-merge CI, Rooms/P2P,
Vercel, and staging smoke passed. Packaging hygiene PR `#211` merged at
`b2d209504ed991bc7df0d334c2bc263ccc03e447`; authoritative artifact
`b2d209504ed991bc7df0d334c2bc263ccc03e447-staging-118` has ZIP SHA-256
`76bcd133fabc82e10f9c1881b5dc99405150ac5b85f7409aa182a814d14e9e61`, exactly
one referenced popup chunk, narrow permissions, and byte-for-byte
synchronization to the two established test folders. The user loaded the exact
artifact in the habitual Chrome staging profile and reported that it works.
This is normal visible-flow loaded-artifact acceptance only; it does not claim
two-network/TURN, production, exhaustive adversarial traffic, or Chrome Web
Store. The integrated Wave 3 matrix is green from final automated Task 9
expiry/replay and privileged-action evidence, post-merge CI/Rooms/P2P/staging
smoke, prior Task 10 acceptance, and this Task 11 acceptance. No security work
from this wave was separately reimplemented for production; the exact tested
tree is now contained in `main` through PR `#228`. Two-network/TURN and
authenticated production acceptance remain explicitly unclaimed.

## Subscription Plan Codes

Canonical subscription plan codes are:

```txt
free | plus | pro
```

Legacy values `watcher`, `nakama`, `junkie`, `crunchyroll_subscriber`, and
`anime_junkie` are migration-only aliases. Runtime code may accept them during
the bridge window for old tokens, old Stripe metadata, and old database rows,
but new UI, APIs, protocol payloads, Stripe metadata, database writes, and docs
must emit `free`, `plus`, and `pro`.

## Extension Session Ownership

The extension background service worker is the single coordinator for extension
sign-in, access-token refresh, and website-account reconciliation. Content
scripts and the popup request auth operations through runtime messages and may
read cached identity for immediate rendering, but they do not own refresh.

Website and extension access tokens expire independently. A stale website access
cookie is not evidence that the extension signed out. The extension uses
`/api/extension/auth/website-session` to validate the long-lived website refresh
cookie for explicit logout and account-switch synchronization. Temporary HTTP or
network failures preserve the cached extension session; a confirmed invalid
extension refresh token remains the terminal server-side sign-out signal.
Cached identity may remain visible during a temporary outage, but authenticated
actions fail with a retryable error until a usable access token is available.
Supabase query failures propagate as server errors and must never be collapsed
into an invalid-token response. Startup reconciliation and cookie-change events
are coalesced by the background worker; strict cookie policies use the existing
silent browser flow as a fallback.

## Core Foundation UI/UX Handoff

The three technical-foundation blocks in
`docs/superpowers/plans/2026-08-21-core-foundation-ui-handoff-plan.md` are
implemented and accepted on `staging` through
`3a442b7f76992a5e48b387740bf9cc31a565235e`, and their final frozen staging
tree is now included in `main` through the baseline promotion recorded above.
This is a documented foundation for subsequent UI/UX work, not a
production-readiness, market-readiness, public-release, or Chrome Web Store
claim.

- **Watch History resource boundary:** PR `#215` deployed
  `20260821162622_watch_history_v2_resource_bounds.sql` as staging squash
  `7d2e3badb043c3d3adb4ef16ad9527dd3762259f`; PR `#216` switched consumers at
  `b652f8b8cfbdd8130a648702708dfcc13dc2cd8d`. Title pages expose at most eight
  recent episode rows per title, while an owner-bound detail continuation is
  capped at 50 rows. The recorded 501-title/13,200-episode local fixture was
  275,920 serialized bytes with a +573,440-byte parser RSS delta. Receipt
  cleanup remains global, hourly, bounded, and exact at the 14-day boundary.
  The user accepted the two-profile loaded artifact for local-first Watch
  History and website convergence on 2026-08-22.
- **Durable room source:** PRs `#217`–`#220` landed the strict shared source
  contract, additive `20260822033019_room_source_generation.sql`, Web
  persistence boundary, and Worker/extension convergence; Task 6 reached
  staging at `d4262ffef6a78e4c275a95fb3e70d705ecc04759`. A room is
  provider-pinned, source generations are monotonic, and the Worker retains one
  coalesced durable-persistence outbox without delaying live playback. ICE uses
  Authorization; the browser WebSocket `roomToken` query remains a separate,
  deliberate browser limitation.
- **Room-invite lifecycle:** PR `#221` applied
  `20260822065227_room_invite_lifecycle_actions.sql` at staging squash
  `b12c4850f034e69f2cfd24a0db90bfd3e045eb87`; PR `#222` switched the runtime at
  `1bafc52`; and PR `#223` applied
  `20260822091552_finalize_legacy_orphan_invite_rooms.sql` at
  `3a442b7f76992a5e48b387740bf9cc31a565235e`. The v2 inbox/action authority
  follows room lifecycle, makes one accept/decline transition atomic and
  idempotent, and preserves old functions and `expires_at` for rollback. The
  user confirmed that the host projection changes to `Accepted` in the two
  loaded staging profiles.

Separate work remains required for UI/UX design, release and store decisions,
authenticated production acceptance, two-network/TURN acceptance, broader
P2P/media hardening, billing, public forms, legal/compliance, media intake, and
additional providers.
For rollback, use reviewed forward rollback/redeploy procedures; do not delete
canonical Watch History, room, or invite data or remove the additive compatibility
database boundaries as part of this handoff.

Task 8 controller verification at runtime base `3a442b7` passed workspace check
6/6, forced workspace tests 6/6 (including 98 extension files and 1,277/1,277
extension tests), API runtime 24/24, database reset, pgTAP 8 files/419, clean
database lint, linked dry-run remote alignment, rooms 39/39, isolated P2P 26/26,
Worker staging smoke, staging extension build/validation, `pnpm dev:check`, and
whitespace. Its first P2P run met an environmental inspector port `9229`
collision; the isolated 26/26 rerun is the recorded result. All post-merge
workflows and staging smokes are green. The accepted artifact is exactly
`3a442b7-staging-20260822162838`; both established unpacked folders are
byte-identical at that version, and the user accepted Watch History, room source,
and invite host `Accepted` behavior in the two-profile staging flow.

Graphify's pre-finish health pass at `f5622c7c` recorded 9,943 nodes, 21,002
edges, 1,120 communities, and zero missing endpoints, dangling links, self-loops,
or duplicate/collapsed edges; query/explain found the handoff. It retains 550
legacy/external-reference placeholder nodes without labels/source files, matching
the prior graph's 1,100 field warnings. The Graphify artifacts included in the
final evidence PR are refreshed from these completed docs; their
`built_at_commit` records the immediately preceding docs commit, while the PR
diff is the full freshness boundary.

## Account Read Contracts And Popup Isolation

Account read responses for friends, groups, invites, and watch-library data use
shared versioned protocol schemas. Their metadata identifies the schema version,
server generation time, and authenticated account owner so extension clients can
reject malformed, incompatible, or cross-account responses before rendering or
caching them.

The Popup treats the active extension session as the owner of all account data.
Social, inbox, and watch snapshots are cached per account, visible state is
cleared immediately on account change or sign-out, and generation gates prevent
late requests, seen acknowledgements, poster hydration, social actions, and
history operations from writing into a newer account session. Popup snapshot I/O
does not claim ownership of the content script's active playback progress.

The lifecycle v2 inbox migration is applied on staging and in the technical
production baseline. Both the Popup Inbox and `/account/invites` use the same
owner-bound `/api/account/inbox` authority, including server counts, seen state,
missed room invites, and cursor pagination in the full web surface. Task 7's
two-profile loaded-artifact acceptance is recorded above; authenticated
production acceptance is not claimed.

## Invitation Notification Direction

Durable room-invite and inbox rows remain authoritative. The authenticated HTTP
inbox, account-scoped Popup cache, unseen badge, seen acknowledgement, and
shared web incoming surface are deployed. Standards-based Web Push delivery and
OS notifications for room invites and incoming friend requests are implemented.
On 2026-09-04 the user reported that the staging invitation flow worked after
testing; exact delivery latency and the complete failure/recovery matrix were
not recorded. The extension release manifest grants the
notification permission up front so the default-on local preference can
register a push device automatically after sign-in; the existing local toggle
still disables and revokes that browser's subscription. The
additive `devices` Web Push migration is already applied and verified on the
staging Supabase project and is present in the technical production baseline.
Broader two-account notification acceptance remains pending, and no public
extension is distributed.
Web Push sends only an `inbox_changed` invalidation so the extension runs the
same inbox sync and displays minimal English invitation notifications derived
locally from validated room-invite and friend-request items. There
is no frequent background inbox polling, Chrome GCM, Supabase Realtime
subscription, persistent notification WebSocket, or separate notification
event platform.

Recovery uses reconciliation on push receipt, Chrome startup, account/session
change, popup open, and successful invite mutation, plus one daily maintenance
alarm for long-running browser sessions. Invite actionability follows the room
lifecycle; unresolved invites become a non-actionable `Missed` presentation for
24 hours after room end. The canonical product and implementation details live
in
`docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md`.

The 2026-09-04 reliability candidate on
`codex/invite-notification-delivery` removes redundant identity requests from
inbox reconciliation, isolates
subscription registration from visible inbox updates, persists bounded
account-owned recovery, and updates an already open Popup from the canonical
cache. Server delivery uses an additive transactional account outbox with
targeted immediate processing, revision-fenced leases and bounded retries.
Staging now uses one Supabase Cron + pg_net recovery timer, with a private
disabled-by-default migration and an explicitly activated staging configuration.
The dedicated drain-only key has no room authority. On 2026-09-04, automatic
cron runs processed both due and future-deadline no-device fixtures through the
deployed web drain, with exact HTTP acknowledgements and outbox completion;
pre-deadline ticks issued no extra HTTP request. The previous staging Cloudflare
schedule is disabled. Production remains unchanged. The existing immediate
sender and outbox are unchanged, and no room Durable Object or lifecycle is
involved. The subsequent positive user smoke result does not establish exact
two-account notification timing or the full acceptance matrix. Those remain
separate from this server recovery proof, tracked in
`docs/superpowers/plans/2026-09-04-invitation-delivery-reliability.md`.

The current Chrome-only delivery slice accepts only HTTPS subscriptions on
Chrome's FCM push host, caps active push-enabled extension installations at five
per account, and uses bounded delivery concurrency with a network timeout.
Permanent failures are pruned without exposing push endpoints or raw provider
responses to clients. Supporting another browser requires an explicit provider
allowlist addition and staging proof rather than accepting arbitrary push URLs.

Room invite creation now uses the service-role-only
`create_room_invite_atomic` Postgres RPC. Room validation, accepted-friend or
group recipient resolution, invite creation, and recipient-snapshot creation
commit in one transaction. A sender-scoped action ledger makes the extension's
stable `clientActionId` retryable, caps new actions at 20 per minute, and keeps
the request payload bound to that identifier. Requests are capped at 100
resolved recipients. Repeated direct/group targeting for the same room and
recipient returns existing state, including declined or expired state, and does
not schedule another push invalidation. The migration is additive: historical
invite rows remain readable and are not destructively rewritten.

The host invite panel reloads canonical sent invites when opened and keeps each
target labeled `Pending`, `Accepted`, or `Invited`. The create response exposes
whether a new recipient snapshot was created, allowing the UI to distinguish a
real send from an idempotent or semantic duplicate.

The schema still assigns `expires_at` with a 12-hour default, but the deployed
v2 inbox and action RPCs do not use it as a product deadline. They retain the
field and old functions for rollback compatibility: a pending invite remains
actionable while its room is active, then reconciles once to non-actionable
`Missed` for 24 hours after room end. Removing the compatibility column or old
functions is separate future cleanup, not part of this handoff.

## Runtime Environments

Local development:

```txt
Web: http://localhost:3003
API: http://127.0.0.1:8787
WS:  ws://127.0.0.1:8787
```

Staging:

```txt
Web: https://staging.anidachi.app
API: https://anidachi-api-staging.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

`staging.anidachi.app` is an internal tester surface. It must stay
password-gated, noindex, excluded from the sitemap, and absent from production
SEO/marketing pages. It may appear in internal env vars, OAuth callback
allowlists, staging extension builds, and internal docs.

Production:

```txt
Web: https://www.anidachi.app
API: https://anidachi-api-production.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-production.vladislav-gul7.workers.dev
```

The custom Cloudflare Worker domain should eventually hide the account subdomain,
but the current Worker URLs above are the active endpoints.

Worker release guardrails:

- `deploy-api` validates the release ref and may run only from `staging` or
  `main`.
- Worker deploys run a Wrangler dry-run before the real deploy.
- Staging Worker smoke can be run with `pnpm smoke:worker:staging`.
- Staging and production Worker names must stay distinct.

Normal deploy path is PR merge. Manual workflow dispatch is for retries or
emergencies only; release workflows must not be manually dispatched from feature
branches.

## Extension Channels

`local`:

- Extension name: `Anidachi Local MVP`
- Stable unpacked ID: `nkinhhgigcflmfhilmcakbkongcpkfnl`
- Built for local development and broad site experiments
- May use broad permissions locally

`staging`:

- Extension name: `Anidachi Staging`
- Stable unpacked ID: `ndkfphbchhfephdodcpehdcoclojagje`
- Built as a repository-controlled tester artifact; no store item is required
- Uses staging web/API endpoints
- Uses narrow release permissions for YouTube, Crunchyroll, Anidachi web, and
  staging Worker hosts

`production`:

- Extension name: `Anidachi`
- Has no approved identity or manifest key in the current pre-release phase
- Web connection therefore fails closed until an explicit production cutover
- Uses production web/API endpoints
- Uses narrow release permissions for YouTube, Crunchyroll, Anidachi web, and
  production Worker hosts

Build commands:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
pnpm build:extension:staging:local-broad
WXT_VAPID_PUBLIC_KEY="<production-public-key>" pnpm build:extension:public
pnpm validate:extension:production
```

The default staging build is release-safe and uses narrow permissions. The broad
staging build is an explicit local-only command for development experiments and
writes to `anidachi-extension-staging-local-broad`, never to the narrow staging
candidate. The same source code produces every channel build. The
channel-specific behavior is selected through build environment variables in
the build scripts.

## Last Recorded Legacy Staging Artifact

The last staging artifact explicitly recorded in this document was generated
from commit `50c80a0`:

```txt
<repo>/anidachi-extension-staging.zip
<repo>/artifacts/anidachi-extension-staging-50c80a0.zip
```

Manifest checks:

```txt
name: Anidachi Staging
version_name: 50c80a0-staging-20260730171210
```

For new testing, prefer the latest `Build Extension` artifact from the
`staging` branch unless a PR records a more specific artifact.

## Current Product Behavior

The extension currently supports:

- YouTube and Crunchyroll content-script overlay;
- an ordered source-adapter registry with shared HTML5 core behavior and
  isolated Generic, YouTube, and Crunchyroll provider modules. This extraction
  preserves the existing winner-first behavior. YouTube overlay mounting is
  restricted to full watch pages so feeds, previews, Shorts, and embeds remain
  untouched;
- deterministic adapter replacement and suspension without recreating the room
  session. Provider geometry subscriptions are disposed before replacement,
  and stale callbacks from the previous player are ignored;
- independent YouTube and Crunchyroll player-chrome geometry. Shared overlay
  layout consumes only normalized safe insets and anchors from the active
  adapter;
- first-class provider-pinned room sources. YouTube and Crunchyroll rooms can
  switch only within their own provider, and the Room Worker rejects conflicting
  provider updates;
- YouTube finite-VOD synchronization with fail-closed transition detection,
  local advertisement isolation, 500 ms host-buffering debounce, authoritative
  playback rate, and explicit user-gesture recovery after autoplay blocking.
  Real-ad and two-profile staging acceptance remain required before PR #148 can
  leave draft;
- a compact room panel with an edge-intent launcher: while the panel is closed,
  the top pill stays hidden until a deliberate top-right hover reveals it; the
  open panel pins the pill in place as its close control;
- an `Interface` settings section with immediately applied, profile-local
  visibility preferences stored under `local:interfacePreferencesV1`. The main
  control can retain its edge-intent auto-hide behavior or remain visible.
  An open panel and keyboard focus continue to pin it regardless of the
  selected preference. Microphone mode, publication, and speaking activity do
  not change the main control's visibility or add a microphone badge there;
  voice indicators remain on participant pills and video bubbles;
- an active-room-only side voice rail with `Smart` and `Always visible` modes.
  Smart preserves quiet-hide, speaking-compact, and deliberate edge expansion.
  Always visible keeps eligible no-video participants compact and expands only
  the hovered, focused, or actively adjusted participant. Mounted video
  participants are still excluded, the current user never receives listener
  controls, and remote volume/mute remains local to the listener;
- sign-in through the web app with Google/Discord;
- room creation and invite copying through the website/API/Worker flow;
- WebSocket room join and playback sync;
- reactions and live chat input backed by one dependency-free Unicode emoji
  catalog. The composer picker is scrollable, and while the composer is open
  global quick-reaction shortcuts are suspended so digits remain normal message
  input even inside the extension's closed Shadow DOM. The quick-reactions
  enabled state and shortcut assignments are local preferences and survive
  supported-site navigation;
- Ghost Cam camera bubbles. They continue to adapt to provider player controls,
  but pointer approach temporarily pins the active safe insets so a bubble does
  not move away during volume interaction. The travel corridor is observed
  passively rather than rendered as a pointer-catching layer, leaving native
  player controls outside the visible bubbles clickable;
- an account-scoped `Room` settings section controls only the next newly
  confirmed room. Microphone startup can use the last explicit mode, Push to
  talk, or Open mic; camera startup can use the last explicit choice, Off, or
  On. The defaults apply immediately to later create/join operations without an
  Apply button, but never mutate an already active room. Camera remains Off by
  default. Same-room network reconnect and same-tab YouTube/Crunchyroll page
  navigation preserve the active room's explicit media intent. Leaving or
  ending the room, signing out, switching account, tab close, and browser
  restart still stop current capture. Restored Open mic or camera-on intent can
  start publication only after exact room/account validation, an authoritative
  media seat, and P2P readiness. Automatic safety resets do not overwrite the
  account's last explicit camera or microphone choice;
- one extension-local Overlay Layout Engine V2 now drives both the live camera/chat
  geometry and the Layout editor. It stores only grid intent under
  `local:overlayLayoutPreferencesV2`, previews one camera leader plus three
  followers, derives chat height from typography and message count, adapts to
  player controls and reserved AniDachi UI without rewriting saved preferences,
  keeps the full four-seat camera geometry reserved while rendering only
  occupied camera slots,
  previews editor drafts against the same measured runtime context in both the
  miniature and a pointer-transparent live ghost layer, starts drag from the
  resolver's actually displayed logical placement, supports bottom-edge chat
  alignment, clears ghosts after Apply, keeps real chat/cameras below the open
  settings panel, and persists changes only after an explicit successful
  `Apply`;
- one microphone publication lifecycle shared by `V`-only Push to talk and
  explicit Open mic. Selecting Open mic starts continuous publication only
  after the exact room session, listener, media seat, snapshot, and P2P
  controller are ready. The active mode is stored per sender tab in
  extension-owned session storage and survives same-room source changes and a
  tab reload. The last mode explicitly selected by the user is also stored as a
  separate account-scoped local preference. A new room resolves the `Room`
  startup setting against that last explicit choice; missing, malformed, or
  another account's data falls back to Last used and then Push to talk. A
  pre-snapshot media-seat gap pauses publication without erasing current intent;
  an authoritative seat revoke or terminal microphone failure stops capture and
  normalizes only the current room back to Push to talk without overwriting the
  user's preference. Leave/end, sign-out, account change, tab close, and browser
  restart stop current capture; a later explicit create/join applies the saved
  preference only after all room and media-readiness gates pass;
- local and remote speaking indicators are measured independently from
  transport flow: quiet Open mic remains published without appearing to speak
  or triggering audio-stall recovery, while sender/receiver audio levels drive
  the green treatment and a local-track RMS fallback covers the period before
  a sender exists. Push to talk is the deliberate exception: local and remote
  indicators activate immediately while `V` is held and clear on release;
- per-listener participant audio mix controls: each remote media-seat
  participant can be muted or adjusted locally from the side voice pill or the
  matching video-bubble contour. Preferences are versioned, validated,
  account-scoped, applied before remote playback, and survive camera/track
  replacement without changing the remote microphone or RTP flow;
- camera and microphone publication are independent. Camera off/on does not
  stop Open mic, microphone stop does not remove healthy video, and rapid
  answerer-side camera transitions coalesce their required renegotiation instead
  of dropping the latest direction change;
- live P2P voice does not duck Crunchyroll or YouTube player volume. Dictate
  reactions and their speech-recognition/player-ducking runtime have been
  removed;
- WebRTC P2P media with Cloudflare TURN fallback;
- no active LiveKit/SFU media path: the legacy extension transport, Worker
  `/livekit/token` route, local `infra/livekit` helper, and `livekit-client`
  dependency have been removed;
- local extension ICE fallback now includes Cloudflare STUN
  (`stun.cloudflare.com:3478`) before Google STUN, so the
  unauthenticated/no-room-token path no longer depends on Google-only STUN.
  `stun.cloudflare.com:53` was removed after real logs showed repeated Chrome
  701 timeouts on that candidate;
- P2P peer connections use `iceCandidatePoolSize: 2` with normal
  `iceTransportPolicy: "all"` outside explicit relay diagnostics, and the
  selected candidate pair is logged as compact direct-vs-relay telemetry without
  candidate strings, IPs, URLs, or participant ids;
- `/ice-servers` relay readiness diagnostics: Worker responses expose safe
  STUN/TURN URL counts plus `hasTurn`/`hasTurns443`, and configured Cloudflare
  TURN responses fail closed if they collapse to STUN-only after browser-blocked
  TURN URLs are filtered;
- Cloudflare TURN credential resilience: configured Workers keep a hot
  module-level cache of the last valid short-lived Cloudflare ICE payload.
  Fresh cached credentials are served without refetching, and a still-valid
  cached relay payload is served if Cloudflare's credential API is temporarily
  unavailable. Authenticated extension media setup no longer silently replaces a
  failed relay fetch with STUN-only defaults unless a build-time fallback also
  contains TURN;
- debug SDP summaries now record negotiated codec/FEC/RTX signals so Teleparty-
  style production A/V choices can be compared against actual AniDachi browser
  behavior before changing topology;
- WebRTC codec preferences are now applied before offer/answer creation:
  audio prefers browser-supported RED first, then Opus fallback; video keeps
  lightweight broadly-supported codecs first while preserving RTX/FEC entries
  when the browser exposes them. Local offer/answer SDP is then narrowly
  normalized for the negotiated audio/Opus payload so `useinbandfec=1` and
  `usedtx=1` are present for lower-bandwidth push-to-talk and ambient silence;
- stats-backed remote voice activity: inbound WebRTC audio bytes/packets/level
  can confirm or clear active-speaker state while a remote peer is expected to
  be talking after `voice-start`; after `voice-stop`, residual RTP/DTX movement
  cannot relight the mic badge by itself;
- Push to talk activity follows the held control on both sides: `voice-start`
  carries the active microphone mode, so local and remote PTT indicators appear
  immediately on key-down and clear on `voice-stop`; Open mic indicators remain
  tied to measured speech;
- push-to-talk audio is no longer coupled to camera visibility: voice-only room
  participants can enter or remain in the P2P media mesh without requiring
  `cameraEnabled`, so turning a camera off does not tear down the peer connection
  that carries audio;
- automatic remote-audio stall recovery: while remote voice is expected,
  connected inbound audio with missing or stalled packet/byte flow is
  classified from WebRTC stats and triggers throttled ICE recovery without a
  user-facing reconnect button;
- proactive P2P ICE recovery on browser `online` and Network Information
  `change` signals, covered by the real-WebRTC short network-loss harness;
- automatic remote-video stall recovery: expected connected remote video is
  checked through inbound WebRTC stats; when `framesDecoded` is available it is
  the authoritative health signal, with `bytesReceived` used only as a fallback
  for browsers that omit decoded-frame counters. Missing or stalled decoded
  frame flow triggers throttled ICE recovery without a manual reconnect button;
- P2P signaling replay fenced by current room/source generation;
- controller-level duplicate SDP/ICE protection in the extension media engine:
  exact repeated `offer`/`answer` SDP and ICE candidates are fingerprinted and
  dropped before being applied, while voice/control signals remain live;
- live `SOURCE_CHANGED` handling: the Worker increments `sourceGeneration` on
  host source changes and the extension resets stale P2P queues;
- Cloudflare Durable Object WebSocket Hibernation core for room sockets:
  versioned socket attachments, constructor rebuild from `getWebSockets()`,
  SQLite-backed room snapshot and P2P replay/sequence state, raw `ping`/`pong`
  auto-response keepalive, JSON `PING` compatibility for old clients, and a
  Workers-runtime forced wake test for existing sockets, host state/source
  snapshots, camera state, raw keepalive, and P2P replay;
- on the current room/P2P hardening branch, Free-room usage is now accumulated
  in one SQLite-backed Durable Object record only while a live host and guest
  are joined. `ROOM_SNAPSHOT` carries the cumulative value for reconnect-safe
  countdown display. Worker waits for the existing internal Web callback to
  acknowledge one service-role-only RPC that atomically applies usage and ends
  the room before it persists the terminal tombstone. The additive staging
  migration, shared callback secret, matching Web deployment, and matching
  Worker deployment were rolled out in that order on 2026-07-13. Automated CI,
  room/P2P E2E, Web smoke, and Worker smoke passed; real two-client acceptance
  remains required before promotion. The first manual host-end check exposed a
  missing Vercel `ANIDACHI_API_INTERNAL_BASE_URL` and correctly failed closed
  with `502`; the staging URL was configured, Web was redeployed, and a real
  staging room then transitioned from `live` to persisted `ended` state;
- debug export from the extension panel. Routine page/content diagnostics are
  bounded in memory and sanitized: titles, user text, identifiers, tokens, and
  attestations are absent, while the explicit support export remains available.
  The overlay uses a closed shadow root. Account-only sign-out requires a trusted
  UI event and is bound to the exact validated extension account and refresh-token
  family; it does not use room authority. Manual room end requires a trusted UI
  event, while manual and quota room end use per-tab authority issued by the
  background from authenticated create/connect, with a persistent, non-reused
  session generation and exact current account, room, host role, and generation
  checks before the server's final authorization. Playback and Watch History
  behavior are unaffected.

The extension still does not host, proxy, record, or distribute source video.

## Single Active Room Session Foundation

The single-active-room invariant was accepted on `staging` and promoted to the
technical `main`/production baseline on 2026-08-23. PR #231 merged to `staging`
as `f511b4dcb805e8959412213e00a2499f12f2b8be` after the additive migration
`20260823090624_single_active_room_sessions.sql` was applied there. Supabase now
owns one server-only active-room assignment per authenticated user, while the
existing room Durable Object remains responsible for live presence, same-room
takeover, disconnect grace, and room termination. No new service, heartbeat,
queue, env variable, secret, TURN, Blob, Stripe, or release path was added.

The accepted baseline behavior is:

- one authenticated user can have only one live room across YouTube,
  Crunchyroll, tabs, browser profiles, and devices;
- a second different room fails with `ACTIVE_ROOM_CONFLICT`, while an explicit
  same-room open may take over from the older session;
- closing the active host tab ends the room, while closing a guest tab removes
  only that guest;
- reload, Back/Forward Cache restore, and a brief offline interval preserve the
  same tab session within the 60-second grace period;
- a stale superseded tab cannot release the winner, and a fresh normal provider
  tab does not silently restore a closed room;
- room finalization releases matching durable assignments idempotently.

The current feature branch additionally implements the following behavior,
which is locally verified but still pending staging and two-profile manual
acceptance:

- 2026-09-01 MVP lifecycle correction: a real browser-tab close is again an
  explicit exit. Before the bounded request, the background persists a settled
  exact-departure job for the closing room/user/participant session. Terminal
  acknowledgements retire that job; timeout, transport, MV3, and temporary
  authorization failures retain it for Chrome-alarm/startup/online retry before
  only the matching tab-local record is cleared. Reload, BFCache, sleep, and
  temporary network/WebSocket interruption retain the Worker's existing
  60-second reconnect grace, and socket disappearance plus the signed callback
  remain the independent fallback. The current extension no longer keeps a
  local post-close recovery card or exposes a broad Leave/End-active-room
  action from a conflict notice. When `acquireRoomTabLock()` can acquire a
  working Web Lock, a same-browser room tab is shown as already open. If Web
  Locks are unavailable or fail, the client proceeds and the server-owned
  active-room assignment remains the authority across tabs, profiles, and
  devices. An
  explicit Create-room conflict is informational and mutation-free: the
  extension performs no hidden departure, no retry, and no replacement of the
  current host or guest session. The atomic database RPC rejects a guest's
  attempted host-room creation without changing the guest assignment or
  creating an orphan room. Returning to a deliberately left room still uses an
  invitation.
  Chrome extension reload/update is also no longer exposed as a one-minute
  active-room conflict: because Chrome clears `chrome.storage.session` during
  that lifecycle, the provider tab now retains only a non-authoritative
  `roomId` and opaque account scope in page `sessionStorage`. The restarted
  extension accepts the hint only for the same authenticated account, mints a
  fresh trusted participant session with camera Off and Push to talk, then
  performs the existing same-room takeover immediately. User ID, participant
  session, and room authority are never stored in the page; mismatched or
  malformed hints are discarded, and explicit leave/end/terminal cleanup
  removes the hint. The 60-second Worker grace stays reserved for real
  transport interruption rather than becoming a UI wait. Local proof:
  extension check and 1515/1515 tests; Web 386 passed/3 skipped;
  API check, 166/166 unit tests, and 37/37 runtime tests; room harness 39/39;
  and real-WebRTC harness 26/26. A focused SQL regression was added for guest
  create conflict, unchanged assignment, and no orphan room; local Supabase
  execution is pending because the Docker runtime was unavailable. The staging
  artifact `e3345f3-staging-20260901162121` was rebuilt, validated, and
  synchronized byte-for-byte to both approved unpacked test folders (manifest
  SHA-256 `3b63d2558000e3fab2d4890c1d490165296c85b22e946c74471db1d3ad657823`).
  Loaded two-profile
  close/reload/invite/create-conflict acceptance is still pending.

- explicit guest departure atomically releases the authenticated user's exact
  Supabase active-room assignment before sending bounded live Worker cleanup;
  detach success, stale responses, timeouts, and transport failures never
  turn a durable leave into an error. The Worker-owned 60-second passive alarm
  callback is retained for unexpected disconnects, while real tab close first
  persists exact retry ownership and then uses the bounded durable-departure
  request with Fetch keepalive before local cleanup;
- normal extension leave uses only the exact-departure contract and treats
  public `stale` as the legacy-compatible no-assignment success. The shared
  protocol and current extension still accept `already_departed` for forward
  compatibility, but current public Web routes do not emit it. Normal leave
  never invokes active-room recovery automatically. The server recovery route
  remains compatible with older artifacts, but the current extension does not
  expose a broad role-specific Leave/End action from a conflict notice;
- every new prepared room operation receives a fresh server-visible
  `participantSessionId`, including a new same-room/account/tab attempt, while
  confirmed camera and microphone preferences are preserved separately. Before
  each connect fetch, the background also persists a fresh exact `may-commit`
  generation.
  Matching passive/explicit cancellation marks only that generation
  cleanup-owned and duplicate signals coalesce, so older completion, alarm,
  exact departure, and local-clear paths cannot touch a newer participant
  session. HTTP/token success moves the job to `handoff-pending`; it retires
  only after the same tab/room/user/session/generation receives its first
  authoritative `ROOM_SNAPSHOT` over the joined room WebSocket. Closing before
  that acknowledgement claims and exact-cleans the job, while an MV3 restart
  waits out a separate 60-second handoff bound (45-second socket liveness,
  maximum 8-second reconnect delay, and a 7-second scheduler margin) before
  cleanup. Snapshot acknowledgement starts before history/event/transport
  consumers run and is retried after a transient reject or negative response
  with exponential 250ms-to-4s backoff while that exact socket remains current;
  success stops the loop, and close or replacement cancels it. Failure or
  ambiguity retains the observing job. Persisted data
  contains only stable room/user/session identity, the non-secret generation
  watermark, and bounded timing metadata. A pre-admission job remains
  `may-commit` across Manifest V3 restart, so pre-settlement `stale` cannot erase
  it. Generic drains pre-arm a replacement one-shot alarm before auth/network
  awaits. A canceled live completion marks only its current generation settled
  and drains immediately; an orphaned worker uses the client's 60-second abort
  through response-body parsing, the connect route's 60-second maximum, and a
  15-second margin from admission begin before terminal stale is safe. It waits
  for matching auth without a perpetual alarm loop, has no cleanup TTL, and
  cannot clear a replacement session. After snapshot acknowledgement, real tab
  close attempts exact durable departure; only an unexpected socket or network
  interruption relies on the Worker's retained 60-second grace;
- the staging gate allows authenticated internal `POST /api/internal/**`
  callbacks to reach their own service-secret authorization while retaining the
  human gate for all other staging requests.

Fresh local verification for the feature branch on 2026-08-31 includes protocol
check and 141/141 tests; API check, 166/166 tests, and 37/37 runtime tests; Web
check and 385 passed/3 skipped tests; extension check and 1507/1507 tests; room
harness 39/39; real-WebRTC harness 26/26; root check/test (6 Turbo tasks each);
the rooms-profile `dev:check` command (exit 0); and staging extension build plus
artifact validation. Generated staging folders and ZIPs remain ignored. This is
code and harness evidence, not staging or two-profile acceptance. Two-profile
YouTube/Crunchyroll acceptance remains pending until this candidate is deployed
and manually exercised.

Evidence for the original accepted baseline includes successful migration runs
`32637163596` and `32637269784`, CI `32637269772`, API deployment `32637269793`, extension build
`32637269796`, Vercel deployment `dpl_D9iXtfYyux52dRp46wucA8VKcM86`, Worker
smoke, and exact artifact
`f511b4dcb805e8959412213e00a2499f12f2b8be-staging-125` with SHA-256
`58a5b07f08bbef7031205244959f536087791a2245887bcd8f63d2dd7442fb8b` loaded
in both established test profiles. Manual two-profile acceptance confirmed the
host/guest conflict paths, pause/seek/rate sync, reload, brief offline recovery,
guest and host tab-close semantics, same-room takeover, stale-close safety,
old-link behavior, popup cleanup, and Crunchyroll Watch History continuity.
YouTube Watch History was intentionally disabled during that last history check
and is not claimed by this observation.

Production promotion preserved the database-first boundary. Migration PR #234
merged as `d971f17e15bccfb02c13849cb9d5ed745d86d974` and applied
`20260823090624_single_active_room_sessions.sql` plus the forward-only input
validation migration `20260823132355_single_active_room_input_validation.sql`.
Fresh runtime PR #236 then merged the exact frozen `staging` tree
`c935cc2a8e5f99a3260b66d855f6279e9a7cfde3` as final `main` SHA
`6f8b90256a06b73cc2cf912f151cbbf9ebafd0a7`, with an empty migration diff.
Production CI `32644176866`, migration no-op `32644176860`, Worker deployment
`32644176861`, and private extension build `32644176856` succeeded. Vercel
deployment `dpl_DmwVzrNwX2pfSFRo9x7dXT4RQY8V` is Ready on that exact SHA, the
production Worker smoke passed on version
`c2cc7ccb-041b-4e51-be2f-0a2593796f67`, and the production extension artifact
validated as `6f8b90256a06b73cc2cf912f151cbbf9ebafd0a7-production-126` with ZIP SHA-256
`cd23fdc295fbab396e94c262e56d7e06a14b0e4365b2cec31d74ba540ebf3972`.

This is a technical production baseline, not a public launch or authenticated
production acceptance claim. The Chrome Web Store was not accessed, the
production extension artifact remains private and unpublished, and production
extension authentication remains fail-closed until a public identity is
approved. The promotion does not replace the still required real TURN-relay
and two-network P2P evidence. Explicit tab close is immediate; a browser crash
or long offline interval relies on the 60-second fallback. Conflict wording and
other visual polish remain normal UI/UX work.

## Watch History v3 Staging Activation

The separately authorized 2026-09-05 staging transition is complete: schema
prerequisite PR #265 (`9328428e`) applied both reviewed migrations before runtime
PR #264 (`56dbd901`). The matching website is READY on `staging.anidachi.app`.
The exact CI extension `56dbd901...-staging-139` was validated and synchronized
byte-for-byte to both established tester folders, with old artifacts backed up.
Authenticated Crunchyroll and loaded-extension acceptance remain open; folder
synchronization is not proof of browser reload. Technical `main` remains at
`54a154b7` with Watch History v2 and was not promoted. Deployment evidence, scoped
reset counts and preservation checks are in `docs/watch-history-v3-staging-verification.md`.

Schema 3 keeps Supabase/Postgres as the only durable authority and stores one
progress row per logical provider episode. The latest actual raw watch/audio
variant remains resume metadata. Bounded catalog snapshots and raw aliases provide
canonical identity, current regional availability, localized provider labels, and
server-owned exact title/season aggregates. Partial, missing, changing-region, or
overflowed evidence suppresses exact totals; a failed same-region locale refresh
keeps the last committed exact bundle.

The clean-start transition resets only reviewed Watch History data, advances the
history generation, and makes old v2 SQL/HTTP writers terminal. Accounts, auth,
subscriptions, rooms/memberships, social/invite/Recent People data, interface/media
settings, YouTube history consent, and monotonic server order are preserved. The
extension clears old history cache/outbox/current observations and migrates only a
validated owner-bound YouTube preference state; unrelated extension settings are
not cleared.

Final review fixes bind website mutation intent to the rendered owner before any
write, retain omitted historical seasons with honest current 0/0 metadata, and
retry interrupted legacy-storage cleanup without overwriting v3 consent/progress.
The forward read fix is migration `20260905083000`; applied migration files remain
unchanged. Dedicated local proof now includes the 39-migration chain, 13 pgTAP files /
654 assertions, a populated transition with three blocked already-entered v2 calls,
five actual RPC pages, 13 catalog list/detail states, the 2,000-episode bounded
benchmark, web/extension checks and suites, and 17 website TSX tests. Final
controller gates at product commit `4d7f395` pass root check/test (six tasks each;
four unchanged tasks cached), a fresh 41-test API runtime run, staging artifact
build/validation, and real-component headless Popup 6 / website 7 cases. The scoped
final re-review closes all three findings with no new breakage; this is local code
approval, not deployment acceptance. Exact commands, measurements, guard
requirements, lint notices, the earlier local-port-54322 harness incident, activation
order, rollback constraint, and open authenticated-provider/staging gates are in
`docs/watch-history-v3-local-verification.md`.

### Watch Drawer Follow-up (2026-09-05)

Branch `codex/watch-drawer-refresh` adds two reviewed checkpoints after the
staging activation above: `dd5c2a9` stabilizes history refresh and presentation;
`7474001` restores canonical Crunchyroll series covers and consistent image-error
fallbacks in Popup and website. The user subsequently authorized publication via
the feature PR into `staging`, without promotion to `main` or production. The
staging PR records the exact merge, CI, Vercel deployment and smoke-test receipt;
the local verification below is not itself evidence of a successful deployment.

Concurrent owner-bound refreshes share work, superseded reads are not reported as
network failures, and automatic recovery only clears a read warning after a
successful canonical response. Submitted actions survive same-owner focus reads
while account, generation and deletion fences remain enforced. Open-drawer title
positions, episode ordering, disclosure defaults and confirmed completion remain
stable across playback checkpoints; completion does not change row geometry.

Series artwork is optional enrichment of the existing progress event: use the
matching series object and captured provider locale, validate the URL, and bound
the optional request to 2.5 seconds. Failure preserves resolved progress and any
existing observation artwork. Image failures keep a fixed-size placeholder, with
another image attempt when the URL changes; the website also handles failure
before hydration. No SQL schema, server API, room/P2P or consent change is included.

Fresh local closeout proof: root test/check completed all 11 Turbo tasks without
cache reuse (protocol 145, API 201, extension 1,680, web 431 passed with four explicit
opt-in skips), plus all 19 website component tests. Isolated real-component browser
checks cover completion/pending-ack cycles, order/disclosure/scroll stability,
reduced motion, real CDN covers, broken-image recovery and narrow website layout.
Review found no Critical/Important issues; an additional deferred in-flight
subscription follow-up test remains a nonblocking coverage improvement.
The narrow staging-channel build and artifact validation are local checks; the
existing dynamic-import bundler warnings remain nonblocking. Generated artifacts
and browser fixtures are not committed. This closeout does not resynchronize the
two established tester folders or reload a browser. The user reported basic
tracking, presentation and cover loading working; this does not close the full
authenticated catalog/locale acceptance matrix recorded in the active v3 plan.

Rollback these follow-ups through a reviewed revert of their feature commits and
the previous staging artifact; no database rollback is required. Continue design
work from this checkpoint. Production promotion still needs separate authorization
and the applicable staging acceptance gates.

### Watch Drawer Browse Local Candidate (2026-09-05)

Branch `codex/watch-history-browse` retains the extension/UI candidate at
`bf260d7e858bbd721820a2c7a4ee5532ac924542`. The final server review found an
episode-label search gap; its server-only fix is
`a92dbdc6bf631af775742014246b1fb97f151e84`, with fresh guarded SQL/RPC evidence.
Scoped re-review and final controller integration approval remain pending. This is
not a staging deployment. Staging still reflects PR `#267` at `f2fafb29`; technical
`main` remains at `54a154b7` with Watch History v2. No remote migration, Web
deployment, extension synchronization, browser reload, push, PR, merge, or
production change is claimed.

The database remains the durable authority. Canonical personal progress and
title/season aggregates do not change under search or filters. New bounded reads
filter eligible history before pagination by Mine/Together, search, local-day UTC
bounds, participant, and owner-private My groups provenance. A group association
requires authenticated invitation context plus actual overlapping owner/recipient
observations in the same verified room generation. It is not a second group
progress record, does not grant members history access, and is never inferred from
current membership, names, links, or invitation acceptance alone. Old ambiguous
sessions remain ordinary Together history without backfill.

The extension keeps browse responses out of the canonical account cache and binds
each request and cursor to the rendered owner, history generation, complete query,
scope, and local invalidation revision. The drawer removes destructive controls,
keeps website history management, moves the existing YouTube choice to History
settings, and preserves its account and optimistic-rollback fences. No room event,
Worker, media, capture, auth, notification, catalog traversal, polling, service, or
consent-policy boundary changed.

The approved specification, implementation plan, and exact local evidence are:

- `docs/superpowers/specs/2026-09-05-watch-drawer-browse-design.md`
- `docs/superpowers/plans/2026-09-05-watch-drawer-browse.md`
- `docs/watch-drawer-browse-local-verification.md`

Rollout must remain database-first: apply the additive migration, deploy the
reviewed matching Web runtime, build the matching narrow staging extension, then
perform authenticated staging acceptance with newly organized group viewing and
actual participation. Rollback keeps the additive data and restores the prior v3
Web/extension consumers; restoring the writer entry point, if required, uses a
reviewed forward migration and never drops history. Each rollout or rollback step
requires separate authorization.

## Known Fragile Areas

These are intentionally not treated as solved:

- Overlay Layout Engine V2 still requires loaded staging acceptance at compact,
  720p, 1080p, and fullscreen player sizes. The local engine/component suite
  covers deterministic geometry, draft isolation, persistence failure, pointer
  cancellation, and keyboard rollback, but one/four real-camera rendering and
  reload persistence must still be confirmed in Chrome;
- P2P media reconnect and asymmetric join timing still require staging/manual
  acceptance beyond the local harness. The local harness now waits until both
  peers have received a room snapshot with both cameras enabled before measuring
  TTFM, which removes one false-start class but is not a real-network proof.
- Open mic and participant mix controls have direct-first two-browser coverage
  for silence, late join, signaling reconnect, camera off/on, microphone-only
  stop, Push to talk warm reuse, local mute/volume, and remote track replacement.
  Room-scoped mode persistence has reducer and revision-guarded storage
  coverage. Manual loaded-extension acceptance is still required for reload
  restore timing, media-seat revoke, permission denial, account switching,
  overlay/source replacement, four-seat load, and real speaker output on two
  devices.
- Interface visibility preferences have unit, component, full-repository,
  room-harness, and direct-first WebRTC coverage, and the staging artifact is
  validated. Loaded-extension visual acceptance is still required on YouTube
  and Crunchyroll across normal, theater, and fullscreen modes before the
  branch is ready for its PR.
- The local real-WebRTC harness usually selects same-machine `host/host`
  candidate pairs. Relay-only TURN harness mode exists and can use either
  explicit short-lived ICE JSON or the real Worker `/ice-servers` path, but a
  successful Cloudflare TURN relay run (`provider=cloudflare`,
  `configured=true`, `turns:443` present, selected pair is `relay`) plus
  two-network/two-profile staging acceptance are still required before treating
  P2P as proven for users in different networks or countries. The latest
  server/client cache hardening removes one transient Cloudflare API failure
  path, but it is not a substitute for a real relay run.
- A market-readiness claim for video/audio additionally requires a real remote
  participant outside the local network/ISP path, with candidate type, TTFM,
  reconnect, audio, and push-to-talk results recorded. Same-network local tests
  are smoke tests only.
- Hibernation forced-wake behavior and empty-room end alarms have explicit
  Workers-runtime coverage, but staging idle-session/alarm acceptance is still
  pending.
- The simplified Free quota meter is locally covered across presence changes,
  hibernation, repeated end, and atomic rollback-tested Supabase finalization.
  The exact staging migration/Web/Worker rollout and automated smokes passed;
  one normal Free-room lifecycle with two real clients and persisted usage
  verification is still pending. The former global cross-room lease deferral is
  superseded by the accepted server-enforced `active_room_sessions` invariant,
  which limits every authenticated user to one active room independently of
  plan or provider. That invariant does not by itself complete the separate
  persisted Free-usage acceptance.
- Room sources are now strict, provider-pinned, and durably convergent: Web
  creation persists generation 1, the Worker accepts only same-provider
  canonical changes, and its coalesced outbox persists the latest higher
  generation without delaying playback. Reload and late join consume the
  durable source; explicit source-switch UI/commands remain future UI/UX work.
- Watch History v3 is active on `staging`; technical `main` remains on v2.
  Supabase/Postgres is the one durable account-history authority; the extension
  background owns the account-scoped cache/outbox, while Popup and website
  consume the same version-matched response. On staging, authenticated v1/v2 HTTP
  paths return `426 UPGRADE_REQUIRED`; old SQL writers are terminal too. The
  schema-3 reset discards only reviewed test history and preserves surrounding
  product state. An old web deployment alone is not a schema-3 rollback.
- `ROOM_HISTORY_GRACE_AMENDMENT_REQUIRED` is the reviewed Task 9 decision after
  the Task 0 report proved unavailable: Worker-issued shared-history authority
  has mandatory exact scalar claims, a unique `jti`, and `exp = iat + 86,400`
  seconds. New expired authority fails before history/session/participant/Recent
  People mutation, while an exact unexpired 14-day receipt remains idempotent
  after authority expiry. Rejected delayed shared work stays in the extension's
  bounded outbox as `invalid-room-authority` and is never reclassified as solo.
- The additive foundation and Recent People v2 migrations are applied on
  staging through `20260814020000`. A user confirmed the repaired solo
  Crunchyroll -> Popup -> staging website path. The same migrations and exact
  runtime tree are now in the technical production baseline, but this closeout
  does not claim authenticated production, full two-profile/two-network
  acceptance, or two-network/TURN evidence; it is not a production-readiness
  claim.
- The `20260816090000_watch_history_v2_bounded_read.sql` migration was merged
  and applied to staging in ordered prerequisite PR #189 (`6c7e1b1b`); the web
  consumer followed in PR #190 (`847d5e32`). It removes the full-account episode
  aggregation from title pagination with a
  transactionally maintained one-row-per-title v2 projection. A second compact
  projection stores one row per v2 `(user, session)` membership with that
  user's current generation and title key. Its ordering timestamp is canonical
  `watch_sessions.last_checkpoint_at`, the same value returned in the session
  DTO, never participant heartbeat time. Session enrichment reads the latest 20
  through the requester-leading title/order index, then unions each visible
  episode's canonical latest session. Roomless shared tombstones with neither
  `room_id` nor `client_session_key` are excluded and cannot consume a candidate
  slot. Shared session generation stays
  host-owned and is never compared to the viewer's generation. It does not
  truncate observed episode DTO data: a single visible title can still return
  arbitrarily many episode rows.
  Keyset selection uses the projection index before `LIMIT`; normal heartbeat
  writes incrementally advance one summary row, while a delete statement
  recomputes each distinct affected title once.
  An explicit migration transaction first takes a write-conflicting lock on
  settings, then session, participant, and progress sources. This follows both writers'
  settings-first lock order, lets an in-flight writer drain, blocks later
  writers through both v2-only initializers, and prevents a concurrent delete
  from being reinserted by a stale initializer snapshot. A ten-second lock
  timeout rolls the migration back for a safe workflow retry. Maintenance is
  installed before both initial fills. The title fill preserves the maximum
  observation; the locked session fill converges exactly to canonical checkpoint
  and identity state.
  Deep cursors add an indexable timestamp upper bound while retaining the strict
  timestamp/binary-ID predicate. Session enrichment uses the v2 recent-title
  requester/session projection index through a per-visible-title `LATERAL ...
  LIMIT 20`. Participant deletion, including full clear, cascades only that
  user's projection row and leaves another participant's row intact. Session-
  side checkpoint/identity maintenance updates current v2 member projections;
  hard room deletion removes derived rows for the resulting internal tombstone.
  The later additive resource-boundary migration and consumer rollout recorded
  above supersede this old unbounded-row measurement: the active title response
  returns at most eight rows per title with exact counts and continuation, and
  the owner-bound detail response returns at most 50 rows.
- The additive projection/RPC was deployed to staging in a migration-only
  prerequisite PR before the web consumer PR. Production preserved the same
  dependency order through migration-only PR `#227` and runtime PR `#228`.
  Future database/runtime promotions must keep this ordering because database
  and application deploys trigger independently and can expose runtime before
  its RPC.
- The migration-only prerequisite is compatible with the old web runtime, but
  it is not dormant: projection maintenance runs on v2 progress, session, and
  participant writes/deletes. If it must be undone, use the reviewed forward
  cleanup sequence in `docs/release-and-rollback-runbook.md`; never delete or
  rewrite canonical `watch_episode_progress` rows.
- The 2026-08-21 core-foundation-to-UI/UX handoff plan is the accepted staging
  evidence record for the bounded episode-page/receipt lifecycle,
  canonical/durable room source, and room-lifecycle invite semantics. It is not
  authority for authenticated production or market readiness; the separate
  2026-08-22 promotion plan records only the technical `main` baseline. The
  broad 2026-08-18 readiness program and the 2026-08-14 Watch History v2
  foundation plan are historical scope/evidence records; their deferred items
  are not silently treated as complete.
- Custom API domain for hiding the Cloudflare account subdomain is deferred.
- Stripe production webhook appears wired, but end-to-end subscription testing is
  still a separate follow-up.

## Documentation Map

- Project operating manual: `docs/project-operating-manual.md`
- Project architecture and development workflow:
  `docs/project-architecture-and-development.md`
- Current operational state: `docs/current-development-state.md`
- Agent/contributor startup contract: `AGENTS.md`
- Development flow quality plan:
  `docs/superpowers/plans/2026-06-17-development-flow-quality-system-plan.md`
- Active core-foundation-to-UI/UX handoff plan:
  `docs/superpowers/plans/2026-08-21-core-foundation-ui-handoff-plan.md`
- Completed waitlist/CRM durable-storage recovery record:
  `docs/superpowers/plans/2026-08-23-waitlist-crm-durable-storage-recovery.md`
- Environment and secrets matrix: `docs/environment-and-secrets-matrix.md`
- Staging acceptance checklist: `docs/staging-acceptance-checklist.md`
- Release and rollback runbook: `docs/release-and-rollback-runbook.md`
- Project knowledge map / Graphify policy: `docs/project-knowledge-map.md`
- Local Watch History v3 verification and activation boundary:
  `docs/watch-history-v3-local-verification.md`
- Local Watch drawer browse verification and rollout boundary:
  `docs/watch-drawer-browse-local-verification.md`
- Approved Watch drawer browse design and implementation plan:
  `docs/superpowers/specs/2026-09-05-watch-drawer-browse-design.md` and
  `docs/superpowers/plans/2026-09-05-watch-drawer-browse.md`
- Overall architecture notes: `docs/architecture.md`
- Extension release channels: `docs/extension-release-channels.md`
- Site and extension integration: `docs/site-extension-integration-notes.md`
- P2P and experimental features: `docs/experimental-features.md`
- Active room/P2P/realtime hardening roadmap:
  `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- Active execution program for that roadmap (SLOs, verified defects, e2e harness,
  block-by-block plan):
  `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- Approved extension voice controls and participant audio implementation plan:
  `docs/superpowers/plans/2026-07-27-voice-controls-and-participant-audio-plan.md`
- Approved Interface visibility design and implementation plan:
  `docs/superpowers/specs/2026-07-30-interface-visibility-settings-design.md`
  and
  `docs/superpowers/plans/2026-07-30-interface-visibility-settings.md`
- Historical commercial room/P2P/progress plan:
  `docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md`
- Monorepo migration history:
  `docs/superpowers/plans/2026-06-03-main-repository-monorepo-migration.md`
