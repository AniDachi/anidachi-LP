# Watch History v3 Staging Verification

Date: 2026-09-05. Status: **matching staging DB/web/extension activated; authenticated manual acceptance pending**.

The user separately authorized this transition after the local closeout. This is
not main/production promotion and does not claim a loaded browser or live provider test.
Local source, review, disposable-database proof and incident disclosure remain in
`docs/watch-history-v3-local-verification.md`.

## Ordered Activation

1. Baseline staging was `ac9ecd696cfbc3e76382e3370fa104118099e534`, Web
   `dpl_D8wKhnCkHzxFDCFUpYSEMxGkFX9r`, database project `cyppqpprkygjloyfvvvj`
   through migration `20260904154732`. GitHub staging DB configuration and Vercel
   Preview database-variable metadata had not changed since June; the project
   mapping is documented in `apps/web/supabase/config.toml` and existing staging
   deployment evidence. Sensitive Vercel values were not retrieved or changed.
2. Runtime [PR #264](https://github.com/AniDachi/anidachi-LP/pull/264) passed CI,
   Vercel build, room signaling, P2P media and smoke before the cutover began.
   CodeRabbit's green status was a skipped review; independent local review and
   scoped re-review are the recorded code-review evidence.
3. Schema-only [PR #265](https://github.com/AniDachi/anidachi-LP/pull/265) contains
   exactly the two reviewed SQL blobs, byte-identical to product `4d7f395`.
   Its checks passed before merge `9328428e20c560af116041c80f93f33723b98aa5`.
   [DB run 33939746789](https://github.com/AniDachi/anidachi-LP/actions/runs/33939746789)
   dry-ran and applied only `20260904205540` and `20260905083000` successfully.
   The existing SQL lock order drained old writers and fenced v2 SQL requests.
4. After database and preservation verification, #264 merged as
   `56dbd901b75f3abf5e127b9571a4ac59302d3bd7`. Web deployment
   `dpl_2Cbxd5uLNgygkkkQogjB3mubAj4D` became READY on `staging.anidachi.app`
   at 02:44:45 UTC. History alone was temporarily unavailable between the SQL
   transition and this matching runtime; rooms/auth/media were not stopped.
5. Exact [CI extension run 33939824349](https://github.com/AniDachi/anidachi-LP/actions/runs/33939824349)
   passed checks, tests, build and narrow-permission validation. The downloaded
   archive was revalidated and synchronized byte-for-byte to both previously
   approved tester folders. Existing artifacts were copied to a recoverable
   local backup before replacement. No browser/profile was opened or reset.

## Reset And Preservation

There were zero active rooms at preflight. Reviewed table counts before reset:

| History relation | Rows |
| --- | ---: |
| `watch_episode_progress` | 60 |
| `watch_sessions` | 4086 |
| `watch_session_participants` | 4031 |
| `watch_history_receipts` | 88 |
| `watch_history_deletions` | 4 |
| `watch_history_title_summaries` | 50 |
| `watch_history_user_session_summaries` | 107 |
| `watch_progress_checkpoints` | 47071 |
| `user_tracked_titles` | 1519 |

All nine relations were empty afterward. Inbound foreign keys stayed entirely
inside this history scope; no `TRUNCATE CASCADE` or full-database reset was used.
All nine settings rows remained: eight generations advanced 1→2 and one 2→3.
Fingerprints matched before/after for users, rooms, room members, friendships,
friend groups, subscriptions, Recent People evidence and all settings fields
except the intended generation/schema change. This preserves YouTube consent.
The bounded v3 SQL read succeeded for all nine settings owners with empty results
and each owner's current generation. New writer/catalog/read RPCs deny `anon`
and `authenticated` execution and retain service-role-only access.

Supabase reported no available managed backup and no PITR. The approved discarded
test history therefore has no promised recovery. A failure after schema commit
requires a reviewed forward fix and matching runtime; old Web alone is not a
rollback. Never reset or restore the whole DB over newer unrelated product data.

## Artifact And Acceptance Boundary

- Manifest: `Anidachi Staging`, version `0.1.0`.
- `version_name`: `56dbd901b75f3abf5e127b9571a4ac59302d3bd7-staging-139`.
- ZIP SHA-256: `f4d57264b90df43566b5c55fb5fd2b8c29db9398b2b08b491033a60d43cb3be6`.
- Retained local archive: `artifacts/anidachi-extension-staging-56dbd901.zip`
  (ignored, never committed).
- Merged-source CI, room/P2P workflows and staging smoke passed; the subsequent
  DB workflow had no further pending migrations. The standard Worker deployment
  also succeeded without a Worker-source change in this feature.
- Unauthenticated staging still serves the password gate and `noindex, nofollow`.
  Invalid bearer requests to v2 and v3 history return 401. Authenticated terminal
  HTTP 426 and new end-to-end writes remain part of manual acceptance, not this
  unauthenticated probe.
- `main` stayed at `54a154b702ea26e85fab2f3259aa7e5b98fa51be`; automatic promotion
  remained disabled on the existing manual promotion PR.

Next: reload the extension and provider tabs, then test the active plan's
authenticated matrix, prioritizing multiple seasons, two audio variants of one
episode, display-language changes, exact/partial progress, resume and Popup/web
parity. Shared-history product redesign and poster/tree cosmetics remain deferred.

The preexisting local port-54322 DB was checked read-only: it responded normally,
had no invalid indexes, and exact users/auth-users/rooms/progress/receipt counts
were zero. Its sole unvalidated constraint was the platform-owned
`realtime.messages` NOT VALID check. This does not reconstruct its state before
the previously disclosed dblink incident. It was not reset or cleaned up here.
