# Watch Drawer Browse And Presentation

Status: approved by the user in conversation on 2026-09-05; implementation local only.

Current target amendment (2026-09-08): the [personal-history MVP](2026-09-08-personal-history-and-plans-mvp-design.md)
and its [implementation plan](../plans/2026-09-08-personal-history-and-plans-mvp.md)
replace the proposed Together group-history model. The visual presentation
below remains the baseline, but Mine/Together and group/participant history
filters are removed when the unified personal history is delivered. Solo and
room records are combined, gated by the viewer's own Plus/Pro plan. This note
changes the target only; the existing local runtime has not been migrated.

## Drawer State Amendment (2026-09-08)

Preserve visited Watch / People / Inbox panels while navigating inside the popup,
with a separate scroll position for each section. On popup reopen, restore the
last section and its position, the Watch query/period, explicit provider/title
expansion choices and selected seasons. New titles start collapsed; providers
start open until the user chooses otherwise. Search may reveal matching branches
temporarily without overwriting the normal library's disclosure choices.

These are bounded local presentation preferences, never history/access authority.
Do not transfer them between accounts; history choices also require the same
history generation. Account changes discard mounted panels, and sign-out clears
the saved view. Fresh data and access revocation still apply normally. If layout
loads later, restore scroll when space becomes available; user scrolling takes
priority. Native popup dimensions stay 392 by 600, with a dark initial background.

## Product

The drawer is a compact, non-destructive way to find and resume viewing. Keep
Watch / People / Inbox and the existing dark neutral surfaces with one orange
accent. Mine and Together are two independently selectable segments; selecting
the active segment is a no-op. Together means shared history, not a friends list.

One Filters button beside search opens a compact non-modal popover over the
history list, without moving the list or toolbar. Keep it within the drawer's
visible bounds. It contains period, group and participant controls; close it on
outside interaction, Escape or its close button. Escape and explicit close return
focus to the trigger; closing preserves selected filters.
Group/participant controls apply only to Together; dates apply to both modes.
The search and filters operate on eligible durable history before pagination,
not just the cards or session samples already loaded in the drawer. Combine
different filter dimensions with AND, including participant and group on the same
viewing session. Per the user's 2026-09-06 refinement, do not show condition chips
below the toolbar. Indicate active filters on the funnel button, show their values
inside the popover, and provide Reset there. Reset clears period, dates, group and
participant, while preserving the separate search field and its own clear action.
Show an honest empty result and a retryable error.

Period presets: All time, Today, Last 7 days, This month, Custom range. Custom
range is a compact date selection revealed on demand, never a permanent calendar
grid. Convert local calendar-day boundaries to UTC instants, using an exclusive
end at the next local midnight; preserve daylight-saving behavior. Render dates
using the user's locale/time zone. Title: latest matching viewing date. Expanded
shared session: its date/time and actual recorded participants. Dates do not
replace resume positions or completion indicators.

## Group Meaning And Privacy

Groups are the host's existing personal friend lists, not a new shared-group
product. My groups means shared viewing organized through that owner's group
invitation. Never derive historical group identity from current membership,
matching people, display names, or URL text.

Persist authenticated invitation provenance and an immutable display-name
snapshot, then associate it with actual recorded shared participation. Sending
or accepting an invitation alone does not count as watching. Generic link entry
is not group attribution without proven invitation context. Actual session
participants can include people who joined separately. If a session qualifies for
multiple groups, each filter can find it, but title/session counts are distinct.
Invitations already deduplicate recipients: preserve that behavior and do not
send additional notifications to create history provenance.

Only the group owner gets the My groups association. It grants no history access
to other group members. Renaming/removing members does not rewrite historical
participants. Deleting/archiving a group must not delete viewing history. Retain
the name snapshot when the group no longer exists. Old sessions without reliable
provenance stay in ordinary shared history; no speculative backfill.

## Progress And Episode Picker

The user approved the episode-grid concept on 2026-09-06. This supersedes the
older nested season/episode tree and its single-scroll restriction. Keep the
provider/title list, full wrapping titles aligned with the top of the cover,
neutral dark surfaces, ivory selected controls and restrained orange accents.

