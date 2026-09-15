# Graph Report - room-media-seats-v3  (2026-09-15)

## Scoped Incremental Update - Server-Anchored Free Quota Reset (2026-09-15)

- Scope: seventeen changed code/test files and only the changed sections of three docs; source `d7b0afd776622256ccf4cb1dcd09d8d31145b951..d8738eaf947b1b31e101783a46767a85487397ac`. AST extraction used Graphify's installed API: 159 nodes / 892 raw edges, with no failed sources. The Codex semantic fragment adds nine documented concepts and twenty-four source-cited relationships.
- The authenticated, private, uncached `GET /api/me/room-quota` resolves current entitlements and returns an owner-bound quota view with server request-reception time and next UTC midnight. The extension includes request latency in its monotonic countdown, uses wall time only for discontinuity detection, discards sleep-spanning responses, fences accounts and stale room creation, and rechecks the server on resume and zero. Hosts see the reset card; guests see the host-limit explanation. Worker metering, admission policy, SQL and media remain unchanged.
- Current graph: 12859 nodes / 27922 edges. Delta: +49 nodes, -1 node, 96 modified nodes; +149 edges, -2 edges, 470 modified edges. The removed node and its two edges are the deleted `quotaExhaustedMessage()` helper.
- Existing community assignments, unrelated graph objects, all hyperedges and unscoped manifest rows are preserved. No whole-corpus rescan or reclustering ran; the community/cohesion analysis below remains the prior snapshot. Repeated AST relationships use the existing simple-graph endpoint-pair representation. One unchanged interface-field reference omitted by incremental AST resolution was preserved after direct source verification at `apps/extension/entrypoints/background.ts:L84`.
- Integrity: no missing/dangling endpoints, duplicate endpoint pairs or self-loops. All twenty scoped manifest entries match final source content. Graph refresh does not establish installed-extension or deployment acceptance.
- Semantic extraction used the active Codex session and one subagent. Token usage counts were unavailable from the collaboration tool; historical token figures below are not the cost of this update.
- Query evidence: `graphify explain "Server UTC Monotonic Countdown"` links the cited decision at `docs/superpowers/plans/2026-09-08-personal-history-and-plans-mvp.md:L689-L696` to `useFreeQuotaNotice()`, the authenticated view, the fenced recheck and server-confirmed renewal. `graphify path "requestRoomQuotaStatus" "Authenticated Room Quota View"` resolves a three-hop directed path through `handleRoomQuotaStatusMessage()` and `GET`.

## Scoped Incremental Update - Visibility Defaults and Compact People (2026-09-15)

- Scope: eight changed extension code/test files and the changed sections of two docs; source `0b7a0fffd66949322217f5835295e7cfeecff01f`.
- Unconfigured controls now default to Always visible. Valid saved choices remain intact and preference hydration prevents a default flash. People keeps the first two rows with an accessible disclosure and bounded additional rows; expansion belongs to the current room. Room/media authority is unchanged.
- Current graph: 12811 nodes / 27775 edges. Delta: +3 nodes, -0 nodes, 96 modified nodes; +10 edges, -0 edges, 278 modified edges.
- Existing community assignments, unrelated graph objects and hyperedges are preserved. The community/cohesion analysis below retains the prior clustering snapshot.
- Integrity: no new missing/dangling endpoints, collapsed pairs or self-loops.
- Semantic extraction used the active Codex session and one subagent. Usage counts were unavailable; historical token figures below are not the cost of this update.
- Useful query: `graphify explain "Profile-Local Versioned Interface Preferences"`.

## Scoped Incremental Update - Explicit Own Seat Defaults (2026-09-15)

- Scope: six changed extension code/test files and the changed sections of four docs; source `addabc0a19476aa18479c7b2c8e64ee441c86047`, including the `room-client-auth.test.ts` request-ID expectation update.
- Host own-seat restoration now links saved account Room defaults and Last used to the matching successful seat result; passive and other-user grants stay silent, and capture remains separately ACK-gated.
- Current graph: 12808 nodes / 27765 edges. Delta: +2 nodes, -0 nodes, 112 modified nodes; +148 edges, -0 edges, 272 modified edges.
- Existing community assignments, unrelated graph objects and hyperedges are preserved. The community/cohesion analysis below is the prior clustering snapshot, not a new whole-corpus analysis.
- Integrity: no new missing/dangling endpoints, collapsed pairs or self-loops.
- Semantic extraction used the active Codex session and one subagent. Usage counts were unavailable from the collaboration tool; historical token figures below are not this update's cost.
- Useful query: `graphify explain "Explicit Own Seat Restoration"`.

