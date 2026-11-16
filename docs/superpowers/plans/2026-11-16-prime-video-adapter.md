# Prime Video adapter

User request: add Amazon Prime Video with the reliability and existing product
flows of the other adapters. This plan implements the local candidate; publication
and production promotion remain separate operations.

## Implementation status — 2026-11-16

Tasks 1–4 are implemented and task-reviewed. Task 5 documentation/readability
is integrated; final artifact, Graphify and whole-branch review remain open.
No Prime staging delivery or loaded-extension acceptance is claimed. The
[provider notes](../../prime-video-adapter-notes.md) record the full contract,
local evidence, deployment order and recovery limits.

| Task | Implemented result | Review / evidence |
| --- | --- | --- |
| 1 | Shared source, identity, catalog, read and capacity v3 contracts | `b54fe213` plus account-boundary fix `fd579179`; reviewed. Full 331 tests, later focused 63; check passed. |
| 2 | Additive migration, Web/Worker room and history admission | `d21f25b8`; reviewed. API 330, room harness 39, web full 1,832 passed / 6 skipped plus scoped fixes; disposable SQL 728 assertions. Downstream UI map check failures were resolved in Task 4. |
| 3 | MAIN bridge, adapter, source lifecycle, history/catalog and narrow manifest | `5928aafa` plus lifecycle/anchor fix `a26c3504`; reviewed. Initial extension full 2,904; fix regression set 81. Initial staging artifact passed build/validation but is stale. |
| 4 | Popup/website Prime stream, presentation, v3 clients and guarded resume | `7c521dad`; reviewed. Extension full 2,926 / 172 files, focused 276; website component 56 and capacity 7; web/extension checks passed. |
| 5 | Contract/evidence documentation and formatting of newly added TS/TSX only | Controller owns final build/validation, Graphify and whole-branch review; acceptance gates below remain open. |

Full extension runs exclude the existing production-emitting release fixture,
as no production artifact is authorized. Task 2's repeated-fixture resource
planner assertion variation is recorded in the provider notes; pristine replay
passed without modifying the index, SQL fixture or assertion.

Additional final local gates: Worker Miniflare runtime **182 passed / 0 failed /
0 pending**, staging Worker bundle dry-run passed, and `pnpm dev:check` was
reviewed. Web lint exited 0 with warnings, including the static Prime SVG image
advisory. A Chrome layout check rendered actual HistoryBrowser SSR/CSS with a
synthetic empty library at widths 1470 and 360: SVG loaded, all five filter
labels fit, no horizontal overflow and correct Prime selection. It did not
exercise authentication, live API/account data or editor behavior.

Remaining Task 5 gates:

- Rebuild and validate the final narrow staging extension after all reviewed
  fixes and UI/docs integration; inspect the emitted Prime SVG and manifest.
- Refresh the curated Graphify through the safe adapter and complete the
  whole-branch review. The documentation update covers these four changed docs.
- Hand the reviewed artifact to the user for extension load/reload and player
  start; the connector cannot do this through `chrome://extensions`.
- With the loaded candidate, verify movie/episode, safe ad transitions,
  transient rate, real fullscreen, chat/input isolation, source replacement,
  navigation and guarded resume. Native SDK research and fixtures do not close
  these gates. Actual authenticated website/editor acceptance is also open.
- After separately authorized additive migration → compatible Web/Worker →
  matching v3 clients, verify two-client Prime room/history against staging.
  The currently deployed server lacks Prime support; no deployment or staging
  write occurred in this implementation.

Shared P2P transport and media-seat policy are unchanged, so this admission /
adapter change does not require a new real-WebRTC harness run. Two-client Prime
staging acceptance is still required before promotion. Production promotion,
public support copy and Store publication remain separate decisions. Preserve
Prime rows, epochs and receipts when rolling clients/server back.

## Global Constraints

- Work only in the clean-development worktree on `codex/prime-video-adapter`,
  based on staging `2c24f661d160e6d474cce997466e7e357f21b5ad`.
- Preserve the pre-existing `.serena/project.yml` change and all other chats.
- Provider key is `primevideo`, display name is `Prime Video`.
- Initial verified surface is HTTPS `www.primevideo.com`. No wildcard Amazon
  permission or claim of regional Amazon support without observed evidence.
- Canonical source is `https://www.primevideo.com/detail/<compactGTI>` where
  compactGTI is exactly 26 uppercase alphanumeric characters. Fingerprint is
  `primevideo|detail/<compactGTI>`. Strip query/hash from persisted identity.
  Autoplay is a navigation decoration, not part of identity.
- Reject credentials, ports, insecure transport, lookalike hosts, ambiguous or
  unsupported routes and cross-provider identities. Known Prime pages never
  fall through to Generic HTML5.
- Main content requires an open/initiated primary player, matching metadata and
  one connected primary video. Ignore previews/preloads. Suspend remote control
  and history during advertisements, supplements, unknown data and replacement.
- Use the observed Prime playback API in one MAIN-world bridge. No raw-video
  seeking, DRM bypass, ad skipping, provider credentials or broad state exports.
