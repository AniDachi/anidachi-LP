# Prime Video adapter

User request: add Amazon Prime Video with the reliability and existing product
flows of the other adapters. This plan implements the local candidate; publication
and production promotion remain separate operations.

## Implementation status — 2026-11-16

Tasks 1–4 are implemented and task-reviewed. Task 5 documentation/readability
is integrated and reviewed. The final narrow artifact is built and validated;
whole-branch source review passed at `16aea5dd` with no critical or important
findings. After initially deferring browser acceptance, the owner loaded the
artifact and authorized careful staging delivery on November 16.
Graphify refresh is blocked
by an inherited ownership collision, with existing artifacts preserved.
Loaded MAIN bridge identity/playback commands passed for one episode; full
room/history and two-client acceptance remain open. At this source checkpoint
Prime server delivery is pending. The
[provider notes](../../prime-video-adapter-notes.md) record the full contract,
local evidence, deployment order and recovery limits.

| Task | Implemented result | Review / evidence |
| --- | --- | --- |
| 1 | Shared source, identity, catalog, read and capacity v3 contracts | `b54fe213` plus account-boundary fix `fd579179`; reviewed. Full 331 tests, later focused 63; check passed. |
| 2 | Additive migration, Web/Worker room and history admission | `d21f25b8`; reviewed. API 330, room harness 39, web full 1,832 passed / 6 skipped plus scoped fixes; disposable SQL 728 assertions. Downstream UI map check failures were resolved in Task 4. |
| 3 | MAIN bridge, adapter, source lifecycle, history/catalog and narrow manifest | `5928aafa` plus lifecycle/anchor fix `a26c3504`; reviewed. Initial extension full 2,904; fix regression set 81. Initial staging artifact passed build/validation but is stale. |
| 4 | Popup/website Prime stream, presentation, v3 clients and guarded resume | `7c521dad`; reviewed. Extension full 2,926 / 172 files, focused 276; website component 56 and capacity 7; web/extension checks passed. |
| 5 | Contract/evidence documentation and formatting of newly added TS/TSX only | `66ce7f85`; reviewed, 20/20 normalized ASTs equivalent. Final narrow build/validation passed at that commit; whole-branch source review passed at `16aea5dd`. Loaded MAIN bridge commands passed; staging delivery and full acceptance continue. Graphify exception is recorded. |

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

- Graphify exception: safe publication stopped at `Foreign node collision:
  ref_clsx` while processing inherited AST backlog. All tracked graph artifacts
  remain unchanged; defer ownership repair and the deferred semantic update
  rather than bypassing the guard or rewriting unrelated historical records.
- The owner loaded the reviewed artifact. The connector cannot load/reload it
  through `chrome://extensions`; a rebuilt artifact still needs user handoff.
- With the loaded candidate, verify movie/episode, safe ad transitions,
  transient rate, real fullscreen, chat/input isolation, source replacement,
  navigation and guarded resume. Native SDK research and fixtures do not close
  these gates. Actual authenticated website/editor acceptance is also open.