Crunchyroll series use one season/Specials dropdown and a grid of real episodes.
Use six columns, five at narrow widths, at most five rows, and four when the
actual drawer is 650 px high or shorter. The grid scrolls independently, loads
bounded continuation pages on demand and retains selection/scroll per season.
Selecting a cell only reveals its detail; Resume/Watch is a separate action.
Keep one selected detail with full title, actual playback time/progress and
existing recorded shared-session actions. Never infer confirmed completion from
a pending checkpoint or a rounded percentage. Disabled/unavailable entries stay
inspectable; their launch action is disabled when availability is known false.

Specials require an explicit provider group label (Specials, Special episodes,
OVA/OAD or their supported explicit Russian labels). Do not infer a special from
season 0, E0, a fractional number or a word embedded in an ordinary season title.
Special groups use compact named rows and preserve null, zero and fractional
source numbers. Films have a single time/progress/action detail without an
artificial season or E1. YouTube retains named video rows and its existing consent.

Overall series count remains under the title; hover/focus reveals its small
progress preview without moving content. Exact main-season and separate Specials
totals come from the accepted catalog. Title and season aggregates stay canonical
and unfiltered; Together/search/date results show matching history episodes only.
Unknown availability has no invented denominator. Positive values below one
percent read <1%; incomplete values never round to 100%.

### Optional Catalog Read

Authenticated `GET /api/watch-history/v3/browse/catalog` is available on staging
through the separately authorized server PR #272 (2026-09-06).
It reads the existing accepted owner/generation Crunchyroll snapshot (maximum
1 MiB / 2,000 episodes), returns all season summaries and at most 50 actual
entries with personal progress for the requested season, and performs no writes.
No database migration, new provider traversal, secrets or env changes are needed.
The cursor binds owner, generation, title, season and catalog revision; a final
metadata read rejects concurrent reset/deletion/catalog replacement. Responses
are private/no-store. The extension uses the existing owner/query/generation and
invalidation fences in its separate browse cache, never canonical storage.

A complete grid is enabled only for unfiltered Mine when this read succeeds.
If the Web endpoint is unavailable, or catalog data is partial/unavailable,
the drawer shows known matching episodes with an honest compact note and keeps
Resume working. Never manufacture unwatched cells from aggregate counts.
Keyboard navigation, Escape/focus return, constrained popover placement, reduced
motion and saved season positions are part of the implemented behavior.

## Settings And Management

Remove title/episode/all-history delete controls from the drawer only. Retain all
website management and deletion protections. Footer Manage history opens the
existing account watch-library page. Move YouTube tracking into gear > History,
reusing the current preference authority and optimistic/rollback/account fences.
Do not introduce a second preference or turn tracking on implicitly. Clarify its
scope independently of the existing browser-local notification setting.

## Boundaries

No room lifecycle, media, Worker, auth, provider identity, catalog traversal,
subscription, notification delivery or YouTube consent-policy redesign. No new
dependencies/services, global polling, history reset, production/main change,
push, PR, merge, remote migration or deployment. Additive database changes only.
Use guarded disposable local DB tests; never mutate or reset an existing shared
local database. Existing live tester folders must not be silently switched to a
client requiring unpublished server APIs.

The later user authorization covers server-only PR #272 into staging and its
deployment checks. It does not publish the local UI candidate or promote main.

## Acceptance

- Group and participant filters agree with actual shared evidence, including
  overlapping groups, repeated invitations, ordinary links, delayed checkpoints,
  different history generations and deletion/account isolation.
- Matches beyond the first title, episode and session page are discoverable;
  unrelated sessions do not satisfy separate dimensions of one query.
- Cursors are owner/query/generation bound. Changed filters reset pagination;
  late old-filter/account responses do not replace the current view or cache.
- Global title/season progress is identical before/after filtering.
- Drawer supports keyboard, long labels, narrow width, empty/error/loading,
  reduced motion, exact/unknown totals and background playback updates.
- YouTube toggle has one source of truth; no deletion controls remain in drawer,
  while account management still works.
- Local automated/visual evidence is separate from authenticated staging proof.