- Preserve room provider pinning, source generations, host authority, account
  epochs, history ownership, access policy and existing providers.
- Legacy history providerVersion 1/2 and capacityVersion 1/2 remain exact. New
  clients explicitly request version 3 for Prime. Prime gets a separate 200-title
  bucket consistent with existing series providers; no pricing/entitlement change.
- Titles/ordinals never manufacture identity. Prime exposes season and episode
  GTIs but the inspected page/player did not expose a separate series GTI. For
  grouping, use the confirmed season-1 compactGTI as an explicit series anchor,
  not a claimed provider series ID. Missing/ambiguous season-1 anchor suspends
  series capture rather than merging by name or choosing another season.
- Catalog completeness remains truthful. Observed episodes may be saved;
  unobserved episodes or seasons are not fabricated. A partial catalog must not
  claim the full series was fetched.
- New host permissions follow the existing narrow release manifest path. No
  unrelated permission onboarding or public launch copy before acceptance.
- Do not deploy, merge, promote production, publish a Store package, modify
  subscriptions, or change account/browser settings as part of local work.

## Observed browser evidence

Research on 2026-11-16 used the user's existing Prime Video login. A user started
The Boys S5E1; playback API pause and seek to 1305 seconds were then observed to
complete. The first real midroll at content position 1309433 ms was observed
through completion. During ads `playback.position` remained at the content
boundary while native video and `webPlayer.currentTime.contentRelativeTimeMs`
advanced. Use `playback.position` and the timeline's content end, not raw video
time or the latter misleading property.

Primary root is `#dv-web-player`; a separate `.draper-player-container` owns the
autoplay preview. The primary video can be preloaded while the player is closed.
The primary React root exposes a context containing `webPlayer`, `playback`,
`timeline`, `title`, `adPlayback`, `playbackControlsPolicy`, `recapStore` and
`playerInfo`. Resolve it by a bounded structural walk, never a minified name.
Validate each required shape and fail closed when it changes.

Observed reads: `title.getTitleInfo()`, `playback.getPlaybackState()`,
`playback.getContentState()`, `playback.position`, `timeline.getTimelineInfo()`,
`timeline.playhead.item.contentInfo.contentType`, `adPlayback.getAdBreakInfo()`,
`adPlayback.getAdPlaybackInfo()`, `adPlayback.isAdTimerShowing()`,
`playbackControlsPolicy.getPolicy()`, `recapStore.getRecapInfo()`.
Main item type and videoMaterialType are `Feature`; ad item type is
`Advertisement`. Player state is `Playing`/`Paused`, content state `Ready`.
Commands are `playback.play()`, `pause()`, `seek(milliseconds)`; seek uses Prime's
own policy/seek helper. Both seek directions must be enabled before seeking.
For rate sync, inspected `playback.player.setPlaybackRate(rate)` delegates to a
non-persisting SDK controller with a 0.5–2 range and forced 1x ad playback. The
UI-facing `playback.setPlaybackRate` also writes preferences and must not be used.
Read/confirm actual rate with `playback.getPlaybackRate()`. Live rate command
acceptance remains separate from the read-only SDK inspection.

The page's `dv-web-page-hydration-data` JSON contains
`init.preparations.body.atf.state` and `.btf.state`. Whitelist `self`, `detail`,
`seasons`, `episodeList`, and page identity only. `self[fullGTI]` supplies `gti`,
`compactGTI`, `link`, `titleType` and optional `sequenceNumber`. Player titleId is
the full GTI. Do not derive compactGTI from UUID; naive base36 does NOT match.
Season links supply compactGTIs. Current season's episode list supplies exact
episode membership. Player titleInfo supplies movie/episode type, title, series
title and ordinals. Validate these against page identity before capture.

Observed URLs: movie `0IUGS56V361WRU60PCC5XH5D8Z`, current season
`0N9BB22P2FZ8UD2BBLNX07RP22`, episode `0SXKMY213EM2FCKUVVKUW95I2C`, next
episode `0FX1R3RCDS4LZSFJ9KPUBXJFAA`, season-1 anchor
`0S1FYJ3LY9KTL9C7WFFAGA9F6F`. Page Play link is
`/detail/<episodeCompactGTI>?autoplay=1&t=0&ref_=...`. The address bar can stay on
the season while the current episode changes; route equality alone is insufficient.
Direct episode route was verified to retain the episode URL while hydration
pageTitleId still identifies its season; both season and current episode are in
self, and btf supplies all current-season episode memberships. Native Next Episode
was observed to reuse the same connected video element and season URL while GTI
changed, so both URL/video equality are insufficient for generation ownership.

Artwork hosts observed: `images-na.ssl-images-amazon.com`, `m.media-amazon.com`,
under `/images/`. Country is `playerInfo.info.territory` (`US`), locale
`webLocale` (`en_US`); normalize locale separately, never infer country from it.

Observed episode availability uses enabled
`a[data-testid="episodes-playbutton"]` actions with canonical matching detail ID,
`autoplay=1`, and matching launched hydration membership. Responsive duplicate
anchors are deduplicated. Unproved entries are omitted; current playing episode
has independent availability proof. This is still a partial series catalog.

