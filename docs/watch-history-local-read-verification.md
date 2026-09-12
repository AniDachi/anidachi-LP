# Watch History Local Read Verification

Date: 2026-09-05. Local-only follow-up on `codex/watch-history-fast-reopen`.
Baseline: `fb3387c3`. Server preview commit: `3325cf17`; initial client integration:
`fc3d638`. Final reviewed runtime: `4c4d559c`. Local implementation is verified;
remote activation and authenticated staging acceptance remain separate.

## Behavior and boundaries

- Server history, eligibility and title/season aggregates remain authoritative.
  Canonical storage, progress capture and outbox retain their responsibilities.
- Browse cache: `chrome.storage.local`, 32 exact queries / 1 MB / seven-day
  retention, 30-second freshness. Ordinary accepted progress changes freshness,
  not whether saved rows may be shown. Per-title revision hints are bounded at 64;
  evicting a hint makes affected older reads stale, not permanently fresh.
- Account, generation, deletion and consent safety are separate from freshness.
  Same-owner token rotation does not itself discard reads. A per-owner UUID auth
  epoch, retained outside removable partitions, fences account departure and late
  responses even if login credentials and generation return to their old values.
- Opt-in `includeEpisodePreviews=true` belongs only to the titles HTTP boundary.
  Existing callers retain the old strict response. Previews contain up to eight
  matching episodes and up to two matching sessions per episode; truthful
  continuation permits older episodes/sessions to be loaded on demand. A newer
  saved exact-query detail page takes precedence over an older preview and keeps
  its own continuation.
- Filtering precedes preview selection. Canonical unfiltered episodes are never
  substituted for matching rows. Filtered DTOs never overwrite canonical history.
- Mine and Together share read behavior. Only unfiltered new shared observations
  may be displayed provisionally as Pending sync, without guessed groups/sessions.
- No dependency, service, polling, room event, Worker, media or capture change.
  Cold/missing/evicted data still needs a server request; offline cache is not a
  promise that all account history has been downloaded.

## Source and SQL evidence

Node 22.23.1 / pnpm 11.2.2. Initial fail-first regressions reproduced lost session
cache after restart, missing reads after an actual accepted progress event,
unnecessary initial episode HTTP requests, and absent shared pending titles.
Focused integration initially passed 45 tests. Final correction reproduced three
failures before fixing actual deletion/logout/relogin, held late responses, and
newer saved Mine/Together detail selection. Latest focused corrections passed 44.
Final `pnpm check` and `pnpm test` both passed all six Turbo tasks: protocol 149,
API 201, extension 118 files / 1736 tests, Web 438 passed with six opt-in skips.
The unchanged demo check/test and protocol build used cache where reported; the
changed package tests ran fresh. Icons and `pnpm dev:check` passed.

Server evidence at 3325cf17: separately enabled local production RPC parser 2/2
passed. Six pgTAP files passed 360 assertions: previews 24, browse 54, canonical 82,
resource bounds 69, catalog 81, invitation lifecycle 50. Protocol/Web checks passed.

Only a new disposable local database was used: project `anidachi-preview-qzg8ie`,
container `supabase_db_anidachi-preview-qzg8ie`, host port 55662, workdir
`/tmp/anidachi-preview-db.Qzg8iE`. Repository target preflight passed before SQL.
No shared local, staging or production database was reset or modified.

The actual service fixture response was 7469 bytes versus 5409 legacy. Adversarial
50-title SQL page: 400 preview episode rows, 1700 selected session IDs, 1045529 raw
JSON bytes; legacy selection remained 1000 IDs. These are bounded local fixture
measurements, not production load or latency acceptance. Eligibility EXPLAIN used
existing indexes; local security advisors found no issue.

## Installed artifact evidence

Initial narrow production-mode WXT artifact at fc3d638 passed the staging artifact
validator. The controller used a direct build, not the staging-copy script. The
root release-channel suite does exercise packaging scripts in this worktree;
it does not synchronize the user's two established external tester folders.
An isolated temporary
Chromium profile loaded the actual MV3 background and popup, using synthetic
validated responses and blocking external DNS. It verified both modes, warm
switch/reopen with no extra request, no initial detail request, and saved episodes
after a full browser restart with all browse network responses held. Page errors: 0.
Initial synthetic restart-to-content observation: 87 ms; not a live-account SLA.

Initial screenshots are archived under ignored
`artifacts/watch-history-local-read-evidence.NEy7qC/initial/`.
Existing ineffective-dynamic-import and >500kB bundle warnings remain nonblocking.
Lightly edited legacy client/storage modules were not bulk reformatted; their
pre-existing style/lint debt is not claimed fixed.

Final runtime was built after the root tests and copied into the newly created
ignored `artifacts/watch-history-local-read-candidate.ftadFk/`. Its build identity is
`4c4d559c-staging-local-history-read-20260905`; the narrow staging validator passed.
One overlapping build attempt was rejected because release-channel tests had
replaced shared WXT output with the broad test build. It was not delivered; final
build/validation/browser execution were serialized against the isolated candidate.
Final screenshots are archived under the evidence directory's `final/` subfolder.
The final isolated candidate repeated both modes, warm reopen, no child HTTP,
progress-stale reads and a full browser restart while browse network was held:
all assertions passed, zero page errors, two saved queries. Synthetic restart
observation was 81 ms. These timings measure a fixture, not provider/server latency.

## Review and activation

Independent server task review approved spec and quality. Final integration review
identified two Important issues: pre-deletion cache key reuse after logout/relogin,
and previews overriding newer saved exact-query first detail. Both were fixed at
`4c4d559c`; scoped independent re-review confirmed both addressed with no new
Critical/Important finding. Graphify maintenance accompanies this documentation
checkpoint; numerical graph metrics remain in its report to avoid document churn.

Nothing was pushed, merged, remotely migrated or deployed. The two established
tester folders and their loaded browser profile were not changed. The new preview
path requires the additive `20260905145315` migration and matching Web runtime;
an extension-only folder replacement is not a complete activation.

After separate authorization: database prerequisite first, matching staging Web,
then validated extension and both tester folders. Authenticated acceptance should
cover Mine/Together reopen, new and old series, combined filters/deep pagination,
progress while switching modes, restart, account changes and deletion. Rollback
restores prior Web/extension consumers and retains canonical history and additive
database objects; never reset history or remove pending progress as rollback.
