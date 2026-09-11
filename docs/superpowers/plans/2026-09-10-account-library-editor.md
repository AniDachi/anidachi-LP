# Account library and manual progress editor

Status: implemented locally on `codex/account-history-editor`; staging acceptance
is still pending. This is the approved next step after the cover-based account
design, not another prototype. It supersedes the manual-editor deferral in D04
of the September 8 personal-history plan.

## Product contract

- Keep the existing account routes, profile, invitations, billing and cancellation
  behavior. Use a compact account header and navigation without the marketing
  navigation/footer around the account workspace.
- Show saved titles as cover cards. Search and provider/progress filters operate
  on the library, completing bounded pagination before reporting a full search.
  Quota counters come from the capacity endpoint, not the visible cards.
- Show only the selected platform's storage counter and capacity warning; All
  shows both. YouTube recording is controlled in the extension drawer settings.
  The website header keeps Refresh and a Library options menu containing
  confirmed Clear all history. Individual title removal stays in the inspector.
- Open a title in a side inspector on desktop or a modal on smaller screens.
  Seasons and explicitly named specials share a dropdown. Episode 0 stays episode
  0. Display about four episode rows, with an independent scroll area for more.
- A normal click selects an episode for playback. In Edit mode, clicks only
  select episodes for an explicit action: Mark watched or Clear progress.
  Select season includes all selectable entries in the current season; a mixed
  selection uses an indeterminate checkbox. Shift-click selects a range.
  Future/unavailable episodes with no saved progress cannot be selected;
  unavailable entries with saved progress can be cleared but not marked watched.
- Actions stage a draft and clear the selection. Undo restores the previous
  action's draft, including partial positions. Cancel discards the entire draft;
  Save commits it. Save/Cancel and the total unsaved-change count stay above the
  grid. An action is never sent to the server merely by selecting episodes.
  Changing seasons clears only the selection, while staged changes survive.
  An authoritative reload invalidates Undo so it cannot restore stale drafts.
- Clear progress removes watched marks and resume positions, keeping the title
  in the library; it is distinct from Remove from history. There is no full-title
  reset menu: clear selected episodes or seasons. Films and videos use the two explicit
  actions directly, without an unnecessary selection step. Playback/removal
  controls are hidden while editing. Changing title, following account links or
  signing out protects staged changes with Save/Discard/Stay; browser unload
  uses its native unsaved-changes warning. Selection alone is not a draft.
- Films and YouTube use the same editor with a single progress entry. Unknown
  durations stay unknown; manual completion must not invent a runtime.
- Free retains reading, Resume and deletion. Plus/Pro enables manual edits as well
  as capture. YouTube's automatic-capture consent remains independent of explicit
  manual editing. There is no shared/group progress or automatic personal import.
- Edit existing saved titles only. Accepted catalog episodes may be added within
  that title. Without a complete catalog, offer only saved observations. Future
  or unavailable episodes cannot be marked watched; reset may clear old marks.
- Reset keeps the title/slot. Removing a title frees its slot. Limits remain
  100 YouTube videos / 200 Crunchyroll titles, without eviction.

## Storage and API

`GET /api/watch-history/v3/editor` returns one owner/generation/title-bound
snapshot, limited to 2,000 episodes. The response includes a revision covering
the canonical progress, accepted catalog/context and availability.

`POST /api/watch-history/v3/editor` accepts that revision, a mutation UUID, and
unique `{episodeKey, watched}` changes. It requires the mounted-owner header;
the server resolves identity from the existing verified session. Current paid
access, generation, revision, title existence and episode availability are
checked again under the existing database policy/account lock. The batch is
atomic. A conflict preserves the client draft and requires explicit review.

The service-only `edit_watch_history_v1` RPC updates `watch_episode_progress`
directly. Labels and URLs come from owned progress/accepted catalog aliases.
Manual rows have no fabricated playback session. Existing canonical summaries
and the extension's catalog aggregates see the same marks. A transaction-local
bulk marker defers catalog aggregation until the end of this RPC; regular
capture/deletion retain their existing behavior.

Mutation receipts support an exact 14-day replay window. An uncertain transport
result retries the same UUID/body. A per-episode `manual_edited_at` fence rejects
earlier playback observations and their receipts before replay, using the
existing capture observation-time boundary. Later valid playback can continue.
This does not rotate an account-wide capture epoch or erase unrelated queues.
Both the personal writer and the legacy canonical writer check this fence before
receipt replay. The editor works with the current inactive staging policy and
after activation; it never changes the rollout switch. Paid access is rechecked
for manual edits in either state.

The schema is additive; there are no new secrets, environment variables, room
events, extension permissions, billing products or Stripe configuration changes.

## Verification and rollout

- Web/API unit tests, account UI interactions, shared protocol tests and workspace
  type checks; SQL tests in the existing disposable local Supabase database.
- SQL coverage includes atomic rollback, idempotency, stale revisions, replay
  after reset, resumed real capture, catalog marks, future episodes, quotas,
  Free/downgrade and service-only access. A 2,000-entry title / 1,998-mark batch
  completed locally in approximately 1.4 seconds; this is not a production SLA.
- Browser verification uses the actual website components and styles with
  isolated fixture transport; desktop and mobile layouts, scrolling and editor
  controls were inspected. This does not replace authenticated staging proof.
- Deploy the additive migration and web change to staging before production
  promotion. Verify a real Plus account: series/season marks, movie/YouTube,
  browser reload and extension readback. Verify retained Free history and denied
  edits. Recheck account navigation and subscription cancellation entry points.
- Rollback: revert the web feature and disable its routes. Leave additive data
  and observation fences intact; do not drop/reset users' saved progress.
  Main promotion requires explicit approval after staging acceptance.