## Task 1: Shared provider contracts

Own `packages/protocol` only. Add a focused `prime-video-identity.ts` and exported
helpers rather than mixing Prime details throughout shared code. Add Prime to
room URL/provider descriptors with strict canonicalization and hostile URL tests.
Initially admit only exact `/detail/<26-character ID>` (optional trailing slash)
on `www.primevideo.com`; query/hash decorations are stripped. Host recognition
must also trigger rejection of Prime-looking invalid/mislabeled descriptors,
as Netflix does, without weakening legacy CR/YT compatibility.

History identity is a strict discriminated union:

- movie: `{ kind: "movie", providerMovieId: compactGTI }`
- episode: `{ kind: "episode", seriesAnchorSeasonId: compactGTI,
  providerSeasonIdentifier: compactGTI, providerEpisodeIdentifier: compactGTI }`

Use `primevideoIdentity` on progress events. Keys are
`primevideo:movie:<id>` (both movie title and episode key),
`primevideo:series:<seriesAnchorSeasonId>`, `primevideo:season:<id>`, and
`primevideo:episode:<id>`. Movies have null season/ordinal fields. Source URL
must exactly match the movie/episode ID. Reject mixed/foreign identity fields.
Add Prime to read/browse/grid/editor/resume/account schemas with strict provider
binding and no provider fallback. Preserve all existing provider contracts.

Support Prime partial catalogs through existing catalog contracts where needed:
`providerSeriesId` is the documented series-anchor compactGTI, season/episode IDs
are compactGTIs, each episode has one exact canonical source variant. Validate
request/snapshot providers, all keys/IDs and source consistency. Do not weaken
Crunchyroll/Netflix catalog validation.

Keep exported v1/v2 capacity schemas unchanged. Add strict V3 with Prime 200 and
extend the compatible union/helper. Accept providerVersion 3 additively; omitted
version still means v1. No server/client behavior changes in this task.

Tests must cover hostile URLs, mismatched source/fingerprint, movie/series keys,
cross-provider mixed catalogs/progress/read payloads, old version exactness and
Prime v3. Run protocol check and full protocol tests once at completion. Report
the exports/interfaces for downstream tasks. Commit only task source/tests.

## Task 2: Server and database support

Own API and web server validators/history routes plus one additive migration and
SQL runtime tests. Use Task 1 contracts. Add Prime to room validation/persistence
and all necessary history admission/read/editor/delete/catalog/capacity paths.
Apply providerVersion filtering before counts, pagination, facets and session
enrichment: v1 CR/YT; v2 adds Netflix; v3 adds Prime. Explicit provider filter is
an opt-in for that provider. Preserve legacy capacity responses; v3 adds Prime.
Validate Prime artwork independently using exact observed hosts and `/images/`,
HTTPS only, no credentials/ports/fragments. Preserve ownership, leases, access
epochs, deletion order, privileges and unrelated provider data.

Use the disposable local SQL harness. Record migration-before-server-before-
client deployment order. Run relevant protocol/API/web checks/tests and room
harness. No remote database changes. Commit only this task.

## Task 3: Prime player adapter

Own new `source-adapters/primevideo` modules, MAIN entrypoint, registry/runtime
integration, narrow manifests and artifact validation. Follow the observed
contract above, with bounded strict bridge messages, request/generation fencing,
stale-command cancellation and idempotent disposal. Constructors remain inert.
Observe safe main-content time, confirmations for seek/play/pause, phases and
native source/video replacement. Same-provider navigation uses validated exact
episode/movie source with autoplay decoration and room hash; it must not seek
or navigate the old source while transitioning.

Expose metadata/history via existing provider policies and writer, respecting
paid access, preferences and leases. Source identity must not depend on current
season URL. Fetch no account history, tokens, bookmarks or unrelated state.
The preview and closed/preloaded main video never mount an active source.
Support fullscreen geometry and existing composer isolation without changing
shared sync, P2P or media-seat policy. Regression-test existing providers.
Run extension check/test and staging build/validation. Commit source/tests only.

## Task 4: Existing history presentation

Own popup/website provider presentation and current read-version clients. Add
Prime label/icon/filter/capacity/pagination/resume/grid/editor alongside existing
providers. Opt new clients into providerVersion/capacityVersion 3 while accepting
older responses as unavailable data, never invented zero capacity. Movies stay
standalone; series use the explicit anchor grouping above and real seasons.
Do not announce support on public marketing pages before browser acceptance.
Run focused component tests plus web/extension checks. Commit this task.

## Task 5: Integration and evidence

Review full diff, run project quality gates, build/validate the staging artifact,
and verify it on actual Prime movie/episode/fullscreen/chat/ads/source replacement
where the authorized browser permits. Two-client room acceptance remains a
separate gate until actually observed. Update provider notes and current state
with exact evidence and limitations; refresh Graphify using the repository safe
adapter and semantic skill workflow. Prepare a reviewable result, preserving
experiments/Serena changes outside the feature. No production publication.
