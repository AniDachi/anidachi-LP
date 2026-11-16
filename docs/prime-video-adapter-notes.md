# Prime Video adapter notes

Staging baseline delivered through [PR #557](https://github.com/AniDachi/anidachi-LP/pull/557),
2026-11-16, at `2bbf955d66e6825fe376128356cbb4aeef98bd69`. Provider key:
`primevideo`; display name: **Prime Video**. The additive schema and compatible
Web/Worker are delivered; loaded room creation and saved episode history passed.
The autoplay launch follow-up shipped through [PR #559](https://github.com/AniDachi/anidachi-LP/pull/559)
at `2a93c598ebef08ba78a79d1328b5c7daf43bd275`. Resume readiness and early launch
capture shipped in [PR #560](https://github.com/AniDachi/anidachi-LP/pull/560)
at `def49ed8`; coherent playing-source room creation shipped in
[PR #561](https://github.com/AniDachi/anidachi-LP/pull/561) at `465f79a9`.
Loaded browser acceptance passed for both follow-ups. The
[execution plan](superpowers/plans/2026-11-16-prime-video-adapter.md)
tracks the remaining integration gates.

## Source and permission scope

The persisted room/history source is exactly
`https://www.primevideo.com/detail/<compactGTI>`, with a 26-character uppercase
alphanumeric compactGTI. An optional trailing slash, query and hash are removed
from persisted identity. The fingerprint is `primevideo|detail/<compactGTI>`.
Autoplay query parameters and the room hash decorate navigation only.
The launch follow-up adds `autoplay=1` to initial room invitation/join URLs and
the shared personal Resume URL used by the website and extension popup. Resume
validates raw Prime input before URL normalization and keeps its intent source
canonical even when the input already has autoplay decorations. Provider redirects
may replace autoplay with `ref_=atv_plr_detail_play`; parsing still binds the same
exact episode/movie. A room hash remains ineligible for personal Resume.

The shared wire validator remains strict: browser routes and aliases must be
resolved before they reach it. HTTP, credentials, explicit ports including
`:443`, lookalikes, malformed IDs and normalization tricks remain invalid.
Known Prime pages never fall through to Generic HTML5. The legacy `amazon`
account-provider placeholder remains distinct.

The owner-authorized Tasks 9–10 broaden browser recognition independently of
that persisted contract. They cover regional and locale detail addresses and
Amazon video/share aliases on eight official domain families: `primevideo.com`,
`amazon.com`, `amazon.co.uk`, `amazon.de`, `amazon.co.jp`, `amazon.ca`,
`amazon.in`, and `amazon.com.mx`. Task 10 explicitly adds their base domains and
subdomains through HTTPS patterns such as `https://*.primevideo.com/*`,
superseding Task 9's initial exact-www permission scope. Host matching requires
the exact root or a dot-separated subdomain, not a textual suffix lookalike.
The host inventory comes from [Prime's marketplace directory](https://www.primevideo.com/help?nodeId=202064890).
An ASIN or full-GTI route needs matching public page/self metadata and the current
SDK title before it can become a canonical compactGTI source. Shopping videos,
trailers, tracking parameters and title text cannot establish that identity.
The extension separates explicit host/resource origins from Amazon video/share
script paths, with one top-frame MAIN entry at `document_start`. Chrome requires
web-accessible resource matches to end in `/*`; the exposed resource remains
only the logo. Wildcards are limited to the eight named families; unrelated
Amazon TLDs, HTTP and global host access are not admitted. Family recognition
does not admit a shopping video without the existing Prime SDK and metadata proof.
Catalog transport still requires the same exact origin, including the subdomain.
Task 9 source review passed; Task 10's source, review and artifact receipts are
tracked in the same PR. The owner will perform loaded-artifact acceptance.
This scope is not evidence that every marketplace/account has been tested. No public
announcement, Store publication, secret or environment addition is included.

## Amazon launch continuity follow-up

Task 11 separates canonical identity from the observed Amazon destination.
Optional `primeNavigation: { contentId, routes: [{ url, observedAt }] }` carries
exact-title links through room sources, progress, catalog variants and history
projections. There is at most one route per approved marketplace, eight routes
in total, with a 16 KiB payload limit. Public same-origin metadata must map the
link to the exact compactGTI; the eventual SDK source still proves playback
identity. Plain canonical Prime links need no redundant navigation hint. An
address-bar season URL is never an episode destination, and an Amazon ASIN is
never manufactured from a compactGTI or translated title.

Invitation, website/popup Resume, unseen catalog episodes and room source
switches consult the same recipient marketplace selection. A missing
verified route for that marketplace is an unknown mapping, not proof that the
title is unavailable. The extension's `prime-launch.html` offers known links,
canonical Prime, or manual navigation to the selected marketplace. It remembers
the choice per AniDachi account, not per display language. It does not rewrite
an Amazon host or silently substitute another edition. Legacy data
without navigation hints keeps canonical Prime behavior unless the recipient
has explicitly selected an Amazon marketplace that cannot be resolved.

Prime invitations pass through `/room/[roomId]/launch` after server admission.
The website prepares and commits a launch through the approved extension ID;
missing or older extensions receive explicit fallback links. The background
stores a five-minute, tab/account/login/generation/source-bound intent in
`chrome.storage.session` before navigation, with at most 64 pending entries and
one navigation attempt. This survives provider redirects, fragment removal and
service-worker restarts. SDK identity, server room authority and personal Resume
account/generation checks still gate admission and seeking. No room token or
provider credential is placed in the destination URL.

Migration `20261116160000_prime_navigation_continuity.sql` adds nullable room
and progress JSONB fields and compatible server-only RPC/projection handling.
Same-source legacy writes preserve observed routes; a source replacement clears
stale routes. New history HTTP readers opt in with
`x-anidachi-prime-navigation: 1`; responses to older strict readers omit the new
field. Navigation timestamps do not establish a new source generation.

Delivery order is additive staging schema, compatible Web/Worker, then the new
extension artifact. Runtime rollback retains the nullable columns and history
rows. Task 11 is under final verification; the previous `49f86b06` ZIP does not
contain this behavior. Loaded regional/two-account acceptance remains separate
from source, SQL and isolated UI verification.

## Runtime ownership and safe playback

Implementation lives in `apps/extension/src/source-adapters/primevideo/`;
`apps/extension/entrypoints/primevideo.content.ts` owns the MAIN-world bridge. Detection requires
exactly one connected video under `#dv-web-player`, a structurally verified
provider context, an open player with playback initiated, and matching title
metadata. The autoplay preview outside this root and closed/preloaded primary
video are excluded. Constructors are inert; subscriptions own timers/listeners
and dispose them on final unsubscription. Page lifecycle disposal and BFCache
restart belong to the entrypoint.

The undocumented SDK context is found through a bounded React child/sibling
walk, with shape checks for the specific observed modules. A changed or unknown
shape fails closed. Only whitelisted public title/hydration fields are read;
whole provider state, account/session data and credentials are never serialized
through the bridge. The catalog path may read observed same-origin season
detail pages as described below; playback commands make no provider requests.

Content time comes from `playback.position` and duration from
`timeline.getTimelineInfo().endPositionMs`, converted from milliseconds. During
an observed real midroll, that content position froze while native video time
and `webPlayer.currentTime.contentRelativeTimeMs` advanced. Neither advancing
clock is used for synchronization or history.

Confirmed main content requires the SDK's Feature material/timeline state and
safe playback, ad and recap signals. Advertisements, recaps/slates, unknown
data, closed player and replacement suspend remote commands and progress
capture. Buffering retains content identity but does not admit a command.
The adapter does not skip ads or recaps, bypass DRM, or seek the DOM video.

The MAIN bridge executes `playback.play()`, `pause()` and `seek(milliseconds)`
through Prime's own policy/seek machinery. Both seek directions must be enabled.
Generation and safe phase are checked immediately before execution; returned
SDK promises alone do not prove success. Confirmation reads are bounded to two
seconds. The isolated playback client has a 3.5-second deadline, AbortSignal cleanup,
strict bounded messages and request/source/generation binding. MAIN limits
pending requests and replay IDs and rejects foreign/malformed messages.

Transient rate commands use only the observed SDK facade
`playback.player.setPlaybackRate(rate)`, gated by capability, generation and
safe content, limited to 0.5–2, and confirmed through
`playback.getPlaybackRate()`. Read-only SDK inspection showed that this path
keeps the desired rate in memory and forces 1x during ads. The UI-facing
`playback.setPlaybackRate` persists preferences and is never used. Fixture
tests cover this contract. The loaded bridge confirmed a transient 1.25 rate
command on one episode. A subsequent seek returned rate 1; sustained rate
across seek and shared-room synchronization remain live acceptance cases.

## Source generations and navigation

The source is the playing movie/episode, not whichever season happens to remain
in the address bar. Native Next Episode was observed to keep both the season
URL and the connected video while changing the title GTI. Context, SDK module,
player facade, video, content and unsafe-phase replacement fence generations.
Media signals plus a bounded 250 ms SDK poll announce binding changes to the
isolated lifecycle, including paused swaps without a DOM mutation.

Obsolete requests cannot update a replacement binding. Binding cancellation is
separate from subscription lifetime: temporary binding loss can recover when
the same video/source returns before lifecycle reconciliation. Source navigation
invalidates the old binding before assigning the new URL. It preserves room
provider pinning and uses the exact movie/episode destination selected by the
Prime launch resolver, with autoplay and room decorations. Canonical identity
remains unchanged. An already-current result requires a MAIN snapshot;
address-bar equality is insufficient. Resume uses the existing bounded local
intent with exact source, expiry, owner/account guards and confirmed SDK seek.
Delivered PR #560 permits waiting without a source descriptor only
while Prime is in transition and its bound content fingerprint exactly matches
the canonical intent. Missing/changed identity outside that state cancels;
claim and seek still require the full exact descriptor and all existing guards.
The same delivered change captures validated initial Prime room/Resume data in
isolated-world memory at `document_start`, before a detectable player or overlay
exists. Prime was observed to clear the entire fragment during autoplay startup.
The one-use handoff requires the original accepted route and bound fingerprint,
expires within five minutes, gives rooms precedence and drops stale data on
source/account change, a new explicit intent, consumption or lifecycle disposal.
It never exposes launch state through MAIN, DOM or persistent storage.

Room creation also treats the playing descriptor as source authority. Prime
may leave a season or previous episode URL in the address bar after replacing
the native episode. The delivered Task 7 follow-up reads the descriptor at the
actual create boundary after async identity/session preparation and uses its
source URL and fingerprint as one pair. A known Prime adapter without a ready
descriptor fails closed with a retryable loading message; ordinary
descriptor-less adapters retain the existing address-bar fallback. Raw URL,
canonical-source validation and strict Prime host/ID rules remain unchanged.
Overlay regressions reproduce the reported Fallout season/episode mismatch,
episode replacement during preparation, missing Prime descriptor and ordinary
fallback. Direct room-client coverage still rejects the mismatched pair.
Task 7 passed staging artifact validation and loaded Fallout S1 E4 room
creation from a season URL. Persisted source and fingerprint matched the
playing episode; the disposable room was ended. The tested candidate and
staging merge trees are identical. Two-account synchronization remains open.

Player geometry and composer isolation use the existing overlay seams and
semantic controls, without English button-label or hashed-class assumptions.
Shared host authority, synchronization, P2P transport and media-seat policy
remain unchanged. Actual fullscreen, chat/input isolation and overlay geometry
still need inspection with the loaded candidate.

## Identity, series anchor and catalog completeness

`packages/protocol/src/prime-video-identity.ts` defines the strict identity:

```ts
type PrimeVideoHistoryIdentity =
  | { kind: "movie"; providerMovieId: string }
  | {
      kind: "episode";
      seriesAnchorSeasonId: string;
      providerSeasonIdentifier: string;
      providerEpisodeIdentifier: string;
    };
```

Every ID is a validated compactGTI. `primevideoIdentity` accompanies progress;
foreign/mixed identity fields and source/key mismatches are rejected. Movie
title and episode keys are both `primevideo:movie:<id>`, with null season and
ordinal fields. Episodes use `primevideo:episode:<id>`, seasons use
`primevideo:season:<id>`, and series grouping uses
`primevideo:series:<seriesAnchorSeasonId>`.

The inspected provider exposes season and episode GTIs, with no separate series
GTI. `seriesAnchorSeasonId` is explicitly the confirmed **season-1 compactGTI**;
the catalog field `providerSeriesId` carries that same anchor. It is not a
claimed provider series ID. Full GTIs map through matching whitelisted `self`
records and canonical links; UUID/base36 conversion, names and ordinals never
manufacture identity.

Each admitted season list must contain one season-1 candidate and agree on its
full/compact GTI, consistently with any known self mapping. Conflicting,
malformed or absent anchor evidence suspends detailed series capture/catalog.
Independently verified playing source identity can remain available. Selecting
another season or grouping by translated title is not a fallback.
Task 9 also handles the observed SOR shape: no season roster, but an exact
season-1 self record, matching page/SDK ordinals and episode membership. This
can establish the current episode's anchor and partial catalog; missing roster
data cannot establish full-series completeness.

The Task 8 follow-up loads the series catalog from observed season detail
links after the existing eligible catalog attempt begins. Task 9 keeps the
observed same-origin regional/marketplace route for transport instead of
synthesizing a root `/detail/` URL. Only verified HTTPS detail links are read,
without tracking, autoplay, fragments or page navigation.
Requests retain provider credentials inside that origin, reject redirects, and
are bounded by 100 seasons, 2,000 episodes, 8 MB per response, 32 MB total and a
45-second loader deadline (50 seconds at the catalog client). Playback command
deadlines are unchanged. Cancellation and source/context replacement discard
stale work; a binding/context has at most one catalog attempt.

Completeness requires every observed season, consistent full/compact mappings
and season-1 anchor, exact unique episode membership/count, and no unexplained
pagination. Availability uses allowlisted typed `Entitled` / `PLAY` / `PLAYBACK`
Feature actions whose full GTI and verified autoplay link match the episode,
together with launched episode metadata. Raw playback envelopes, provider
account data and surrounding action payloads never leave the provider page.
SSR-disabled Play buttons are placeholders, so their state is not used as
negative availability evidence. Display labels and translated titles do not
establish identity.

Only a fully verified series snapshot becomes **complete**. A failed, oversized,
paginated, context-changed or ambiguous retrieval cannot invent totals or mark
unknown episodes unavailable. The existing selected-season **partial** catalog
remains the fallback; its positive availability proof is actual playback or
matching launched membership plus an enabled exact provider Play link. The
server's existing complete-catalog editor rule stays intact. Catalog entries
are separate from personal progress: unseen episodes remain unplayed, and
selecting them opens their exact episode URL with a zero-position intent.

Artwork is separately validated as HTTPS `/images/` URLs on exactly
`images-na.ssl-images-amazon.com` or `m.media-amazon.com`, with no credentials,
ports, fragments, backslashes or dot traversal. Region comes from provider
territory evidence; locale is normalized independently and does not prove region.

## History, capacity and compatibility

The existing durable outbox, writer, recording choice, eligibility checks,
owner/account generations, access epochs, leases, catalog revision fencing and
deletion/receipt ordering remain authoritative. The legacy library reconciliation
writer rejects Prime because that payload cannot establish the explicit anchor;
new detailed Prime writes use the existing history v3 interface.

History API v3 and `providerVersion=3` are different version axes. Omitted or
explicit provider version 1 still selects Crunchyroll/YouTube; version 2 adds
Netflix; version 3 adds Prime. Explicit provider filtering opts into that named
provider. Filtering occurs before counts, pagination, facets and session
enrichment. Capacity versions 1/2 keep their exact shapes; only explicit
`capacityVersion=3` adds the separate Prime 200-title bucket. Missing Prime
capacity in an older response is unavailable data, never invented 0/200.
No pricing, entitlement or unrelated provider capacity changes are included.

Current popup and website SSR/list/browse/session/options clients explicitly
request provider version 3 and capacity version 3. Prime has independent popup
query/cursor/cache/depth/search state alongside the three existing streams.
The existing official SVG, provider filter and movie/anchored-series editing
and resume flows are reused. Incomplete-catalog copy directs the user to open the title with the extension;
complete catalogs expose all verified seasons and episodes.

## Full-series catalog follow-up evidence

Authenticated read-only Upload season pages supplied 10, 7, 8 and 4 episodes
(29 total) across four observed seasons without starting playback. Canonical
season URLs without tracking query parameters returned the same evidence.
The existing SQL fixture already verifies partial-to-complete admission and an
unseen Prime episode in the editor. The website regression verifies an unplayed
other-season episode with translated labels launches its exact source at zero
without a progress write. Initial loaded acceptance exposed a missing-property
case masked by fixture normalization: Prime supplies an empty ATF episode-list
placeholder while BTF carries the actual complete list. The reviewed correction
accepts absent/empty placeholders and still rejects malformed or orphaned
counts, pagination and membership. Shape-faithful current-page/four-season
evidence passes the parser, loader and actual MAIN/client bridge; covering
Prime/coordinator tests pass 134 cases, with extension check and rebuilt narrow
artifact validation. Live acceptance and staging delivery are recorded in
[PR #562](https://github.com/AniDachi/anidachi-LP/pull/562); fixture evidence alone
is not a loaded-browser claim.

## Regional-address follow-up evidence

The reported SOR URL uses `/region/na/detail/`. The old extension loaded its
styles but rejected the route before creating a player binding or overlay.
The same page's public self/episode links also use that prefix, and its season
roster is empty. The regression fixture preserves those facts and the observed
SDK season-1 episode-1 identity; the admitted catalog remains partial.

An inspected Amazon US movie page has a requested ASIN different from its
same-origin canonical ASIN. Its public self record is keyed by ASIN and supplies
the full GTI and compactGTI separately. This evidence informs alias resolution;
the account could not play this title, so its playback test uses an explicitly
synthetic SDK identity. This is parsing/integration evidence, not live Amazon
playback acceptance. The first regional artifact passed the project validator but
Chrome rejected its manifest: resource matches incorrectly reused path-scoped
Amazon script matches. The correction separates origin and injection lists and
adds negative manifest validation cases. [Chrome's resource manifest contract](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)
requires origin-only matching. Regional loaded-artifact acceptance and delivery
receipts are tracked in [PR #563](https://github.com/AniDachi/anidachi-LP/pull/563).
The corrected narrow artifact at `90caab1d` passes the strengthened validator;
the same validator rejects deliberately invalid Amazon resource paths. The owner
chose to check Chrome personally, so installation, regional capsule/progress and
broader marketplace playback are not marked accepted from source tests alone.
No source IDs, seasons or totals are inferred from translated
labels, an account's watch position or a missing season list.

## Local evidence and remaining acceptance

The recorded automated runs are local evidence at their task revisions:

| Surface | Recorded result and limit |
| --- | --- |
| Protocol | Full suite: 331 tests / 31 files; later account-boundary fix: 63 tests / 2 files. Check passed. |
| API / rooms | 330 tests / 31 files; 39 room-harness scenarios. Final local Miniflare runtime: 182 passed, 0 failed/pending, outbound requests intercepted. |
| Web | Full lib run: 1,832 passed, 6 skipped; later scoped route/legacy fixes passed. Task 4 component suite: 56; capacity: 7. Final check passed. Lint exited 0 with warnings, including a static Prime SVG image advisory. |
| SQL | Clean disposable replay of all 97 migrations; 728 assertions across 12 suites. Existing resource-bounds planner assertion varied after repeated fixtures; all 69 passed on pristine focused replay without weakening SQL/tests. |
| Extension | Task 4 full run: 2,926 tests / 172 files, excluding the existing production-emitting release fixture. Check passed. Earlier reviewed lifecycle/anchor fixes passed 81 focused tests. |
| Final local integration | Staging Worker bundle dry-run passed; `pnpm dev:check` reviewed. Chrome rendered actual HistoryBrowser SSR/CSS with a synthetic empty library at widths 1470 and 360: SVG loaded, all five filter labels fit, no horizontal overflow and correct Prime selection. This is limited layout proof without authentication, live API/account data or editor acceptance. |
| Staging artifact | Final narrow build and validation passed at `66ce7f85`, superseding the stale `5928aafa` artifact. One top-frame document-start Prime MAIN script, exact Prime host permission and emitted logo were verified; the popup references the SVG and its bytes match the canonical source. |

Baseline ZIP at Task 5: `artifacts/anidachi-extension-staging-66ce7f85.zip`.
SHA-256: `afc652a2a1b149330bf2e0ef7dfb15f2b808b94de9b65703ffb2d31ecca6f403`.
Loadable folder: `anidachi-extension-staging/`. These generated outputs are
ignored local artifacts, not committed or published. The build reports the
existing ineffective-dynamic-import advisory for the history client; no error.

Native authenticated Prime research observed pause/seek, content-clock freeze
through a real ad, same-video/same-season-URL Next Episode, and direct episode
hydration. Movie metadata was inspected on closed/preloaded detail state.
These observations did not exercise a loaded AniDachi extension. Read-only rate
facade source inspection is not a live rate command. The connector's fullscreen
click changed provider CSS state while `document.fullscreenElement` remained
absent, so real fullscreen is unproved.

The browser connector cannot load/reload developer extensions through
`chrome://extensions`; artifact changes require a user handoff. After initially
deferring checks, the owner loaded the artifact built at `66ce7f85`. On episode
`0FX1R3RCDS4LZSFJ9KPUBXJFAA`, the actual loaded MAIN bridge confirmed coherent
episode/season/season-1-anchor identity, 3752-second duration, pause, transient
1.25 rate, seek and restoration. Original playback state was restored. This
does not prove isolated-controller or room/history end-to-end behavior.
Whole-branch source review of `2c24f661..16aea5dd`
passed with no critical or important findings; this is local code readiness,
not release acceptance. Remaining gates are loaded
movie/episode/ads/rate/fullscreen/chat/source-replacement/resume checks,
authenticated website/editor acceptance, and two-client Prime room/history
acceptance against compatible staging. At that pre-delivery checkpoint the
staging server lacked Prime support, blocking that end-to-end flow.
That pre-delivery mismatch is resolved: PR #557 delivered staging merge
`2bbf955d66e6825fe376128356cbb4aeef98bd69` to Web and Worker, with the sole Prime
migration applied. Actual overlay room creation and authenticated saved episode
history passed. Resume reached the exact saved episode but stopped at Prime's
detail/Resume screen; PR #559 supplied `autoplay=1` in both initial room launch
and shared personal Resume navigation. Post-delivery website Resume opens the
primary player automatically. PR #560 merged at `def49ed8` and its reviewed
artifact `3b69197d-staging-20261116161316` was loaded. Controller delivery receipts
in `task-6-final-delivery-report.md` confirm website Resume restored exactly
`625.824822` seconds; an invitation opened previously unwatched episode 5 despite
prior episode 2 history and joined automatically. CI, staging smoke and Vercel
delivery passed; the compatible Worker remains the PR #559 version. This proves
those same-account flows only. Two independent accounts/devices for
host-authoritative position, pause/play, seek and episode transition, plus the
remaining loaded-client matrix, are still acceptance gates.
Production remains excluded.

Graphify refresh exception: the repository safe adapter extracted 291 pending
AST sources, including inherited staging backlog, then refused publication with
`Foreign node collision: ref_clsx`. The existing record is a semantic concept
owned by `apps/web/lib/utils.ts`; the fresh import stub has different ownership.
All three tracked graph artifacts remain unchanged. Semantic publication uses
the same adapter and is also blocked by this pending AST collision. No guard was
bypassed, historical hash stamped, or unrelated graph record rewritten. Resolve
the ownership collision separately, then refresh the changed documents
through Codex semantic extraction and the safe adapter. The stale graph is a
navigation limitation; source, tests and artifact receipts remain authoritative.

## Ordered delivery and rollback

The November 16 owner authorization permitted the following bounded staging
procedure. Schema/runtime delivery steps 1–4 completed for PR #557; step 5 still
has the acceptance limits above. Deployment and browser receipts are recorded
in the controller's SDD delivery report. The readiness follow-up requires its own
staging PR, compatible artifact and browser acceptance:

1. Freeze the reviewed feature head, open its PR into `staging`, run the required
   CI, and verify that the migration diff contains only
   `20261116090000_prime_video_history_and_room_sources.sql`.
2. Confirm current staging baseline `2c24f661` has no pending migrations using
   `db-staging.yml` on `staging`. With that baseline and the sole migration diff
   established, run only that guarded DB workflow from the frozen, reviewed,
   CI-green feature ref. Its project equality guard must resolve to
   `cyppqpprkygjloyfvvvj` before linking. Inspect dry-run/apply logs for exactly
   the Prime migration, a successful transaction and no unrelated migrations.
3. Merge through the normal staging PR path after schema success. Verify matching
   Web/Worker source, successful no-op staging DB rerun, Worker and protected Web
   smoke, password gate/noindex and exclusion from the production sitemap.
4. Build/validate the narrow staging extension from the delivered source. Record
   immutable workflow/deployment IDs, source SHAs and artifact hashes in the PR
   and controller report; avoid a docs-only redeployment loop for these receipts.
5. Verify Create room and history with the loaded Prime client, then complete
   the remaining acceptance matrix before any future production promotion.

Only the additive DB step may run from the feature ref; Web, Worker and release
artifacts still deliver from `staging`. This is not a general feature-ref release
permission. The compatible recovery baseline is `2c24f661`; coordinated runtime
rollback must retain the additive Prime schema and all newly written rows.

The migration extends provider admission and adds server-only capacity v3; it
preserves existing rows, privileges and policy fences. The explicit owner
instruction authorizes staging only. Keep staging password-gated/noindex and
follow feature PR → staging → accepted promotion PR → main.

On recovery, roll back clients/server before considering removal of compatible
database support. Preserve stored Prime rows, access epochs and receipts;
removing provider admission after writes is not a safe destructive downgrade.
Record the exact compatible recovery ref before any later rollout. Production
promotion and Store publication remain separate decisions.