- Deliver the now-authorized additive migration → compatible Web/Worker →
  matching v3 clients, then verify Prime room/history and two-client behavior.
  The baseline server rejects Prime room creation; follow the exact
  [schema-first procedure](../../prime-video-adapter-notes.md#ordered-delivery-and-rollback).
  Capture final deployment IDs/SHAs and acceptance in the PR/controller receipt.

Shared P2P transport and media-seat policy are unchanged, so this admission /
adapter change does not require a new real-WebRTC harness run. Two-client Prime
staging acceptance is still required before promotion. Production promotion,
public support copy and Store publication remain separate decisions. Preserve
Prime rows, epochs and receipts when rolling clients/server back.

## Global Constraints

### Task 15: Separate player presence from source readiness

Use the existing observed primary-player SDK and one MAIN inspection loop to
publish overlay presence separately from the strict content/generation binding.
Do not derive identity from labels or manufacture IDs when metadata is pending.
Pending UI shows a waiting notice, blocks create/sync and initial join, and keeps
launch recovery ahead of saved-room restoration. Retain the existing phase and
history suspension guards. Cover missing/recovered metadata, same-video episode
replacement, stale commands and real OverlayApp saved-room/launch ordering.
The read-only candidate inspector admitted the owner's paused Gen V S1 E1;
this is not proof of the packaged extension reload. Extension checks, full
non-production-emitting tests, room harness, independent review and staging
build/validation are the gates. No permissions, backend or wire-contract change.
Graphify publication remains blocked by the inherited `ref_clsx` collision;
preserve the curated graph and defer semantic publication with that exception.

### Task 14: Provider display labels and inspection cost

Reproduced Gilmore Girls S2 E1 with the latest loaded artifact: a space before
the title ellipsis differs between SDK and public page. Use public labels for
display and exact IDs/type/route/season/membership/ordinals for playback identity.
Cover equivalent display variants and retained conflict rejection. Skip initial
hydration reads after native SPA navigation. Candidate MAIN restored the capsule
on the real paused player; extension tests/typecheck and source review passed.
Finish staging packaging/delivery and distinguish final-artifact reload from
candidate source evidence. Graphify's inherited `ref_clsx` blocker remains a
documented publication exception. No backend or permission changes.

### Task 13: Native SPA page metadata

Reproduced the owner's Grimm failure after Supernatural → Home → Grimm in
authenticated Chrome. Initial hydration/canonical HTML stays on the first title;
the committed page provider and player SDK move to Grimm. Use that current public
page context for MAIN metadata and catalog parsing, preserving exact route/title
and membership guards. Cover stale HTML, late/replaced live context, ambiguous
providers, bounded traversal and canonical-alias ownership in regressions.
Candidate MAIN replacement already restored the capsule without document reload;
finish extension checks, review and staging packaging. Final artifact reload and
broader regional/two-account acceptance remain separate. No backend/permission
change. Graphify safe refresh still stops at inherited `ref_clsx` ownership
collision; preserve existing graph and defer semantic publication with it.

### Task 12: Verify capsule detection on supported Amazon surfaces

Owner requests checking recognition and capsule presence across Amazon. Verify
the eight existing domain families through actual MAIN/discovery/mount paths,
including locale/region paths, delayed SPA player readiness and page restore.
Fix the reproduced Back/Forward-cache disposal gap without widening permissions
or replaying old launch fragments. Run extension checks/tests, build/validate
the staging artifact and inspect it in an isolated synthetic browser. Preserve
owner-led authenticated regional playback acceptance as a separate boundary.

### November 16 regional-address follow-up (Task 9)

The owner's later instruction is to make the adapter accept all official Prime
regions and address forms, superseding the original exact `/detail/`-only
browser scope below. The verified failure is `/region/na/detail/` on
primevideo.com. Work continues from staging `61d814d7` on
`codex/prime-regional-routes`. Persisted source URLs, compactGTI identities,
fingerprints, account/history guards and server contracts remain canonical.

Official marketplace hosts are primevideo.com and Amazon US, UK, Germany,
Japan, Canada, India and Mexico, as listed by
[Prime's marketplace directory](https://www.primevideo.com/help?nodeId=202064890).
Accept routing/locale prefixes and documented detail/share address variants
through one provider-local parser. Map Amazon ASIN/full-GTI aliases only using
matching page metadata and the current SDK identity; never turn an ASIN into a
fabricated compactGTI. Keep permissions to explicit official hosts and content
script paths for Prime video. Store pages, trailers and unrelated shopping
videos must not become a source merely because the host is Amazon.

### Task 9: Regional routes and marketplace aliases

1. Reproduce the missing overlay on the supplied SOR regional URL. Add failing
   tests for regional/locale detail links, metadata aliases, native navigation,
   catalog transport and initial room/Resume handoff. Add adversarial URL cases.
2. Separate browser page recognition and observed transport links from canonical
   persisted identity. Support current official marketplace hosts and common
   detail/share paths. Region/language/slug/tracking parameters do not identify
   content. SDK full GTI plus verified page mappings remain required.
3. Normalize accepted regional/locale links throughout metadata parsing; carry
   observed safe same-origin season URLs through catalog fetches, so regional
   redirects are not required. Preserve bounded reads, cancellation and no
   cross-origin credential forwarding. Catalog completeness still requires all
   identity/count/pagination/availability proofs.
4. Integrate page recognition with MAIN injection, registry, overlay lifecycle,
   launch capture, current-tab/provider resolution and keyboard/composer paths.
   Preserve canonical room/history wire contracts and existing providers. If an
   alias cannot be proven, suspend rather than select a different episode.
5. Run extension check/full tests, focused contract/permission regressions and
   dev:check. Review the whole follow-up, build/validate a narrow staging ZIP,
   verify the loaded regional page and history, then deliver via PR to staging.
   Browser acceptance on one marketplace is not a claim that every account and
   regional catalog was live-tested. Production remains separately authorized.

### Task 10: Official domain families and subdomains

The owner's subsequent request explicitly broadens Task 9's exact-www scope to
base domains and subdomains. Apply this amendment instead of the historical
wildcard prohibition for these eight domain families only: `primevideo.com`,
`amazon.com`, `amazon.co.uk`, `amazon.de`, `amazon.co.jp`, `amazon.ca`, `amazon.in`
and `amazon.com.mx`. Use HTTPS wildcard host patterns such as
`https://*.primevideo.com/*`, covering the apex as well as subdomains. Do not add
HTTP, arbitrary TLDs, unrelated providers or global host permissions.

1. Match a validated DNS hostname at the exact family root or a dot-separated
   suffix, supporting ordinary digits, hyphens and nested subdomains. Reject
   suffix lookalikes, malformed labels, credentials, explicit ports and encoded
   authority tricks. Prime-family hosts use Prime detail routes; Amazon-family
   hosts use the existing video/detail/share routes.
2. Expand host/resource origins and content/MAIN injection patterns together.
   Keep resource paths exactly `/*`, with separate route-scoped Amazon script
   patterns and independent artifact allowlists. Retain the invalid-resource
   path regressions learned from the failed Chrome load.
3. Prove base/subdomain recognition through the real MAIN/binding/lifecycle and
   catalog transport paths. A known family is not sufficient to admit a source:
   SDK identity and public metadata still must agree. Cross-subdomain catalog
   requests remain cross-origin and must be rejected. Persisted source URLs and
   all server/account/history contracts remain unchanged.
4. Run the relevant regressions, extension check/full tests, independent review,
   dev:check and a new narrow staging build/validation. Update the existing
   PR #563 and provide the new ZIP. The owner chose to do browser acceptance
   personally; do not resume browser control or repeatedly request reloads.

### Task 11: Amazon navigation and launch continuity

The owner explicitly requests closing the Amazon-specific gaps after learning
that invitations, personal Resume and source switches still navigate to the
canonical primevideo.com URL. Canonical content identity and the local playback
destination must remain separate. Scope is the eight already approved domain
families and existing room/history flows, not a new provider or global redirect.

1. Trace source creation, invitation/join, popup and website Resume, catalog
   episode launch and host-driven source switches. Record where Amazon origin
   or an observed exact episode route is lost, including redirects and early
   fragment clearing. Choose a coherent cross-plane contract before coding.
2. Keep the canonical compactGTI and fingerprint authoritative. Prefer verified
   provider links for the exact episode and a recipient's own marketplace;
   never infer region from display language, reuse a season/previous-episode
   address, fabricate an ASIN, or let a navigation hint authorize a mismatch.
   Unknown regional availability must remain an explicit recoverable state.
3. Implement the smallest compatible solution across affected launch consumers,
   including old clients/data, delayed player startup, account/source changes,
   missing preferences, expired intents, redirect loops and unsafe URLs. Any
   new wire/storage contract must be additive and checked in all consumers.
4. Prove the identified failures with behavioral regression tests before fixes;
   run affected package checks/tests, independent review, dev:check and narrow
   staging build/validation. Update PR #563 and provide a candidate ZIP.
   Staging delivery is authorized where required; production is not. Owner
   browser acceptance remains separate, with no repeated reload prompts.

Original baseline constraints below describe Tasks 1–8; apply Tasks 9–11's
explicit browser-scope amendments where they conflict.

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
- The November 16 owner instruction authorizes careful staging PR/CI delivery
  and acceptance, with the bounded DB-before-runtime exception documented in
  the provider notes. It supersedes the initial local-only scope.
- No production/main promotion, Store publication, subscription/entitlement
  changes or unrelated account/browser settings changes are authorized.

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

## Task 8 — Full-series Prime history catalog follow-up

Owner report on November 16: the library exposes only episodes already watched.
Confirmed cause: the adapter emits selected-season partial snapshots, while the
existing editor correctly admits unseen catalog rows only from a complete
accepted snapshot. The server/protocol already support complete Prime catalogs;
their source and progress safeguards remain unchanged.

Implement a bounded provider-local loader of observed season detail links. Each
response must prove its season, the same season-1 anchor, the same season set,
exact episode membership/count and typed matching Feature PLAY actions. No
provider playback payloads or credentials cross the normalized catalog bridge.
Cancel stale fetches/results on source, context or lifecycle changes and retain
existing owner/account/access/deletion/revision guards. Only a fully verified
series may become complete; failed or ambiguous retrieval remains partial.

Authenticated read-only evidence: Upload supplied four seasons with 10, 7, 8
and 4 episodes through same-origin detail GETs, without starting playback.
SSR-disabled buttons are placeholders; typed entitlement/PLAY metadata proves
availability independently of language. No season/episode identity is generated
from titles, numbering or a guest's watch history.

Follow-up branch: `codex/prime-history-catalog`, based on staging `465f79a9`.
Validate loader/bridge cancellation and completeness, existing editor support
for unplayed cross-season launch, extension checks/tests and narrow artifact.
Require loaded browser evidence that all four Upload seasons and 29 episodes
appear while existing personal progress stays intact before claiming acceptance.
No new SQL migration, Worker behavior, permissions or production promotion is
planned. The inherited Graphify publication exception remains unchanged.

## Task 16 — Direct launch without a marketplace picker

Owner correction on November 17 explicitly rejects the unsolicited marketplace
selection screen. Open the supplied verified exact episode URL immediately and
let Amazon handle regional redirects. Remove preference-based destination
selection and the manual-choice/homepage flow. Canonical Prime is the fallback
only for records without an observed route. Retain the existing bound pending
intent so room/Resume survives redirects without accepting another episode.

Branch `codex/prime-direct-launch` starts at staging `9f294b07`. Keep only an
automatic compatibility redirect for old, still-valid launch tabs; the normal
path never opens that page. The website's missing-extension fallback uses one
link to the same supplied destination. Verify direct popup Resume, room
prepare/commit, legacy tab lifetime/account/replay guards and regional route
preservation. Run protocol, extension, affected web/API checks, room harness,
independent review and narrow staging artifact validation. No production
promotion or schema/permission change. The inherited Graphify collision remains
an explicit publication exception; do not overwrite the curated graph.
