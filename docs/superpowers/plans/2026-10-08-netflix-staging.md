# Netflix support for staging

**Goal:** Add Netflix to AniDachi's existing room, playback, personal history, and website flows, then validate a staging release. Production and Chrome Web Store publication are explicitly outside this work.

**Architecture:** An isolated Netflix source adapter and small MAIN-world player bridge feed the existing playback coordinator and history outbox. Shared provider contracts, server validation, and an additive database migration precede the new clients. Existing authentication, subscription rules, ownership fencing, and room authority remain authoritative.

**Tech stack:** WXT, TypeScript, React, Zod, Next.js, Supabase/PostgreSQL, Cloudflare Worker.

**Spec:** User-approved parity with Crunchyroll and YouTube; movies, stable series/season/episode identities, artwork, navigation, seeking, player overlay/chat, history search and pagination on extension and website. No separate enable/permission onboarding for Netflix.

## Global constraints

- Deliver only to staging through a PR. Never promote main, deploy production, publish the Store package, or change payments/entitlements.
- Add narrow Netflix host matches through the existing manifest path. Never request broad hosts or create optional-permission UX.
- Preserve existing history and protocol compatibility. Default capacity responses remain version 1 with exactly YouTube and Crunchyroll; new clients explicitly request version 2, which adds Netflix with the existing series-provider limit of 200 titles. No plan or pricing change.
- Canonical Netflix source is HTTPS `www.netflix.com/watch/<numeric-id>`; route/player IDs must agree. Reject credentials, unsupported hosts/routes, cross-provider identities, and stale source generations.
- Netflix IDs, not localized labels or episode numbers, identify a series/season/episode. Movies have independent movie keys and no invented season. Do not import Netflix account bookmarks/history.
- No recording or remote playback during ads, trailers, supplemental recaps, ambiguous metadata, or player replacement. Unknown data stays unknown. No DRM/ad bypass or direct-video seek fallback when the player API is unavailable.
- Isolate undocumented Netflix player API use in the bridge. Bound/validate both bridge directions; stale commands cannot control a new episode. Dispose observers/listeners/timers on lifecycle invalidation. Do not expose credentials or full application state.
- Preserve existing YouTube/Crunchyroll behavior, history access leases, account generations, deletion ordering, catalog refresh fencing, room source pinning, and free/paid capabilities.
- History uses the existing 20-title per-provider popup pagination and full-history search. Website supports the same provider without treating Netflix as Crunchyroll.
- Keep user-facing UI concise and consistent with the current style. No unrelated refactor.

## Verified Netflix evidence

Authenticated browser inspection on 2026-10-08 found `netflix.appContext.state.playerApp.getAPI().videoPlayer`, `getAllPlayerSessionIds`, `getVideoPlayerBySessionId`, and player `getMovieId/getCurrentTime/getDuration/isPaused/isReady/getElement/play/pause/seek`. Time/seek are milliseconds. Pause and seek were verified on a real player.

Metadata is available through `getVideoMetadataByVideoId(id)._metadataObject.video`. A show contains a stable series `id`, `title`, `type: show`, `currentEpisode`, `seasons` with stable `id/seq/title`, and episodes with `id/episodeId/seq/title/runtime/thumbs/stills`. Artwork arrays contain `{w,h,url}` on `*.nflxso.net`. Do not serialize unrelated metadata. Region and completeness must not be invented.

Breaking Bad: series 70143836; season 70114191; episode 70196259 (S2E1), next episode 70196260 (S2E2). Next-episode navigation replaced the video element with a transient no-video state. Film El Camino: route and main movie 81078819, but initial recap was actual player ID 81169895 with type supplemental. Suspend during this mismatch. Main movie metadata has type movie and no seasons.

Stable DOM roots: `[data-uia="watch-video"]`, `[data-uia="player"]`, `[data-uia="video-canvas"]`. Fullscreen root is the watch-video container. Browse/detail autoplay videos must never mount the adapter or record history.

## Review focus

Cross-provider validation; legacy capacity wire compatibility; append-only migration and service-role/RLS boundaries; native Netflix source replacement, recap gating and seek verification; complete/partial catalog truthfulness; no CR fallback in UI; staging-only release evidence.

### Task 1: Shared Netflix contracts

Files: `packages/protocol/src/source-url.ts`, `types.ts`, `watch-history.ts`, `watch-history-capacity.ts`, `watch-history-grid.ts`, `watch-history-editor.ts`, `index.ts`, and their focused tests. Add focused Netflix identity helpers/schema files if that keeps provider-specific validation readable.

Implement Netflix room provider/URL/fingerprint validation. Add an explicit Netflix progress identity for episode versus movie, with stable numeric provider IDs and exact title/season/episode/source consistency. Use `netflix:series:<series-id>`, `netflix:season:<season-id>`, `netflix:episode:<episode-id>`; movies use `netflix:movie:<movie-id>` for title and episode key, null season.