## Corpus Check
- 47 files · ~1,365,837 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 12806 nodes · 27617 edges · 795 communities (467 shown, 285 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 449 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- seo-guide-blocks.tsx, watch-youtube-together/page.tsx
- SeoPageLayout(), TocHeading
- auth-client.ts, auth-tokens.ts
- getGuideLinks(), guide-links.ts
- getResolvedSiteOrigin(), json-ld.tsx
- responsive-compare-table.tsx, ResponsiveCompareTable()
- watch-history-v3-routes.ts, WatchHistoryV3ApiError
- social.ts, social.test.ts
- room-session-storage.ts, room-session-storage.test.ts
- room-invite-notifications.ts, room-invite-notification-retry.ts
- popup-app.tsx, popup-people-panel.test.tsx
- overlay-app.tsx, OverlayApp()
- seo-page-layout.tsx, primary-checkout-cta.tsx
- watch-history.ts, watch-history.test.ts
- watch_history_v3_disposable_target.mjs, watch_history_v3_catalog_read_states_contract.mjs
- social-client.ts, social-client.test.ts
- popup-watch-drawer.tsx, popup-watch-history.tsx
- .next/**, next/link
- protocol/src/index.ts, next/server
- PlaybackSyncController, .applyHostState()
- pricing-copy.ts, how-to-host-a-crunchyroll-watch-party/page.tsx
- room-persistence.ts, room-source-persistence.ts
- RoomDurableObject, .handleMessage()
- room-session.ts, anidachi-auth/room-lifecycle.ts
- p2p-media.ts, voice-activity.ts
- watch-history-client.ts, watch-history-client.test.ts
- jwt.ts, [roomId]/connect/route.ts
- watch-library.ts, cleanWatchProgressEntry
- core/types.ts, html5-video-adapter.ts
- RoomState, room-state.ts
- device-push.ts, device-push.test.ts
- plan-entitlements.ts, anidachi-auth/watch-history-access.ts
- stripe-subscription-sync.ts, stripe-plans.ts
- [slug]/page.tsx, jikan-for-watch-page.ts
- account.ts, friends-client-contracts.ts
- src/types.ts, protocol.test.ts
- source-navigation.ts, registry.ts
- crm-client.tsx, actions.ts
- oauth-transaction.ts, handle-oauth-callback.ts
- room-client.ts, room-client-auth.test.ts
- crunchyroll.content.ts, handleControlRequest()
- P2PMediaController, logDebug()
- room-media-defaults.ts, use-room-join-defaults.test.tsx
- room-departure-retry.ts, createRoomDepartureRetryCoordinator()
- getSession(), next/navigation
- connect/page.tsx, extension-codes.ts
- lucide-react, cn()
- room-media.ts, protocol/test/room-media-seats.test.ts
- crunchyroll/progress.ts, season.ts
- anidachi-auth/watch-history-browse.ts, protocol/src/watch-history-browse.ts
- diagnostic-log.ts, constants.ts
- p2p-media-harness.mjs, main()
- api/src/index.ts, routes.test.ts
- privileged-overlay-intent.ts, privileged-overlay-intent.test.ts
- site-url.ts, best-action-anime-to-watch-with-friends/page.tsx
- video/prepare/route.ts, reel/route.ts
- db.ts, db()
- content.tsx, content-lifecycle.test.tsx
- popup-people-model.ts, popup-inbox-panel.tsx
- watch-history-v3.ts, invalidDatabaseResponse()
- createWatchHistoryClient(), watchHistoryPartitionKey()
- chrome-extension-demo-async-overlay.tsx, chrome-extension-demo.tsx
- send-connection-requests.mjs, main()
- watch-history-controller.ts, watch-history-controller.test.ts
- anidachi-logo.tsx, app/login/page.tsx
- billing.ts, billing-client.tsx
- gmail-tokens.ts, gmail.ts
- store.ts, cli.ts
- /graphify, What You Must Do When Invoked
- debug-log.ts, videoDebugSnapshot()
- reaction-shortcuts.ts, use-reaction-shortcuts.test.tsx
- Current Development State, Account bug report restoration
- overlay-interface-settings.tsx, top-bubble-reveal.test.tsx
- overlay-interface-settings.test.tsx, interface-preferences.ts
- participant-disconnect.ts, participant-disconnect.test.ts
- VideoAdapter, active-adapter-playback.test.tsx
- crunchyroll/player-chrome.ts, overlay-geometry.ts
- survey-lead.ts, survey-lead-shared.ts
- account-inbox.ts, seen/route.ts
- room-departure.ts, room-departure.test.ts
- google-ads/oauth.ts, oauth/callback/route.ts
- portfolio-audit.ts, keyword-opportunities.ts
- ghost-cam.ts, media-types.ts
- Account Data Watch History Social And Inbox Foundation Design, Bounded Notification Recovery
- account-inbox-cache.ts, popup-inbox-convergence.test.tsx
- blob-reconciliation.ts, blob-reconciliation.test.ts
- internal-web-client.ts, api/src/room-presence-evidence.ts
- sitemap-discovery.ts, internal-link-audit.ts
- plan-survey-modal.tsx, pricing.tsx
- vitest, personal-history-capture.test.ts
- instagram/storage.ts, hasPrivateIntegrationBlobConfiguration()
- room-hibernation-runtime.ts, RuntimeRoomClient
- overlay-layout-engine.ts, resolveOverlayLayout()
- session.ts, api/auth/refresh/route.ts
- Historical: 2026 09 12 Production Promotion Preparation, Production 35 To 60 Transition
- playback-sync-controller.ts, playback-sync-controller.test.ts
- youtube/player-chrome.ts, subscribeYouTubePlayerOverlayGeometry()
- extension-session.ts, active-session/depart/route.ts
- watch-library-routes.test.ts, watch-library-routes.ts
- anidachi-auth/watch-history-grid.ts, src/watch-history-grid.ts
- middleware.ts, staging-access.ts
- overlay-layout-editor.tsx, overlay-layout-interaction.ts
- pseo-new-guides.tsx, getGuideMetadata()
- Host-managed media seats v3, Host-managed media seats: delivery and verification
- Room Flow and P2P Flawless Execution Plan, Stats Based Peer Health
- Watch History Crunchyroll Catalog Progress Implementation Plan, Final Local Implementation Closeout
- node:fs, node:crypto
- voice-audio-preferences.ts, voice-audio-preferences.test.ts
- scripts, build
- p2p-media.test.ts, FakeAudioTrack
- react, profile-client.tsx
- jsonUnauthorizedUnlessKreatliSession(), blou-access.ts
- public.get_account_inbox_page_v3(), public.save_friend_group_v1()
- YouTubeVideoAdapter, playback-phase.ts
- Task 1 Shared Session and Departure Contracts, Task 2 Atomic Supabase Authority
- background.ts, background-invite-notification-wiring.test.ts
- Free hosted 35 to 60 to 35 rehearsal commands, Conditional managed-role policy with second-target acceptance
- production-history-prefix-proof.mjs, production-history-prefix-proof.test.mjs
- overlay-layout-model.ts, normalizeOverlayLayoutDefinition()
- public-media-blob.test.ts, public-media-blob.ts
- anidachi-auth/watch-history-editor.ts, src/watch-history-editor.ts
- dependencies, @amplitude/unified
- overlay-room-rail.tsx, overlay-room-rail.test.tsx
- popup-watch-history.test.tsx, subscribeToPopupWatchHistorySnapshot()
- watch-history-storage.ts, createWatchHistoryStorage()
- feature-requests.ts, feature-request-route.ts
- room-source.ts, room-source.test.ts
- Production Room Realtime and P2P Hardening Roadmap, WebSocket Hibernation
- room-socket-attachment.ts, api/src/auth.ts
- history-recording-choice.ts, watch-history-preference-listener.ts
- bridge-client.ts, bridge-contract.ts
- contact-messages.ts, contact-route.ts
- inventory, manifest.json
- Watch History v3 Local Verification, Final Fix Verification Evidence
- ice-servers.ts, createIceServersPayload()
- app/layout.tsx, conditional-site-chrome.tsx
- youtube/storage.ts, youtube/api.ts
- trackConversion(), conversion-events.ts
- node:assert/strict, extension_auth_pkce_concurrency_contract.mjs
- migrate-private-integration-blobs.ts, private-integration-blob-migration.test.ts
- p2p-ice.ts, loadP2PIceServersWithCache()
- catalog.ts, normalizeCrunchyrollCatalog()
- privileged-overlay-wiring.test.tsx, installActiveHostRoomRuntime()
- node:path, production-history-application-acl.mjs
- invites-client.tsx, account-notifications.tsx
- tiktok/storage.ts, tiktok/api.ts
- node:test, profile-route.ts
- rules, a11y
- Anidachi Auth Integration Implementation Plan, Files and Responsibilities
- AniDachi Core Foundation to UI/UX Handoff Plan, Foundation Gap Scope
- nav-bar-client.tsx, account-menu-client.test.ts
- Watch History v2 Clean MVP Implementation Plan, Watch History v2 Clean MVP Scope
- tasks, ^build
- reaction-pop.tsx, reaction-pop.test.tsx
- background-privileged-room-route.test.ts, startSameIdentitySuccessorScenario()
- post/status/route.ts, video/status/route.ts
- trackEvent(), gtag.ts
- Main Repository Monorepo Migration Implementation Plan, 2026-06-03-main-repository-monorepo-migration.md
- AniDachi Pre-release Security and Reliability Readiness Plan, Findings and Task Ownership
- Watch History Catalog And Progress Design, Canonical Durable Data Model
- Watch History Room Authority Threat Model, 1. Overview
- Harness, .connectClient()
- user-identity.ts, silent-session-adoption.ts
- popup-view-state.ts, popup-view-state.test.tsx
- watch-library-client.test.tsx, installServer()
- anidachi-seo-aeo-pages.md, YouTube keyword bank + templates (Keyword Planner US)
- September 12 prelaunch remediation verification, Real WebRTC harness documentation
- Commercial Room, P2P, and Watch Progress Architecture Implementation Plan, Architecture Boundaries
- Source Adapter Architecture Implementation Plan, PR 1: Behavior-Preserving Provider Extraction
- Canonical Runtime Flow, Authenticated Watch History v2 Web Service
- use-camera-interaction-lock.ts, use-camera-interaction-lock.test.tsx
- artwork-select.ts, crunchyroll/artwork.ts
- study.ts, startCrunchyrollStudy()
- verifyKreatliCrmSession(), kreatli-crm/auth.ts
- private-integration-blob.ts, private-integration-blob.test.ts
- scripts, web/package.json
- Anidachi Architecture and Stack Notes, Current Stack
- Deferred Together Group History Specification, Deferred Shared Membership Access
- production-history-rehearsal.mjs, production-history-rehearsal-operator-fence.mjs
- AniDachi Repository Overview, AniDachi — Watch Anime Together
- overlay-layout-runtime.ts, finiteNonNegative()
- extension/test/watch-history-browse.test.ts, watch-history-browse-cache.ts
- history-browser.tsx, client-api.ts
- Account subscription cancellation, Cancellation deep link
- Rollout Phases, Watch History Catalog And Progress Implementation Plan
- Overlay Layout Engine V2 Design, Verification
- Deferred Together: Together MVP Revision 2, Deferred Together: TARGET Personal Group Routing
- room-signaling-harness.mjs, runScenarios()
- RecentP2PSignalBuffer, p2p-signal-buffer.ts
- RoomAdmission, room-admission.ts
- RoomRateLimiter, RoomSubjectRateLimiters
- .ensurePeer(), .restartPeerIce()
- Kreatli CRM Data Schema, Kreatli CRM Agent Instructions
- active-room-session.ts, active-room-session.test.ts
- prepare.sql, anidachi_transition_20260912.install_holds()
- Watch History v3 Staging Verification, Release And Rollback Runbook
- Personal History And Plans MVP Specification, D05 Bounded Access Lease
- production-history-application-acl.integration.mjs, assertPreserved()
- overlay-interaction-boundary.ts, overlay-voice-controls.test.tsx
- overlay-layout-editor.test.tsx, OverlayLayoutDefinition
- popup-watch-browse.test.tsx, generationClient()
- zod, anidachi-auth/room-presence-evidence.ts
- teleparty-not-working-youtube/page.tsx, teleparty-not-working-crunchyroll/page.tsx
- home-client.tsx, faq-section.tsx
- public.browse_watch_history_v3(), 20260905084800_watch_history_browse.sql
- Accepted second target-specific hosted application recovery, Historical first recovery failure remains separate from later accepted targets
- Environment And Secrets Matrix, ANIDACHI_NOTIFICATION_DRAIN_SECRET
- Development Flow Quality System Plan, Target Operating Model
- LinkedIn Sales Navigator Connection Requests, Session output
- AniDachi Extension Icon 48px, AniDachi Extension Icon
- src/account-inbox-client.ts, test/account-inbox-client.test.ts
- watch-library-client.tsx, WatchLibraryOwnerClient()
- Anidachi Project Operating Manual, Development Flow
- Shared Watch Progress Tracker, Durable Account History Authority
- Development Workflow Hardening Implementation Plan, 2026-06-04-development-workflow-hardening.md
- Plan Code Canonicalization And Billing Cleanup Implementation Plan, 2026-06-22-plan-code-canonicalization-and-billing-cleanup.md
- social-snapshot-cache.ts, wxt/utils/storage
- hotkeys.ts, hotkeys.test.ts
- overlay-mount.ts, url.ts
- .handleSignalNow(), .queueNegotiation()
- RoomClient, .connect()
- devDependencies, eslint
- YouTube Playback Synchronization Hardening Implementation Plan, Provisional Interfaces And Dependency Direction
- Watch Drawer Browse Local Verification, Episode label search fix
- Account Data History Social And Inbox Foundation Design, Canonical durable inbox aggregation and unread seen state
- dev-check.mjs, classify()
- popup-watch-filters.tsx, extension/src/watch-history-browse.ts
- room-invite-target-status.ts, room-invite-target-status.test.ts
- release-channel-build.test.ts, artifactText()
- youtube/callback/route.ts, youtube/oauth.ts
- components.json, aliases
- public.apply_personal_watch_progress_v1(), 20260908030441_personal_watch_history.sql
- Survey → Subscription Conversion (Planner Notes), Async Mode Demo — landing page (2026-07-07)
- Crunchyroll Adapter Notes, Catalog Completeness Evidence
- Maintenance Admission, Shared protocol maintenance parser
- Anidachi Development Environments, Extension Builds
- AniDachi New Chat Project Context, P2P Media Product Decisions
- OpenClaw: YouTube Shorts posting, Step 2 — Prepare video post
- src/source-url.ts, canonicalizeRoomSourceUrl()
- compilerOptions, tsconfig.base.json
- devDependencies, happy-dom
- popup-styles.ts, styles.ts
- RoomMediaSession, .intent()
- account-sections-client.test.ts, account-workspace-state.tsx
- public.get_account_inbox_page(), 20260809_room_invite_inbox_foundation.sql
- Personal history MVP staging delivery packet, September 12 Sandbox cancellation verification
- Temporary Free-project rehearsal window, Restored staging baseline and account room acceptance after three windows
- Watch History Local Read Implementation Plan, Bounded persistent cache policy
- generate-extension-icons.mjs, chunk()
- AGENTS.md, Promotion Diff Classifier
- api/package.json, scripts
- demo/package.json, scripts
- ghost-cam-size.ts, getResponsiveGhostCamSizePx()
- ControlledWebSocket, FakeWebSocket
- MemoryStorageArea, StorageAreaLike
- package.json, devDependencies
- Room Invitation Return and Reinvitation, Durable Assignment Resend Fence
- Invitation Delivery Reliability Implementation Plan, Private Database Scheduler
- Room Defaults With Media Seats, Initial Authoritative Admission Once
- Social Rooms Subscriptions Execution Plan, Core Product Rules
- dependencies, @anidachi/protocol
- protocol/package.json, scripts
- watch_history_capacity_concurrency_contract.mjs, contend()
- 20260814010000_watch_history_v2_foundation.sql, public.apply_watch_progress_v2()
- compilerOptions, allowJs
- pull_request_template.md, CI Check and Test Job
- Personal History And Plans MVP — Implementation Evidence, personal-history-and-plans-mvp-verification.md
- Project Architecture and Development, Extension viewing and capture client plane
- Core Contract, Provider Player Overlay Geometry Implementation Plan
- Voice Controls and Participant Audio Implementation Plan, 2026-07-27-voice-controls-and-participant-audio-plan.md
- Interface Visibility Settings Design, Product Behavior
- devDependencies, typescript
- Personal History MVP Design, Watch drawer presentation baseline with later personal-history amendment
- overlay-media-session.ts, RoomConnectionStatus
- overlay-room-media-controls.tsx, RoomPeopleSection()
- account-navigation-client.test.ts, account-nav.tsx
- friends-client.tsx, AccountEmptyState()
- friends-client.test.tsx, FriendsClient()
- best-anime-to-watch-with-friends/page.tsx, watch-kdrama-together-long-distance/page.tsx
- Chrome Web Store Listing — AniDachi Extension, Detailed Description
- AniDachi SEO Content Guidelines, Templates (intent → shape)
- seo-cta-cleanup.py, export-anidachi-logo.py
- auth_artifact_cleanup_plan_contract.mjs, assertPlan()
- YouTube SEO conversion polish + agent upgrades, Part A — Page enrichment (conversion-first)
- Handoff For AI Working On AniDachi Site Pages, ai-site-development-handoff.md
- Edge Cases, Blocked User
- File Map, Account Contracts And Popup Isolation Implementation Plan
- Two-phase Production Promotion, Runtime-second Phase
- Waitlist And CRM Durable Storage Recovery Implementation Plan, Lossless CRM Reconciliation Tool
- validate-extension-artifact.mjs, actualExtensionId
- AniDachi Contributor Startup Contract, Development Quality Gates
- extension/package.json, scripts
- overlay-voice-session.ts, overlay-voice-session.test.ts
- anidachi-vs-twoseven/page.tsx, watch-anime-long-distance-boyfriend-girlfriend/page.tsx
- watch_history_v2_migration_order_contract.mjs, initializationPosition
- scratchpad.md, High-level Task Breakdown
- Historical: Local CLI prefix atomicity receipt passed, Local native CLI atomicity receipt
- Codex-Hosted Semantic Extraction, September 4 Graphify Installation Audit
- One canonical personal episode progress row in Supabase, Background-owned account and generation scoped cache/outbox
- Global Constraints, Room And P2P Release Hardening Implementation Plan
- V1 Product Decisions (Historical), V1 Staging Acceptance Matrix (Historical)
- Shared Pure Visibility Policy, Four-Responsibility Shared Policy Architecture
- Friends and groups link first MVP plan, Extension People MVP plan
- telemetry.ts, telemetry.test.ts
- VoiceMode, voice-mode-preference.ts
- FriendsWorkspace(), parseSavedGroup()
- watch-history-v3-sql.test.ts, migrationSql()
- public.get_account_inbox_page_v2(), 20260822065227_room_invite_lifecycle_actions.sql
- public.commit_room_usage_day_v1(), 20260908065520_room_media_capabilities_v2.sql
- watch_history_v3.test.sql, watch_v3_force_receipt_failure
- Project Knowledge Map, Isolated Code Update Regression Test
- Account library and manual progress editor plan, Service only edit_watch_history_v1 atomic progress edits
- Popup People And Social Directory Implementation Plan, 2026-08-07-popup-people-social-directory.md
- smoke-staging-web.mjs, main()
- Incremental Re-extraction, Incremental Update Runbook
- room-quota-display.ts, roomQuotaRemainingSeconds()
- contact-form-client.test.ts, ContactForm()
- seo-landing-path.ts, getSeoAttributionFields()
- Download on the App Store Badge, App Store Conversion CTA
- 20260816090000_watch_history_v2_bounded_read.sql, public.list_watch_history_v2_page()
- public.active_room_sessions, 20260823090624_single_active_room_sessions.sql
- Project Operating Manual, Custom website OAuth and cookie sessions backed by Supabase tables
- Resources Progress Menu Implementation Plan, 2026-05-26-resources-progress-menu.md
- Task 7 Complete, Production Cutover And Closeout
- Watch History Capacity, Canonical admission guard
- Account MVP navigation design, Account bug report contact contract
- p2p-scorecard.mjs, printReport()
- Project Planes, CodeRabbit Review Policy
- overlay-room-media-controls.test.tsx, PanelCameraControl()
- .sampleRemoteAudioActivityOnce(), .getStats()
- room-invite-notification-runtime.test.ts, json()
- include, extension/tsconfig.json
- SEO Trust & Authority plan (2026-07-28), Hard safety constraint
- AniDachi Logo Asset, Friendly Brand Tone
- personal_mvp_activation_contract.mjs, delay()
- 20260819133849_auth_channel_rotation.sql, public.refresh_token_families
- 20260904114914_account_inbox_push_outbox.sql, enqueue_friend_request_inbox_push
- personal_watch_history.test.sql, pg_temp.legacy_watch()
- MVP Plan Pricing, All Supported Platforms
- Rollout Order, Phase 0 - Contract And Plan
- Completed Public-Product Recovery Record, Distinct Live Signup 2026-08-23T18:13:49.881Z Created Position 686
- Watch Drawer Browse Implementation Plan, Authorized Staging Delivery
- types, types
- panel-account-title.tsx, PanelAccountTitle()
- overlay-layout-ghost-preview.tsx, overlay-layout-ghost-preview.test.tsx
- Conversion metrics (GA4), CONVERSION_METRICS.md
- Host Avatar Asset, Host Persona
- public.apply_watch_progress_v2(), 20260820111116_room_history_authority_expiry.sql
- 20260907194413_personal_history_access.sql, public.account_manual_plan_grants
- include, web/tsconfig.json
- graphify reference: extra exports and benchmark, exports.md
- Executor's Feedback or Assistance Requests, Additional batch (10 more watch pages — 2026-05-12)
- Participant Session Identity, Explicit Room Protocol Contract
- Social Rooms, Friends, Groups, And Subscriptions Execution Plan, 2026-06-20-social-rooms-subscriptions-execution-plan.md
- Global Constraints, Interface Visibility Settings Implementation Plan
- Durable Cross-room Assignment, Live Room State
- MemoryStorage, .asDurableObjectStorage()
- MemoryStorage, .asDurableObjectStorage()
- include, api/tsconfig.json
- room-tab-lock.ts, acquireRoomTabLock()
- watch-history-runtime-policy.ts, watch-history-runtime-policy.test.ts
- overlay-layout-engine.test.ts, chatTopForSelectionRow()
- Haruto Avatar Image, Watch Party Avatar
- Natsuki Avatar Asset, Approachable Social Presence
- public.room_invite_actions, 20260810190000_room_invite_atomicity.sql
- public.consume_extension_auth_code_v1(), 20260820040229_auth_artifact_cleanup.sql
- room_invite_return.test.sql, before_denial
- Prelaunch remediation plan, Confirmed main content clock eligibility for personal history
- Staging Acceptance Checklist, staging-acceptance-checklist.md
- API Surface, Billing
- Database Model, Devices And Web Push Subscriptions
- Global Constraints, Overlay Layout Engine V2 Core Implementation Plan
- Global Constraints, Overlay Layout Runtime And Editor V2 Implementation Plan
- Approved Voice UX Simplification V2, V2 Implementation Tasks
- Production Acceptance Snapshot: 685 Survey Leads, Post-Signup Private Authority: 688 Contacts And 686 Survey Leads
- YouTube Adapter Notes, youtube-adapter-notes.md
- sync.ts, normalizeRemotePlaybackState()
- lib, lib
- findKatamariPlayerFromReactNode(), isRecord()
- overlay-layout.ts, overlay-layout.test.ts
- .handleNetworkSignal(), shouldProactivelyRestartIceForNetworkSignal()
- AniDachi Apple Touch Icon, Web App Brand Asset
- AniDachi Web Logo Asset, Smiling Anime Face Mascot
- public.watch_sessions, 20260626_watch_library.sql
- watch_history_editor.test.sql, editor_calls
- Operating contract (mandatory), Evidence hierarchy
- Project Status Board, AniDachi SEO audit (Executor — awaiting Planner confirm)
- Site, Extension, Auth, and Database Integration Notes, Historical research: Authenticated Room Flow
- Social pricing model, History retention and capacity
- Voice UX Simplification V2, Room-Scoped Voice State
- Participant Audio Controls, UI Contract
- September 4 Microphone-Independent Main Control Correction, Automated Verification and Staging Artifact Evidence
- Account Isolation, Notification Privacy And Routing
- demo/tsconfig.json, include
- current-resource-panel.tsx, CurrentResourceDisplay
- AniDachi App Icon, Browser Tab Identity
- Stable Channel Identity, Notification Permission Disclosure
- skills.ts, getCombinedSkillContent()
- public.room_invites, public.room_invite_recipients
- public.list_recent_people_evidence(), 20260808_social_atomicity.sql
- public.claim_active_room_session_v1(), public.create_room_with_active_session_v1()
- anidachi_private.tick_inbox_push_scheduler(), 20260904154732_private_inbox_push_scheduler.sql
- 20260908071729_room_media_negotiation_fence.sql, public.claim_active_room_session_v1()
- personal_history_access.test.sql, access_results
- personal_watch_catalog_epochs.test.sql, catalog_epoch_calls
- watch_history_capacity.test.sql, capacity_before
- watch_history_v3_catalog.test.sql, calls
- watch_history_v3_episode_previews.test.sql, pg_temp.preview_tail()
- watch_history_v3_resource_bounds.test.sql, pg_temp.watch_v3_explain_json()
- graphify reference: query, path, explain, query.md
- High-level Task Breakdown (historical), Completed (prior watch-page batches — historical)
- Sitewide CTA → Plan-Picker Survey (Planner Notes), Key Challenges and Analysis
- Capacity endpoint, Authoritative cancellation return
- AniDachi Project Knowledge Map, Graph-First, Source-Verified Navigation
- Billing And Entitlements, Access Rules
- Required Tests, API Tests
- Extension UX, Friend And Group Actions
- Always-Visible Compact Participant Pills, Persistent Compact Participant Rail Integration
- Final Staging Runtime Acceptance, Fresh Preview Deployment dpl_AnAzpf8XTHUcCrYMz19TDkQ2y3rq
- Exact Assignment Release, Durable Release First, Live Detach Second
- Extension Inbox polish plan, September 11 Inbox presentation amendment
- Accepted Catalog Read, Episode Grid Presentation
- protocol/tsconfig.json, include
- smoke-worker.mjs, fetchJson()
- apps/api Agent Instructions, api/AGENTS.md
- apps/extension Agent Instructions, extension/AGENTS.md
- overlay-panel-interaction.ts, overlay-panel-interaction.test.ts
- overlay-unmount-cleanup.test.tsx, overlay-unmount-cleanup.ts
- apps/web Agent Instructions, web/AGENTS.md
- CTA and conversion map (internal), CTA_AND_CONVERSION_MAP.md
- privacy.ts, privacy.test.ts
- 20260525_anidachi_auth.sql, public.users
- 20260620_billing_entitlements.sql, public.billing_customers
- 20260621_social_profiles_friends_recent.sql, public.users
- public.friend_groups, public.friend_group_members
- public.list_recent_people_evidence_v2(), 20260814020000_watch_history_v2_clean_cutover.sql
- friends_groups_editor.test.sql, test_reject_link
- Crunchyroll conversion stack (required), Crunchyroll anti-cannibalization map (owned queries)
- Programmatic anime pages (`/watch/[slug]`), Genre hub pages (`/watch-{genre}-anime-with-friends`)
- Private Tester Readiness, Room Policy Renewal Correction
- Four-Layer P2P Acceptance Matrix, Service Level Objectives
- Web Account Dashboard UX, Dashboard Shell
- Participant Audio Control Surface Handoff, Hotkey and Player Interaction Isolation
- V2 Staging Acceptance Matrix, Recovery and Load
- Room Lifecycle Invite Actionability, Conditional Invite Response
- packages/protocol Agent Instructions, protocol/AGENTS.md
- inbox_push_scheduler.test.sql, pg_temp.scheduler_response()
- 20260602_extension_auth.sql, public.devices
- 20260612_room_lifecycle_quota.sql, public.usage_daily
- 20260818131602_oauth_login_transactions.sql, public.consume_oauth_login_transaction_v1()
- public.watch_catalog_read_v3(), 20260905083000_watch_history_observed_season_fallback.sql
- 20260908070552_room_media_compatibility_fence.sql, public.create_room_with_active_session_v1()
- room_invite_return_concurrency.test.sql, first_send
- room_media_capabilities.test.sql, pg_temp.create_room_v2()
- watch_history_v3_browse.test.sql, pages
- vercel.json, regions
- graphify reference: add a URL and watch a folder, add-watch.md
- graphify reference: commit hook and native CLAUDE.md integration, hooks.md
- graphify reference: incremental update and cluster-only, update.md
- Experimental Features, experimental-features.md
- Manual Staging Release Gate, Ultra-Light P2P Reliability
- Privacy Security And Abuse Controls, Abuse Controls
- Audio Speech Activity Classification, Microphone and Camera Independence
- Voice Activity and Flow Model, Sampling Cost
- Production Closeout Complete, Production Promotion PR 240
- Unified own-player personal history MVP, Owner-bound access lease and original capture authority
- Personal History Plans and Room Capabilities MVP, Media Protocol v2 Grants
- Account MVP navigation implementation plan, Account MVP integration and staging gates
- Five-Object CRM Reconciliation, CRM Recovery Deployment Order
- launch-chrome.sh, launch-chrome.sh script
- vitest/config, vitest.cloudflare.config.ts
- main.ts, title
- env.d.ts, ImportMeta
- public.friend_invite_links, 20260625_friend_invite_links.sql
- public.check_personal_history_operation_v1(), 20260908031543_personal_history_metadata_authority.sql
- public.check_personal_history_operation_v1(), 20260908174716_personal_history_readonly_free.sql
- public.get_watch_history_capacity_v1(), 20260909043915_watch_history_provider_capacity.sql
- public.renew_room_media_lease_v2(), 20260913055426_room_policy_renewal_lock_permissions.sql
- inbox_push_outbox.test.sql, claimed
- graphify reference: GitHub clone and cross-repo merge, github-and-merge.md
- graphify reference: transcribe video and audio, transcribe.md
- Player Lifecycle and Episode Identity, Crunchyroll Adapter
- Staging Smoke Workflow, Staging Password Gate
- pg_net Platform Permission Boundary, Scheduler Permission Verification
- Chrome Compliance Patch, Account-scoped Recording Choice
- Current Integration Foundation, Room Scoped ICE Authorization
- Staging-accepted Integration Foundation, One-time Extension Auth Handoff
- Durable Room Lifecycle and Idempotent Create, Orphan Room Policy
- Single Active Room Global Constraints, Exact-session Cleanup Rule
- Persistent Exact Operation Generation, Authoritative Room Snapshot Handoff
- Production Promotion Preparation, Accepted Free-plan Execution Path
- Panel Access and Focus Overrides, Main Control Always Visible
- Filter Before Pagination, Filter Reset Preserves Search
- Build Extension Workflow, Extension Channel
- Real-WebRTC Two-browser P2P Harness, Media v3 Host-managed Seat Scenarios
- API typecheck unit runtime and Wrangler dry run gates, Deploy API workflow
- Local Video Demo Page, Video Adapter System
- vite-env.d.ts, *.css
- postcss.config.mjs, config
- web/README.md, @anidachi/web
- auth_channel_rotation.test.sql, wrong_channel_last_used_snapshots
- extraction-spec.md, graphify reference: extraction subagent prompt (compact)
- Authoritative Room Departure Implementation Plan, Authoritative Room Departure Design
- Fail-Closed CRM Runtime, Waitlist And Public Form Product Contract
- Existing YouTube Preference Authority, History Management Scope
- Historical Group Provenance, Historical Same Session Provenance Filter
- Deploy Migrations to Production, Main-only Production Migration
- Branch-scoped Worker Delivery, Deploy API
- P2P Media Workflow Path Filters, Real WebRTC P2P Harness
- Rooms Workflow Path Filters, Room Signaling Harness
- build-extension-public.sh, build-extension-public.sh script
- build-extension-staging.sh, build-extension-staging.sh script
- Noncanceling production migration operation
- kreatli email crm crm client copyfilteredsurveyleadstsv
- kreatli email crm crm client copyrendered
- kreatli email crm crm client runexport
- kreatli email crm crm client runexportsurveyleads
- kreatli email crm crm client runpreview
- Checkout Events
- CTA Click Events
- GA4 Conversion Funnel
- CTA Surface Map
- Page Template IDs
- Pricing Checkout Surface
- Internal Linking Protocol
- Jikan Content Source
- JSON LD Schema
- SEO Content Engine
- Sitemap Protocol
- Template A Anime Pages
- Template B Comparison Pages
- Template D Listicles
- Table Of Contents Component
- Web App Scope
- Web Commands
- public.watch_session_participants
- public.rooms
- public.rooms
- public.rooms
- public.rooms
- public.users
- public.watch_progress_checkpoints
- public.watch_sessions
- public.devices
- public.watch_progress_checkpoints
- public.extension_auth_codes
- public.refresh_tokens
- public.rooms
- public.user_watch_settings
- public.rooms
- cache
- Graphify File Watcher
- Graphify URL Ingest
- Graphify Extra Export Formats
- Token Reduction Benchmark
- Extraction Confidence Rubric
- Deep Mode Inference Rules
- Extraction JSON Schema
- Extraction Node ID Contract
- Graphify GitHub Clone Flow
- Cross Repo Graph Merge
- Monorepo Graph Merge Flow
- Native Claude Graphify Integration
- Graphify Post Commit Hook
- Graphify BFS DFS Query Modes
- NetworkX Query Fallback
- Path and Explain Query Flows
- Graphify Query Feedback Save
- Whisper Transcription Flow
- config
- SEO Conversion CTA Rules
- Genre Hub Page Pattern
- SEO Internal Linking Rules
- SEO Skill Invocation Flow
- JSON LD Initial HTML Requirement
- New URL Checklist
- Programmatic Watch Page Guardrails
- Robots Crawl Scope Rules
- SEO AEO Skill Scope
- Sitemap Discovery Rules
- SEO Voice and Claims Rules
- GSC SEO Optimization Batch
- Homepage CRO Rework
- Hub and Listicle Backlinks
- MAL ID and Jikan Cache Work
- Manual Spot Check Requests
- Plan Picker Survey
- Programmatic Watch Page Expansion
- Sitewide CTA Survey Modal
- Survey Email CRM Integration
- Safe Site Paths
- Sensitive Paths
- Site Development Handoff Brief
- Cloudflare TURN Endpoint
- Crunchyroll Adapter
- Host Authoritative Sync
- P2P Media Current Default
- Room Creation Auth Flow
- Environment Separation
- Extension Build Environments
- ICE Server Strategy
- P2P Signaling Replay
- WebSocket Keepalive
- External acceptance remains separate from local and delivery evidence
- Durable Model And Convergence
- Historical v2 Evidence
- Historical v2 Read Boundary
- Product Surface
- Rollout And Rollback
- Runtime Ownership
- Billing scope
- Free hosting clock
- Free tracking privacy
- Independent media limits
- Personal invitation groups
- Personal watch history
- Supported platforms
- PR Evidence
- Room P2P Acceptance
- Site Auth Checks
- Staging Noindex Gate
- Crunchyroll Progress Identity
- Future Backend Progress Upgrade
- Local Watch Progress Store
- Overlay Progress Recorder
- Resources Panel UI
- Resources Progress Plan
- Auth Integration Plan
- Extension Auth Bridge
- Invite Extension Handoff
- Production Auth Hardening
- Room Token Model
- Website Supabase Identity
- Worker Room Token Verification
- Commercial Architecture Plan
- Durable Watch Progress
- Observability Debug Export
- P2P Signal Replay
- Commercial Release Gates
- Source Switching Contract
- Ultra Light P2P Contract
- Branch Protection Workflow
- Build Output Policy
- Cloudflare Worker Environments
- GitHub CI Deploy Workflows
- Monorepo Layout
- Monorepo Migration Plan
- Production Release Flow
- Source Of Truth Repo
- Staging Acceptance Test
- Vercel Monorepo Deploy
- Canonical Staging Origin
- Everyday Development Loop
- Manual Dispatch Safety
- Narrow Bearer Bypass
- Staging Noindex After Password
- Staging Smoke Tests
- Store Safe Extension Builds
- Workflow Hardening Plan
- Network, Security, and Cost Guardrails
- Canonical Agent Entry Point
- CodeRabbit Contextual Review
- Dev Check Profiles
- Development Quality Plan
- Environment Secret Hygiene
- Local Project Knowledge Graph
- PR Template Review Checklists
- Product Planning Integration
- Rollback Runbooks
- Staging Acceptance Release Gate
- Task 9 Closeout Documentation
- Conditional CRM Rollback Anchors
- Retained media-v2 frozen room caps and independent media grants
- Historical Execution Plan Index
- Extension-local Web Lock
- Single Active Room Session Design
- Staging Acceptance Evidence
- Waitlist CRM Storage Incident
- Emergency Active-Room Recovery
- Drawer management handoff to account library
- Explicit Specials Identity
- Local Calendar UTC Boundaries
- Local Versus Staging Evidence
- Unified Personal Target Amendment
- Deferred Together Shared Group Design
- Capture and ordering
- R01 Personal history identity
- R02 Paid recording
- R03 Universal integrations
- R04 Split entitlement authority
- R05 Existing invitation flow
- R06 Private groups
- R07 Host control
- R08 Actual player evidence
- R09 Late join point
- R10 Independent departure
- R11 Completion and Resume
- R12 Personal Resume
- R13 Unified Watch
- R14 Free saved history
- R15 Independent media caps
- R16 Server access checks
- R17 Data preservation
- R18 Independent paid guest
- R19 Recent People presence
- R20 Cross plane acceptance
- Resume launch and interface
- Web Watch Library
- Unpublished narrow staging-channel artifact bf260d7e-staging-20260905175943
- Canonical title slots
- Existing title updates
- Free access and consent
- Manual slot release
- Rejected observations
- Unfiltered Pending sync shared observations
- eslintrc
- PR AI Contribution Notes
- google
- google ads tokens mergegoogleadstokens
- kreatli crm gmail tokens cleargmailtokens
- kreatli crm gmail tokens isgmailconnected
- lib founder discord founder discord username
- lib gtag ga measurement id
- lib room quota min session start seconds
- lib social account limits max instagram accounts
- lib social account limits max tiktok accounts
- node http
- node zlib
- og
- pg_catalog.pg_trigger
- Allowed Native Build Dependencies
- Minimum Release Age Exclusion
- public.subscriptions
- public.user_tracked_titles
- script
- src constants anidachi build id
- src constants api http base
- src constants api ws base
- src crunchyroll control crunchyroll control result source
- src crunchyroll control crunchyroll control source
- src index p2psignal
- src message composer events anidachi composer open attr
- src message composer events anidachi message composer shortcut event
- src message composer events anidachi message composer submit event
- Relay/TURN Mode
- Run
- What This Harness Does Not Prove
- unified
- apps demo src styles css
- apps web app globals css
- apps web lib google ads tokens.ts
- apps web lib kreatli crm gmail tokens.ts

## God Nodes (most connected - your core abstractions)
1. `.next/**` - 177 edges
2. `next/link` - 176 edges
3. `vitest` - 173 edges
4. `SeoPageLayout()` - 146 edges
5. `TocHeading` - 143 edges
6. `react` - 137 edges
7. `next/server` - 125 edges
8. `getGuideLinks()` - 122 edges
9. `node:assert/strict` - 119 edges
10. `getResolvedSiteOrigin()` - 116 edges

## Surprising Connections (you probably didn't know these)
- `Project Planes` --semantically_similar_to--> `API Review Scope`  [INFERRED] [semantically similar]
  AGENTS.md → .coderabbit.yaml
- `Project Planes` --semantically_similar_to--> `Extension Review Scope`  [INFERRED] [semantically similar]
  AGENTS.md → .coderabbit.yaml
- `Project Planes` --semantically_similar_to--> `Protocol Review Scope`  [INFERRED] [semantically similar]
  AGENTS.md → .coderabbit.yaml
- `Project Planes` --semantically_similar_to--> `Web Review Scope`  [INFERRED] [semantically similar]
  AGENTS.md → .coderabbit.yaml
- `Three-Plane Architecture` --semantically_similar_to--> `Project Planes`  [INFERRED] [semantically similar]
  docs/new-chat-project-context.md → AGENTS.md

## Import Cycles
- 1-file cycle: `apps/web/app/about/page.tsx -> apps/web/app/about/page.tsx`
- 1-file cycle: `apps/web/lib/utils.ts -> apps/web/lib/utils.ts`
- 1-file cycle: `apps/extension/test/privileged-overlay-wiring.test.tsx -> apps/extension/test/privileged-overlay-wiring.test.tsx`
- 1-file cycle: `apps/extension/test/release-channel-build.test.ts -> apps/extension/test/release-channel-build.test.ts`
- 1-file cycle: `apps/extension/entrypoints/background.ts -> apps/extension/entrypoints/background.ts`
- 1-file cycle: `apps/extension/src/account-inbox-cache.ts -> apps/extension/src/account-inbox-cache.ts`
- 1-file cycle: `apps/extension/src/extension-channel-identity.ts -> apps/extension/src/extension-channel-identity.ts`
- 1-file cycle: `apps/extension/wxt.config.ts -> apps/extension/wxt.config.ts`
- 1-file cycle: `apps/api/test/auth.test.ts -> apps/api/test/auth.test.ts`
- 1-file cycle: `apps/extension/src/active-adapter-playback.ts -> apps/extension/src/active-adapter-playback.ts`
- 1-file cycle: `apps/web/app/blou/manager/connect-client.tsx -> apps/web/app/blou/manager/connect-client.tsx`
- 1-file cycle: `apps/web/app/account/account-nav.tsx -> apps/web/app/account/account-nav.tsx`
- 1-file cycle: `apps/api/src/index.ts -> apps/api/src/index.ts`
- 1-file cycle: `apps/api/src/auth.ts -> apps/api/src/auth.ts`
- 1-file cycle: `apps/web/app/api/account/inbox/route.ts -> apps/web/app/api/account/inbox/route.ts`
- 1-file cycle: `apps/web/app/account/watch-library/watch-library-client.test.tsx -> apps/web/app/account/watch-library/watch-library-client.test.tsx`
- 1-file cycle: `packages/protocol/src/account.ts -> packages/protocol/src/account.ts`
- 1-file cycle: `apps/extension/entrypoints/content.tsx -> apps/extension/entrypoints/content.tsx`
- 1-file cycle: `apps/web/app/layout.tsx -> apps/web/app/layout.tsx`
- 1-file cycle: `apps/web/lib/pre-release-security-boundaries.test.ts -> apps/web/lib/pre-release-security-boundaries.test.ts`

## Hyperedges (group relationships)
- **Deferred Together: Target ordered group capture with terminal lifecycle and bounded durable delivery** — docs_superpowers_specs_2026_09_07_together_watch_design_target_terminal_group_session, docs_superpowers_specs_2026_09_07_together_watch_design_target_personal_group_routing, docs_superpowers_specs_2026_09_07_together_watch_design_target_checkpoint_acceptance, docs_superpowers_specs_2026_09_07_together_watch_design_target_ordering_and_reset_fences, docs_superpowers_specs_2026_09_07_together_watch_design_target_bounded_checkpoint_queue [EXTRACTED 1.00]
- **Canonical progress convergence and recovery** — docs_shared_watch_progress_tracker_canonical_progress_authority, docs_shared_watch_progress_tracker_background_cache_outbox, docs_shared_watch_progress_tracker_transactional_history_fences, docs_shared_watch_progress_tracker_metadata_pending_observations [EXTRACTED 1.00]
- **Isolated Free rehearsal scheduling execution and recovery** — docs_releases_personal_history_mvp_free_rehearsal_window_window_receipt, docs_releases_personal_history_mvp_free_hosted_rehearsal_backup_binding, docs_releases_personal_history_mvp_free_hosted_rehearsal_same_database_recovery, docs_releases_personal_history_mvp_free_rehearsal_window_resume_on_failure [EXTRACTED 1.00]
- **Historical first recovery data equality and two security mismatches** — docs_releases_personal_history_mvp_free_hosted_rehearsal_data_recovery_pass, docs_releases_personal_history_mvp_free_hosted_rehearsal_surplus_client_grants, docs_releases_personal_history_mvp_free_hosted_rehearsal_managed_role_residual, docs_releases_personal_history_mvp_free_hosted_rehearsal_transactional_acl_correction [EXTRACTED 1.00]
- **Environment-specific Release Delivery** — docs_environment_and_secrets_matrix_environment_isolation, docs_extension_release_channels_stable_channel_identity, github_workflows_deploy_api_branch_scoped_worker_delivery [INFERRED 0.85]
- **Room Reliability Contract and Evidence** — docs_superpowers_plans_2026_06_07_production_room_p2p_hardening_roadmap_versioned_room_event_envelope, docs_superpowers_plans_2026_06_12_room_flow_p2p_flawless_execution_plan_two_browser_measurement_gate, tests_e2e_readme_real_webrtc_harness [INFERRED 0.85]
- **Code Refresh, Semantic Refresh, and Freshness Policy** — docs_project_knowledge_map_normalized_code_graph_refresh, docs_project_knowledge_map_codex_hosted_semantic_extraction, docs_project_knowledge_map_incremental_freshness_policy [EXTRACTED 1.00]
- **One Policy Drives Launcher, Rail, and Preview** — docs_superpowers_plans_2026_07_30_interface_visibility_settings_pure_visibility_policy, docs_superpowers_plans_2026_07_30_interface_visibility_settings_main_control_integration, docs_superpowers_plans_2026_07_30_interface_visibility_settings_persistent_participant_rail, docs_superpowers_plans_2026_07_30_interface_visibility_settings_finite_policy_preview [EXTRACTED 1.00]
- **Server contract, isolated client, drawer presentation, and local integration** — docs_superpowers_plans_2026_09_05_watch_drawer_browse_durable_provenance_server_boundary, docs_superpowers_plans_2026_09_05_watch_drawer_browse_watch_history_browse_contract, docs_superpowers_plans_2026_09_05_watch_drawer_browse_query_isolated_extension_client, docs_superpowers_plans_2026_09_05_watch_drawer_browse_drawer_layout_settings, docs_superpowers_plans_2026_09_05_watch_drawer_browse_integration_evidence_handoff [EXTRACTED 1.00]
- **Fast saved-history display with bounded server refresh** — docs_superpowers_plans_2026_09_05_watch_history_local_read_exact_query_episode_previews, docs_superpowers_plans_2026_09_05_watch_history_local_read_persistent_read_cache, docs_superpowers_plans_2026_09_05_watch_history_local_read_drawer_integration, docs_superpowers_plans_2026_09_05_watch_history_local_read_hard_read_fences [EXTRACTED 1.00]
- **Local evidence establishes a candidate while authenticated rollout remains pending** — docs_watch_drawer_browse_local_verification_automated_source_evidence, docs_watch_drawer_browse_local_verification_exact_source_database_evidence, docs_watch_drawer_browse_local_verification_isolated_narrow_artifact, docs_watch_drawer_browse_local_verification_real_component_visual_evidence, docs_watch_drawer_browse_local_verification_review_gate_exceptions, docs_watch_drawer_browse_local_verification_authorized_rollout_sequence [EXTRACTED 1.00]
- **Independent layers of local candidate verification** — docs_watch_history_local_read_verification_source_sql_evidence, docs_watch_history_local_read_verification_installed_mv3_evidence, docs_watch_history_local_read_verification_build_isolation, docs_watch_history_local_read_verification_review_fixes [EXTRACTED 1.00]
- **Local CLI atomicity proof and pending hosted prefix gate** — docs_releases_personal_history_mvp_free_hosted_rehearsal_local_cli_atomicity_receipt, docs_releases_personal_history_mvp_free_hosted_rehearsal_prefix_37_38_full_recovery, docs_releases_personal_history_mvp_free_hosted_rehearsal_prefix_50_resume_gate, docs_releases_personal_history_mvp_free_hosted_rehearsal_prefix_evidence_scope [EXTRACTED 1.00]
- **Wave 1 High-severity Boundaries** — docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_wave_1_immediate_high_severity_boundaries, docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_nextjs_15_5_23_security_patch, docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_public_and_private_blob_isolation [EXTRACTED 1.00]
- **Wave 2 Auth Security Chain** — docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_browser_oauth_transaction_binding, docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_extension_client_binding_and_pkce, docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_refresh_family_channel_rotation [EXTRACTED 1.00]
- **Wave 3 Room and Extension Isolation** — docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_room_history_authority_lifetime, docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_pre_join_websocket_admission, docs_superpowers_plans_2026_08_18_pre_release_security_reliability_readiness_plan_privileged_overlay_and_diagnostics_isolation [EXTRACTED 1.00]
- **Core Foundation Cross Plane Contracts** — docs_superpowers_plans_2026_08_21_core_foundation_ui_handoff_plan_monotonic_source_persistence, docs_superpowers_plans_2026_08_21_core_foundation_ui_handoff_plan_lifecycle_invite_actionability [EXTRACTED 1.00]
- **CRM Data Model** — apps_web_crm_data_schema_crm_data_layout, apps_web_crm_data_schema_contact_record, apps_web_crm_data_schema_touch_event, apps_web_crm_data_schema_outreach_queue_eligibility [EXTRACTED 1.00]
- **Seat authority, local intent and retained receive** — docs_superpowers_plans_2026_09_14_host_managed_media_seats_host_managed_media_seats_v3, docs_superpowers_plans_2026_09_14_host_managed_media_seats_serialized_roomstate_authority, docs_superpowers_plans_2026_09_14_host_managed_media_seats_local_intent_and_confirmed_capture, docs_superpowers_plans_2026_09_14_host_managed_media_seats_listener_receive_continuity [EXTRACTED 1.00]
- **Duplicate Off prevention, guarded settlement and transient feedback** — docs_superpowers_plans_2026_09_14_host_managed_media_seats_transient_media_request_feedback, docs_superpowers_plans_2026_09_14_host_managed_media_seats_duplicate_off_after_capture_failure, docs_superpowers_plans_2026_09_14_host_managed_media_seats_successful_off_sends_per_transport, docs_superpowers_plans_2026_09_14_host_managed_media_seats_guarded_duplicate_stale_reply_settlement, docs_superpowers_plans_2026_09_14_host_managed_media_seats_transient_rejection_feedback [EXTRACTED 1.00]
- **Graphify Extraction Pipeline** — _codex_skills_graphify_skill_file_detection, _codex_skills_graphify_skill_ast_structural_extraction, _codex_skills_graphify_skill_semantic_extraction, _codex_skills_graphify_skill_ast_semantic_merge, _codex_skills_graphify_skill_graph_build_pipeline [EXTRACTED 1.00]
- **Graph Integrity and Persistence** — _codex_skills_graphify_skill_graph_shrink_guard, _codex_skills_graphify_skill_graph_health_check, _codex_skills_graphify_skill_manifest_and_cost_tracking, _codex_skills_graphify_skill_incremental_update [EXTRACTED 1.00]
- **Graph Navigation Commands** — _codex_skills_graphify_skill_graph_query_navigation, _codex_skills_graphify_skill_graph_path_navigation, _codex_skills_graphify_skill_graph_node_explanation [EXTRACTED 1.00]
- **Incremental Graph Consistency Controls** — _codex_skills_graphify_references_update_incremental_detection, _codex_skills_graphify_references_update_semantic_cache_invalidation, _codex_skills_graphify_references_update_changed_file_replacement, _codex_skills_graphify_references_update_portable_manifest, _codex_skills_graphify_references_update_semantic_output_stamp_gate [EXTRACTED 1.00]
- **Participant Session Identity Flow** — docs_superpowers_plans_2026_08_23_single_active_room_session_implementation_plan_prepared_session_candidate, docs_superpowers_plans_2026_08_23_single_active_room_session_implementation_plan_participant_session_id, docs_superpowers_plans_2026_08_23_single_active_room_session_implementation_plan_room_token_session_binding, docs_superpowers_plans_2026_08_23_single_active_room_session_implementation_plan_pending_disconnect_records [EXTRACTED 1.00]
- **Voice Mode Publication Speech and Flow Separation** — docs_superpowers_plans_2026_07_27_voice_controls_and_participant_audio_plan_room_scoped_voice_state, docs_superpowers_plans_2026_07_27_voice_controls_and_participant_audio_plan_microphone_publication_state, docs_superpowers_plans_2026_07_27_voice_controls_and_participant_audio_plan_audio_speech_activity, docs_superpowers_plans_2026_07_27_voice_controls_and_participant_audio_plan_audio_transport_flow [EXTRACTED 1.00]
- **Waitlist CRM Final Staging Acceptance** — docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_final_staging_runtime_acceptance, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_three_observed_failed_survey_submissions_recovered, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_staging_survey_lead_count_685, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_fresh_preview_deployment_dpl_anazpf8xthuccrymz19tdkq2y3rq [EXTRACTED 1.00]
- **Waitlist CRM Production Closeout** — docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_task_7_complete, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_production_main_promotion_pr_240, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_fresh_production_redeploy_dpl_dct6ocjbbej848rfac38w5bhbdyg, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_production_crm_runtime_logs_clean, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_distinct_live_signup_2026_08_23t18_13_49_881z, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_post_signup_private_authority_688_contacts_686_survey_leads, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_final_docs_triggered_production_deployment_dpl_hcqvvanf9v4enshjyekrpmkfqeuy, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_live_product_counts_are_dynamic [EXTRACTED 1.00]
- **Waitlist CRM Runtime Durability Chain** — docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_crm_runtime_authority, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_optimistic_blob_mutation, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_conflict_safe_crm_mutations, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_truthful_public_submission_responses [EXTRACTED 1.00]
- **Watch History v2 Canonical Pipeline** — docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_provider_owned_eligibility, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_meaningful_progress_controller, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_extension_background_single_writer, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_authenticated_v2_web_service, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_transactional_progress_writer, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_canonical_v2_read_model, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_popup_website_read_model_cutover [EXTRACTED 1.00]
- **Watch History v2 Consistency Fences** — docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_account_history_generation_fencing, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_idempotency_first_conflict_ordering, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_deletion_fences, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_bounded_shape_outbox [EXTRACTED 1.00]
- **Watch History v2 Release Sequence** — docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_versioned_protocol_contract, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_authenticated_v2_web_service, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_extension_background_single_writer, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_logical_pre_release_cutover, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_staging_acceptance_matrix, docs_superpowers_plans_2026_08_14_watch_history_v2_clean_mvp_implementation_production_deployment_ordering [EXTRACTED 1.00]
- **Extension Release Safety** — github_workflows_build_extension_release_ref_validation, github_workflows_build_extension_extension_channel [INFERRED 0.85]
- **Rendered owner and captured authority prevent stale mutations** — docs_superpowers_specs_2026_09_10_account_mvp_navigation_design_optional_profile_owner_mismatch_fence_with_compatible_old_clients, docs_superpowers_plans_2026_09_11_friends_groups_link_mvp_x_anidachi_social_owner_mismatch_fence, docs_superpowers_plans_2026_09_10_account_library_editor_revision_bound_owner_fenced_manual_progress_editor_api, docs_releases_personal_history_mvp_2026_09_12_prelaunch_verification_event_arrival_provider_sample_and_authority_revision_fence, docs_releases_personal_history_mvp_2026_09_12_prelaunch_verification_authority_refresh_invalidates_queued_samples_across_eligibility_changes [INFERRED 0.85]
- **Canonical Catalog Progress Model** — docs_superpowers_plans_2026_09_05_watch_history_crunchyroll_catalog_progress_plan_canonical_progress_model, docs_superpowers_specs_2026_08_13_watch_history_catalog_progress_design_canonical_durable_data_model, docs_watch_history_v3_local_verification_canonical_schema_3_storage [INFERRED 0.95]
- **Cross-Plane Architecture and Contract Governance** — agents_project_planes, agents_cross_plane_contract_first, docs_new_chat_project_context_three_plane_architecture [INFERRED 0.95]
- **Derived reads preserve server authority and confirmed provenance** — docs_watch_history_local_read_verification_bounded_cache_policy, docs_watch_history_local_read_verification_preview_continuation, docs_watch_history_local_read_verification_pending_shared_observations [INFERRED 0.95]
- **Exact Departure Identity Fence** — docs_superpowers_plans_2026_08_31_authoritative_room_departure_persistent_exact_operation_generation, docs_superpowers_plans_2026_08_31_authoritative_room_departure_authoritative_room_snapshot_handoff, docs_superpowers_specs_2026_08_31_authoritative_room_departure_design_exact_session_invariants, docs_superpowers_specs_2026_08_31_authoritative_room_departure_design_late_admission_compensation [INFERRED 0.95]
- **Final History Boundary Fixes** — docs_superpowers_plans_2026_09_05_watch_history_crunchyroll_catalog_progress_plan_final_local_implementation_closeout, docs_watch_history_v3_local_verification_final_review_fixes [INFERRED 0.95]
- **History capacity admission and management** — docs_watch_history_capacity_provider_limits, docs_watch_history_capacity_canonical_title_slots, docs_watch_history_capacity_existing_title_updates, docs_watch_history_capacity_manual_slot_release, docs_watch_history_capacity_canonical_admission_guard, docs_watch_history_capacity_canonical_capacity_authority, docs_watch_history_capacity_compatible_terminal_envelope, docs_watch_history_capacity_queue_continuation, docs_watch_history_capacity_capacity_endpoint, docs_watch_history_capacity_drawer_capacity_notice, docs_watch_history_capacity_watch_library_counters [INFERRED 0.95]
- **Human-gated Outreach Flow** — apps_web_crm_data_agents_human_controlled_sending, apps_web_crm_data_workflow_gmail_send_step, apps_web_crm_data_workflow_touch_logging_step, apps_web_crm_data_workflow_next_action_scheduling [INFERRED 0.95]
- **Owner confirmed period end cancellation flow** — docs_account_subscription_cancellation_subscription_page, docs_account_subscription_cancellation_cancellation_portal_endpoint, docs_account_subscription_cancellation_cancellation_deep_link, docs_account_subscription_cancellation_default_portal_configuration, docs_account_subscription_cancellation_portal_configuration_validation, docs_account_subscription_cancellation_authoritative_cancellation_return, docs_account_subscription_cancellation_billing_refresh_endpoint, docs_account_subscription_cancellation_fenced_subscription_sync, docs_account_subscription_cancellation_classic_and_flexible_cancellation [INFERRED 0.95]
- **Risk-Gated Staging Release System** — agents_git_release_flow, readme_development_workflow, docs_development_quality_gates_gate_matrix, docs_new_chat_project_context_git_and_release_flow [INFERRED 0.95]
- **Safe CRM Cutover** — docs_superpowers_specs_2026_08_23_waitlist_crm_durable_storage_design_five_object_reconciliation, docs_superpowers_specs_2026_08_23_waitlist_crm_durable_storage_design_deployment_order, docs_superpowers_specs_2026_08_23_waitlist_crm_durable_storage_design_rollback_strategy, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_staging_acceptance, docs_superpowers_plans_2026_08_23_waitlist_crm_durable_storage_recovery_production_cutover [INFERRED 0.95]
- **Schema 3 Staging Activation** — docs_superpowers_plans_2026_09_05_watch_history_crunchyroll_catalog_progress_plan_staging_activation_closeout, docs_superpowers_specs_2026_08_13_watch_history_catalog_progress_design_staging_activation_completion, docs_watch_history_v3_staging_verification_ordered_staging_activation [INFERRED 0.95]
- **Single Active Room Cross-plane Authority** — docs_superpowers_specs_2026_08_23_single_active_room_session_design_durable_cross_room_assignment, docs_superpowers_specs_2026_08_23_single_active_room_session_design_live_room_state, docs_superpowers_specs_2026_08_23_single_active_room_session_design_session_binding [INFERRED 0.95]

## Communities (795 total, 285 thin omitted)

### Community 0 - "seo-guide-blocks.tsx, watch-youtube-together/page.tsx"
Cohesion: 0.03
Nodes (116): faq, headings, metadata, SITE_URL, faq, headings, metadata, SITE_URL (+108 more)

### Community 1 - "SeoPageLayout(), TocHeading"
Cohesion: 0.02
Nodes (96): faq, itemList, metadata, tocHeadings, faq, metadata, tocHeadings, faq (+88 more)

### Community 2 - "auth-client.ts, auth-tokens.ts"
Cohesion: 0.03
Nodes (102): assertExtensionLogoutRedirect(), attemptWebsiteLogoutFlow(), AuthCommand, AuthMessage, AuthMessageResponse, buildExtensionConnectUrl(), buildExtensionLogoutUrl(), buildWebUrl() (+94 more)

### Community 3 - "getGuideLinks(), guide-links.ts"
Cohesion: 0.02
Nodes (99): AnimeWatchPartyPage(), faq, metadata, pillarItemList, SITE_URL, tocHeadings, AnimeWatchPartyToolkitPage(), faq (+91 more)

### Community 4 - "getResolvedSiteOrigin(), json-ld.tsx"
Cohesion: 0.02
Nodes (83): faq, howToSteps, metadata, SITE_URL, tocHeadings, faq, howToSteps, metadata (+75 more)

### Community 5 - "responsive-compare-table.tsx, ResponsiveCompareTable()"
Cohesion: 0.02
Nodes (87): AniDachiVsHyperbeamPage(), faq, headings, metadata, SITE_URL, AniDachiVsMetastreamPage(), faq, headings (+79 more)

### Community 6 - "watch-history-v3-routes.ts, WatchHistoryV3ApiError"
Cohesion: 0.03
Nodes (75): dynamic, POST, dynamic, POST, dynamic, POST, dynamic, GET (+67 more)

### Community 7 - "social.ts, social.test.ts"
Cohesion: 0.05
Nodes (92): dynamic, maxDuration, POST(), GET(), POST(), deferInboxPushOutboxDrain(), acceptFriendInviteLink(), acceptFriendRequest() (+84 more)

### Community 8 - "room-session-storage.ts, room-session-storage.test.ts"
Cohesion: 0.07
Nodes (90): assertTabId(), captureRoomSessionIdentity(), clearRoomSessionDepartureIfMatch(), clearRoomSessionForClosedTab(), clearRoomSessionForDepartureIfMatch(), clearRoomSessionForDepartureIfMatchNow(), clearRoomSessionIfMatch(), clearRoomSessionIfMatchForTabNow() (+82 more)

### Community 9 - "room-invite-notifications.ts, room-invite-notification-retry.ts"
Cohesion: 0.04
Nodes (89): getCachedExtensionSession(), getStoredAuthTokens(), withInvitationHttpDeadline(), beginNotificationRetry(), claimNotificationRetry(), clearNotificationRetryAccount(), completeNotificationRetry(), expired() (+81 more)

### Community 10 - "popup-app.tsx, popup-people-panel.test.tsx"
Cohesion: 0.03
Nodes (68): rootElement, accountErrorState(), accountIdentityChanged(), accountLoadingState(), accountReadyState(), AccountRequestGate, AccountRequestToken, AccountScopeToken (+60 more)

### Community 11 - "overlay-app.tsx, OverlayApp()"
Cohesion: 0.04
Nodes (78): HOLD_FIRE_SUPER_REACTION_EXPERIMENT, normalizeExperimentFlag(), attachAndPlayVideoElement(), activeRoomConflictMessage(), appendVisibleReaction(), buildCurrentSourceUrlForInvite(), CatchUpState, ChatDisplayMode (+70 more)

### Community 12 - "seo-page-layout.tsx, primary-checkout-cta.tsx"
Cohesion: 0.03
Nodes (65): faq, headings, itemList, metadata, SITE_URL, faq, headings, itemList (+57 more)

### Community 13 - "watch-history.ts, watch-history.test.ts"
Cohesion: 0.03
Nodes (82): PersonalWatchHistoryStore, productionStore, WatchLibraryResponseSchema, PersonalWatchProgressEvent, PersonalWatchProgressEventSchema, PersonalWatchProgressRequest, PersonalWatchProgressRequestSchema, WatchHistoryAccessErrorCodeSchema (+74 more)

### Community 14 - "watch_history_v3_disposable_target.mjs, watch_history_v3_catalog_read_states_contract.mjs"
Cohesion: 0.04
Nodes (65): dir, identity(), json(), quote(), snapshot(), sql(), target, cleanup() (+57 more)

### Community 15 - "social-client.ts, social-client.test.ts"
Cohesion: 0.08
Nodes (78): createWebsiteRoomHeaders(), RoomApiError, acceptFriendRequest(), acceptFriendRequestFromApi(), acceptFriendRequestHttpMessage(), acceptInviteHttpMessage(), acceptRoomInvite(), acceptRoomInviteFromApi() (+70 more)

### Community 16 - "popup-watch-drawer.tsx, popup-watch-history.tsx"
Cohesion: 0.05
Nodes (66): PopupEpisodeProgress(), HistoryConsent(), PopupHistorySettings(), BrowseMessage, Parser, PopupWatchBrowseRecovery, PopupWatchBrowseViews, usePopupWatchBrowse() (+58 more)

### Community 17 - ".next/**, next/link"
Cohesion: 0.03
Nodes (50): metadata, faq, headings, metadata, SITE_URL, faq, headings, metadata (+42 more)

### Community 18 - "protocol/src/index.ts, next/server"
Cohesion: 0.07
Nodes (56): dynamic, POST(), dynamic, POST(), dynamic, POST(), dynamic, POST() (+48 more)

### Community 19 - "PlaybackSyncController, .applyHostState()"
Cohesion: 0.09
Nodes (18): isMediaSettling(), isMediaTimeBuffered(), MediaReadyReason, READY_EVENTS, shouldDeferHostStateSeek(), shouldSeekForHostState(), shouldSeekForRemoteCommand(), shouldThrottleRemoteSeekAttempt() (+10 more)

### Community 20 - "pricing-copy.ts, how-to-host-a-crunchyroll-watch-party/page.tsx"
Cohesion: 0.03
Nodes (66): faq, itemList, metadata, tocHeadings, faq, headings, metadata, SITE_URL (+58 more)

### Community 21 - "room-persistence.ts, room-source-persistence.ts"
Cohesion: 0.05
Nodes (73): nextParticipantDisconnectAlarmAt(), activeRoomLifecycle, EMPTY_ROOM_RETRY_BASE_MS, EMPTY_ROOM_RETRY_MAX_MS, emptyRoomLifecycle, emptyRoomRetryAt(), endedRoomLifecycle, endedRoomTombstone (+65 more)

### Community 22 - "RoomDurableObject, .handleMessage()"
Cohesion: 0.09
Nodes (10): handleRoomWebSocketMessageBoundary(), RoomDurableObject, roomEndedEvent(), sendAndCloseEndedRoomSockets(), clearStoredRoomLifecycleAndAlarm(), initializeRoomStorage(), readEndedRoomTombstone(), readNextP2PServerSeq() (+2 more)

### Community 23 - "room-session.ts, anidachi-auth/room-lifecycle.ts"
Cohesion: 0.05
Nodes (64): lifecycleApi, dynamic, POST(), activeRoomChanged(), authRequired(), CurrentAssignment, departResolvedAssignment(), DepartureDependencies (+56 more)

### Community 24 - "p2p-media.ts, voice-activity.ts"
Cohesion: 0.04
Nodes (67): createLocalAudioLevelMeter(), LocalAudioLevelMeter, addOptionalNumbers(), applyP2PCodecPreferences(), configureSender(), copyDefinedStat(), countMatches(), createP2PMediaSignalDedupeKey() (+59 more)

### Community 25 - "watch-history-client.ts, watch-history-client.test.ts"
Cohesion: 0.05
Nodes (58): CrunchyrollHistoryMetadata, canCaptureWatchHistory(), canReadWatchHistory(), createWatchHistoryLease(), parseWatchHistoryLease(), personalEnvelopeEligible(), contextKey(), createWatchHistoryCatalogCoordinator() (+50 more)

### Community 26 - "jwt.ts, [roomId]/connect/route.ts"
Cohesion: 0.06
Nodes (61): dynamic, maxDuration, POST(), dynamic, POST(), activeRoomConflictResponse(), claimActiveRoomSession(), createRoomWithActiveSession() (+53 more)

### Community 27 - "watch-library.ts, cleanWatchProgressEntry"
Cohesion: 0.05
Nodes (70): listRoomMembers(), RoomMemberRow, RoomRow, UserRow, getLegacyWatchLibraryEntitlements(), ProfileRow, archiveOldestTrackedTitlesOverLimit(), buildWatchLibraryItems() (+62 more)

### Community 28 - "core/types.ts, html5-video-adapter.ts"
Cohesion: 0.06
Nodes (30): duckVideoVolume(), getDocumentVideoKey(), getStableVideoSourceKey(), Html5VideoAdapter, PlayerOverlayGeometryListener, buildWatchSourceDescriptor(), normalizeWatchTitle(), canonicalWatchSourceUrl() (+22 more)

### Community 29 - "RoomState, room-state.ts"
Cohesion: 0.04
Nodes (17): emptyMediaState(), HostStateUpdateErrorCode, HostStateUpdateResult, LEGACY_ROOM_CAPABILITIES, matchesCanonicalFingerprint(), MediaSeatChangeCode, MediaSeatChangeResult, NormalizedRoomSourceUpdate (+9 more)

### Community 30 - "device-push.ts, device-push.test.ts"
Cohesion: 0.05
Nodes (56): DELETE(), dynamic, dynamic, GET(), maxDuration, POST(), AccountInboxPushResult, defaultDevicePushRepository (+48 more)

### Community 31 - "plan-entitlements.ts, anidachi-auth/watch-history-access.ts"
Cohesion: 0.05
Nodes (51): AccountWatchLibraryPage(), dynamic, metadata, Dependencies, loadWatchLibraryData(), dynamic, GET, dynamic (+43 more)

### Community 32 - "stripe-subscription-sync.ts, stripe-plans.ts"
Cohesion: 0.05
Nodes (57): checkoutSessionUserId(), dynamic, POST(), CheckoutTier, getOrCreateStripeCustomer(), loginUrlForRequest(), POST(), POST() (+49 more)

### Community 33 - "[slug]/page.tsx, jikan-for-watch-page.ts"
Cohesion: 0.06
Nodes (60): AnimeWithFriendsPage(), buildTitleTag(), buildToc(), dynamic, generateMetadata(), getAnimeBySlug(), getPageLastModified(), Props (+52 more)

### Community 34 - "account.ts, friends-client-contracts.ts"
Cohesion: 0.03
Nodes (68): parseRecentPeopleResponse(), AcceptedRoomInviteResponse, AcceptedRoomInviteResponseSchema, ACCOUNT_RESPONSE_SCHEMA_VERSION, AccountInboxActiveRoomInviteItemSchema, AccountInboxCounts, AccountInboxCountsSchema, AccountInboxFriendRequestItemSchema (+60 more)

### Community 35 - "src/types.ts, protocol.test.ts"
Cohesion: 0.04
Nodes (58): WorkerAuthEnv, env, getSecret(), isBoundedId(), isBoundedUrl(), legacyVerifyRoomToken(), serverJwtSecret(), OTHER_SECRET (+50 more)

### Community 36 - "source-navigation.ts, registry.ts"
Cohesion: 0.05
Nodes (31): SourceAdapterHistoryPolicy, CanonicalSourceNavigationResult, DefinitionLookup, ensureGenericSource(), ensureSourceForProvider(), navigationRejection(), resolveCanonicalSourceNavigation(), withRoomHash() (+23 more)

### Community 37 - "crm-client.tsx, actions.ts"
Cohesion: 0.06
Nodes (61): addContactAction(), applyImportAction(), CrmActionState, deleteContactAction(), exportCsvDataAction(), exportSurveyLeadsCsvAction(), guard(), ImportPreviewResult (+53 more)

### Community 38 - "oauth-transaction.ts, handle-oauth-callback.ts"
Cohesion: 0.07
Nodes (50): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+42 more)

### Community 39 - "room-client.ts, room-client-auth.test.ts"
Cohesion: 0.05
Nodes (56): AdmittedRoom, assertRoomHttpResponse(), bridgeError(), buildRoomWebSocketUrl(), cleanupCancelledRoomAdmission(), clearUnobservedCancelledAdmission(), ConfirmedAdmissionDepartureOutcome, confirmPreparedRoomSessionForSender() (+48 more)

### Community 40 - "crunchyroll.content.ts, handleControlRequest()"
Cohesion: 0.07
Nodes (64): BitmovinLikePlayer, BitmovinNamespace, BitmovinPlayerConstructor, BitmovinPlayerMethod, clampMediaTime(), clickElement(), CrunchyrollKatamariPlayer, delay() (+56 more)

### Community 41 - "P2PMediaController, logDebug()"
Cohesion: 0.10
Nodes (7): logDebug(), classifyMicrophoneTerminalFailure(), formatCameraErrorMessage(), formatMicrophoneErrorMessage(), microphoneErrorName(), P2PMediaController, stopStream()

### Community 42 - "room-media-defaults.ts, use-room-join-defaults.test.tsx"
Cohesion: 0.06
Nodes (37): CAMERA_OPTIONS, MICROPHONE_OPTIONS, resolveOptionIndex(), RoomDefaultControl(), RoomDefaultsSettingsPanel(), RoomDefaultsSettingsPanelProps, CAMERA_ENABLED_PREFERENCE_VERSION, CameraEnabledPreferenceRecord (+29 more)

### Community 43 - "room-departure-retry.ts, createRoomDepartureRetryCoordinator()"
Cohesion: 0.05
Nodes (44): acknowledgeRoomDepartureAdmissionHandoff(), claimRoomDepartureAdmissionHandoffCleanup(), createRoomDepartureRetryCoordinator(), defaultRoomDepartureRetryCoordinator, departPersistedRoomSession(), drainRoomDepartureRetries(), earliestAttempt(), exactIdentity() (+36 more)

### Community 44 - "getSession(), next/navigation"
Cohesion: 0.06
Nodes (44): AccountBugReportPage(), metadata, AccountFeatureRequestsPage(), metadata, AccountFriendsPage(), dynamic, metadata, dynamic (+36 more)

### Community 45 - "connect/page.tsx, extension-codes.ts"
Cohesion: 0.06
Nodes (53): dynamic, POST(), ExtensionConnectMobileConfirm(), dynamic, ExtensionConnectPage(), metadata, Props, dynamic (+45 more)

### Community 46 - "lucide-react, cn()"
Cohesion: 0.06
Nodes (43): ConnectClient(), ERROR_MESSAGES, IgAccount, IgStatus, TtAccount, TtStatus, YtAccount, YtStatus (+35 more)

### Community 47 - "room-media.ts, protocol/test/room-media-seats.test.ts"
Cohesion: 0.04
Nodes (62): Generation, HostMediaRevoke, HostMediaRevokeSchema, isRoomMediaPairAllowed(), MediaIntentAck, MediaIntentError, MediaIntentSchema, MediaSeatResult (+54 more)

### Community 48 - "crunchyroll/progress.ts, season.ts"
Cohesion: 0.07
Nodes (61): isValidHistoryMedia(), normalizeHistoryUrl(), cleanCrunchyrollTitle(), cleanImageUrl(), collectJsonLdSeasonCandidates(), collectJsonLdSeriesCandidates(), CrunchyrollCurrentObjectIdentity, crunchyrollHistoryPolicy (+53 more)

### Community 49 - "anidachi-auth/watch-history-browse.ts, protocol/src/watch-history-browse.ts"
Cohesion: 0.05
Nodes (54): dynamic, GET, dynamic, GET, dynamic, GET, dynamic, GET (+46 more)

### Community 50 - "diagnostic-log.ts, constants.ts"
Cohesion: 0.06
Nodes (58): ANIDACHI_BUILD_ID, API_HTTP_BASE, API_WS_BASE, VOICE_KEYWORD_EMOJI, WEB_HTTP_BASE, WXT_VAPID_PUBLIC_KEY, appendDiagnosticEntry(), clearDiagnosticEntries() (+50 more)

### Community 51 - "p2p-media-harness.mjs, main()"
Cohesion: 0.07
Nodes (58): node:http, runMediaSeatsCase(), sleep(), API_DIR, appendWorkerVar(), buildWorkerArgs(), bundleHarness(), cleanupHarness() (+50 more)

### Community 52 - "api/src/index.ts, routes.test.ts"
Cohesion: 0.06
Nodes (40): app, closeInvalidRoomFrame(), closeRoomRateLimitedSocket(), consumeParsedRoomEventBoundary(), consumeRoomFrameBoundary(), departureResponse(), detachResponse(), encode() (+32 more)

### Community 53 - "privileged-overlay-intent.ts, privileged-overlay-intent.test.ts"
Cohesion: 0.08
Nodes (52): getCurrentExtensionSession(), isAuthMessage(), activeRoomAuthorityClaimExecutionsByTab, assertIntentResponse(), authorityStorageKey(), authorityStorageMutationQueuesByTab, clearPrivilegedOverlayContextForTab(), clearRoomAuthorityClaimIfOwned() (+44 more)

### Community 54 - "site-url.ts, best-action-anime-to-watch-with-friends/page.tsx"
Cohesion: 0.03
Nodes (43): faq, headings, metadata, SITE_URL, faq, headings, metadata, SITE_URL (+35 more)

### Community 55 - "video/prepare/route.ts, reel/route.ts"
Cohesion: 0.11
Nodes (50): AccountResult, blobUrlToProxyUrl(), POST(), prepareTikTokImages(), publishToIgAccount(), AccountResult, blobUrlToProxyUrl(), maxDuration (+42 more)

### Community 56 - "db.ts, db()"
Cohesion: 0.07
Nodes (53): dynamic, POST(), POST(), ActiveRoomClaimResult, ActiveRoomCreateResult, ActiveRoomSummary, beginStripeEventProcessing(), beginStripeSubscriptionRefresh() (+45 more)

### Community 57 - "content.tsx, content-lifecycle.test.tsx"
Cohesion: 0.06
Nodes (34): ContentLifecycleDependencies, ContentLifecycleRuntime, createReactOverlayRenderer(), detectLifecycleResult(), ensurePageStyles(), installMessageComposerKeyboardGuard(), LOCAL_CONTENT_SCRIPT_MATCHES, main() (+26 more)

### Community 58 - "popup-people-model.ts, popup-inbox-panel.tsx"
Cohesion: 0.05
Nodes (30): AccountOwnedState, InboxInviteAction, PopupInboxPanel(), AccountInboxItem, buildPopupInboxModel(), buildPopupPeopleModel(), cloneFriend(), cloneGroup() (+22 more)

### Community 59 - "watch-history-v3.ts, invalidDatabaseResponse()"
Cohesion: 0.11
Nodes (54): buildHostAuthoritativeWatchHistoryRoomSource(), buildWatchHistoryTitleEpisodesV3Response(), buildWatchHistoryV3Response(), EvidenceCase, GENERATED_AT, compareEpisodeRows(), compareObservationDescending(), databaseRowKey() (+46 more)

### Community 60 - "createWatchHistoryClient(), watchHistoryPartitionKey()"
Cohesion: 0.12
Nodes (56): bestEffortFlushWatchHistoryBeforeSignOut(), browseHardRevision(), browsePath(), browseReadRevision(), browseResponseMatchesQuery(), browseResponseMeta(), capturePauseKey(), createWatchHistoryClient() (+48 more)

### Community 61 - "chrome-extension-demo-async-overlay.tsx, chrome-extension-demo.tsx"
Cohesion: 0.06
Nodes (33): ActiveWatcher, ASYNC_STEP_LABELS, AsyncDemoOverlayKeyframes(), AsyncDemoOverlayLayer(), BEAT_CAPTIONS, BEAT_TITLES, DemoMode, FRIEND (+25 more)

### Community 62 - "send-connection-requests.mjs, main()"
Cohesion: 0.07
Nodes (53): esbuild, playwright, node:process, node:readline/promises, dependencies, playwright, name, private (+45 more)

### Community 63 - "watch-history-controller.ts, watch-history-controller.test.ts"
Cohesion: 0.07
Nodes (43): HISTORY_OBSERVATION_SUSPENDED, HistoryObservation, HistoryObservationResult, HistoryPolicyInput, ProviderPlaybackMetadata, youtubeHistoryArtworkUrl(), canonicalSourceUrl(), canonicalYouTubeHistoryUrl() (+35 more)

### Community 64 - "anidachi-logo.tsx, app/login/page.tsx"
Cohesion: 0.06
Nodes (33): metadata, metadata, FriendInviteClient(), initials(), Props, PublicProfile, readJson(), dynamic (+25 more)

### Community 65 - "billing.ts, billing-client.tsx"
Cohesion: 0.06
Nodes (39): BillingClient(), formatDate(), PLAN_NAMES, BillingPage(), dynamic, metadata, dynamic, POST (+31 more)

### Community 66 - "gmail-tokens.ts, gmail.ts"
Cohesion: 0.09
Nodes (41): dynamic, errorToShortString(), failRedirect(), GET(), dynamic, GET(), Body, dynamic (+33 more)

### Community 67 - "store.ts, cli.ts"
Cohesion: 0.12
Nodes (44): GET(), isContactDue(), appendTouch(), assertLocalCrmRuntime(), blobReadText(), blobUpdateText(), ContactMutation, ContactMutationResult (+36 more)

### Community 68 - "/graphify, What You Must Do When Invoked"
Cohesion: 0.04
Nodes (48): AST and Semantic Merge, AST Structural Extraction, Community Detection, Community Labeling, Corpus Size Guard, Existing Graph Fast Path, Corpus File Detection, GitHub and Multi-Path Merge (+40 more)

### Community 69 - "debug-log.ts, videoDebugSnapshot()"
Cohesion: 0.07
Nodes (35): cleanClassName(), clearDebugLog(), compactDebugData(), compactInputData(), compactVideoData(), controlsDebugSnapshot(), copyDebugFields(), DebugEntry (+27 more)

### Community 70 - "reaction-shortcuts.ts, use-reaction-shortcuts.test.tsx"
Cohesion: 0.07
Nodes (23): ANIDACHI_EMOJI_CATALOG, DockScaleStyle, ReactionShortcutEditor(), ReactionShortcutEditorProps, assignReactionShortcut(), getDefaultReactionShortcutPreferences(), isReactionEmoji(), isRecord() (+15 more)

### Community 71 - "Current Development State, Account bug report restoration"
Cohesion: 0.05
Nodes (49): Account bug report restoration, Watch Library account workspace, Versioned owner-bound account read contracts, Atomic recipient resolution and invite action ledger, Bounded hourly auth-artifact cleanup, Bounded query-owned history browse and local read cache, Durable private Blob waitlist and public-form recovery, Current Development State (+41 more)

### Community 72 - "overlay-interface-settings.tsx, top-bubble-reveal.test.tsx"
Cohesion: 0.07
Nodes (34): AnidachiLogoMark(), AnidachiLogoMarkProps, MainControlVisibility, MainControlPresentation, MainControlRevealPhase, ParticipantPillPresentation, ParticipantRailPresentation, resolveMainControlPresentation() (+26 more)

### Community 73 - "overlay-interface-settings.test.tsx, interface-preferences.ts"
Cohesion: 0.07
Nodes (17): getDefaultInterfacePreferences(), INTERFACE_PREFERENCES_STORAGE_KEY, INTERFACE_PREFERENCES_VERSION, InterfacePreferencesPatch, InterfacePreferencesV1, isRecord(), parseInterfacePreferences(), updateInterfacePreferences() (+9 more)

### Community 74 - "participant-disconnect.ts, participant-disconnect.test.ts"
Cohesion: 0.10
Nodes (38): acknowledgeParticipantDisconnect(), acknowledgeStoredParticipantDisconnect(), cancelParticipantDisconnectForJoin(), cancelStoredParticipantDisconnectForJoin(), claimDueParticipantDisconnects(), claimDueStoredParticipantDisconnects(), claimParticipantDisconnect(), claimStoredParticipantDisconnect() (+30 more)

### Community 75 - "VideoAdapter, active-adapter-playback.test.tsx"
Cohesion: 0.07
Nodes (13): ActiveAdapterPlaybackOptions, useActiveAdapterPlayback(), readCurrentResourceDisplay(), ActiveAdapterHooks, AdapterManager, AdapterReconcileResult, CRUNCHYROLL_PLAYBACK_POLICY, DEFAULT_PLAYBACK_POLICY (+5 more)

### Community 76 - "crunchyroll/player-chrome.ts, overlay-geometry.ts"
Cohesion: 0.08
Nodes (36): arePlayerOverlayGeometriesEqual(), DEFAULT_PLAYER_OVERLAY_GEOMETRY, normalizeBoundedValue(), normalizeDimension(), normalizeNonNegativeInteger(), normalizePlayerOverlayGeometry(), PlayerOverlayAnchor, PlayerOverlayGeometry (+28 more)

### Community 77 - "survey-lead.ts, survey-lead-shared.ts"
Cohesion: 0.12
Nodes (36): GET(), AccountWaitlistStatus, buildResult(), buildSurveyNote(), buildSurveySegments(), creditReferrer(), getAccountWaitlistStatus(), mergeSegments() (+28 more)

### Community 78 - "account-inbox.ts, seen/route.ts"
Cohesion: 0.10
Nodes (36): dynamic, GET(), dynamic, POST(), AccountInboxApiError, AccountInboxCountRow, accountInboxCountsFromRow(), accountInboxDatabaseError() (+28 more)

### Community 79 - "room-departure.ts, room-departure.test.ts"
Cohesion: 0.09
Nodes (37): ConfirmedRoomDepartureOutcome, confirmedRuntimeDeparture(), confirmExplicitRoomDeparture(), ConfirmExplicitRoomDepartureDependencies, departActiveWebsiteRoomFromApi(), departExactRoomSession(), departWebsiteRoomFromApi(), explicitDepartureError() (+29 more)

### Community 80 - "google-ads/oauth.ts, oauth/callback/route.ts"
Cohesion: 0.09
Nodes (36): dynamic, failRedirect(), GET(), dynamic, GET(), buildSeed(), generateKeywordIdeas(), GenerateKeywordIdeasInput (+28 more)

### Community 81 - "portfolio-audit.ts, keyword-opportunities.ts"
Cohesion: 0.10
Nodes (39): getGoogleMarketingAuthClient(), fetchGa4LandingByChannel(), fetchGa4LandingConversions(), fetchGa4TopPages(), Ga4LandingChannelRow, Ga4LandingConversionRow, Ga4PageRow, resolveGa4PropertyName() (+31 more)

### Community 82 - "ghost-cam.ts, media-types.ts"
Cohesion: 0.08
Nodes (33): GhostCamOptions, GhostCamSession, IncomingP2PSignalSender, p2pSignalMatchesActiveGeneration(), p2pSignalMetadata(), replayPendingP2PSignals(), syncRemoteVoiceParticipant(), useGhostCam() (+25 more)

### Community 83 - "Account Data Watch History Social And Inbox Foundation Design, Bounded Notification Recovery"
Cohesion: 0.07
Nodes (44): Account Data Watch History Social And Inbox Foundation Design, Account Response Runtime Validation, Bounded Notification Recovery, Chrome FCM Endpoint Allowlist, Chrome Web Push Documentation, Compatibility Blocked Friendship, Cross Surface Acceptance, Cursor History And Exact Counts (+36 more)

### Community 84 - "account-inbox-cache.ts, popup-inbox-convergence.test.tsx"
Cohesion: 0.09
Nodes (33): ACCOUNT_INBOX_CACHE_VERSION, accountInboxCacheKeyForUser(), accountInboxItemInstanceKey(), CachedAccountInbox, clearCachedAccountInboxForUser(), getCachedAccountInboxForUser(), inboxStructure(), isCanonicalUtcTimestamp() (+25 more)

### Community 85 - "blob-reconciliation.ts, blob-reconciliation.test.ts"
Cohesion: 0.09
Nodes (38): assertContact(), BlobHeadResult, BlobReadResult, CONTACT_STATUSES, contentTypeFor(), CrmMeta, digest(), isObject() (+30 more)

### Community 86 - "internal-web-client.ts, api/src/room-presence-evidence.ts"
Cohesion: 0.08
Nodes (34): boundedInternalWebCallbackTimeout(), fetchAndReadJsonWithBoundedTimeout(), INTERNAL_WEB_CALLBACK_TIMEOUT_MS, internalWebCallbackConfig(), InternalWebLifecycleEnv, isLoopbackHostname(), notifyWebParticipantDeparted(), notifyWebRoomEnded() (+26 more)

### Community 87 - "sitemap-discovery.ts, internal-link-audit.ts"
Cohesion: 0.08
Nodes (34): escapeXml(), GET(), AI_TRAINING_BOT_AGENTS, robots(), sitemap(), FORCE_INDEX_URL_PATHS, guideLinks, INTERNAL_TOOL_APP_SEGMENTS (+26 more)

### Community 88 - "plan-survey-modal.tsx, pricing.tsx"
Cohesion: 0.08
Nodes (31): DiscordIcon(), PlanSurveyOpenContext, SurveyStep, isStaleDefaultSurvey(), isValidSegment(), OpenSurveyArgs, PlanSurveyContext, PlanSurveyContextValue (+23 more)

### Community 89 - "vitest, personal-history-capture.test.ts"
Cohesion: 0.08
Nodes (24): ctx, environment, event, WatchHistoryClientDependencies, applyPersonalHistoryResume(), takePersonalHistoryResume(), historyOwner, paidHistoryLease() (+16 more)

### Community 90 - "instagram/storage.ts, hasPrivateIntegrationBlobConfiguration()"
Cohesion: 0.10
Nodes (36): clearStateCookie(), dynamic, GET(), getOrigin(), ShortLivedTokenResponse, compat, __dirname, eslintConfig (+28 more)

### Community 91 - "room-hibernation-runtime.ts, RuntimeRoomClient"
Cohesion: 0.07
Nodes (15): ConnectParams, connectRoomClient(), fixture(), join(), makeEmptyAlarmDue(), openRoomSocket(), participant(), readRoomRuntime() (+7 more)

### Community 92 - "overlay-layout-engine.ts, resolveOverlayLayout()"
Cohesion: 0.12
Nodes (39): CHAT_TEXT_METRICS, clampAxisPosition(), clampInteger(), clampRectToSafeRect(), ContactAxis, createCameraPriorityFallback(), createChatLayout(), createMinimumFallback() (+31 more)

### Community 93 - "session.ts, api/auth/refresh/route.ts"
Cohesion: 0.09
Nodes (28): dynamic, POST(), dynamic, GET(), loginRedirectUrl(), POST(), refreshSessionFromCookie(), dynamic (+20 more)

### Community 94 - "Historical: 2026 09 12 Production Promotion Preparation, Production 35 To 60 Transition"
Cohesion: 0.06
Nodes (40): Schema 3 durable canonical episode authority, Historical: Local application ACL correction and independent source review passed, Historical: Production 35-to-60 preservation prerequisite, Second synthetic hosted application recovery accepted with production gates open, Non-superuser pg_net removal and managed log boundary, Ordinary postgres-only hosted execution policy, Hosted rehearsal external closure drain checkpoint and controlled reopening, Compatible runtime then DB unlock under continuing external maintenance (+32 more)

### Community 95 - "playback-sync-controller.ts, playback-sync-controller.test.ts"
Cohesion: 0.07
Nodes (22): RemoteSeekAttempt, AsyncEpoch, AuthoritativeRoomSource, EMPTY_SESSION, isPlaybackBarrier(), PendingLocalSeek, PendingRemoteSeek, PlaybackSyncControllerOptions (+14 more)

### Community 96 - "youtube/player-chrome.ts, subscribeYouTubePlayerOverlayGeometry()"
Cohesion: 0.11
Nodes (34): AvailableElementRect, childListMutationMayChangeChromeRoots(), childListMutationTouchesChromeRoots(), clampNumber(), getActiveFallbackChromeElements(), getAvailableElementRects(), getAvailableRect(), getAvailableRects() (+26 more)

### Community 97 - "extension-session.ts, active-session/depart/route.ts"
Cohesion: 0.11
Nodes (31): dynamic, POST(), dynamic, GET(), dynamic, POST(), dynamic, POST() (+23 more)

### Community 98 - "watch-library-routes.test.ts, watch-library-routes.ts"
Cohesion: 0.10
Nodes (28): dynamic, POST, dynamic, GET, PATCH, dynamic, POST, dynamic (+20 more)

### Community 99 - "anidachi-auth/watch-history-grid.ts, src/watch-history-grid.ts"
Cohesion: 0.08
Nodes (32): dynamic, GET, runtime, HISTORY_PRIVATE_HEADERS, aggregate(), fail(), fingerprint(), progressFingerprint() (+24 more)

### Community 100 - "middleware.ts, staging-access.ts"
Cohesion: 0.11
Nodes (30): AUTH_REFRESH_PATH, isStaticOrInternalAssetPath(), shouldAutoRefreshWebsiteSession(), isPublicMarketingPath(), needsSessionMiddleware(), buildStagingAccessCookieValue(), canBearerBypassStagingGate(), canBypassStagingGate() (+22 more)

### Community 101 - "overlay-layout-editor.tsx, overlay-layout-interaction.ts"
Cohesion: 0.11
Nodes (34): CHAT_TEXT_SCALE_OPTIONS, createPreviewContext(), FALLBACK_PREVIEW_CONTEXT, finitePositive(), formatChatWidth(), getArrowDelta(), getChatPointerSteps(), getObjectDragPointer() (+26 more)

### Community 102 - "pseo-new-guides.tsx, getGuideMetadata()"
Cohesion: 0.08
Nodes (21): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+13 more)

### Community 103 - "Host-managed media seats v3, Host-managed media seats: delivery and verification"
Cohesion: 0.09
Nodes (38): V3 first-frame clocks start at remote camera grant, Correlated MEDIA_SEAT_RESULT failure after durable rollback, Host-managed media seats: delivery and verification, Negotiated-answer fence for coalescing duplicate remote requests, Owner-approved move of remaining manual acceptance to production, Apply permitted peer authority before synchronous capture stop, Recorded local protocol, SQL, runtime, extension and browser verification, Staging prerequisites PR 316 and activation PR 318 at 293da9f1 (+30 more)

### Community 104 - "Room Flow and P2P Flawless Execution Plan, Stats Based Peer Health"
Cohesion: 0.08
Nodes (38): Authenticated ICE Endpoint, BFCache Session Resume, Bounded Camera Recovery State, Decoded Frame Stall Recovery, Deferred HMAC IP Abuse Signals, Deferred Relay Privacy Mode, Forced Relay Harness, Four Acceptance Layers (+30 more)

### Community 105 - "Watch History Crunchyroll Catalog Progress Implementation Plan, Final Local Implementation Closeout"
Cohesion: 0.10
Nodes (38): Adapted Summary Projections, Canonical Deletion Safety, Canonical Crunchyroll Identity, Canonical Logical Identity, Canonical Progress, Canonical Progress Model, Canonical Progress Semantics, Canonical Reads And Deletion (+30 more)

### Community 106 - "node:fs, node:crypto"
Cohesion: 0.12
Nodes (30): node:child_process, node:crypto, node:fs, child, binding, buildArtifacts(), literal(), read() (+22 more)

### Community 107 - "voice-audio-preferences.ts, voice-audio-preferences.test.ts"
Cohesion: 0.11
Nodes (27): MicrophoneIntent, MicrophoneStatus, shouldPublishMicrophone(), ParticipantAudioContourControl(), ParticipantAudioInlineControl(), ParticipantMuteButton(), applyParticipantAudioSliderValue(), clampParticipantAudioVolume() (+19 more)

### Community 108 - "scripts, build"
Cohesion: 0.05
Nodes (37): scripts, build, build:extension:icons, build:extension:public, build:extension:staging, build:extension:staging:local-broad, check, check:extension:icons (+29 more)

### Community 109 - "p2p-media.test.ts, FakeAudioTrack"
Cohesion: 0.07
Nodes (14): decideP2PSignalConnection(), getP2PAudioTransceiverDirection(), isPoliteP2PPeer(), p2pAudioTrackSwapNeedsNegotiation(), shouldInitiateP2POffers(), dispatchRemoteAudioTrack(), fakeAudioStream(), FakeAudioTrack (+6 more)

### Community 110 - "react, profile-client.tsx"
Cohesion: 0.09
Nodes (22): EditableProfile, ProfileClient(), ProfileResponse, WaitlistStatus, BlouLoginForm(), safeNextParam(), ExtensionCheck(), COPY (+14 more)

### Community 111 - "jsonUnauthorizedUnlessKreatliSession(), blou-access.ts"
Cohesion: 0.09
Nodes (24): dynamic, GET(), OPTIONAL, dynamic, GET(), INSTAGRAM_SCOPES, POST(), GET() (+16 more)

### Community 112 - "public.get_account_inbox_page_v3(), public.save_friend_group_v1()"
Cohesion: 0.07
Nodes (25): anon, cleanup_removed_friend_memberships_v1, public.accept_friend_link_v1(), public.save_friend_group_v1(), validate_friend_group_member_v1, public.claim_active_room_session_v3(), public.create_room_with_active_session_v3(), public.renew_room_media_lease_v2() (+17 more)

### Community 113 - "YouTubeVideoAdapter, playback-phase.ts"
Cohesion: 0.09
Nodes (15): clampVolumePercent(), YouTubeVideoAdapter, AD_CONTAINER_SELECTOR, finiteNonNegative(), isVisibleMarker(), MEDIA_EVENTS, positiveFinite(), snapshotSignature() (+7 more)

### Community 114 - "Task 1 Shared Session and Departure Contracts, Task 2 Atomic Supabase Authority"
Cohesion: 0.06
Nodes (35): Active Room Conflict Response, Active Room Sessions Table, Atomic Active-room RPCs, Single Active Room Cross-plane Architecture, Room Disconnect Grace Constant, Durable Object Disconnect Authority, Extension Web Locks Local Guard, Graphify Semantic Update (+27 more)

### Community 115 - "background.ts, background-invite-notification-wiring.test.ts"
Cohesion: 0.08
Nodes (27): BackgroundPushEvent, dispatchPrivilegedRoomRuntimeMessage(), dispatchRoomDepartureRuntimeMessage(), PrivilegedRoomRuntimeDependencies, RemovedRoomTabDependencies, ROOM_ADMISSION_DEPARTURE_SETTLE_TIMEOUT_MS, waitForAdmissionCompletion(), isDiagnosticMessage() (+19 more)

### Community 116 - "Free hosted 35 to 60 to 35 rehearsal commands, Conditional managed-role policy with second-target acceptance"
Cohesion: 0.09
Nodes (34): Original-binding immutable ACL artifact packages, PostgreSQL ACL normalization REVOKE and platform role references, Full public and migration-history aggregate digests, Application restore TOC with exact ACL reconciliation, Application cleanup restore and hold reinstall in one transaction, Original backup-bound transition input and independent hashes, Complete checksum-bound baseline application ACL capture, Unchanged first 35 migrations with password-free db-url (+26 more)

### Community 117 - "production-history-prefix-proof.mjs, production-history-prefix-proof.test.mjs"
Cohesion: 0.13
Nodes (31): assessPrefixAttempt(), captureSql(), CLI_BINARY_SHA256, CLI_VERSION, context(), controlBinding(), exactKeys(), expectedArchiveRows() (+23 more)

### Community 118 - "overlay-layout-model.ts, normalizeOverlayLayoutDefinition()"
Cohesion: 0.11
Nodes (30): clampInteger(), cloneDefinition(), DEFAULT_LAYOUT, getDefaultOverlayLayoutDefinition(), getDefaultOverlayLayoutPreferencesV2(), isRecord(), normalizeCameraSizeStep(), normalizeGridCoordinate() (+22 more)

### Community 119 - "public-media-blob.test.ts, public-media-blob.ts"
Cohesion: 0.09
Nodes (29): GET(), GOOGLE_ADS_TOKENS_BLOB_PATH, INSTAGRAM_CREDENTIALS_BLOB_PATH, CONTACT_MESSAGES_BLOB_PATH, FEATURE_REQUESTS_BLOB_PATH, GMAIL_TOKENS_BLOB_PATH, KREATLI_CRM_CONTACTS_BLOB_PATH, KREATLI_CRM_META_BLOB_PATH (+21 more)

### Community 120 - "anidachi-auth/watch-history-editor.ts, src/watch-history-editor.ts"
Cohesion: 0.08
Nodes (28): dynamic, { GET, POST }, runtime, createWatchHistoryEditorHandlers(), fail(), historyEditorError(), productionStore, ack (+20 more)

### Community 121 - "dependencies, @amplitude/unified"
Cohesion: 0.06
Nodes (32): @amplitude/unified, dependencies, @amplitude/unified, class-variance-authority, clsx, google-auth-library, googleapis, jose (+24 more)

### Community 122 - "overlay-room-rail.tsx, overlay-room-rail.test.tsx"
Cohesion: 0.11
Nodes (20): ParticipantPillVisibility, EMPTY_REACTION_CUE_PARTICIPANT_IDS, participantInitials(), ROOM_RAIL_CLOSE_DELAY_MS, RoomRail(), RoomRailAvatar(), RoomRailProps, ParticipantAudioControlProps (+12 more)

### Community 123 - "popup-watch-history.test.tsx, subscribeToPopupWatchHistorySnapshot()"
Cohesion: 0.12
Nodes (27): subscribeToPopupWatchHistorySnapshot(), createListWatchHistoryMessage(), click(), clientFixture(), findButton(), findInput(), fixtureBrowseDetail(), fixtureBrowseEpisodes() (+19 more)

### Community 124 - "watch-history-storage.ts, createWatchHistoryStorage()"
Cohesion: 0.11
Nodes (28): WatchHistoryCatalogAcknowledgement, activeGenerationsFromPartitions(), createWatchHistoryStorage(), clearRebuildableAccountData(), discardAllOtherOwnerOutboxes(), discardOtherOwnerOutbox(), ensureMigration(), otherOwnerPendingSummary() (+20 more)

### Community 125 - "feature-requests.ts, feature-request-route.ts"
Cohesion: 0.12
Nodes (24): POST(), dynamic, KreatliCrmPage(), CATEGORY_LABELS, buildEmail(), clientIp(), FeatureRequestPostDependencies, handleFeatureRequestPost() (+16 more)

### Community 126 - "room-source.ts, room-source.test.ts"
Cohesion: 0.11
Nodes (26): dynamic, POST(), persistRoomSource(), assignCleanString(), handleRoomCreateRequestBody(), invalidRequest(), parseRoomCreateRequestBody(), RoomCreateFailure (+18 more)

### Community 128 - "Production Room Realtime and P2P Hardening Roadmap, WebSocket Hibernation"
Cohesion: 0.09
Nodes (32): Cloudflare Hibernation Documentation, Durable Idempotent Room Creation, Historical plan: Durable Shared Watch Progress, Durable Source Persistence Pending, Exact Departure Lifecycle, Generation Scoped Signal Replay, Hibernation Alarm Acceptance Pending, Historical Shared Progress Task (+24 more)

### Community 129 - "room-socket-attachment.ts, api/src/auth.ts"
Cohesion: 0.12
Nodes (27): getSecret(), isBoundedId(), isBoundedUrl(), isPositiveInteger(), RoomHistoryAttestationClaims, signRoomHistoryAttestation(), signRoomTokenForTest(), VerifiedRoomToken (+19 more)

### Community 130 - "history-recording-choice.ts, watch-history-preference-listener.ts"
Cohesion: 0.13
Nodes (24): contextChanged(), hasHistoryRecordingConsent(), HISTORY_RECORDING_NOTICE_VERSION, HistoryRecordingChoice, historyRecordingChoiceKey(), historyRecordingContextRevision(), parseHistoryRecordingChoice(), readHistoryRecordingChoice() (+16 more)

### Community 131 - "bridge-client.ts, bridge-contract.ts"
Cohesion: 0.12
Nodes (26): checkHistoryAbort(), cmsPath(), collectCrunchyrollHistoryCatalog(), createMessageId(), HistoryJsonLoader, historyRows(), isCrunchyrollControlResult(), resolveCrunchyrollHistoryMetadata() (+18 more)

### Community 132 - "contact-messages.ts, contact-route.ts"
Cohesion: 0.13
Nodes (24): POST(), CATEGORY_LABELS, CONTACT_CATEGORIES, CONTACT_MESSAGE_SEGMENT, ContactCategory, ContactMessageRecord, isContactCategory(), appendContactMessage() (+16 more)

### Community 133 - "inventory, manifest.json"
Cohesion: 0.06
Nodes (30): baselineCount, cli, inventory, user_tracked_titles, user_watch_settings, watch_episode_progress, watch_history_deletions, watch_history_receipts (+22 more)

### Community 134 - "Watch History v3 Local Verification, Final Fix Verification Evidence"
Cohesion: 0.11
Nodes (31): Catalog Snapshots And Aliases, Localized Provider Labels, Observed Historical Season Fallback, Retryable Legacy Storage Cleanup, Website Owner Intent Fix, Accepted Large Catalog Benchmark, Canonical Schema 3 Storage, Controlled Small Catalog Benchmark (+23 more)

### Community 135 - "ice-servers.ts, createIceServersPayload()"
Cohesion: 0.11
Nodes (26): CachedCloudflareIceServers, clearIceServersCacheForTest(), cloneIceServersPayload(), CloudflareIceServersResponse, createIceServersPayload(), dropEmptyIceServers(), FALLBACK_ICE_SERVERS, filterBrowserBlockedTurnUrls() (+18 more)

### Community 136 - "app/layout.tsx, conditional-site-chrome.tsx"
Cohesion: 0.09
Nodes (20): metadata, geistMono, geistSans, metadata, shouldNoindex, viewport, AnidachiLogoLink(), AuthMinimalNav() (+12 more)

### Community 137 - "youtube/storage.ts, youtube/api.ts"
Cohesion: 0.14
Nodes (24): GET(), dynamic, GET(), safeRefreshTiktok(), ensureAllCredentials(), ensureAuthClient(), getCredentialsForChannel(), isInvalidGrant() (+16 more)

### Community 138 - "trackConversion(), conversion-events.ts"
Cohesion: 0.18
Nodes (19): FooterPricingCta(), Hero(), JoinDiscordButton(), JoinDiscordButtonProps, trackDiscordClick(), NavPricingButton(), NavPricingLink(), PlanSurveyModal() (+11 more)

### Community 139 - "node:assert/strict, extension_auth_pkce_concurrency_contract.mjs"
Cohesion: 0.07
Nodes (18): files, source, SOURCE_URL, challenge, codeHash, psqlArgs, query(), stateHash (+10 more)

### Community 140 - "migrate-private-integration-blobs.ts, private-integration-blob-migration.test.ts"
Cohesion: 0.11
Nodes (24): readResult(), stream(), streamingReadResult(), assertReadableResult(), authFromEnvironment(), BlobAuth, BlobHeadResult, BlobListRow (+16 more)

### Community 141 - "p2p-ice.ts, loadP2PIceServersWithCache()"
Cohesion: 0.14
Nodes (27): buildIceServersRequest(), CachedIceServers, cachedIceServersByScope, clearP2PIceServersCacheForTest(), cloneIceServers(), dedupeIceServers(), getIceServerUrls(), hasTurnServer() (+19 more)

### Community 142 - "catalog.ts, normalizeCrunchyrollCatalog()"
Cohesion: 0.14
Nodes (27): array(), Availability, boundedString(), classifyAvailability(), compareOrder(), compatibleSeason(), CrunchyrollCatalogInput, CrunchyrollCatalogPartialReason (+19 more)

### Community 143 - "privileged-overlay-wiring.test.tsx, installActiveHostRoomRuntime()"
Cohesion: 0.11
Nodes (21): confirmedRoomSession(), createAdapter(), extensionStorage, flushMountedWork(), flushRoomActionWork(), guestParticipant(), hostParticipant(), installActiveHostRoomRuntime() (+13 more)

### Community 144 - "node:path, production-history-application-acl.mjs"
Cohesion: 0.10
Nodes (22): providerDirectories, sharedOverlayRuntimeFiles, sourceAdaptersDirectory, sourceDirectory, alt, contentType, runtime, size (+14 more)

### Community 145 - "invites-client.tsx, account-notifications.tsx"
Cohesion: 0.13
Nodes (22): AcceptInviteResponse, AccountInboxItem, acknowledgeInboxPageSeen(), ActiveRoomInvite, Avatar(), formatDate(), FriendRequestRow(), InboxFriendRequest (+14 more)

### Community 146 - "tiktok/storage.ts, tiktok/api.ts"
Cohesion: 0.17
Nodes (25): clearCookies(), dynamic, GET(), getOrigin(), publishToTtAccount(), publishToTtAccount(), apiError(), ensureAllCredentials() (+17 more)

### Community 147 - "node:test, profile-route.ts"
Cohesion: 0.10
Nodes (19): catalogContext, envelope(), progressEvent(), cleanAvatarUrl(), createProfilePatchHandler(), ProfilePatchDependencies, ProfileUpdate, lifecycleApi (+11 more)

### Community 148 - "rules, a11y"
Cohesion: 0.07
Nodes (28): noLabelWithoutControl, useButtonType, useKeyWithClickEvents, useSemanticElements, useValidAnchor, useExhaustiveDependencies, files, ignoreUnknown (+20 more)

### Community 149 - "Anidachi Auth Integration Implementation Plan, Files and Responsibilities"
Cohesion: 0.07
Nodes (28): Anidachi Auth Integration Implementation Plan, Authenticated Room Flow, Branch, Backup, and Commit Strategy, Current Research Snapshot, Database Migration Design, Extension Files to Add, Extension Files to Modify, Extension Login Flow (+20 more)

### Community 150 - "AniDachi Core Foundation to UI/UX Handoff Plan, Foundation Gap Scope"
Cohesion: 0.10
Nodes (29): Atomic Invite Response, Bounded Watch History, Bounded Watch History Read Contract, Canonical Durable Room Source, Canonical Room Source Contract, Coalesced Source Retry, Completed Staging Foundation, AniDachi Core Foundation to UI/UX Handoff Plan (+21 more)

### Community 151 - "nav-bar-client.tsx, account-menu-client.test.ts"
Cohesion: 0.11
Nodes (20): AccountEntryLink(), destinations, NavUser, UserMenu(), ContactNavMenu(), fetchNavUser(), isWatchClusterPath(), MeResponse (+12 more)

### Community 152 - "Watch History v2 Clean MVP Implementation Plan, Watch History v2 Clean MVP Scope"
Cohesion: 0.07
Nodes (28): Watch History v2 Clean MVP Scope, Corrected Decision Ledger, Current External Constraints Rechecked For This Plan, Data And Conflict Rules, Deferred Catalog Evidence Gate, Deferred Catalog Evidence Gate (Not Part Of Core MVP Execution), Execution Waves And Mandatory Stops, Failure And Account-Switch Behavior (+20 more)

### Community 153 - "tasks, ^build"
Cohesion: 0.08
Nodes (27): ^build, dist/**, !.next/cache/**, .output/**, dependsOn, outputs, dependsOn, outputs (+19 more)

### Community 154 - "reaction-pop.tsx, reaction-pop.test.tsx"
Cohesion: 0.11
Nodes (22): RoomSocketAttachment, clamp(), findReactionAnchor(), REACTION_IDENTITY_CUE_DURATION_MS, REACTION_MOTION_PROFILES, REACTION_VISIBLE_DURATION_MS, ReactionAnchor, ReactionMotionProfile (+14 more)

### Community 155 - "background-privileged-room-route.test.ts, startSameIdentitySuccessorScenario()"
Cohesion: 0.11
Nodes (15): cancelRoomAdmissionForTab(), cleanupRoomAdmissionHandoffForTab(), RoomAdmissionFence, RoomAdmissionHandoff, roomAdmissionHandoffMessage, createDepartureRetryScheduler(), createDepartureRetryStorage(), createSessionStorage() (+7 more)

### Community 156 - "post/status/route.ts, video/status/route.ts"
Cohesion: 0.21
Nodes (23): GET(), processInstagramAccount(), processTikTokAccount(), GET(), processInstagramReel(), processTikTokVideo(), getContainerStatus(), getCredentialsById() (+15 more)

### Community 157 - "trackEvent(), gtag.ts"
Cohesion: 0.13
Nodes (22): AnalyticsEvents(), onScroll(), DemoModeToggle(), Props, WaitlistReferralCard(), amplitude, ANALYTICS_OPTIONS, ensureReady() (+14 more)

### Community 158 - "Main Repository Monorepo Migration Implementation Plan, 2026-06-03-main-repository-monorepo-migration.md"
Cohesion: 0.07
Nodes (26): Commit Strategy, Current Status, Definition Of Done, Environment Model, Execution Order, Known Migration Risks And Mitigations, Main Repository Monorepo Migration Implementation Plan, Non-Negotiable Rules (+18 more)

### Community 159 - "AniDachi Pre-release Security and Reliability Readiness Plan, Findings and Task Ownership"
Cohesion: 0.13
Nodes (27): Active Foundation Scope Transfer, Browser OAuth Transaction Binding, Closure Without Full Completion, Database Implementation Contract, Deferred Pre-public Hardening, Execution Drift Gate, Existing System Planes, Extension Client Binding and PKCE (+19 more)

### Community 160 - "Watch History Catalog And Progress Design, Canonical Durable Data Model"
Cohesion: 0.13
Nodes (27): Atomic Deletion Semantics, Bounded Catalog Snapshot, Canonical Durable Data Model, Clean Start Amendment, Consistent History Product Goal, Crunchyroll Provider Policy, Expanded Season, Honest Title Summary (+19 more)

### Community 161 - "Watch History Room Authority Threat Model, 1. Overview"
Cohesion: 0.08
Nodes (25): 1. Overview, 2. Persisted Lifecycle Audit, 3. Approved Attestation Contract, 4. Verification Order, 5. Threats, Mitigations, and Residual Risk, 6. Severity Calibration and Gate Decision, Account fences and self-only writes, Actors (+17 more)

### Community 163 - "user-identity.ts, silent-session-adoption.ts"
Cohesion: 0.15
Nodes (20): createAuthMessage(), sendAuthCommand(), adoptWebsiteSessionWithRetry(), DEFAULT_SILENT_ADOPTION_DELAYS_MS, isTerminalIdentityResult(), report(), SilentSessionAdoptionOptions, SilentSessionAdoptionReason (+12 more)

### Community 164 - "popup-view-state.ts, popup-view-state.test.tsx"
Cohesion: 0.19
Nodes (19): PopupTab, boolean(), forgetPopupView(), HistoryView, PopupView, position(), readPopupHistoryView(), readPopupView() (+11 more)

### Community 165 - "watch-library-client.test.tsx, installServer()"
Cohesion: 0.13
Nodes (21): loadWatchHistoryTitleEpisodePage(), accessFixture(), buttonByLabel(), buttonByText(), capacityFixture(), click(), deletionAck(), detailFixture() (+13 more)

### Community 166 - "anidachi-seo-aeo-pages.md, YouTube keyword bank + templates (Keyword Planner US)"
Cohesion: 0.08
Nodes (22): Addy Osmani / technical SEO gate, AEO (answer engines), Alternatives / listicle differentiation minimum, Conversion and CTAs, E-E-A-T and trust, FAQ strategy, Gold-standard reference pages, Hard boundaries (+14 more)

### Community 167 - "September 12 prelaunch remediation verification, Real WebRTC harness documentation"
Cohesion: 0.14
Nodes (25): Actual relay physical media distributed 15 4 8 acceptance open, Authority refresh invalidates queued samples across eligibility changes, Complete candidate stats bounded five second resampling, External production delivery traffic and recovery prerequisites open, Final extension local proof 153 focused and 1916 full tests, Legacy 8000 ms harness boundary restored, Loaded staging real YouTube ad and MV3 acceptance open, September 12 prelaunch remediation verification (+17 more)

### Community 168 - "Commercial Room, P2P, and Watch Progress Architecture Implementation Plan, Architecture Boundaries"
Cohesion: 0.08
Nodes (24): Architecture Boundaries, Cloudflare Worker + Durable Object / Live Plane, Commercial Room, P2P, and Watch Progress Architecture Implementation Plan, Commit Strategy, Current Status, Definition Of Done, Durable Room Lifecycle, Execution Order (+16 more)

### Community 169 - "Source Adapter Architecture Implementation Plan, PR 1: Behavior-Preserving Provider Extraction"
Cohesion: 0.08
Nodes (24): Core Contracts, Definition Of Done, Global Constraints, Non-Goals, PR 1: Behavior-Preserving Provider Extraction, PR 2: Lifecycle, Capabilities, And First-Class YouTube, Provider And Room Isolation Invariants, Registry Rules (+16 more)

### Community 170 - "Canonical Runtime Flow, Authenticated Watch History v2 Web Service"
Cohesion: 0.10
Nodes (25): Account History Generation Fencing, Account-Scoped Local Cache, Authenticated Watch History v2 Web Service, Bounded-Shape Watch History Outbox, Canonical Runtime Flow, Canonical Watch History v2 Read Model, Cursor-Bounded Title Projection, Durable History Deletion Fences (+17 more)

### Community 171 - "use-camera-interaction-lock.ts, use-camera-interaction-lock.test.tsx"
Cohesion: 0.13
Nodes (16): PixelRect, OverlayLayoutRuntimeContextInput, PlayerOverlayInsets, CAMERA_INTERACTION_APPROACH_TIMEOUT_MS, CAMERA_INTERACTION_RELEASE_DELAY_MS, CameraInteractionLockState, CameraInteractionPlayerGeometry, equalInsets() (+8 more)

### Community 172 - "artwork-select.ts, crunchyroll/artwork.ts"
Cohesion: 0.18
Nodes (21): getCrunchyrollApiUrl(), getCrunchyrollContentToken(), getCrunchyrollLocale(), getCrunchyrollOrigin(), isCrunchyrollPage(), loadCrunchyrollCmsObject(), loadCrunchyrollPosterArtwork(), loadCrunchyrollPosterFromMainWorld() (+13 more)

### Community 173 - "study.ts, startCrunchyrollStudy()"
Cohesion: 0.17
Nodes (22): cleanClassName(), elementSnapshot(), EVENT_NAMES, finite(), finiteOrNull(), getCrunchyrollStudySnapshot(), getElementPath(), getRect() (+14 more)

### Community 174 - "verifyKreatliCrmSession(), kreatli-crm/auth.ts"
Cohesion: 0.14
Nodes (16): dynamic, POST(), POST(), BlouLoginPage(), dynamic, metadata, LoginForm(), dynamic (+8 more)

### Community 175 - "private-integration-blob.ts, private-integration-blob.test.ts"
Cohesion: 0.12
Nodes (17): assertPrivatePath(), BlobReadResult, createPrivateIntegrationBlobClient(), DEFAULT_SDK, EXACT_PRIVATE_PATHS, isPrivateIntegrationBlobPath(), PrivateAuth, PrivateBlobSnapshot (+9 more)

### Community 176 - "scripts, web/package.json"
Cohesion: 0.08
Nodes (23): name, private, scripts, blob:migrate:private, build, cache:jikan, check, crm (+15 more)

### Community 177 - "Anidachi Architecture and Stack Notes, Current Stack"
Cohesion: 0.08
Nodes (23): Anidachi Architecture and Stack Notes, Cloudflare Deploy, Current Stack, Extension, Fullscreen Overlay Decision, Ghost Cam And Audio, Hotkeys, Identity and Invite Flow (+15 more)

### Community 178 - "Deferred Together Group History Specification, Deferred Shared Membership Access"
Cohesion: 0.12
Nodes (24): Deferred Archive Read Only Access, Deferred Attestation Insufficiency, Deferred Compatible Rollout, Deferred Group Access Is Not Admission, Deferred Group Grace Ordering, Deferred Group Import, Deferred Group Launch, Deferred Group Protocol (+16 more)

### Community 179 - "production-history-rehearsal.mjs, production-history-rehearsal-operator-fence.mjs"
Cohesion: 0.10
Nodes (17): checks, d, finished, identity, input(), operatorFenceSources(), q(), read() (+9 more)

### Community 180 - "AniDachi Repository Overview, AniDachi — Watch Anime Together"
Cohesion: 0.09
Nodes (20): Feature to Staging to Production Git Flow, Graphify Development Workflow, Git And Release Flow, Graphify Usage, Runtime Environments, Workspace Package Globs, AniDachi Repository Overview, AniDachi — Watch Anime Together (+12 more)

### Community 181 - "overlay-layout-runtime.ts, finiteNonNegative()"
Cohesion: 0.23
Nodes (21): CAMERA_INTERACTION_CORRIDOR_PADDING_PX, clamp(), createOverlayLayoutRuntimeContext(), finiteNonNegative(), getBubbleGapPx(), getCameraInteractionCorridor(), getOverlayLayoutCameraSlotCount(), getOverlayLayoutReservedRects() (+13 more)

### Community 182 - "extension/test/watch-history-browse.test.ts, watch-history-browse-cache.ts"
Cohesion: 0.13
Nodes (18): BrowseCacheStorage, browserStorage, createWatchHistoryBrowseCache(), initialize(), prune(), Entry, WATCH_BROWSE_FRESH_MS, WATCH_BROWSE_MAX_AGE_MS (+10 more)

### Community 183 - "history-browser.tsx, client-api.ts"
Cohesion: 0.14
Nodes (16): clock(), episodeLabel(), HistoryActions(), HistoryBrowser(), HistoryPlatform, historyPlatforms, InspectorHandle, isTitleWatched() (+8 more)

### Community 184 - "Account subscription cancellation, Cancellation deep link"
Cohesion: 0.11
Nodes (23): Account subscription cancellation, Billing refresh endpoint, Billing request privacy, Billing rollback, Billing visual artifacts, Billing visual scenarios, Cancellation deep link, Cancellation portal endpoint (+15 more)

### Community 185 - "Rollout Phases, Watch History Catalog And Progress Implementation Plan"
Cohesion: 0.09
Nodes (21): Durable storage, Final Acceptance Matrix, Global Constraints, Out Of Scope Follow-Ups, Rollback Rules, Rollout Phases, Runtime ownership, Shared protocol (+13 more)

### Community 186 - "Overlay Layout Engine V2 Design, Verification"
Cohesion: 0.09
Nodes (22): Camera Group, Chat, Clean Version 2 Start, Code Boundaries, Component Tests, Delivery Stages, Draft And Apply, Failure Handling (+14 more)

### Community 187 - "Deferred Together: Together MVP Revision 2, Deferred Together: TARGET Personal Group Routing"
Cohesion: 0.13
Nodes (23): Deferred Together: TARGET Bounded Checkpoint Queue, Deferred Together: TARGET Checkpoint Acceptance, Deferred Together: TARGET Compatibility Migration, Deferred Together: TARGET Completion And Catalog Totals, Deferred Together: TARGET Consent And Access, Deferred Together: TARGET Durable Data Contract, Deferred Together: TARGET Entitlements And Archive, Deferred Together: TARGET Filter And Cache Semantics (+15 more)

### Community 188 - "room-signaling-harness.mjs, runScenarios()"
Cohesion: 0.17
Nodes (15): API_DIR, b64url(), Client, __dirname, main(), playbackStateFor(), PORT, rawConnect() (+7 more)

### Community 189 - "RecentP2PSignalBuffer, p2p-signal-buffer.ts"
Cohesion: 0.16
Nodes (8): addP2PSignalForDispatch(), AddP2PSignalResult, BufferedP2PSignalEvent, getP2PSignalDedupeKey(), matchesGenerationScope(), P2PSignalReplayScope, RecentP2PSignalBuffer, ServerEvent

### Community 190 - "RoomAdmission, room-admission.ts"
Cohesion: 0.13
Nodes (6): ROOM_ADMISSION_JOIN_DEADLINE_MS, ROOM_ADMISSION_PENDING_PER_SUBJECT_LIMIT, RoomAdmission, RoomAdmissionJoinResult, RoomAdmissionResult, RoomAdmissionSocket

### Community 191 - "RoomRateLimiter, RoomSubjectRateLimiters"
Cohesion: 0.17
Nodes (5): CLASS_LIMITS, RoomEventClass, RoomRateLimitDecision, RoomRateLimiter, RoomSubjectRateLimiters

### Community 192 - ".ensurePeer(), .restartPeerIce()"
Cohesion: 0.12
Nodes (7): createP2PRtcConfiguration(), createVideoElement(), decideP2PIceRestart(), mediaElementUsesTrack(), reconcilePeerAction(), summarizeIceServers(), toP2PIceCandidate()

### Community 193 - "Kreatli CRM Data Schema, Kreatli CRM Agent Instructions"
Cohesion: 0.13
Nodes (22): Kreatli CRM Agent Instructions, Conservative Outreach Governance, CRM CLI Workflow, Human-controlled Sending, Personal Outreach Source of Truth, UTC Queue Interpretation, Contact Import Modes, Contact Record (+14 more)

### Community 194 - "active-room-session.ts, active-room-session.test.ts"
Cohesion: 0.19
Nodes (19): ACTIVE_ROOM_CONFLICT_MESSAGE, ActiveRoomAssignment, ActiveRoomClaimDatabaseResult, activeRoomConflictResponseInput(), ActiveRoomCreateDatabaseResult, ActiveRoomReleaseDatabaseResult, ActiveRoomSessionDatabaseError, ActiveRoomSummary (+11 more)

### Community 195 - "prepare.sql, anidachi_transition_20260912.install_holds()"
Cohesion: 0.10
Nodes (16): anidachi_transition_20260912.control, anidachi_transition_20260912.cron_state, anidachi_transition_20260912.descriptor(), anidachi_transition_20260912.install_holds(), anidachi_transition_20260912.relations, anidachi_transition_20260912.rows, auth_cleanup_results, pg_temp.explain_json() (+8 more)

### Community 196 - "Watch History v3 Staging Verification, Release And Rollback Runbook"
Cohesion: 0.14
Nodes (22): Extension Rollback, History Only Forward Fix Rollback, OAuth And Environment Rollback, Release And Rollback Runbook, Release Incident Runbook, Supabase Rollback, Watch History v3 Coordinated Transition, Web Rollback (+14 more)

### Community 197 - "Personal History And Plans MVP Specification, D05 Bounded Access Lease"
Cohesion: 0.12
Nodes (22): Accepted R01 R20, Authoritative History Gates, D01 Retention Without Legacy Quotas, D02 Frozen Room And Graceful Expiry, D03 Explicit Media Grants, D04 Deferred New Editor, D05 Bounded Access Lease, Exact Personal Resume (+14 more)

### Community 198 - "production-history-application-acl.integration.mjs, assertPreserved()"
Cohesion: 0.14
Nodes (21): actual(), assertPreserved(), badCapture, baseline, before, binding, defaultAcl(), fail() (+13 more)

### Community 199 - "overlay-interaction-boundary.ts, overlay-voice-controls.test.tsx"
Cohesion: 0.14
Nodes (10): isWithinOverlayHotkeyBoundary(), OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE, overlayHotkeyBoundaryProps, OverlayInteractionBoundaryProps, getNextVoiceMode(), VoiceModeButtonProps, VoiceSettingsPanel(), VoiceSettingsPanelProps (+2 more)

### Community 200 - "overlay-layout-editor.test.tsx, OverlayLayoutDefinition"
Cohesion: 0.10
Nodes (5): OverlayLayoutEditorProps, OverlayLayoutContext, OverlayLayoutDefinition, measuredLayoutContext, RenderedEditor

### Community 201 - "popup-watch-browse.test.tsx, generationClient()"
Cohesion: 0.16
Nodes (18): PopupWatchHistoryPanel(), aggregate, browse(), button(), change(), click(), clientFixture(), detail() (+10 more)

### Community 202 - "zod, anidachi-auth/room-presence-evidence.ts"
Cohesion: 0.13
Nodes (14): dynamic, POST(), handleInternalRoomPresencePost(), evidence, ROOM_PRESENCE_MAX_AGE_MS, RoomPresenceAcknowledgementSchema, RoomPresenceEvidenceSchema, RoomPresenceParticipantSchema (+6 more)

### Community 203 - "teleparty-not-working-youtube/page.tsx, teleparty-not-working-crunchyroll/page.tsx"
Cohesion: 0.10
Nodes (18): faq, metadata, NetflixPartyForYoutubePage(), SITE_URL, tocHeadings, faq, howToSteps, metadata (+10 more)

### Community 204 - "home-client.tsx, faq-section.tsx"
Cohesion: 0.15
Nodes (14): ChromeExtensionDemo(), columns, CompareTable(), rows, FAQSection(), HomeClient(), HomeSectionHeader(), HowItWorks() (+6 more)

### Community 205 - "public.browse_watch_history_v3(), 20260905084800_watch_history_browse.sql"
Cohesion: 0.10
Nodes (16): public.apply_watch_progress_v3(), public.browse_watch_history_v3(), public.profiles, public.user_watch_settings, public.users, public.watch_episode_progress, public.watch_session_participants, public.watch_sessions (+8 more)

### Community 206 - "Accepted second target-specific hosted application recovery, Historical first recovery failure remains separate from later accepted targets"
Cohesion: 0.14
Nodes (20): Historical: Second hosted application recovery accepted while production prerequisites remain open, Historical: First hosted recovery acceptance failed after row equality, Historical: Conditional managed-role policy measured and accepted on second recovery, Accepted interrupted prefix 37, 2026-09-12, Accepted second target-specific hosted application recovery, Capture-source review and receipt validation are separate from recovery acceptance, Historical first recovery failure remains separate from later accepted targets, Strict application recovery equality and conditional managed-role boundary (+12 more)

### Community 207 - "Environment And Secrets Matrix, ANIDACHI_NOTIFICATION_DRAIN_SECRET"
Cohesion: 0.10
Nodes (20): ANIDACHI_NOTIFICATION_DRAIN_SECRET, Configuration change evidence checklist, Cloudflare, Distinct Worker and analytics bindings by environment, Narrow CRM-only private Blob authority, Environment And Secrets Matrix, GitHub deployment and extension environment ownership, Matched per-environment Web Worker internal authority (+12 more)

### Community 208 - "Development Flow Quality System Plan, Target Operating Model"
Cohesion: 0.10
Nodes (20): Block 0 - Stabilize The Working Baseline, Block 10 - Integrate The Flow Into Product Planning, Block 1 - Add One Canonical Agent Entry Point, Block 2 - Configure CodeRabbit As A Contextual Reviewer, Block 3 - Build A Local Project Knowledge Graph, Block 4 - Formalize PR Templates And Review Checklists, Block 5 - Make Local Verification Easy And Standard, Block 6 - Strengthen CI Without Blocking Fast Iteration (+12 more)

### Community 209 - "LinkedIn Sales Navigator Connection Requests, Session output"
Cohesion: 0.10
Nodes (20): Architecture, CLI flags, Common skip reasons, Exit codes, Files, `launch-chrome.sh`, LinkedIn Sales Navigator Connection Requests, Outcomes (+12 more)

### Community 210 - "AniDachi Extension Icon 48px, AniDachi Extension Icon"
Cohesion: 0.13
Nodes (20): AniDachi Extension Icon, Blue Purple Gradient Badge, Browser Extension Brand Identity, Dark Rounded Square Canvas, Stylized A Mark, AniDachi Extension Icon 16px, White Stylized A Brand Mark, Extension Toolbar Icon (+12 more)

### Community 211 - "src/account-inbox-client.ts, test/account-inbox-client.test.ts"
Cohesion: 0.22
Nodes (16): accountInboxFromBridge(), accountInboxHttpError(), AccountInboxHttpMessage, AccountInboxHttpMessageResponse, AccountInboxUnauthorizedError, decodeAccountInboxResponse(), handleAccountInboxHttpMessage(), isAccountInboxHttpMessage() (+8 more)

### Community 212 - "watch-library-client.tsx, WatchLibraryOwnerClient()"
Cohesion: 0.17
Nodes (19): WatchLibraryCapacity(), bindWatchHistoryPageRefresh(), clampProgress(), deleteConfirmation(), deleteScopeKey(), errorMessage(), formatProgressPercent(), getWatchHistoryAggregateLabel() (+11 more)

### Community 213 - "Anidachi Project Operating Manual, Development Flow"
Cohesion: 0.10
Nodes (20): Anidachi Project Operating Manual, Development Flow, Development Startup Checklist, Documents To Read First, Everyday Development Loop, Extension Channels, How Joining Works, How Login Works (+12 more)

### Community 214 - "Shared Watch Progress Tracker, Durable Account History Authority"
Cohesion: 0.15
Nodes (20): Canonical Episode Resume, Canonical Title Projection, Crunchyroll Observed Episode Evidence, Dormant Account Outbox, Durable Account History Authority, Extension Background Single Writer, Fourteen Day Receipt Cleanup, Historical Browse Rollout (+12 more)

### Community 215 - "Development Workflow Hardening Implementation Plan, 2026-06-04-development-workflow-hardening.md"
Cohesion: 0.10
Nodes (19): Acceptance Criteria, Development Workflow Hardening Implementation Plan, Evidence Snapshot, File Map, Recommended Execution Order, Target Operating Model, Task 0: Prepare A Safe Implementation Branch, Task 10: Update Active Documentation As Source Of Truth (+11 more)

### Community 216 - "Plan Code Canonicalization And Billing Cleanup Implementation Plan, 2026-06-22-plan-code-canonicalization-and-billing-cleanup.md"
Cohesion: 0.10
Nodes (19): Completion Criteria, Current Problems, Evidence Reviewed, File Structure, Hard Rules, Plan Code Canonicalization And Billing Cleanup Implementation Plan, Rollback Plan, Task 0: Branch And Baseline Hygiene (+11 more)

### Community 217 - "social-snapshot-cache.ts, wxt/utils/storage"
Cohesion: 0.16
Nodes (17): clearCachedAccountDataForUser(), CachedSocialSnapshot, clearCachedSocialSnapshotForUser(), getCachedSocialSnapshotForUser(), isCanonicalUtcTimestamp(), isRecord(), isSocialSnapshotCacheFresh(), parseCachedSocialSnapshot() (+9 more)

### Community 218 - "hotkeys.ts, hotkeys.test.ts"
Cohesion: 0.21
Nodes (16): getEmojiHotkey(), getHotkeyAction(), hasBlockedModifier(), HotkeyAction, HotkeyEventLike, isEditableElement(), isEditableEventTarget(), isFireReactionReleaseEvent() (+8 more)

### Community 219 - "overlay-mount.ts, url.ts"
Cohesion: 0.22
Nodes (15): getOverlayMountDecision(), getOverlayPageDecision(), isOverlayAllowedOnPage(), mutationsAffectVideo(), nodeContainsVideo(), OverlayMountDecision, OverlayPageDecision, shouldRefreshSameVideoAdapter() (+7 more)

### Community 220 - ".handleSignalNow(), .queueNegotiation()"
Cohesion: 0.25
Nodes (5): getCandidateProtocol(), getCandidateType(), prepareP2PLocalDescription(), summarizeP2PSdp(), summarizeSignal()

### Community 221 - "RoomClient, .connect()"
Cohesion: 0.21
Nodes (4): createRoomConnectionId(), isOlderHistoryBoundary(), RoomClient, sameHistoryBoundary()

### Community 222 - "devDependencies, eslint"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, eslint-config-next, @eslint/eslintrc, tailwindcss, @tailwindcss/postcss, tsx, tw-animate-css (+11 more)

### Community 223 - "YouTube Playback Synchronization Hardening Implementation Plan, Provisional Interfaces And Dependency Direction"
Cohesion: 0.11
Nodes (18): Current Verified Baseline, Definition Of Done, External Constraints Verified On 2026-07-23, Global Constraints, Product Decisions, Provisional Interfaces And Dependency Direction, Rollback Boundaries, Status And Relationship To Existing Plans (+10 more)

### Community 224 - "Watch Drawer Browse Local Verification, Episode label search fix"
Cohesion: 0.12
Nodes (18): Task 3: drawer filters, progress tree, and History settings, Task 1: durable invitation provenance and bounded server browse, Task 4: local integration evidence and controller handoff, Task 2: view-local owner-validated extension browse client, WatchHistoryBrowseQuery and WatchHistoryBrowseResponse, Activation, Acceptance And Rollback, bf260d7e automated source evidence, Database Evidence (+10 more)

### Community 225 - "Account Data History Social And Inbox Foundation Design, Canonical durable inbox aggregation and unread seen state"
Cohesion: 0.22
Nodes (19): Account Data History Social And Inbox Foundation Design, Account owned cache outbox cursor and request generation, Atomic room invite recipient snapshots and stable action retry, Bounded account owned inbox and subscription recovery, Canonical durable inbox aggregation and unread seen state, Chrome FCM push allowlist and five installations per account, Historical 12 hour expires_at runtime bridge, Historical compact self written history outbox and reconcile (+11 more)

### Community 226 - "dev-check.mjs, classify()"
Cohesion: 0.15
Nodes (17): args, changedFiles(), classify(), commands, dedupe(), fail(), files, isDocs() (+9 more)

### Community 227 - "popup-watch-filters.tsx, extension/src/watch-history-browse.ts"
Cohesion: 0.20
Nodes (14): emptyHistoryConditions, periods, PopupHistoryConditions, PopupWatchFilters(), useWatchFilterPopover(), createWatchHistoryDateRange(), isoRange(), localDateStart() (+6 more)

### Community 228 - "room-invite-target-status.ts, room-invite-target-status.test.ts"
Cohesion: 0.17
Nodes (15): finalizeStatuses(), GROUP_STATUS_ORDER, isNewerRecipientEntry(), mergeInviteRecipients(), mergeRecipientEntry(), mergeTargetRecipients(), RecipientStatusEntry, RoomInviteRecipientStatus (+7 more)

### Community 229 - "release-channel-build.test.ts, artifactText()"
Cohesion: 0.12
Nodes (11): artifactText(), broadPatterns, expectCanonicalRuntime(), hostileEnvironment, localHostPermissions, Manifest, productionHostPermissions, repoRoot (+3 more)

### Community 230 - "youtube/callback/route.ts, youtube/oauth.ts"
Cohesion: 0.25
Nodes (15): clearStateCookie(), dynamic, GET(), getOrigin(), dynamic, GET(), createYouTubeOAuth2(), exchangeYouTubeCode() (+7 more)

### Community 231 - "components.json, aliases"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 232 - "public.apply_personal_watch_progress_v1(), 20260908030441_personal_watch_history.sql"
Cohesion: 0.13
Nodes (14): public.apply_personal_watch_progress_v1(), public.apply_watch_catalog_v3(), public.check_personal_history_operation_v1(), public.personal_history_policy, public.personal_watch_sequences, anon, authenticated, public (+6 more)

### Community 233 - "Survey → Subscription Conversion (Planner Notes), Async Mode Demo — landing page (2026-07-07)"
Cohesion: 0.11
Nodes (18): Async Mode Demo — landing page (2026-07-07), Converting mechanism goals (subscription purchase), Current Status / Progress Tracking (2026-05-12), Force-Index Sitemap + Noindex Cleanup (2026-07-17), Hero extension demo overlay restyle (2026-07-26), High-converting SEO batch (2026-07-19) — Keyword Planner validated, High-converting SEO batch 2 (2026-07-22) — Keyword Planner validated, High-impact survey improvements (ideas) (+10 more)

### Community 234 - "Crunchyroll Adapter Notes, Catalog Completeness Evidence"
Cohesion: 0.14
Nodes (18): Active Player And Detail Page States, Active Player Waiting State, Bounded MAIN World Metadata Bridge, Catalog Completeness Evidence, Catalog Revision And Context Fences, Crunchyroll Control Fallbacks, Crunchyroll Adapter Notes, Crunchyroll Fullscreen Parent (+10 more)

### Community 235 - "Maintenance Admission, Shared protocol maintenance parser"
Cohesion: 0.12
Nodes (18): Default-open Web and Worker maintenance admission, Server-only ANIDACHI_MAINTENANCE_MODE, Per-script staging Worker publication flags, Shared protocol maintenance parser, Maintenance Admission, In-flight work and existing socket/job boundary, Website HTTP failure retains owner-guarded editor state, Existing Web asset and metadata exclusions (+10 more)

### Community 236 - "Anidachi Development Environments, Extension Builds"
Cohesion: 0.11
Nodes (18): Anidachi Development Environments, API Environments, Branch Model, Extension Builds, Fast Local Extension Development, Local Toolchain, OAuth Redirects, P2P Scorecard (+10 more)

### Community 237 - "AniDachi New Chat Project Context, P2P Media Product Decisions"
Cohesion: 0.11
Nodes (17): Account-Scoped Local-First Extension Cache, AniDachi New Chat Project Context, Current Product Focus, Debug Logs And P2P Diagnosis, External Docs Rule, First Read Order, Historical Working Baseline, Important Extension/P2P Decisions (+9 more)

### Community 238 - "OpenClaw: YouTube Shorts posting, Step 2 — Prepare video post"
Cohesion: 0.11
Nodes (17): Authentication, Caption rules (YouTube), Error codes, Examples, Form fields, Human setup (one-time, not via OpenClaw), OpenClaw: YouTube Shorts posting, Operational notes (+9 more)

### Community 239 - "src/source-url.ts, canonicalizeRoomSourceUrl()"
Cohesion: 0.20
Nodes (16): boundedCanonicalRoomSource(), canonicalizeProviderUrl(), canonicalizeRoomSourceUrl(), CanonicalRoomSource, CanonicalRoomSourceUrlResult, crunchyrollWatchPath(), currentRuntimeYouTubeFingerprint(), isLegacyRoomSourceFingerprintAlias() (+8 more)

### Community 240 - "compilerOptions, tsconfig.base.json"
Cohesion: 0.11
Nodes (17): compilerOptions, allowSyntheticDefaultImports, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, module, moduleResolution, noEmit (+9 more)

### Community 241 - "devDependencies, happy-dom"
Cohesion: 0.12
Nodes (17): devDependencies, happy-dom, @types/chrome, @types/react, @types/react-dom, typescript, vitest, wxt (+9 more)

### Community 242 - "popup-styles.ts, styles.ts"
Cohesion: 0.21
Nodes (8): extensionThemeTokens, popupInboxStyles, popupPeopleStyles, popupStyles, popupWatchHistoryStyles, overlayStyles, getNumericProperty(), getRule()

### Community 244 - "account-sections-client.test.ts, account-workspace-state.tsx"
Cohesion: 0.14
Nodes (12): AccountViewContext, AccountWorkspaceProvider(), requestAccountNavigation(), useAccountScrollRestoration(), useAccountViewState(), FeatureRequestForm(), button(), click() (+4 more)

### Community 245 - "public.get_account_inbox_page(), 20260809_room_invite_inbox_foundation.sql"
Cohesion: 0.13
Nodes (13): prepare_friendship_inbox_state, prepare_room_invite_recipient_inbox_state, public.get_account_inbox_page(), public.reconcile_account_inbox(), public.friend_groups, public.friendships, public.profiles, public.room_invite_recipients (+5 more)

### Community 246 - "Personal history MVP staging delivery packet, September 12 Sandbox cancellation verification"
Cohesion: 0.19
Nodes (17): LIVE Stripe and actual paid period expiry acceptance open, Authorized cancellation preserved Plus and billing period, Renewal restored on the same active subscription, Sandbox cancellation does not prove expiry or LIVE, Sandbox default portal period end cancellation configuration, September 12 Sandbox cancellation verification, C04 active policy compatible recovery remains unperformed, Database prerequisites before compatible Web Worker and client (+9 more)

### Community 247 - "Temporary Free-project rehearsal window, Restored staging baseline and account room acceptance after three windows"
Cohesion: 0.13
Nodes (17): Hosted proof closes only tested DB operator recovery questions, Temporary Free-project rehearsal window, First authorized zero-cost rehearsal window closed, Two active Free-project limit and zero-cost creation boundary, Normal test-room drain before publication shutdown, Pause exact staging project and recheck production health, Supabase capacity pause and Cloudflare publication references, Restored staging baseline and account room acceptance after three windows (+9 more)

### Community 248 - "Watch History Local Read Implementation Plan, Bounded persistent cache policy"
Cohesion: 0.17
Nodes (17): Stable drawer read integration, Exact-query initial episode previews, Hard read invalidation fences, Opt-in legacy response compatibility, Local-only implementation and verification boundary, History-preserving consumer rollback, Persistent account and query-owned read cache, Watch History Local Read Implementation Plan (+9 more)

### Community 249 - "generate-extension-icons.mjs, chunk()"
Cohesion: 0.15
Nodes (16): node:zlib, CHECK_ONLY, chunk(), crc32(), encodePng(), OUTPUT_DIR, paethPredictor(), PNG_SIGNATURE (+8 more)

### Community 250 - "AGENTS.md, Promotion Diff Classifier"
Cohesion: 0.12
Nodes (15): Commands, Done Means, Git Flow, graphify, Instruction Layers, Knowledge Graph, Quality Gates, Read First (+7 more)

### Community 251 - "api/package.json, scripts"
Cohesion: 0.12
Nodes (15): dependencies, hono, jose, jose, name, private, scripts, build (+7 more)

### Community 252 - "demo/package.json, scripts"
Cohesion: 0.12
Nodes (15): devDependencies, typescript, vite, vitest, vitest, name, private, scripts (+7 more)

### Community 253 - "ghost-cam-size.ts, getResponsiveGhostCamSizePx()"
Cohesion: 0.22
Nodes (14): clamp01(), DEFAULT_GHOST_CAM_SIZE_STEP, getAdaptiveGhostCamMaxPx(), getCameraStackWidthShare(), getGhostCamGapPx(), getGhostCamSizeLabel(), getGhostCamSizePx(), getResponsiveGhostCamSizePx() (+6 more)

### Community 255 - "MemoryStorageArea, StorageAreaLike"
Cohesion: 0.12
Nodes (5): BackgroundDependencies, DelayedRemoveStorageArea, MemoryStorageArea, PageSessionStorage, StorageAreaLike

### Community 256 - "package.json, devDependencies"
Cohesion: 0.12
Nodes (15): @biomejs/biome, devDependencies, @biomejs/biome, turbo, typescript, vitest, engines, node (+7 more)

### Community 257 - "Room Invitation Return and Reinvitation, Durable Assignment Resend Fence"
Cohesion: 0.17
Nodes (16): Invite Return Additive Rollout, Room Invitation Return Correction, Room Invitation Return Follow-up, Accepted Return Recovery, Atomic Database Lifecycle, Durable Assignment Resend Fence, Extension Host and Inbox, Fresh Reinvitation Identity (+8 more)

### Community 258 - "Invitation Delivery Reliability Implementation Plan, Private Database Scheduler"
Cohesion: 0.17
Nodes (16): Outer Cron Statement Timeout, Automatic Staging Recovery Evidence, Durable Client Recovery, Independent Worker Recovery Drain, Invitation Delivery Reliability Implementation Plan, Open Popup Inbox Convergence, Ordered Staging Cutover, Outer Statement Timeout (+8 more)

### Community 259 - "Room Defaults With Media Seats, Initial Authoritative Admission Once"
Cohesion: 0.17
Nodes (16): Account Scoped Next Room Defaults, Capture Authority Gate, Immutable Tester ZIP Rollback, Initial Authoritative Admission Once, Last Used, Mounted Overlay Regression Verification, Private Tester Artifact Acceptance, Push To Talk Starts Silent (+8 more)

### Community 260 - "Social Rooms Subscriptions Execution Plan, Core Product Rules"
Cohesion: 0.17
Nodes (16): Core Product Rules, Extension Popup, Groups, Identity, Optional Future Side Panel, Personal Groups, Product Surfaces And Sync Model, Protocol And Worker Changes (+8 more)

### Community 261 - "dependencies, @anidachi/protocol"
Cohesion: 0.13
Nodes (15): @anidachi/protocol, @anidachi/protocol, dependencies, @anidachi/protocol, lucide-react, motion, react, react-dom (+7 more)

### Community 262 - "protocol/package.json, scripts"
Cohesion: 0.13
Nodes (14): zod, dependencies, zod, exports, name, private, scripts, build (+6 more)

### Community 263 - "watch_history_capacity_concurrency_contract.mjs, contend()"
Cohesion: 0.20
Nodes (14): args, contend(), event(), labels, literal(), live, marker, ports (+6 more)

### Community 264 - "20260814010000_watch_history_v2_foundation.sql, public.apply_watch_progress_v2()"
Cohesion: 0.25
Nodes (14): public.apply_watch_progress_v2(), public.delete_watch_history_v2(), public.recent_people_evidence, public.set_watch_preferences_v2(), public.user_watch_settings, public.watch_episode_progress, public.watch_history_deletions, public.watch_history_receipts (+6 more)

### Community 265 - "compilerOptions, allowJs"
Cohesion: 0.13
Nodes (15): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, module, moduleResolution (+7 more)

### Community 266 - "pull_request_template.md, CI Check and Test Job"
Cohesion: 0.13
Nodes (14): GitHub Actions Review Scope, Affected Planes, AI Contribution Notes, Changed Areas, Docs / Graphify, Goal, Quality Gate, Risk Class (+6 more)

### Community 267 - "Personal History And Plans MVP — Implementation Evidence, personal-history-and-plans-mvp-verification.md"
Cohesion: 0.13
Nodes (14): Personal-history MVP implementation evidence, Initial Local Checks, Personal History And Plans MVP — Implementation Evidence, Populated staging-chain preservation rehearsal, Preserved Baseline, Remaining Acceptance, Task 1 — Contracts And Early Media Experiment, Task 3 — Personal Writer, Read Fences And Unified Browse (+6 more)

### Community 268 - "Project Architecture and Development, Extension viewing and capture client plane"
Cohesion: 0.25
Nodes (15): Direct first WebRTC with Cloudflare TURN fallback, Extension viewing and capture client plane, Four-plane Architecture, Historical: Inactive policy 1 capture 1 media protocol 2, Personal writer independent of host created history sessions, Historical: Production database Worker Web ordered transition gate, Project Architecture and Development, Protocol-first Cross-plane Contracts (+7 more)

### Community 269 - "Core Contract, Provider Player Overlay Geometry Implementation Plan"
Cohesion: 0.13
Nodes (14): Core Contract, Done Means, File Structure, Global Constraints, Prerequisites, Provider Player Overlay Geometry Implementation Plan, Rollback, Task 1: Add The Provider-Neutral Geometry Contract (+6 more)

### Community 270 - "Voice Controls and Participant Audio Implementation Plan, 2026-07-27-voice-controls-and-participant-audio-plan.md"
Cohesion: 0.13
Nodes (14): Final Definition of Done, Implementation Status, Preference Model, Pull Request and Promotion, Runtime State Model, Task 1: Add the Voice Domain and Preference Codec, Task 2: Separate Microphone Publication, Speech, and Audio Flow, Task 3: Generalize the P2P Microphone Lifecycle (+6 more)

### Community 271 - "Interface Visibility Settings Design, Product Behavior"
Cohesion: 0.13
Nodes (14): Accessibility, Architecture, Goals, Information Architecture, Interface Visibility Settings Design, Main Control, Non-Goals, Participant Pills (+6 more)

### Community 272 - "devDependencies, typescript"
Cohesion: 0.14
Nodes (14): devDependencies, @cloudflare/vitest-pool-workers, typescript, vitest, wrangler, vitest, typescript, @cloudflare/vitest-pool-workers (+6 more)

### Community 273 - "Personal History MVP Design, Watch drawer presentation baseline with later personal-history amendment"
Cohesion: 0.14
Nodes (14): Native popup dimensions and dark initial surface, Accepted-catalog episode grid and honest partial fallback, Account-scoped retained drawer presentation state, Watch drawer presentation baseline with later personal-history amendment, Architectural boundaries, D01 Retention and Free access, D02 Frozen room capabilities, D03 Explicit media admission (+6 more)

### Community 274 - "overlay-media-session.ts, RoomConnectionStatus"
Cohesion: 0.21
Nodes (10): CameraEnabledForRoomConnectionInput, DEFAULT_LOCAL_CAMERA_ENABLED, getCameraEnabledForRoomConnection(), getP2PMediaSessionState(), P2PMediaSessionInput, P2PMediaSessionState, persistRoomSessionForCurrentJoin(), PersistRoomSessionForCurrentJoinInput (+2 more)

### Community 275 - "overlay-room-media-controls.tsx, RoomPeopleSection()"
Cohesion: 0.22
Nodes (10): getMediaAction(), MediaActionInput, orderRoomParticipants(), PanelCameraControlProps, participantInitials(), participantMediaStatus(), participantOrderRank(), RoomPeopleSection() (+2 more)

### Community 276 - "account-navigation-client.test.ts, account-nav.tsx"
Cohesion: 0.20
Nodes (11): AccountNav(), PRIMARY, SECONDARY, dialog(), dom, mount(), navigations, open() (+3 more)

### Community 277 - "friends-client.tsx, AccountEmptyState()"
Cohesion: 0.14
Nodes (9): CurrentUser, Directory, Editor, EMPTY, InviteLink, Modal, Notice, AccountEmptyState() (+1 more)

### Community 278 - "friends-client.test.tsx, FriendsClient()"
Cohesion: 0.21
Nodes (10): FriendsClient(), accountClient(), button(), click(), directory(), dom, friendship(), profile() (+2 more)

### Community 279 - "best-anime-to-watch-with-friends/page.tsx, watch-kdrama-together-long-distance/page.tsx"
Cohesion: 0.16
Nodes (9): faq, headings, itemList, metadata, faq, metadata, tocHeadings, DataTableColumn (+1 more)

### Community 280 - "Chrome Web Store Listing — AniDachi Extension, Detailed Description"
Cohesion: 0.14
Nodes (13): Category, Chrome Web Store Listing — AniDachi Extension, Detailed Description, Extension Name, Keywords (for internal reference, not shown on store), Language, Minimal Push Payload Privacy Model, Privacy And Permissions Notes (+5 more)

### Community 281 - "AniDachi SEO Content Guidelines, Templates (intent → shape)"
Cohesion: 0.14
Nodes (14): AniDachi SEO Content Guidelines, Canonical anime URL (programmatic), Guides / compare / listicles, Hard safety rules (ranking / indexation), Information architecture, Measurement, Page checklist (new or substantial edit), Pre-publish checklist (+6 more)

### Community 282 - "seo-cta-cleanup.py, export-anidachi-logo.py"
Cohesion: 0.20
Nodes (12): bg_like(), main(), collections, math, pathlib, pil, re (Python standard library), main() (+4 more)

### Community 283 - "auth_artifact_cleanup_plan_contract.mjs, assertPlan()"
Cohesion: 0.20
Nodes (11): actualVisits(), assertPlan(), explain(), familyDelete, findSubplan(), flattenPlan(), lineageDelete, migration (+3 more)

### Community 284 - "YouTube SEO conversion polish + agent upgrades, Part A — Page enrichment (conversion-first)"
Cohesion: 0.14
Nodes (13): Execution order, Goal, Light pass (P2 guides), Out of scope, Part A — Page enrichment (conversion-first), Part B — SEO agent upgrades, Pillar-specific (`watch-youtube-together/page.tsx`), Priority pages (edit these; light pass on the rest) (+5 more)

### Community 285 - "Handoff For AI Working On AniDachi Site Pages, ai-site-development-handoff.md"
Cohesion: 0.14
Nodes (13): Branch Model, Checks To Run, Current Expected Workflow Summary, Handoff For AI Working On AniDachi Site Pages, How Site Changes Reach Main, Paths That Are Safe For Site-Only Auto-Promotion, Paths That Block Auto-Promotion, Production Environment (+5 more)

### Community 286 - "Edge Cases, Blocked User"
Cohesion: 0.14
Nodes (14): Blocked User, Dashboard And Popup Drift, Edge Cases, Free Guest In Paid Room, Friend Removed After Invite, Group Changed After Invite, Local Progress Reconcile Conflict, Multi-Device User (+6 more)

### Community 287 - "File Map, Account Contracts And Popup Isolation Implementation Plan"
Cohesion: 0.14
Nodes (13): Account Contracts And Popup Isolation Implementation Plan, Completion Boundary, Existing files to modify, File Map, Global Constraints, New files, Task 1: Shared Account Read Contracts, Task 2: Versioned Web Read Responses (+5 more)

### Community 288 - "Two-phase Production Promotion, Runtime-second Phase"
Cohesion: 0.16
Nodes (14): Fresh Approval Before Every Merge, Frozen Staging Candidate, Staging and Main Git Convergence, Migration-first Phase, Technical Baseline Is Not a Public Launch, PR 174 Superseded Combined Promotion, PR 227 Migration-only Promotion, PR 228 Runtime Promotion (+6 more)

### Community 289 - "Waitlist And CRM Durable Storage Recovery Implementation Plan, Lossless CRM Reconciliation Tool"
Cohesion: 0.23
Nodes (14): Conflict-Safe CRM Mutations, CRM-Specific Blob Runtime Authority, Canonical Docs Environment Contract And Graphify Closeout, Recovery Global Constraints, Waitlist And CRM Durable Storage Recovery Implementation Plan, Interim Staging Data Acceptance, Legacy Public CRM Rollback Source, Lossless CRM Reconciliation Tool (+6 more)

### Community 290 - "validate-extension-artifact.mjs, actualExtensionId"
Cohesion: 0.14
Nodes (9): actualExtensionId, args, broadPatterns, channel, contentMatches, expectedByChannel, manifest, manifestPath (+1 more)

### Community 291 - "AniDachi Contributor Startup Contract, Development Quality Gates"
Cohesion: 0.19
Nodes (12): AniDachi Contributor Startup Contract, Plane-Specific Definition of Done, Layered Contributor Instructions, Repository Security Boundaries, Baseline For Every Change, Development Quality Gates, Verification Evidence Capture, Evidence To Capture (+4 more)

### Community 292 - "extension/package.json, scripts"
Cohesion: 0.15
Nodes (12): name, private, scripts, build, check, dev, dev:local, dev:staging (+4 more)

### Community 293 - "overlay-voice-session.ts, overlay-voice-session.test.ts"
Cohesion: 0.27
Nodes (11): createVoiceSessionState(), getVoiceIndicatorParticipantIds(), isVoiceSessionPublishing(), MicrophoneRelease, reduceVoiceSession(), shouldResetPersistedOpenMicAfterMediaSeatLoss(), stopVoiceSessionImmediately(), VoiceSessionAction (+3 more)

### Community 294 - "anidachi-vs-twoseven/page.tsx, watch-anime-long-distance-boyfriend-girlfriend/page.tsx"
Cohesion: 0.15
Nodes (10): AniDachiVsTwosevenPage(), faq, headings, metadata, SITE_URL, faq, howToSteps, metadata (+2 more)

### Community 295 - "watch_history_v2_migration_order_contract.mjs, initializationPosition"
Cohesion: 0.15
Nodes (12): initializationPosition, initializationSql, lockTimeoutPosition, migrationUrl, rpcPosition, sessionTriggerPosition, sourceLockPosition, transactionPosition (+4 more)

### Community 296 - "scratchpad.md, High-level Task Breakdown"
Cohesion: 0.17
Nodes (12): AniDachi SEO audit (Planner → Executor 2026-08-11), Background and Motivation, Background and Motivation (historical), Current Status / Progress Tracking, Full SEO Analysis (Executor 2026-08-02), GSC SEO Optimisation Batch (2026-06-08), High-level Task Breakdown, Homepage CRO Rework (Execution Summary) (+4 more)

### Community 297 - "Historical: Local CLI prefix atomicity receipt passed, Local native CLI atomicity receipt"
Cohesion: 0.22
Nodes (13): Historical: Hosted interrupted prefix 37 recovery, Historical: Local CLI prefix atomicity receipt passed, Historical: Manual Free-plan hosted rehearsal path, Authored COMMIT before migration history insertion, Fixed-case offline prefix proof checker, Local native CLI atomicity receipt, Prefixes 37 and 38 require full baseline recovery, Prefix 50 conditional unchanged-suffix gate (+5 more)

### Community 298 - "Codex-Hosted Semantic Extraction, September 4 Graphify Installation Audit"
Cohesion: 0.17
Nodes (13): Codex-Hosted Semantic Extraction, Graphify Union Merge Driver, Graphify 0.9.53 Release, Headless Graphify Semantic Backend, Incremental Freshness and Upgrade Policy, Per-Machine Setup and Opt-In Git Hooks, Normalized AST-Only Code Graph Refresh, September 4 Graphify Installation Audit (+5 more)

### Community 299 - "One canonical personal episode progress row in Supabase, Background-owned account and generation scoped cache/outbox"
Cohesion: 0.24
Nodes (13): Background-owned account and generation scoped cache/outbox, Bounded canonical title and episode reads with honest continuation, Browse rollback restores prior v3 consumers and retains additive history data, One canonical personal episode progress row in Supabase, Local Watch Drawer Browse Candidate, Metadata-pending observations, Owner-private group provenance requires invited overlapping viewing, Providers (+5 more)

### Community 300 - "Global Constraints, Room And P2P Release Hardening Implementation Plan"
Cohesion: 0.15
Nodes (12): Done Means, Global Constraints, Rollout And Rollback, Room And P2P Release Hardening Implementation Plan, Task 1: Fail-Closed Microphone And Capture Ownership, Task 2: Bounded Protocol And Worker Room Boundary, Task 3: Terminal Room Lifecycle Across Web And Durable Object, Task 4: Empty-Room Alarm And Idempotent Web Callback (+4 more)

### Community 301 - "V1 Product Decisions (Historical), V1 Staging Acceptance Matrix (Historical)"
Cohesion: 0.17
Nodes (13): Microphone Errors, Open Mic, Participant Mix, Per-Participant Playback, Player and Dictation, Player Audio, Privacy and Lifecycle, Push to Talk (+5 more)

### Community 302 - "Shared Pure Visibility Policy, Four-Responsibility Shared Policy Architecture"
Cohesion: 0.21
Nodes (13): Accessible Interface Settings View, Finite Policy-Driven Preview, Main-Control Preference Integration, Versioned Interface Preference Model, Shared Pure Visibility Policy, Serialized Preference Persistence, Immediate Apply with Persistence Rollback, Interface Accessibility Contract (+5 more)

### Community 303 - "Friends and groups link first MVP plan, Extension People MVP plan"
Cohesion: 0.28
Nodes (13): Atomic private group modal with retained drafts, Background social bridge owner and revision fencing, Deliberate one time friend link generation, Extension People MVP plan, Loaded staging People artifact 6dd848dc read only smoke, Real group save and two account link acceptance remain open, Atomic owner plan friendship revision checked group saves, Atomic single recipient friend link consumption (+5 more)

### Community 304 - "telemetry.ts, telemetry.test.ts"
Cohesion: 0.27
Nodes (8): AnalyticsEngineDataset, buildRoomDataPoint(), emitRoomTelemetry(), RoomDataPoint, RoomTelemetryContext, RoomTelemetryEvent, RoomTelemetryEventName, shortHash()

### Community 305 - "VoiceMode, voice-mode-preference.ts"
Cohesion: 0.24
Nodes (9): HotkeyState, VoiceMode, loadVoiceModePreference(), parseVoiceModePreference(), persistVoiceModePreference(), StorageAreaLike, VOICE_MODE_PREFERENCE_VERSION, VoiceModePreferenceRecord (+1 more)

### Community 306 - "FriendsWorkspace(), parseSavedGroup()"
Cohesion: 0.26
Nodes (9): FriendsWorkspace(), action(), closeModal(), dismissModal(), editGroup(), generateLink(), openModal(), saveGroup() (+1 more)

### Community 307 - "watch-history-v3-sql.test.ts, migrationSql()"
Cohesion: 0.20
Nodes (9): AUTHORITY_EXPIRY_MIGRATION_URL, CUTOVER_MIGRATION_URL, functionDefinition(), MIGRATION_URL, migrationSql(), NEW_TABLES, normalizedSql(), V2_FUNCTIONS (+1 more)

### Community 308 - "public.get_account_inbox_page_v2(), 20260822065227_room_invite_lifecycle_actions.sql"
Cohesion: 0.23
Nodes (10): public.get_account_inbox_page_v2(), public.reconcile_account_inbox_v2(), public.respond_room_invite_v2(), public.friend_groups, public.friendships, public.profiles, public.room_invite_recipients, public.room_invites (+2 more)

### Community 309 - "public.commit_room_usage_day_v1(), 20260908065520_room_media_capabilities_v2.sql"
Cohesion: 0.26
Nodes (10): public.commit_room_usage_day_v1(), public.create_room_with_active_session_v1(), public.finalize_room_usage(), public.room_usage_days_v1, anon, authenticated, public, public.active_room_sessions (+2 more)

### Community 310 - "watch_history_v3.test.sql, watch_v3_force_receipt_failure"
Cohesion: 0.17
Nodes (6): public.recent_people_evidence, watch_v3_force_receipt_failure, watch_v3_recent_people_before_expired, watch_v3_recent_people_before_post_end, watch_v3_recent_people_pair, pg_temp.watch_v3_force_receipt_failure

### Community 311 - "Project Knowledge Map, Isolated Code Update Regression Test"
Cohesion: 0.17
Nodes (11): Baseline Graph, Current Anidachi Queries To Run Before P2P Block 6, Current Status, Isolated Code Update Regression Test, Keeping The Graph Current, Output Policy, Project Knowledge Map, Pull Request Rule (+3 more)

### Community 312 - "Account library and manual progress editor plan, Service only edit_watch_history_v1 atomic progress edits"
Cohesion: 0.27
Nodes (12): Event arrival provider sample and authority revision fence, Account library and manual progress editor plan, Clear progress retains a title slot and removal frees it, Exact 14 day manual mutation receipt retry, Manual editor local implementation with staging acceptance pending, Manual edits require paid access while Free retains saved history, Only accepted available catalog episodes can be marked watched, Per episode manual_edited_at observation fence (+4 more)

### Community 313 - "Popup People And Social Directory Implementation Plan, 2026-08-07-popup-people-social-directory.md"
Cohesion: 0.17
Nodes (11): Final Self-Review Checklist, Popup People And Social Directory Implementation Plan, Pull Request And Rollback, Scope Guardrails, Task 1: Add Shared Recent-People And Social-Directory Contracts, Task 2: Make Recent People Canonical And Duplicate-Free, Task 3: Add The MV3 Social-Directory And Friend-Request Bridge, Task 4: Migrate The Account-Owned Popup Social Snapshot (+3 more)

### Community 314 - "smoke-staging-web.mjs, main()"
Cohesion: 0.29
Nodes (10): assertHeaderIncludes(), assertStatus(), assertTextIncludes(), baseUrl, extractCookie(), fetchManual(), formBody(), getSetCookies() (+2 more)

### Community 315 - "Incremental Re-extraction, Incremental Update Runbook"
Cohesion: 0.18
Nodes (11): Changed-file Replacement, Cluster-only Refresh, Code-only Fast Path, Deleted-source Pruning, Graph Update Diff, Incremental File Detection, Incremental Re-extraction, Incremental Update Runbook (+3 more)

### Community 316 - "room-quota-display.ts, roomQuotaRemainingSeconds()"
Cohesion: 0.31
Nodes (9): acceptAuthoritativeQuota(), applyRoomUsageSnapshot(), AuthoritativeQuotaAnchor, authoritativeQuotaRemainingSeconds(), isNewerRoomUsage(), nonnegative(), quotaDayFromResetAt(), roomQuotaRemainingSeconds() (+1 more)

### Community 317 - "contact-form-client.test.ts, ContactForm()"
Cohesion: 0.20
Nodes (6): ContactForm(), contact, dom, field(), fill(), mount()

### Community 318 - "seo-landing-path.ts, getSeoAttributionFields()"
Cohesion: 0.36
Nodes (10): captureFirstLandingPath(), getFirstLandingPath(), getFirstLandingReferrer(), getFirstLandingUtm(), getSeoAttributionFields(), isNonMarketingPath(), NON_MARKETING_PREFIXES, readUtmFromSearch() (+2 more)

### Community 319 - "Download on the App Store Badge, App Store Conversion CTA"
Cohesion: 0.31
Nodes (11): Download on the App Store Badge, App Store Conversion CTA, Apple Logo Glyph, Black Rounded Badge Container, Download on the App Store Lettering, Gray Badge Outline, iOS App Distribution Trust Signal, Mobile App Download Funnel (+3 more)

### Community 320 - "20260816090000_watch_history_v2_bounded_read.sql, public.list_watch_history_v2_page()"
Cohesion: 0.18
Nodes (5): public.list_watch_history_v2_page(), public.user_watch_settings, public.watch_episode_progress, sync_watch_history_session_summaries_v2, public.sync_watch_history_session_summaries_v2

### Community 321 - "public.active_room_sessions, 20260823090624_single_active_room_sessions.sql"
Cohesion: 0.29
Nodes (8): public.active_room_sessions, public.claim_active_room_session_v1(), public.create_room_with_active_session_v1(), public.finalize_room_usage(), public, public.room_members, public.rooms, public.users

### Community 322 - "Project Operating Manual, Custom website OAuth and cookie sessions backed by Supabase tables"
Cohesion: 0.24
Nodes (11): Architecture stack reference to Supabase Auth, Custom website OAuth and cookie sessions backed by Supabase tables, Define cross plane contracts before consumers, Extension one time code and independent token lifecycle, Feature PR staging acceptance then explicit production release, Host authoritative playback synchronization, Older manual branch protection assertions, Paid personal capture and retained Free read Resume delete (+3 more)

### Community 323 - "Resources Progress Menu Implementation Plan, 2026-05-26-resources-progress-menu.md"
Cohesion: 0.18
Nodes (10): Acceptance Criteria, File Structure, Future Backend Upgrade, Resources Progress Menu Implementation Plan, Task 1: Local Watch Progress Store, Task 2: Crunchyroll Progress Identity, Task 3: Resources Panel Component, Task 4: Overlay Integration and Recorder (+2 more)

### Community 324 - "Task 7 Complete, Production Cutover And Closeout"
Cohesion: 0.20
Nodes (11): Explicit Production Approval Gate Satisfied, Acceptance Snapshot Private Authority: 687 Contacts And 685 Survey Leads, Final Production CRM Rollback Anchors, Pre-Cutover Deployment Rollback Anchor, Production Controlled Public-Form Acceptance, Production CRM Runtime Logs Clean, Production Cutover And Closeout, Production Narrow Credential Boundary (+3 more)

### Community 325 - "Watch History Capacity, Canonical admission guard"
Cohesion: 0.20
Nodes (11): Provider capacity amendment, Canonical admission guard, Canonical capacity authority, Capacity deployment order, Capacity rollback, Capacity verification, Capacity visual QA, Compatible terminal envelope (+3 more)

### Community 326 - "Account MVP navigation design, Account bug report contact contract"
Cohesion: 0.31
Nodes (11): Account bug report contact contract, Account MVP navigation design, Bug report submission lifecycle, Header notification dialog backed by canonical account inbox, Mounted history draft protection through navigation and Join, Optional profile owner mismatch fence with compatible old clients, Owner keyed transient account workspace controls, Report a bug secondary navigation (+3 more)

### Community 327 - "p2p-scorecard.mjs, printReport()"
Cohesion: 0.29
Nodes (10): analyzeFile(), fail(), get(), median(), ms(), pairKind(), parseExport(), paths (+2 more)

### Community 328 - "Project Planes, CodeRabbit Review Policy"
Cohesion: 0.27
Nodes (10): Contract First for Cross-Plane Changes, Project Planes, API Review Scope, Extension Review Scope, CodeRabbit Path Filters, Plan Review Scope, Protocol Review Scope, CodeRabbit Review Policy (+2 more)

### Community 329 - "overlay-room-media-controls.test.tsx, PanelCameraControl()"
Cohesion: 0.22
Nodes (5): PanelCameraControl(), defaultPeopleProps, render(), RenderedView, renderPeople()

### Community 330 - ".sampleRemoteAudioActivityOnce(), .getStats()"
Cohesion: 0.22
Nodes (4): audioActivityStatsChanged(), classifyPeerHealth(), classifyRemoteVideoActivity(), getAudioTrackFromElement()

### Community 331 - "room-invite-notification-runtime.test.ts, json()"
Cohesion: 0.22
Nodes (5): alarms, diagnostic, json(), registered(), state

### Community 332 - "include, extension/tsconfig.json"
Cohesion: 0.20
Nodes (9): compilerOptions, jsx, extends, include, src, test, entrypoints, wxt.config.ts (+1 more)

### Community 333 - "SEO Trust & Authority plan (2026-07-28), Hard safety constraint"
Cohesion: 0.20
Nodes (10): Agent / guidelines, Attribution, Freeze exit criteria, Hard safety constraint, Run the portfolio audit, SEO Trust & Authority plan (2026-07-28), URL stability (ranked pages), What it does not replace (+2 more)

### Community 334 - "AniDachi Logo Asset, Friendly Brand Tone"
Cohesion: 0.33
Nodes (10): AniDachi Logo Asset, Anime Mascot Face, App Icon Readability, Circular Badge Shape, Closed Smile Expression, Dark Curved Eyes, Friendly Brand Tone, Hair Flame Shape (+2 more)

### Community 335 - "personal_mvp_activation_contract.mjs, delay()"
Cohesion: 0.24
Nodes (8): activation, args, delay(), policy(), readme, sql(), target, until()

### Community 336 - "20260819133849_auth_channel_rotation.sql, public.refresh_token_families"
Cohesion: 0.38
Nodes (8): public.create_refresh_token_family_v1(), public.refresh_token_families, public.refresh_token_lineage, public.resolve_refresh_token_family_v1(), public.revoke_refresh_token_family_v1(), public.rotate_refresh_token_family_v1(), public.devices, public.users

### Community 337 - "20260904114914_account_inbox_push_outbox.sql, enqueue_friend_request_inbox_push"
Cohesion: 0.20
Nodes (6): enqueue_friend_request_inbox_push, enqueue_room_invite_inbox_push, public.enqueue_room_invite_inbox_push(), inserted_recipients, public.enqueue_friend_request_inbox_push, public.enqueue_room_invite_inbox_push

### Community 338 - "personal_watch_history.test.sql, pg_temp.legacy_watch()"
Cohesion: 0.20
Nodes (6): old_youtube, personal_catalog, personal_test_input, pg_temp.legacy_watch(), preserved_rows, mixed_page

### Community 339 - "MVP Plan Pricing, All Supported Platforms"
Cohesion: 0.20
Nodes (10): All Supported Platforms, D01 Retained History, Free Host Time, Free Plus Pro Limits, Independent Media Publication, Media Claims Release Gate, MVP Plan Pricing, Own Plan History Access (+2 more)

### Community 340 - "Rollout Order, Phase 0 - Contract And Plan"
Cohesion: 0.20
Nodes (10): Phase 0 - Contract And Plan, Phase 1 - Billing Entitlements Foundation, Phase 2 - Profiles, Friends, And Recent People, Phase 3 - Personal Groups, Phase 4.5 - Product Surface Reframe, Phase 4 - Room Capabilities And Media Seats, Phase 5 - Invites, Inbox, And Push Delivery, Phase 6 - Watch Library, History, And Continue Together (+2 more)

### Community 341 - "Completed Public-Product Recovery Record, Distinct Live Signup 2026-08-23T18:13:49.881Z Created Position 686"
Cohesion: 0.20
Nodes (9): Distinct Live Signup 2026-08-23T18:13:49.881Z Created Position 686, Completed Public-Product Recovery Record, Distinct Live Signup Advanced Production To 686, Fresh-Deployment Acceptance, Live Production Survey Lead Count: 686, Plans, Production And Main Promotion Complete, Staging And Production CRM Recovery Complete (+1 more)

### Community 342 - "Watch Drawer Browse Implementation Plan, Authorized Staging Delivery"
Cohesion: 0.20
Nodes (9): Authorized Staging Delivery, Global Constraints, Next.js reserved binding fix, Task 1: Durable Provenance And Server Browse Boundary, Task 2: Query-Isolated Extension Client, Task 3: Drawer Layout, Filtering And History Settings, Task 4: Integration, Evidence And Local Handoff, Watch Drawer Browse Implementation Plan (+1 more)

### Community 343 - "types, types"
Cohesion: 0.22
Nodes (9): @cloudflare/workers-types, compilerOptions, types, types, @cloudflare/workers-types, types, chrome, @cloudflare/vitest-pool-workers/types (+1 more)

### Community 344 - "panel-account-title.tsx, PanelAccountTitle()"
Cohesion: 0.39
Nodes (7): AuthenticatedUserPlan, calculatePlanGlyphOffset(), getLastVisibleGrapheme(), measureGlyphAscent(), PanelAccountTitle(), PanelAccountTitleProps, PLAN_LABELS

### Community 345 - "overlay-layout-ghost-preview.tsx, overlay-layout-ghost-preview.test.tsx"
Cohesion: 0.33
Nodes (6): CHAT_PREVIEW_MESSAGES, OverlayLayoutChatPreview(), ResolvedOverlayLayout, getPixelRectStyle(), OverlayLayoutGhostPreview(), OverlayLayoutGhostPreviewProps

### Community 346 - "Conversion metrics (GA4), CONVERSION_METRICS.md"
Cohesion: 0.22
Nodes (8): Conversion metrics (GA4), Event names (funnel), Next test hypotheses, Parameters (all string-friendly for GA4), QA checklist (post-deploy), SEO portfolio audit, Stripe checkout metadata, Web vitals (field data)

### Community 347 - "Host Avatar Asset, Host Persona"
Cohesion: 0.28
Nodes (9): Calm Neutral Expression, Cool Blue Purple Lighting, Demo Avatar Profile, Frontal Headshot Composition, Host Avatar Asset, Host Persona, Minimal Dark Wardrobe, Square Avatar Crop (+1 more)

### Community 348 - "public.apply_watch_progress_v2(), 20260820111116_room_history_authority_expiry.sql"
Cohesion: 0.22
Nodes (8): public.apply_watch_progress_v2(), public.profiles, public.user_watch_settings, public.users, public.watch_episode_progress, public.watch_history_receipts, public.watch_session_participants, public.watch_sessions

### Community 349 - "20260907194413_personal_history_access.sql, public.account_manual_plan_grants"
Cohesion: 0.25
Nodes (5): public.account_manual_plan_grants, public.begin_stripe_subscription_refresh_v1(), public.stripe_subscription_refresh_leases, public, public.users

### Community 350 - "include, web/tsconfig.json"
Cohesion: 0.22
Nodes (8): exclude, include, my-video, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx

### Community 351 - "graphify reference: extra exports and benchmark, exports.md"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 352 - "Executor's Feedback or Assistance Requests, Additional batch (10 more watch pages — 2026-05-12)"
Cohesion: 0.22
Nodes (9): Additional batch (10 more watch pages — 2026-05-12), Additional batch (10 more watch pages — 2026-05-14), Additional batch (10 more watch pages — 2026-05-15), Additional batch (10 more watch pages — 2026-05-19), Additional batch slugs (implemented 2026-05-12), Additional batch slugs (implemented 2026-05-14), Executor's Feedback or Assistance Requests, Proposed next 10 `/watch/[slug]-with-friends` pages (+1 more)

### Community 353 - "Participant Session Identity, Explicit Room Protocol Contract"
Cohesion: 0.28
Nodes (9): Connection Versus Tab Identity, Explicit Room Protocol Contract, Participant Session Identity, Short-Lived Room Token Authority, Snapshot Gated P2P Start, Source Descriptor and Generation, WebSocket Hibernation Migration, Session and Reconnect Block (+1 more)

### Community 354 - "Social Rooms, Friends, Groups, And Subscriptions Execution Plan, 2026-06-20-social-rooms-subscriptions-execution-plan.md"
Cohesion: 0.22
Nodes (8): Current Gaps To Close, Done Means, Evidence Reviewed, Non-Goals, Plan Matrix, Progress Log, Social Rooms, Friends, Groups, And Subscriptions Execution Plan, Watch History And Continue Together

### Community 355 - "Global Constraints, Interface Visibility Settings Implementation Plan"
Cohesion: 0.22
Nodes (8): Global Constraints, Interface Visibility Settings Implementation Plan, Task 1: Define The Versioned Interface Preference Model, Task 2: Add One Pure Visibility Policy For Runtime And Preview, Task 3: Load And Persist Preferences With Ordered Writes, Task 4: Build The Interface Settings View And Truthful Preview, Task 5: Connect Main-Control Preferences Without Regressing Edge Intent, Task 6: Add Persistent Compact Participant Pills

### Community 356 - "Durable Cross-room Assignment, Live Room State"
Cohesion: 0.25
Nodes (9): Disconnect Grace, Durable Cross-room Assignment, Exact Departure, Invite And Membership Semantics, Live Room State, Migration-first Rollout, No New Distributed Authority For MVP, Selected: Supabase Assignment Plus Existing Room Durable Object (+1 more)

### Community 359 - "include, api/tsconfig.json"
Cohesion: 0.25
Nodes (7): extends, include, src, test, tsconfig base.json, vitest.cloudflare.config.ts, wrangler.toml

### Community 360 - "room-tab-lock.ts, acquireRoomTabLock()"
Cohesion: 0.46
Nodes (5): acquireRoomTabLock(), getLockManager(), isRoomTabLockSupported(), LockManagerLike, releaseRoomTabLock()

### Community 361 - "watch-history-runtime-policy.ts, watch-history-runtime-policy.test.ts"
Cohesion: 0.32
Nodes (6): resolveWatchHistoryRuntimeGate(), shouldRefreshWatchHistoryAuthority(), WatchHistoryAuthContext, WatchHistoryAuthorityRefreshInput, WatchHistoryRuntimeGate, WatchHistoryRuntimeGateInput

### Community 362 - "overlay-layout-engine.test.ts, chatTopForSelectionRow()"
Cohesion: 0.36
Nodes (7): blockChatGridCell(), blockChatGridSpan(), blockChatRow(), chatTopForSelectionRow(), reservedCameraViewport, selectionViewport, viewport

### Community 363 - "Haruto Avatar Image, Watch Party Avatar"
Cohesion: 0.39
Nodes (8): Approachable Demo Identity, Haruto Avatar Image, Direct Eye Contact, Friendly Smiling Portrait, Haruto Persona, Neutral Profile Background, Profile Placeholder Asset, Watch Party Avatar

### Community 364 - "Natsuki Avatar Asset, Approachable Social Presence"
Cohesion: 0.43
Nodes (8): Approachable Social Presence, Demo Watch-Party Persona, Natsuki Avatar Asset, Red Turtleneck Styling, Smiling Portrait Subject, Soft Blurred Background, Square Avatar Composition, Warm Expressive Smile

### Community 365 - "public.room_invite_actions, 20260810190000_room_invite_atomicity.sql"
Cohesion: 0.25
Nodes (6): public.room_invite_actions, public, public.friend_groups, public.room_invites, public.rooms, public.users

### Community 366 - "public.consume_extension_auth_code_v1(), 20260820040229_auth_artifact_cleanup.sql"
Cohesion: 0.25
Nodes (6): public.consume_extension_auth_code_v1(), public.extension_auth_codes, public.refresh_tokens, public.oauth_login_transactions, public.refresh_token_families, public.refresh_token_lineage

### Community 367 - "room_invite_return.test.sql, before_denial"
Cohesion: 0.25
Nodes (5): before_denial, first_page, results, return_page, revision

### Community 368 - "Prelaunch remediation plan, Confirmed main content clock eligibility for personal history"
Cohesion: 0.29
Nodes (8): Confirmed main content clock eligibility for personal history, Prelaunch remediation plan, Preserve root WIP and data with production activation excluded, Task 1 exclude YouTube advertisements from personal history, Task 2 restore test subscription cancellation, Task 3 prepare safe production database transition, Task 4 repair room validation and acceptance instructions, Task 5 integrate review and deliver to staging

### Community 369 - "Staging Acceptance Checklist, staging-acceptance-checklist.md"
Cohesion: 0.25
Nodes (7): Always Check, Evidence To Attach To PR, Extension, Promotion Rule, Room / P2P, Site / Auth, Staging Acceptance Checklist

### Community 370 - "API Surface, Billing"
Cohesion: 0.25
Nodes (8): API Surface, Billing, Dashboard Aggregates, Devices, Friends And Recent People, Profile, Rooms And Invites, Watch History

### Community 371 - "Database Model, Devices And Web Push Subscriptions"
Cohesion: 0.25
Nodes (8): Billing Tables, Database Model, Devices And Web Push Subscriptions, Friend Invite Link Table, Friendship Tables, Invites, Profile Tables, Watch History And Tracking

### Community 372 - "Global Constraints, Overlay Layout Engine V2 Core Implementation Plan"
Cohesion: 0.25
Nodes (7): Execution Note, Global Constraints, Overlay Layout Engine V2 Core Implementation Plan, Task 1: Version 2 Layout Model And Defaults, Task 2: Deterministic Camera Slot Geometry, Task 3: Chat Geometry, Collision Search, And Core Resolver, Task 4: Core Acceptance And Knowledge Graph Refresh

### Community 373 - "Global Constraints, Overlay Layout Runtime And Editor V2 Implementation Plan"
Cohesion: 0.25
Nodes (7): Global Constraints, Overlay Layout Runtime And Editor V2 Implementation Plan, Task 1: V2 Storage Contract And Runtime Style Adapter, Task 2: Live Runtime Parity, Task 3: Draft-Based V2 Layout Editor, Task 4: Delete V1 And Finish Visual Styling, Task 5: Acceptance, Documentation, And Staging Delivery

### Community 374 - "Approved Voice UX Simplification V2, V2 Implementation Tasks"
Cohesion: 0.25
Nodes (8): Approved Voice UX Simplification V2, Product Contract, Runtime Contract, Task 10: Add Room-Scoped Voice Restore (Complete), Task 11: Simplify Voice UI and Remove Dictation (Complete), Task 12: Verify and Hand Off (Automated Complete, Manual Pending), Task 9: Replace the V1 Voice Interaction Contract (Complete), V2 Implementation Tasks

### Community 375 - "Production Acceptance Snapshot: 685 Survey Leads, Post-Signup Private Authority: 688 Contacts And 686 Survey Leads"
Cohesion: 0.29
Nodes (8): Final Docs-Triggered Production Deployment dpl_HcqvVAnF9V4EnSHjYekrpmKfQEUY, Fresh Production Redeploy dpl_DCt6ocJBbEJ848rfaC38W5bhbdyg, Full-Redeploy Durability Proof, Live Product Counts Are Dynamic, Post-Signup Private Authority: 688 Contacts And 686 Survey Leads, Production Deployment dpl_3v2H5pk4v5muknJvpyKjXZpJHEXX, Production Idempotent Replay, Production Acceptance Snapshot: 685 Survey Leads

### Community 376 - "YouTube Adapter Notes, youtube-adapter-notes.md"
Cohesion: 0.25
Nodes (7): Ownership, Playback Phases, Required Acceptance, Selector Maintenance, Supported Surface, Synchronization Policy, YouTube Adapter Notes

### Community 377 - "sync.ts, normalizeRemotePlaybackState()"
Cohesion: 0.29
Nodes (7): getExpectedHostTime(), getPlaybackDrift(), normalizeRemotePlaybackState(), SYNC_CATCH_UP_DRIFT_SECONDS, SYNC_IGNORE_DRIFT_SECONDS, SYNC_SEEK_DRIFT_SECONDS, SyncCorrection

### Community 378 - "lib, lib"
Cohesion: 0.29
Nodes (7): lib, lib, dom, dom, dom iterable, ES2022, esnext

### Community 379 - "findKatamariPlayerFromReactNode(), isRecord()"
Cohesion: 0.48
Nodes (7): findAncestor(), findKatamariPlayer(), findKatamariPlayerFromReactNode(), isKatamariPlayer(), isRecord(), readKatamariPlayer(), readObjectProperty()

### Community 380 - "overlay-layout.ts, overlay-layout.test.ts"
Cohesion: 0.48
Nodes (5): DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX, getOverlayChromePlacement(), normalizePixelValue(), OverlayChromePlacement, shouldShowCameraStack()

### Community 381 - ".handleNetworkSignal(), shouldProactivelyRestartIceForNetworkSignal()"
Cohesion: 0.29
Nodes (3): getNetworkInformation(), shouldProactivelyRestartIceForNetworkSignal(), summarizeNetworkInformation()

### Community 382 - "AniDachi Apple Touch Icon, Web App Brand Asset"
Cohesion: 0.43
Nodes (7): AniDachi Apple Touch Icon, Flame Hair Gradient, Friendly Closed-Eye Expression, iOS Home Screen Asset, Mascot Face, Web App Brand Asset, White Face Shape

### Community 383 - "AniDachi Web Logo Asset, Smiling Anime Face Mascot"
Cohesion: 0.52
Nodes (7): Smiling Anime Face Mascot, AniDachi Web Logo Asset, Circular Logo Badge, Closed Eye Smile Expression, Friendly Anime Brand Identity, Red Orange Gradient Hair Silhouette, White Face Shape

### Community 384 - "public.watch_sessions, 20260626_watch_library.sql"
Cohesion: 0.62
Nodes (6): public.user_tracked_titles, public.watch_progress_checkpoints, public.watch_session_participants, public.watch_sessions, public.rooms, public.users

### Community 386 - "Operating contract (mandatory), Evidence hierarchy"
Cohesion: 0.29
Nodes (7): Evidence hierarchy, Measurement commands, Operating contract (mandatory), Publishing gate (new or major SEO URL), Ranking / indexation safety, URL stability gate (mandatory), Winner queue (while freeze is active)

### Community 387 - "Project Status Board, AniDachi SEO audit (Executor — awaiting Planner confirm)"
Cohesion: 0.29
Nodes (7): AniDachi SEO audit (Executor — awaiting Planner confirm), Full SEO Analysis (2026-08-02), Keyword Enrichment Analysis (2026-08-02), Keyword Enrichment Implementation (2026-08-03) — Executor, Project Status Board, SEO agent critical fixes (Executor — awaiting Planner confirm), SEO Trust & Authority

### Community 388 - "Site, Extension, Auth, and Database Integration Notes, Historical research: Authenticated Room Flow"
Cohesion: 0.29
Nodes (7): Historical research: Authenticated Room Flow, Historical research: Custom Website Auth Model, Historical research: Extension PKCE Login Flow, Historical research: Server-derived Participant Identity, Historical research: Shared Protocol Monorepo, Site, Extension, Auth, and Database Integration Notes, Historical research: Web and Worker Source of Truth Split

### Community 389 - "Social pricing model, History retention and capacity"
Cohesion: 0.29
Nodes (7): Free plan, History retention and capacity, Host and viewer entitlements, Plus plan, Pro plan, Public media acceptance, Social pricing model

### Community 390 - "Voice UX Simplification V2, Room-Scoped Voice State"
Cohesion: 0.29
Nodes (7): Account-Scoped Last Explicit Voice Preference, Dictate Reactions Removal, Manual Voice Staging Acceptance Pending, Room Media Startup Defaults, Room-Scoped Voice State, V-Only Push to Talk, Voice UX Simplification V2

### Community 391 - "Participant Audio Controls, UI Contract"
Cohesion: 0.29
Nodes (7): Header Microphone Control, Hotkey and Player Isolation, Participant Audio Controls, Participant With Rendered Video, Surface Handoff, UI Contract, Voice Settings Panel

### Community 392 - "September 4 Microphone-Independent Main Control Correction, Automated Verification and Staging Artifact Evidence"
Cohesion: 0.33
Nodes (7): Manual Acceptance and Draft PR Gate, September 4 Microphone-Independent Main Control Correction, Automated Verification and Staging Artifact Evidence, Extension-Local Presentation Boundary, Microphone-Independent Launcher Visibility, Extension-Only Staging Rollout, Automated Coverage and Manual Staging Acceptance Boundary

### Community 393 - "Account Isolation, Notification Privacy And Routing"
Cohesion: 0.29
Nodes (7): Account Isolation, Account Request Generation Fence, Independent Corrupt Cache Recovery, Notification Click Route Intent, Notification Privacy And Routing, Profile Notification Preference, Delete And Account Fences

### Community 394 - "demo/tsconfig.json, include"
Cohesion: 0.33
Nodes (5): compilerOptions, extends, include, src, index.html

### Community 395 - "current-resource-panel.tsx, CurrentResourceDisplay"
Cohesion: 0.47
Nodes (4): CurrentResourceDisplay, CurrentResourcePanel(), CurrentResourcePanelProps, formatProgressClock()

### Community 396 - "AniDachi App Icon, Browser Tab Identity"
Cohesion: 0.40
Nodes (6): AniDachi App Icon, Browser Tab Identity, Red Orange Circular Badge, Stylized Anime Mascot Face, Transparent PNG Icon Asset, White Face Silhouette

### Community 397 - "Stable Channel Identity, Notification Permission Disclosure"
Cohesion: 0.33
Nodes (6): Notification Permission Disclosure, Staging and Production Environment Isolation, Default-On Notification Permission Model, Extension Release Channels, Private ZIP Promotion Flow, Stable Channel Identity

### Community 398 - "skills.ts, getCombinedSkillContent()"
Cohesion: 0.33
Nodes (4): SKILL_CONTENT, SKILL_DETECTION_PROMPT, SKILL_NAMES, SkillName

### Community 399 - "public.room_invites, public.room_invite_recipients"
Cohesion: 0.47
Nodes (5): public.room_invite_recipients, public.room_invites, public.friend_groups, public.rooms, public.users

### Community 400 - "public.list_recent_people_evidence(), 20260808_social_atomicity.sql"
Cohesion: 0.33
Nodes (4): public.list_recent_people_evidence(), public.friendships, public.recent_people_hidden, public.watch_progress_checkpoints

### Community 402 - "public.claim_active_room_session_v1(), public.create_room_with_active_session_v1()"
Cohesion: 0.47
Nodes (5): public.claim_active_room_session_v1(), public.create_room_with_active_session_v1(), public.active_room_sessions, public.room_members, public.rooms

### Community 403 - "anidachi_private.tick_inbox_push_scheduler(), 20260904154732_private_inbox_push_scheduler.sql"
Cohesion: 0.40
Nodes (5): anidachi_private.inbox_push_scheduler, anidachi_private.tick_inbox_push_scheduler(), net.http_request_queue, net._http_response, public.account_inbox_push_outbox

### Community 404 - "20260908071729_room_media_negotiation_fence.sql, public.claim_active_room_session_v1()"
Cohesion: 0.40
Nodes (5): public.claim_active_room_session_v1(), public.claim_active_room_session_v2(), public.create_room_with_active_session_v2(), public.personal_history_policy, public.rooms

### Community 405 - "personal_history_access.test.sql, access_results"
Cohesion: 0.33
Nodes (3): access_results, saved_order, saved_progress

### Community 409 - "watch_history_v3_episode_previews.test.sql, pg_temp.preview_tail()"
Cohesion: 0.40
Nodes (3): bounded_preview, pg_temp.preview_tail(), preview_pages

### Community 411 - "graphify reference: query, path, explain, query.md"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 412 - "High-level Task Breakdown (historical), Completed (prior watch-page batches — historical)"
Cohesion: 0.33
Nodes (6): Completed (prior watch-page batches — historical), Completed (YouTube SEO batch 2 — 2026-07-26), High-level Task Breakdown (historical), Next batch (10 new watch pages), SEO agent critical fixes (Planner → Executor 2026-07-26), YouTube conversion polish (Executor — awaiting Planner confirm)

### Community 413 - "Sitewide CTA → Plan-Picker Survey (Planner Notes), Key Challenges and Analysis"
Cohesion: 0.33
Nodes (6): High-level Task Breakdown (implementation plan), Key Challenges and Analysis, Manual test checklist (post-implementation), Sitewide CTA → Plan-Picker Survey (Planner Notes), What exists today (relevant CTA surfaces found), What you asked for

### Community 414 - "Capacity endpoint, Authoritative cancellation return"
Cohesion: 0.33
Nodes (6): Authoritative cancellation return, Billing owner session fence, Access lease compatibility, Capacity endpoint, Drawer capacity notice, Watch Library counters

### Community 415 - "AniDachi Project Knowledge Map, Graph-First, Source-Verified Navigation"
Cohesion: 0.47
Nodes (6): AniDachi Project Knowledge Map, Graph-First, Source-Verified Navigation, P2P Block 6 Graph Navigation, Pull Request Graph and Source Evidence, Scoped Local Graphs, Shared Graph Artifact Allowlist

### Community 416 - "Billing And Entitlements, Access Rules"
Cohesion: 0.33
Nodes (6): Access Rules, Billing And Entitlements, Checkout Requirements, Required Webhook Events, Server Entitlement Helper, Source Of Truth

### Community 417 - "Required Tests, API Tests"
Cohesion: 0.33
Nodes (6): API Tests, Extension Tests, Harness/Staging Tests, Required Tests, Unit Tests, Web Dashboard Tests

### Community 418 - "Extension UX, Friend And Group Actions"
Cohesion: 0.33
Nodes (6): Extension UX, Friend And Group Actions, Main Invite Surface, Notification Permission, Plan-Limit States, Popup Navigation

### Community 419 - "Always-Visible Compact Participant Pills, Persistent Compact Participant Rail Integration"
Cohesion: 0.33
Nodes (6): Persistent Compact Participant Rail Integration, Audio-Adjustment Expansion Latch, Listener-Local Audio Controls and Compact Mute Marker, Always-Visible Compact Participant Pills, Participant Rail Eligibility and Displayable-Video Deduplication, Smart Participant Pills

### Community 420 - "Final Staging Runtime Acceptance, Fresh Preview Deployment dpl_AnAzpf8XTHUcCrYMz19TDkQ2y3rq"
Cohesion: 0.33
Nodes (6): Final Staging Runtime Acceptance, Fresh Preview Deployment dpl_AnAzpf8XTHUcCrYMz19TDkQ2y3rq, Runtime Deployment Acceptance Gate, Recovered Submission Idempotency, Staging Survey Lead Count: 685, Three Observed Failed Survey Submissions Recovered

### Community 421 - "Exact Assignment Release, Durable Release First, Live Detach Second"
Cohesion: 0.33
Nodes (6): Durable-First Guest Departure, Durable Active-Room Assignment, Durable Release First, Live Detach Second, Exact Assignment Release, Exact Session Invariants, Public Exact Departure Contract

### Community 422 - "Extension Inbox polish plan, September 11 Inbox presentation amendment"
Cohesion: 0.53
Nodes (6): Cached inbox refresh failures disable stale actions, Extension Inbox polish plan, Loaded staging Inbox artifact 939f9f4c read only smoke, Real two account invitation action acceptance remains open, Single empty state and populated Friend requests Room invites Missed, September 11 Inbox presentation amendment

### Community 423 - "Accepted Catalog Read, Episode Grid Presentation"
Cohesion: 0.33
Nodes (6): Accepted Catalog Read, Canonical Unfiltered Aggregates, Catalog Cursor Invalidation Fence, Distinct Grid Selection And Launch, Episode Grid Presentation, Honest Catalog Fallback

### Community 424 - "protocol/tsconfig.json, include"
Cohesion: 0.33
Nodes (5): compilerOptions, extends, include, src, test

### Community 425 - "smoke-worker.mjs, fetchJson()"
Cohesion: 0.40
Nodes (3): baseUrl, fetchJson(), url()

### Community 426 - "apps/api Agent Instructions, api/AGENTS.md"
Cohesion: 0.40
Nodes (4): apps/api Agent Instructions, Rules, Source Of Truth, Verification

### Community 427 - "apps/extension Agent Instructions, extension/AGENTS.md"
Cohesion: 0.40
Nodes (4): apps/extension Agent Instructions, Rules, Source Of Truth, Verification

### Community 428 - "overlay-panel-interaction.ts, overlay-panel-interaction.test.ts"
Cohesion: 0.60
Nodes (3): OverlayPanelDismissContext, shouldDismissOverlayPanel(), waitForOverlayPaint()

### Community 429 - "overlay-unmount-cleanup.test.tsx, overlay-unmount-cleanup.ts"
Cohesion: 0.60
Nodes (3): OverlayUnmountCleanupOptions, useOverlayUnmountCleanup(), CleanupHarness()

### Community 430 - "apps/web Agent Instructions, web/AGENTS.md"
Cohesion: 0.40
Nodes (4): apps/web Agent Instructions, Rules, Source Of Truth, Verification

### Community 431 - "CTA and conversion map (internal), CTA_AND_CONVERSION_MAP.md"
Cohesion: 0.40
Nodes (4): CTA and conversion map (internal), Placements, Surfaces, Template IDs (`page_template` in events)

### Community 432 - "privacy.ts, privacy.test.ts"
Cohesion: 0.60
Nodes (3): YOUTUBE_SHORTS_PRIVACY, YouTubePrivacyStatus, youtubeUploadStepLabel()

### Community 433 - "20260525_anidachi_auth.sql, public.users"
Cohesion: 0.80
Nodes (4): public.refresh_tokens, public.room_members, public.rooms, public.users

### Community 434 - "20260620_billing_entitlements.sql, public.billing_customers"
Cohesion: 0.50
Nodes (4): public.billing_customers, public.stripe_events, public.subscriptions, public.users

### Community 435 - "20260621_social_profiles_friends_recent.sql, public.users"
Cohesion: 0.60
Nodes (4): public.friendships, public.profiles, public.recent_people_hidden, public.users

### Community 436 - "public.friend_groups, public.friend_group_members"
Cohesion: 0.60
Nodes (4): public.friend_group_members, public.friend_groups, public, public.users

### Community 437 - "public.list_recent_people_evidence_v2(), 20260814020000_watch_history_v2_clean_cutover.sql"
Cohesion: 0.40
Nodes (4): public.list_recent_people_evidence_v2(), public.friendships, public.recent_people_evidence, public.recent_people_hidden

### Community 439 - "Crunchyroll conversion stack (required), Crunchyroll anti-cannibalization map (owned queries)"
Cohesion: 0.40
Nodes (5): Crunchyroll anti-cannibalization map (owned queries), Crunchyroll conversion checklist (required), Crunchyroll conversion stack (required), Crunchyroll Keyword Planner gate (before locking URLs), Crunchyroll measurement note

### Community 440 - "Programmatic anime pages (`/watch/[slug]`), Genre hub pages (`/watch-{genre}-anime-with-friends`)"
Cohesion: 0.40
Nodes (5): Genre hub pages (`/watch-{genre}-anime-with-friends`), New `/watch/{slug}-with-friends` pages — hub backlinks (**always**), Programmatic anime pages (`/watch/[slug]`), Programmatic quality guardrails, Watch template (`app/watch/[slug]/page.tsx`)

### Community 441 - "Private Tester Readiness, Room Policy Renewal Correction"
Cohesion: 0.40
Nodes (5): Immutable Private Test Artifact, Personal History Policy Activation Receipt, Private Tester Readiness, Room Policy Renewal Correction, Runtime-role Policy Lock Boundary

### Community 442 - "Four-Layer P2P Acceptance Matrix, Service Level Objectives"
Cohesion: 0.40
Nodes (5): Four-Layer P2P Acceptance Matrix, Measurable End-to-End Room Flow Goal, Measurement Foundation, Service Level Objectives, Two-Browser Room and P2P Harness

### Community 443 - "Web Account Dashboard UX, Dashboard Shell"
Cohesion: 0.40
Nodes (5): Dashboard Shell, Devices And Notifications, Friends And Groups, Watch Library, Web Account Dashboard UX

### Community 444 - "Participant Audio Control Surface Handoff, Hotkey and Player Interaction Isolation"
Cohesion: 0.50
Nodes (5): Participant Audio Control Surface Handoff, Hotkey and Player Interaction Isolation, Listener-Local Participant Volume and Mute, Side Voice Rail Audio Control, Video Bubble Contour Audio Control

### Community 445 - "V2 Staging Acceptance Matrix, Recovery and Load"
Cohesion: 0.40
Nodes (5): Mode and Privacy, Recovery and Load, Room-Scoped Restore, UI and Indicators, V2 Staging Acceptance Matrix

### Community 446 - "Room Lifecycle Invite Actionability, Conditional Invite Response"
Cohesion: 0.40
Nodes (5): Conditional Invite Response, Historical Invite Expiry Transition, Missed Invite Presentation, Room Capacity Uses Ordinary Admission, Room Lifecycle Invite Actionability

### Community 447 - "packages/protocol Agent Instructions, protocol/AGENTS.md"
Cohesion: 0.40
Nodes (4): packages/protocol Agent Instructions, Rules, Source Of Truth, Verification

### Community 449 - "20260602_extension_auth.sql, public.devices"
Cohesion: 0.67
Nodes (3): public.devices, public.extension_auth_codes, public.users

### Community 452 - "public.watch_catalog_read_v3(), 20260905083000_watch_history_observed_season_fallback.sql"
Cohesion: 0.50
Nodes (3): public.watch_catalog_read_v3(), public.watch_catalog_snapshots, public.watch_episode_progress

### Community 454 - "20260908070552_room_media_compatibility_fence.sql, public.create_room_with_active_session_v1()"
Cohesion: 0.67
Nodes (3): public.create_room_with_active_session_v1(), public.create_room_with_active_session_v2(), public.personal_history_policy

### Community 459 - "vercel.json, regions"
Cohesion: 0.50
Nodes (3): regions, $schema, sfo1

### Community 460 - "graphify reference: add a URL and watch a folder, add-watch.md"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 461 - "graphify reference: commit hook and native CLAUDE.md integration, hooks.md"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 462 - "graphify reference: incremental update and cluster-only, update.md"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 463 - "Experimental Features, experimental-features.md"
Cohesion: 0.50
Nodes (3): Experimental Features, Hold Fire Super Reaction, P2P Media Transport

### Community 464 - "Manual Staging Release Gate, Ultra-Light P2P Reliability"
Cohesion: 0.50
Nodes (4): Manual Staging Release Gate, Ultra-Light P2P Reliability, P2P Media Engine Block, Release Gates and Rollback

### Community 465 - "Privacy Security And Abuse Controls, Abuse Controls"
Cohesion: 0.50
Nodes (4): Abuse Controls, Chrome Web Store, Privacy Security And Abuse Controls, Supabase

### Community 466 - "Audio Speech Activity Classification, Microphone and Camera Independence"
Cohesion: 0.50
Nodes (4): Audio Speech Activity Classification, Audio Transport Flow Classification, Microphone and Camera Independence, Microphone Publication State

### Community 467 - "Voice Activity and Flow Model, Sampling Cost"
Cohesion: 0.50
Nodes (4): Sampling Cost, Speech Classification, Transport Flow Classification, Voice Activity and Flow Model

### Community 468 - "Production Closeout Complete, Production Promotion PR 240"
Cohesion: 0.50
Nodes (4): Production Promotion PR 240, Full Production Redeploy dpl_DCt6ocJBbEJ848rfaC38W5bhbdyg, Main SHA 8cc5e4e6641ca55f0b62a320e8726de67900ce34, Production Closeout Complete

### Community 469 - "Unified own-player personal history MVP, Owner-bound access lease and original capture authority"
Cohesion: 0.50
Nodes (4): Owner-bound access lease and original capture authority, D01 amendment: Free retains reading, Resume and deletion, Unified own-player personal history MVP, Recent People from actual co-presence

### Community 470 - "Personal History Plans and Room Capabilities MVP, Media Protocol v2 Grants"
Cohesion: 0.50
Nodes (4): Media Protocol v2 Grants, Paid History Access Epoch, Personal History Plans and Room Capabilities MVP, Free Plus and Pro Entitlements

### Community 471 - "Account MVP navigation implementation plan, Account MVP integration and staging gates"
Cohesion: 0.50
Nodes (4): Account MVP navigation implementation plan, Account MVP integration and staging gates, Owner-scoped social invalidation event, Owner-keyed AccountWorkspaceProvider

### Community 472 - "Five-Object CRM Reconciliation, CRM Recovery Deployment Order"
Cohesion: 0.50
Nodes (4): CRM Recovery Deployment Order, ETag Concurrency Control, Five-Object CRM Reconciliation, CRM Recovery Rollback Strategy

### Community 473 - "launch-chrome.sh, launch-chrome.sh script"
Cohesion: 0.83
Nodes (3): port_in_use(), print_port_conflict_help(), launch-chrome.sh script

### Community 487 - "Player Lifecycle and Episode Identity, Crunchyroll Adapter"
Cohesion: 0.67
Nodes (3): Crunchyroll Adapter, Overlay Playback Control, Player Lifecycle and Episode Identity

### Community 488 - "Staging Smoke Workflow, Staging Password Gate"
Cohesion: 0.67
Nodes (3): Staging Password Gate, Staging Smoke Workflow, Staging Web Smoke Script

### Community 489 - "pg_net Platform Permission Boundary, Scheduler Permission Verification"
Cohesion: 0.67
Nodes (3): pg_net Platform Permission Boundary, Server-only service role and private scheduler Vault boundary, Scheduler Permission Verification

### Community 490 - "Chrome Compliance Patch, Account-scoped Recording Choice"
Cohesion: 0.67
Nodes (3): Account-scoped Recording Choice, Chrome Compliance Patch, MV3 Jitless Validation

### Community 491 - "Current Integration Foundation, Room Scoped ICE Authorization"
Cohesion: 0.67
Nodes (3): Current Integration Foundation, Room Scoped ICE Authorization, Site Extension Integration Notes

### Community 492 - "Staging-accepted Integration Foundation, One-time Extension Auth Handoff"
Cohesion: 0.67
Nodes (3): One-time Extension Auth Handoff, Site Extension Auth and Database Integration, Staging-accepted Integration Foundation

### Community 493 - "Durable Room Lifecycle and Idempotent Create, Orphan Room Policy"
Cohesion: 0.67
Nodes (3): Durable Room Lifecycle and Idempotent Create, Orphan Room Policy, Room Lifecycle Block

### Community 494 - "Single Active Room Global Constraints, Exact-session Cleanup Rule"
Cohesion: 0.67
Nodes (3): Exact-session Cleanup Rule, Single Active Room Global Constraints, Migration-first Additive Boundary

### Community 495 - "Persistent Exact Operation Generation, Authoritative Room Snapshot Handoff"
Cohesion: 0.67
Nodes (3): Authoritative Room Snapshot Handoff, Persistent Exact Operation Generation, Late Admission Compensation

### Community 496 - "Production Promotion Preparation, Accepted Free-plan Execution Path"
Cohesion: 0.67
Nodes (3): Accepted Free-plan Execution Path, Production Promotion Preparation, Separate Policy and Extension Release Gates

### Community 497 - "Panel Access and Focus Overrides, Main Control Always Visible"
Cohesion: 0.67
Nodes (3): Main Control Always Visible, Main Control Auto Hide, Panel Access and Focus Overrides

### Community 498 - "Filter Before Pagination, Filter Reset Preserves Search"
Cohesion: 0.67
Nodes (3): Filter Before Pagination, Filter Reset Preserves Search, Nonmodal Filter Focus Contract

### Community 499 - "Build Extension Workflow, Extension Channel"
Cohesion: 0.67
Nodes (3): Build Extension Workflow, Extension Channel, Release Ref Validation

### Community 500 - "Real-WebRTC Two-browser P2P Harness, Media v3 Host-managed Seat Scenarios"
Cohesion: 0.67
Nodes (3): Media v3 Host-managed Seat Scenarios, Real-WebRTC Two-browser P2P Harness, Same-machine Evidence Boundary

## Ambiguous Edges - Review These
- `Historical 12 hour expires_at runtime bridge` → `Room lifecycle actionability and 24 hour Missed retention`  [AMBIGUOUS]
  docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md · relation: conceptually_related_to
- `Architecture stack reference to Supabase Auth` → `Custom website OAuth and cookie sessions backed by Supabase tables`  [AMBIGUOUS]
  docs/project-architecture-and-development.md · relation: conceptually_related_to
- `Historical September 8 inactive staging delivery identities` → `Historical solo shared and Free history model superseded`  [AMBIGUOUS]
  docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md · relation: conceptually_related_to
- `Codex-Hosted Semantic Extraction` → `Automated Verification and Staging Artifact Evidence`  [AMBIGUOUS]
  docs/superpowers/plans/2026-07-30-interface-visibility-settings.md · relation: implements

## Knowledge Gaps
- **3736 isolated node(s):** `SeoGuideOption`, `SeoGuideRelatedLink`, `SeoGuideStep`, `AuthCommand`, `AuthMessage` (+3731 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 5203 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **285 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Historical 12 hour expires_at runtime bridge` and `Room lifecycle actionability and 24 hour Missed retention`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Architecture stack reference to Supabase Auth` and `Custom website OAuth and cookie sessions backed by Supabase tables`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Historical September 8 inactive staging delivery identities` and `Historical solo shared and Free history model superseded`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Codex-Hosted Semantic Extraction` and `Automated Verification and Staging Artifact Evidence`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **Why does `next/server` connect `protocol/src/index.ts, next/server` to `contact-messages.ts, contact-route.ts`, `watch-history-v3-routes.ts, WatchHistoryV3ApiError`, `social.ts, social.test.ts`, `youtube/storage.ts, youtube/api.ts`, `tiktok/storage.ts, tiktok/api.ts`, `node:test, profile-route.ts`, `room-session.ts, anidachi-auth/room-lifecycle.ts`, `jwt.ts, [roomId]/connect/route.ts`, `post/status/route.ts, video/status/route.ts`, `device-push.ts, device-push.test.ts`, `plan-entitlements.ts, anidachi-auth/watch-history-access.ts`, `stripe-subscription-sync.ts, stripe-plans.ts`, `oauth-transaction.ts, handle-oauth-callback.ts`, `getSession(), next/navigation`, `connect/page.tsx, extension-codes.ts`, `verifyKreatliCrmSession(), kreatli-crm/auth.ts`, `anidachi-auth/watch-history-browse.ts, protocol/src/watch-history-browse.ts`, `video/prepare/route.ts, reel/route.ts`, `db.ts, db()`, `billing.ts, billing-client.tsx`, `gmail-tokens.ts, gmail.ts`, `store.ts, cli.ts`, `zod, anidachi-auth/room-presence-evidence.ts`, `survey-lead.ts, survey-lead-shared.ts`, `account-inbox.ts, seen/route.ts`, `google-ads/oauth.ts, oauth/callback/route.ts`, `instagram/storage.ts, hasPrivateIntegrationBlobConfiguration()`, `session.ts, api/auth/refresh/route.ts`, `extension-session.ts, active-session/depart/route.ts`, `watch-library-routes.test.ts, watch-library-routes.ts`, `anidachi-auth/watch-history-grid.ts, src/watch-history-grid.ts`, `middleware.ts, staging-access.ts`, `youtube/callback/route.ts, youtube/oauth.ts`, `jsonUnauthorizedUnlessKreatliSession(), blou-access.ts`, `public-media-blob.test.ts, public-media-blob.ts`, `anidachi-auth/watch-history-editor.ts, src/watch-history-editor.ts`, `feature-requests.ts, feature-request-route.ts`, `room-source.ts, room-source.test.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `Account bug report restoration` connect `Current Development State, Account bug report restoration` to `contact-messages.ts, contact-route.ts`, `Account MVP navigation design, Account bug report contact contract`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `react` connect `react, profile-client.tsx` to `seo-guide-blocks.tsx, watch-youtube-together/page.tsx`, `history-recording-choice.ts, watch-history-preference-listener.ts`, `contact-messages.ts, contact-route.ts`, `app/layout.tsx, conditional-site-chrome.tsx`, `popup-app.tsx, popup-people-panel.test.tsx`, `overlay-app.tsx, OverlayApp()`, `trackConversion(), conversion-events.ts`, `seo-page-layout.tsx, primary-checkout-cta.tsx`, `privileged-overlay-wiring.test.tsx, installActiveHostRoomRuntime()`, `popup-watch-drawer.tsx, popup-watch-history.tsx`, `invites-client.tsx, account-notifications.tsx`, `overlay-room-media-controls.tsx, RoomPeopleSection()`, `account-navigation-client.test.ts, account-nav.tsx`, `friends-client.tsx, AccountEmptyState()`, `friends-client.test.tsx, FriendsClient()`, `nav-bar-client.tsx, account-menu-client.test.ts`, `reaction-pop.tsx, reaction-pop.test.tsx`, `trackEvent(), gtag.ts`, `plan-entitlements.ts, anidachi-auth/watch-history-access.ts`, `[slug]/page.tsx, jikan-for-watch-page.ts`, `popup-view-state.ts, popup-view-state.test.tsx`, `watch-library-client.test.tsx, installServer()`, `crm-client.tsx, actions.ts`, `room-media-defaults.ts, use-room-join-defaults.test.tsx`, `use-camera-interaction-lock.ts, use-camera-interaction-lock.test.tsx`, `getSession(), next/navigation`, `overlay-unmount-cleanup.test.tsx, overlay-unmount-cleanup.ts`, `verifyKreatliCrmSession(), kreatli-crm/auth.ts`, `lucide-react, cn()`, `history-browser.tsx, client-api.ts`, `content.tsx, content-lifecycle.test.tsx`, `popup-people-model.ts, popup-inbox-panel.tsx`, `chrome-extension-demo-async-overlay.tsx, chrome-extension-demo.tsx`, `contact-form-client.test.ts, ContactForm()`, `anidachi-logo.tsx, app/login/page.tsx`, `billing.ts, billing-client.tsx`, `reaction-shortcuts.ts, use-reaction-shortcuts.test.tsx`, `overlay-interaction-boundary.ts, overlay-voice-controls.test.tsx`, `overlay-interface-settings.tsx, top-bubble-reveal.test.tsx`, `overlay-interface-settings.test.tsx, interface-preferences.ts`, `overlay-layout-editor.test.tsx, OverlayLayoutDefinition`, `VideoAdapter, active-adapter-playback.test.tsx`, `overlay-room-media-controls.test.tsx, PanelCameraControl()`, `popup-watch-browse.test.tsx, generationClient()`, `home-client.tsx, faq-section.tsx`, `ghost-cam.ts, media-types.ts`, `account-inbox-cache.ts, popup-inbox-convergence.test.tsx`, `watch-library-client.tsx, WatchLibraryOwnerClient()`, `panel-account-title.tsx, PanelAccountTitle()`, `overlay-layout-ghost-preview.tsx, overlay-layout-ghost-preview.test.tsx`, `plan-survey-modal.tsx, pricing.tsx`, `popup-watch-filters.tsx, extension/src/watch-history-browse.ts`, `overlay-layout-editor.tsx, overlay-layout-interaction.ts`, `voice-audio-preferences.ts, voice-audio-preferences.test.ts`, `account-sections-client.test.ts, account-workspace-state.tsx`, `overlay-room-rail.tsx, overlay-room-rail.test.tsx`, `popup-watch-history.test.tsx, subscribeToPopupWatchHistorySnapshot()`, `feature-requests.ts, feature-request-route.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
Semantic extraction used the active Codex subagent; token usage was not reported by the tool.
