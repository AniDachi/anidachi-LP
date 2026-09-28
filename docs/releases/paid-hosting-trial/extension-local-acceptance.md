# Extension local acceptance, 2026-09-28

Source baseline: `cb1f095bcbc309c25d41af575a988ac9a532ddf5`, with the test-only
follow-up recorded in [implementation evidence](implementation-evidence.md).
Serena definitions/references and source search were checked in the paid-hosting
worktree. This is the current extension entrypoint map, not an audit of the
uninspected published Store package. No product runtime or website UI changes
were needed for this checkpoint.

## Actions and authority

Paths below are repository-relative. Test paths are under `apps/extension/test/`
unless explicitly prefixed with `apps/web/`.

| Existing action | Actual route and authority | Result and local evidence |
| --- | --- | --- |
| Ordinary Create room | `overlay-app.tsx: handleCreateRoom -> createAndConnectRoom`; `room-client.ts: createRoom -> handleRoomHttpMessage -> createWebsiteRoomFromApi`; POST `/api/rooms`. Web resolves host entitlements before quota; `create_room_with_active_session_v3` also checks transactional hosting authority before creation/reuse. | Authoritative `HOST_SUBSCRIPTION_REQUIRED` opens the plan offer; an outage remains an error. Prepared session and Web Lock are released. Retry requires a click. `privileged-overlay-wiring.test.tsx`, `room-client-auth.test.ts`, web `room-create.test.ts`, SQL `paid_hosting_room_admission.test.sql`. |
| Invitation/source-link room hash | Overlay reads `anidachiRoom`, then `connectToExistingWebsiteRoom -> connectWebsiteRoom`; POST `/api/rooms/:id/connect`. Web/SQL admission checks the room host and active assignment; the background issues authority only after successful admission. | Free joins an eligible host rather than creating a room. Terminal HOST/404/426 clears room recovery state without opening a guest paywall. `privileged-overlay-wiring.test.tsx`, `room-client-auth.test.ts`. |
| Stored room restoration and reconnect | Owner-bound persisted room and timed reconnect use the same connect path, not create. Session reservations and server admission remain required. | Local component scenario restores a Free guest across 31 minutes and UTC midnight without personal quota. Terminal responses stop retries. Source/component proof is not a real browser restart or two-profile staging test. |
| Popup/overlay personal Resume | Saved source URL carries a bounded owner/generation-bound resume intent; `watch-history-resume.ts: applyPersonalHistoryResume` seeks only the matching ready video after a background `resume-claim`. A current read lease is required; no room POST occurs. | Free can resume saved video with recording consent off. Joining a room, changing owner/generation/source, or expiring the intent cancels stale seeks. `watch-history-resume.test.ts`, `popup-watch-browse.test.tsx`, `watch-history-client.test.ts`. |
| Legacy history bridge `create-room` | `watch-history-client.ts` retains POST `/api/watch-history/v3/rooms`. Source/ref search found no current popup/overlay UI caller. Server `checkLegacyRoomOperation` retires this route after personal-history activation; the SQL version gate handles activation races. | Free read access does not authorize creation. New four-case bridge regression maps HTTP426 to `upgrade-required` for Free/Plus and HTTP503 to `retryable`, with no retry or storage mutation. Existing web `watch-history-v3-routes.test.ts` covers authentication, owner checks, active/inactive policy and SQL race. This route's retirement is separate from the paid-hosting T flag. |
| Plan offer and return from pricing | `hosting-paywall.tsx` links to `/pricing`; account/session-bound `useHostingAccess` reads `/api/me/entitlements` on opening/focus/visibility and auth change. Server time determines policy activation. | Closing/Escape only dismisses. Returning refreshes display, never starts checkout or room creation. Unknown authority does not promise a trial. `hosting-paywall.test.tsx`, `hosting-access-client.test.ts`, `use-hosting-access.test.tsx`. |
| Quota display | `use-free-quota-notice.ts` consumes the same confirmed hosting state as the offer. Web `/api/me/room-quota` returns post-T Free denial without querying usage; pre-T legacy contract remains. | No post-T countdown, reset promise or quota polling; stale replies cannot revive them. `use-free-quota-notice.test.tsx`, `room-quota-status-client.test.ts`, web `room-quota-status.test.ts`. Shared 1800-second legacy policy remains for pre-T compatibility/accounting. |
| Personal recording | Controller and background writer require the viewer's own unexpired capture lease, owner and generation; a host's room authority is not personal entitlement. | Free capture/discovery/persistence stays off. Expiry/outage cannot renew recording; confirmed Free closes the old capture epoch; late receipts cannot revive it. New paid access starts from current observations, without Free-period backfill. `watch-history-controller.test.ts`, `personal-history-capture.test.ts`, `watch-history-client.test.ts`. |
| Existing history and account changes | Read leases remain separate from capture. Popup keeps the existing Manage history link; deletion remains on the website. Login/session identity fences apply to reads, offers and pending work. | Free Resume and no-create behavior, stale same-owner login/account/logout replies, preserved preferences and eligible queued work across a temporary outage are covered. Actual website history UI behavior was checked in the prior checkpoint; it was not edited here. |

## State coverage and explicit limits

