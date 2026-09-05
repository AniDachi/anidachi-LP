# Watch Drawer Browse And Presentation

Status: approved by the user in conversation on 2026-09-05; implementation local only.

## Product

The drawer is a compact, non-destructive way to find and resume viewing. Keep
Watch / People / Inbox and the existing dark neutral surfaces with one orange
accent. Mine and Together are two independently selectable segments; selecting
the active segment is a no-op. Together means shared history, not a friends list.

One Filters button beside search reveals group, participant and period controls.
Group/participant controls apply only to Together; dates apply to both modes.
The search and filters operate on eligible durable history before pagination,
not just the cards or session samples already loaded in the drawer. Combine
different filter dimensions with AND, including participant and group on the same
viewing session. A removable chip identifies each active condition. Show an honest
empty result, a retryable error, and a way to clear conditions.

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

## Progress And Tree

Title and season aggregate counts/progress remain canonical and unfiltered.
Selecting a period, group, or participant must never change personal completion,
catalog availability, or the overall percentage. Matching sessions/episodes are
a browsing projection, not progress writes. Current episode resume remains
separate from group context. No new completion rule or history reset.

Use consistent 2:3 covers, titles at most two lines, restrained provider headings,
and an overall bar filling the available text width. Counts align left and whole
percentages right. Positive values below one percent read <1%; incomplete values
never round to 100%. Exact totals require complete catalog evidence; unknown
availability has no invented denominator. Season metadata uses server aggregate,
not the number of displayed observed episode rows as season length.

The tree trunk aligns with the cover's horizontal center and emerges from under
the cover. Use continuous thin lines with short season branches and shallow
episode indentation. Long localized and RTL titles must not overflow controls.
One outer scroll; no nested per-season scrolling. Opening/refreshing/hovering must
not change card widths or reorder existing rows unexpectedly. Keep disclosure,
scroll and keyboard focus stable across background refreshes; respect reduced
motion. Show honest continuation controls for bounded title/episode pages.

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
