# Netflix Adapter Notes

Candidate checkpoint: October 8, 2026. These are observed implementation
contracts, not a supported Netflix API promise. Delivery and remaining acceptance
are tracked in [staging verification](netflix-staging-verification.md).

## Page and player boundary

Only HTTPS `www.netflix.com/watch/<positive-decimal-id>` is a source; IDs have at
most 20 digits. Query/hash decorations are removed from the canonical persisted
URL. Credentials, other hosts/routes, cross-provider URLs and mismatched player
IDs are rejected. Netflix browse/detail autoplay never mounts a recording source.
Narrow manifests include only `https://www.netflix.com/*` for Netflix; the wider
path permits MAIN bridge lifecycle on SPA navigation without admitting browse
content. Generic HTML5 fallback is blocked on Netflix.

`apps/extension/src/source-adapters/netflix/main-bridge.ts` alone accesses the
observed `playerApp.getAPI().videoPlayer` session/player API and
`getVideoMetadataByVideoId(player.getMovieId())._metadataObject.video`. Real page
research observed the player element as a connected container containing the
primary video. Admission requires exactly one matching player/video under
`[data-uia="watch-video"]`, ready video/player, route/current player ID agreement,
coherent primary movie/show metadata and explicitly false `adPresenting` (boolean
or the observed boolean `_value`). Unknown/active ads, supplemental recaps,
trailers, unready/replaced players and ambiguous metadata suspend recording and
remote controls. Verified natural main-content end can retain completion identity.

Play/pause/seek use the Netflix API, never raw HTML5 seeking when the API is
unavailable. Netflix milliseconds convert to seconds at the bridge boundary.
Seek completion is observed within 1.25 seconds of target; pending commands have
a 2.5-second observation deadline and the client a 3.5-second deadline. There is
no DRM or ad bypass. Undocumented API changes fail closed and may interrupt support.

## Identity and artwork

Titles, localized labels and ordinal numbers describe content; IDs define it.
Episode identities contain provider series, season and episode IDs. Keys are
`netflix:series:<id>`, `netflix:season:<id>` and `netflix:episode:<id>`.
Movies use an independent `netflix:movie:<id>` for both title and episode key,
with null season and episode-number fields. Unsafe JavaScript numeric precision,
duplicate IDs, inconsistent current episode and oversized metadata are rejected.
Each episode has one exact canonical watch variant; fingerprint is
`netflix|watch/<id>`.

The adapter prefers portrait boxart from whitelisted artwork arrays. Missing or
unsafe artwork remains null. HTTPS subdomains ending in `.nflxso.net` are the
observed CDN boundary; credentials, explicit ports and lookalike domains are
rejected. Server/SQL validate saved artwork independently and reject fragments
as well. The website/popup preserve the supplied provider and poster without a
Crunchyroll fallback. No Netflix account bookmarks, account watch history,
credentials or full application state are imported or serialized.

## Generation and capture lifecycle

MAIN binding generations change with route, player, DOM video or unsafe content.
The validated snapshot generation is bound to the actual DOM video attribute.
Both bridge directions validate request IDs, source/generation and bounded
payloads; pending work is canceled on abort/disposal. Adapter construction is
inert. Subscription owns the 500 ms snapshot polling and native video events;
idempotent unsubscribe releases listeners/timers. MAIN reinjection/pagehide
disposes prior resources, and bfcache pageshow restores the bridge.

History observes only fresh validated own-player snapshots. A disconnected video,
stale generation, changed source or unsafe phase suspends observation. The shared
background writer retains viewer ownership, paid/trial access, recording
preferences, access/consent epochs, account generations, deletion ordering and
leases; adding Netflix grants no capability. Saved Resume validates the item's
explicit provider and readiness, then consumes its intent only after a confirmed
API seek. Room navigation remains provider-pinned and preserves the room hash.

The focused DOM lifecycle test uses the real bridge/client/adapter with a
controlled page API: old video → no video → new video on the same route. It
replays a delayed genuine old-command success after replacement, rejects an old
generation command, verifies suspended old history, resumes the new subscription
and checks timer cleanup. This establishes local fencing, not live episode or
two-client acceptance.

## Catalog truth and compatibility

Frequent snapshots contain small current metadata, not the full season catalog.
Only the existing authorized catalog-begin lease permits full collection. Netflix
collection carries current identity, owner/account generation, access epoch,
revision and source cancellation through the existing coordinator. Context must
remain consistent across collection; stale/mismatched attempts cannot commit.

Explicit country comes from `reactContext.models.geo.data.requestCountry.id`;
locale comes from `.locale.id`. Real research observed country `VN` and locale
`uk-HU`, so locale suffix never supplies region. Missing usable context prevents
a page attempt instead of fabricating it. Unknown availability remains partial;
complete accepted current-region catalogs alone supply unseen episode cells.
Extraction is bounded to 100 seasons and 2,000 episodes and does not invent IDs
or missing episodes.

Default/omitted `providerVersion` retains v1 all-provider reads with only
Crunchyroll/YouTube, filtering before counts, pagination, browse facets and
session enrichment. New extension reads, website SSR/client and browse consumers
request `providerVersion=2`; explicit `provider=netflix` itself opts in. Default
capacity remains exact v1; `capacityVersion=2` adds Netflix's separate 200-title
bucket. Missing v2 capacity stays unavailable, not an invented zero. Popup keeps
20 titles per provider page, independent load-more and full-provider search.

## Composer and evidence limits

Netflix composer isolation hides interfering lazily mounted controls only during
compose/quiet grace. Early keyboard capture preserves text editing while stopping
provider shortcuts. Page-delivered Escape dismisses chat without exitFullscreen
or Keyboard Lock. Chrome can consume fullscreen Escape before page JavaScript;
that browser-owned behavior is not claimed fixed.

Controlled metadata/API tests, disposable SQL and component tests cover identity,
ads/recaps suspension, artwork, catalogs, resume, compatibility and generation
fences. Real authenticated research observed metadata, primary/supplemental film
distinction, native video replacement and millisecond pause/seek independently
of the extension. Final loaded-artifact movie/series/history/fullscreen/chat,
native episode transition, two-client room sync and real ad-plan behavior remain
separate pending acceptance gates.
