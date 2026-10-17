# Player keyboard and camera-status fixes, October 17, 2026

## Scope and boundaries

The owner authorized four audited fixes, regression verification for YouTube and
Crunchyroll, and delivery through a feature PR into staging. Production, Store
publication, subscriptions, permissions and provider playback APIs are unchanged.

Base: staging `71c2e29e6e985d2d955c335be11729ac1f4658b4`.
Branch: `codex/netflix-input-media-fixes`.

## Findings and implementation

1. A held push-to-talk microphone could remain published when opening Netflix
   chat swallowed its V release. Opening the composer explicitly releases held
   push-to-talk; the early key router also routes releases before typing isolation.
   Open mic stays on by explicit user choice. Existing charged reaction release
   behavior stays intact.
2. React installed hotkeys after provider window-capture listeners and ignored
   repeated V keydown events. A document-start router now keeps its listener
   position and delegates to the current overlay handlers. It owns the consumed
   key sequence through repeats, keypress and keyup, without repeating actions.
   Editable controls, IME, system modifiers, inactive rooms and native unclaimed
   player keys retain their existing behavior. The onboarding guard keeps priority.
3. Plain Enter opened chat even on a focused player button. Enter now respects
   native interactive elements and their accessible roles, including child icons.
   Enter on the player background and the existing chat shortcut remain available.
4. Restoring a v2/v3 RoomState applied legacy mediaSeat normalization and cleared
   reported cameraEnabled while the camera stream continued. Restoration now
   preserves the report only for the same connected session with its camera grant
   (and its v3 seat). A grant alone does not invent a live camera. Legacy rooms,
   real camera-off, disconnection and revoked/stale-session grants remain off.

## Verification contract

- Regression tests run against the actual overlay and early content guard on
  Netflix, YouTube and Crunchyroll page contexts. Physical media/network are
  replaced only at the boundary; no messages are sent to real participants.
- RoomState tests and a real Cloudflare runtime test force WebSocket hibernation,
  change microphone intent after wake and assert the matching new ROOM_SNAPSHOT
  seen by another client. Both negotiated media versions are covered.
- Run extension and API checks/full unit suites, Cloudflare runtime suite, room
  signaling harness, real WebRTC harness, staging build and artifact validation.
- Record exact commands, outcomes, CI, staging deploy and artifact identity in the
  PR. Automated fixtures do not prove authenticated Netflix ads or cross-network
  host/guest acceptance. Recheck the loaded new artifact before production.
- Chrome can handle fullscreen Escape before page JavaScript. This work does not
  request Keyboard Lock or promise to override browser-owned Escape.

## Evidence and rollout

The old implementation failed the new Enter/held-V/order tests and both camera
restoration versions. The forced-wake test matches snapshot sequence to the new
microphone acknowledgement so an old queued camera-on snapshot cannot pass it.
Official Cloudflare guidance confirms that hibernation preserves sockets but
reconstructs in-memory state:
https://developers.cloudflare.com/durable-objects/best-practices/websockets/

No protocol fields, database migrations, secrets, env variables, polling timers
or broad permissions are introduced. The Worker retains hibernation and existing
write/no-op/alarm optimizations. Deploy the reviewed Worker and extension through
staging; keep the prior identifiable artifact for rollback. Revert this scoped
PR through staging and rebuild its previous revision if acceptance fails.

## Execution notes

- Ruling: keep charged fire release semantics instead of cancelling the reaction
  on composer open. The stable early router fixes its lost release as well; the
  existing regression suite requires the original release behavior.
- Ruling: keep publication state separate from camera permission; repair server
  restoration instead of masking the participant label from local UI state.
- Real-browser acceptance and production promotion remain separate from local
  tests and staging artifact delivery.

## Local verification receipt

- Extension typecheck and full suite: 148 files, 2411 tests passed.
- API typecheck and full unit suite: 25 files, 272 tests passed.
- Cloudflare runtime: 5 files, 111 tests passed, including forced v2/v3
  hibernation followed by microphone intents and a new camera-on snapshot.
- Protocol typecheck and 245 tests passed; room harness: 39/39 passed.
- Real WebRTC: legacy harness 26/26; six-member v3 harness 13/13 passed.
- Independent review found no Critical or Important issues.
- `pnpm dev:check` selected API, rooms, extension and docs profiles.
- Graphify navigation was used. Its safe AST publisher failed on an unresolved
  pre-existing `storage (wxt/utils/storage)` cross-source node before publication.
  No canonical graph artifacts changed. The PR records this scoped tooling
  exception; this repair does not change graph infrastructure or force a partial
  graph update.