| State | Extension expectation | Evidence boundary |
| --- | --- | --- |
| Signed out | Sign-in prompt, no authenticated room admission or private history | Existing auth/overlay/bridge tests; real login remains staging acceptance. |
| Free, unused trial | Join allowed by host admission; own Create receives plan offer with one 3-day card trial | Component tests and prior synthetic loaded-artifact check. Account age is irrelevant. |
| Free, used trial | Same joining/recording limits; offer ordinary paid checkout | Component tests and prior synthetic loaded artifact; no new trial granted locally. |
| Trial or paid Plus/Pro | Display the server's effective plan and capabilities; recording still needs its own lease | Plus/Pro/Free component transitions and prior loaded artifact. Display cannot independently establish payment or trial status. |
| Canceled trial before original end | Use server rights until the original end, then apply lost access | Server lifecycle evidence exists separately. Full cancellation-to-extension staging flow is still open. |
| First payment pending / successful or late payment | Consume current server access; never start a fresh local grace period or automatic room | Local display refresh/fencing is checked. Real Checkout/webhook-to-client propagation remains open. |
| Declined payment / 3DS / expired access | Server removes rights; personal capture stops. Room closingAt/terminal cause comes from the room authority, not the guest's plan | Capture and terminal overlay tests pass. Full Stripe-to-room end-to-end acceptance remains open. |
| Temporary authority failure | Remove stale paid/trial promises; no classification as Free, consumed trial or payment failure | Hook/client/component tests; separate history handling retains eligible work without recording beyond lease expiry. |
| Logout/login or different account | Retire old responses and prepared room state; never show another login's offer or history | Current component/background tests, plus prior loaded-artifact same-owner session test. |

## Verification of this checkpoint

- Disposable local PostgreSQL: **1360 assertions across 34 SQL files**, including
  the corrected browse fixture and nine added invitation/history assertions.
- Extension: **450 tests across 13 selected files** (370 + 80), including the four
  new legacy-bridge regressions; extension typecheck passed.
- Related web endpoint tests: **43 passed**. No website runtime was changed.
- Runtime, manifest and dependencies are unchanged from `cb1f095b`. This
  test/documentation checkpoint does not require a new ZIP or repeat visual/media
  tests. Earlier full-suite/build/loaded-artifact receipts retain their original
  scope and date; they are not presented as fresh runs here.

Remaining acceptance at that checkpoint: real browser restart with old saved
state (the local part is now covered below), authenticated two-profile staging,
actual Checkout/webhook-to-extension transitions, the exact
published Store package and mixed clients. Website changes require the owner's
agreement on concrete changes first. Whole-branch review and release/cutover
gates remain open. No production, staging, Stripe or Store state was changed.

## Full browser process restart, 2026-09-28

Source `6c6d9e9f`. The same unmodified narrow staging artifact was loaded in a
dedicated Chromium profile, launched four times with distinct browser PIDs.
Each previous process was confirmed stopped before the next launch. The profile
and extension storage persisted; ordinary user Chrome profiles were untouched.
The local proxy served the synthetic YouTube page/video and Web/Worker HTTP and
WebSocket boundaries from localhost, rejecting other HTTP/CONNECT destinations.
This run did not contact hosted staging, production, Stripe or the Store.

| Scenario | Observed result |
| --- | --- |
| Pre-T baseline | The ordinary Create control created a Free room; its live quota was visible. Durable room state and one saved history item existed before shutdown. |
| Restart after T, old Free room URL | Real compiled startup/connect received the local server's hosting denial; room hash/recovery UI cleared. No quota returned. Explicit Create opened the card-trial offer; Escape dismissed it. |
| Free saved history and Resume | Popup retained the saved item and showed that recording was paused. Clicking Resume opened the matching video at 30 seconds, without creating a room. |
| Free playback | The real video clock advanced 65 seconds, beyond the 60-second history heartbeat, then paused through keyboard input. No progress/catalog upload, captured observation or outbox entry appeared; saved progress stayed at 30 seconds and recording consent stayed enabled. |
| Free guest of a paid host | Current connect admission and a real local WebSocket delivered a schema-validated Pro-room snapshot. The guest joined without quota or a subscription offer. |
| Guest browser restart | The same profile reopened the paid-room URL, performed fresh server admission and received a room snapshot. No Create occurred and no personal quota appeared. A new document used a fresh participant session; actual server admission/takeover remains a staging boundary. |
| Authority outage on restart | An unavailable entitlements response removed cached plan claims and did not restore quota or promise a trial. |

The final run passed eight recorded checks with no page/fixture errors. There
were exactly two explicit Create requests (pre-T success and post-T denial),
zero post-T quota requests, and zero history progress/catalog POSTs. Screenshots
were inspected at 1100 and 390 pixels, including the Free offer, saved-history
Resume, guest panel and unavailable-plan state. The synthetic media fixture and
blocked thumbnail do not constitute a production-provider visual/media audit.

Local reproducibility evidence: `/tmp/anidachi-browser-restart/run.mts`,
`inventory.json`, `result.json`, `run.log` and `01-` through `07-` screenshots.
The ignored `browser-restart-receipt.json` in the active plan workspace records
their hashes and the source/artifact identity. ZIP SHA256 remains
`83721f73e1e669aab654d5361575936a0461abdd7d595453c660573d56240178`;
all 11 files match the loaded directory. No rebuild or runtime change was needed.

Harness calibration corrected invalid fixture fields, pre-T eligibility,
observed host/guest control names and a millisecond lease-boundary race. These
were test-stand issues; no product defect was established or runtime changed.
This proves cold browser processes and persisted client state against local
synthetic authority. It does not prove an update from an installed old Store
version, restoration of every browser tab policy, a real billing transition,
real server assignment/Worker recovery or two-person WebRTC. Those remain in F;
website edits still require owner agreement and push/staging changes are not
authorized by this local checkpoint.