Allow Netflix series catalogs/begin/commit/ack/grid/editor using the existing bounded catalog shape. Preserve all CR validations and existing exports; validate every nested key/URL against its declared provider. A commit must also match snapshot provider. Netflix episode variants are a single exact canonical watch URL. Do not invent a region or loosen CR completeness requirements; report any region/completeness design issue for controller resolution.

Keep a strict exported v1 capacity schema. Add strict v2 schema with Netflix 200, and a new-client compatible union/helper as needed without changing existing default endpoint behavior (server work is Task 2). Maintain old fixture/type compatibility.

Tests: Netflix canonicalization and hostile URLs, movie/series identities, foreign mixed catalogs, stale/mismatching commit context, grid/editor sources, v1 exact compatibility and v2 validation. Run `fnm exec --using=22.23.1 pnpm --filter @anidachi/protocol check` and protocol tests. Commit only this task. Report new interfaces and integration follow-ups.

### Task 2: Server and additive database support

Files: history/room validators under `apps/web/lib/anidachi-auth/`, watch-history route handlers, corresponding Worker source allowlists under `apps/api/src/`, one new migration under `apps/web/supabase/migrations/`, SQL contracts/tests. Never rewrite earlier migrations.

Trace and update the currently active SQL functions, table checks and capacity admission for Netflix progress, catalog refresh/commit/projection, grid, editor, browse, deletion and room sources. Preserve ownership locks, current access/epoch and generation validation, receipts/idempotency, role grants and authenticated rejection. Default v1 capacity RPC/HTTP output stays exact; version 2 is requested explicitly and includes Netflix. Existing provider data is unchanged. Artwork allowlist must accept observed Netflix CDN safely without allowing lookalikes/private hosts.

Use the disposable local database harness for migration/runtime tests, not a production clone mutation. Validate existing provider fixtures and new Netflix movie/series, season/episode reads, resume URLs, edit/delete, provider capacity isolation, and unauthorized writes. Run relevant web/API type checks and tests; record staging migration/deployment order and rollback. No remote deployment in this task.

### Task 3: Netflix adapter and extension runtime

Files: new `apps/extension/src/source-adapters/netflix/` modules, MAIN entrypoint, registry/core policies, existing content entrypoint and overlay provider wiring, `wxt.config.ts`, staging artifact allowlist/validation scripts, history capture/catalog coordination, tests.

Build a narrow page bridge for the observed player API and whitelisted metadata. Require route/current movie identity match, primary content type, playable video and ready state; ignore browse previews and supplemental/ad phases. Use generation/request fencing and timeout handling; remote seek uses Netflix milliseconds with observed completion, never raw currentTime fallback. Support native playback events, seeking, fullscreen container, episode/video replacement and idempotent cleanup. Keep provider-pinned room behavior and stable history observations during SPA changes.

Extract stable movie/series/season/episode identity and safe artwork, feed the existing personal-history writer and catalog coordinator. Bound full series catalog extraction; truthful partial state for unknown availability. No Netflix account bookmarks import. Adapt history platform routing generically without cross-importing CR provider internals.

Integrate existing quiet-composer behavior: opening/typing/sending/Escape dismissing chat should not activate player shortcuts/controls or exit fullscreen. Preserve standard Mac/Windows shortcut labels and existing providers. Add only normal narrow Netflix manifest matches. Run extension check/test and staging build/validation. Commit source/tests only.

### Task 4: Website and extension library presentation

Files: watch library and popup provider names/logos/filters/capacity, history client requests, metadata/artwork presentation, supported-platform UI/copy and upcoming-platform block, relevant focused tests.

Add Netflix alongside existing providers, using real IDs and shared contracts from prior tasks. Explicitly request capacity v2. Movies remain standalone; shows expose seasons/episodes and accurate progress/resume. Keep per-provider 20-title initial popup page, load-more inside each provider and search across all available titles. Check provider options, grid/editor, pending/catalog states and empty/error UI for hardcoded CR/YT fallbacks. Reuse the current Netflix artwork asset where possible. Update relevant supported-platform copy only; remaining future platforms stay coming soon. Run web/extension checks and focused tests, inspect responsive local UI.

### Task 5: Integration proof and staging delivery

Review the complete branch and resolve material findings. Run quality-gate-required checks, room/source harness (shared contracts changed), staging extension build/validation and `pnpm dev:check`. Update canonical current state and adapter/history docs with implementation and verification limits, then safely refresh Graphify for changed semantic inputs.

Open PR into staging, wait for required CI. Inspect the exact staging Supabase project and migration state, apply the reviewed additive migration only there, merge through the normal staging path and validate staging Web/Worker. Build an identifiable staging extension folder/ZIP from the delivered revision; never a production artifact.

Use the user's authorized Netflix Chrome tab for loaded-artifact behavior where available: movie, series, episode replacement, pause/seek/fullscreen/chat, history and artwork on extension/site. Real shared-room host/guest synchronization remains an explicit acceptance item until observed with two authenticated clients. Do not represent mock/unit proof as authenticated Netflix or ad-plan acceptance. Record useful evidence and precise remaining manual checks.
