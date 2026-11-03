# Free20 browser and installation abuse protection

Owner-approved behavior, November 3, 2026. Implementation is authorized in the
existing staging worktree. Production, Store publication and unrelated changes
are excluded. A deployment is not evidence of loaded-client acceptance.

## Intent and accepted tradeoff

Changing AniDachi accounts in the same known browser/extension must not multiply
the daily free hosting allowance. Preserve the account allowance across devices.
Each account, signed browser marker and proved extension installation has a
1200-second UTC-day ceiling; available time is the smallest remaining allowance.
For example A spends 720 seconds, then fresh B in that browser has 480 seconds.
Different people sharing one browser profile share this allowance. An IP address
alone never links accounts. A fresh account with both markers reset remains an
acknowledged limit of this design, not a hardware/person identity guarantee.

## Approaches

The owner selected reuse of the signed cookie and installation-key mechanism,
with a separate daily ledger. Phone verification was discussed and not selected.
No fingerprinting, IP quota, CAPTCHA, SMS, new provider or new secret is included.
The historical one-trial-per-marker ledger is preserved and never used to deny
daily Free20. This supersedes the earlier Free20 exclusion of new shared-browser
restrictions solely for the tradeoff explicitly accepted here.

## Security and accounting contract

- Server authentication establishes the account; neither a marker nor a client
  plan/timer is authority. Unknown context/authority fails closed for new free
  hosting without being presented as consumed minutes or an expired paid plan.
- Reuse the existing random signed HttpOnly browser cookie and P-256 installation
  key. Keep keys across logout. Use a distinct Free20 signing purpose and bounded
  server challenge bound to account, browser, origin and request ID. The private
  installation key stays in the extension. Do not export markers in URLs/logs/
  analytics or expose them in room/public status DTOs.
- Enroll through an authenticated first-party-cookie request plus required valid
  installation proof. Invalid or absent proof never becomes cookie-only free
  hosting. After validation, issue a bounded signed context token, account-bound,
  used only in a dedicated request header. The background owns enrollment/cache;
  account replacement retires pending work. Ordinary same-account token refresh
  preserves presentation and does not require clearing the known timer.
- Both markers are checked at creation. Each survives loss of the other through
  its own durable daily ledger. An enrollment/refresh must not mint allowance.
- PostgreSQL owns marker usage, room bindings and admission serialization. Actual
  consumption comes only from existing cumulative room-day settlement. One delta
  is applied once to account usage and each bound marker. Replayed/out-of-order
  ACKs do not double-charge. Marker usage survives account/room deletion; bounded
  retention must not discard unsettled evidence.
- Only one spending Free20 room may hold a given marker at a time. Reservation
  survives disconnect/unknown terminal settlement and is released only with
  durable terminal completion (or a separately proved safe paid transition).
  A conflicting different account receives a neutral retryable busy response;
  never disclose that other account's room link, identity or participants.
- Creation replay cannot replace a room's original allowance with fresh markers.
  Host reconnect from another legitimate device must preserve the current room
  and never create a new budget. Additional verified context can be attached
  under the same account/room fences; it cannot remove original scope restrictions.
  Any newly attached scope must reflect current known account consumption and
  subsequent room deltas, including a pending ACK, without double-counting.
- Binding a fresh replacement marker must carry forward the greatest known
  current-day consumption of the account and all paired/bound scopes, not just
  the account's own consumption. Browser 720 + fresh installation + fresh account
  must seed the new installation to 720 before spending; later replacing the
  browser then cannot recover those 720 seconds. Status/enrollment reads do not
  mutate a live room's scope ceiling outside its serialized transfer.
- The effective committed total is max(account committed, each bound marker's
  committed total). With exclusive active-scope ownership, the existing DO's
  own unsettled interval can be added once using its existing ACK machinery.
  All bindings/claims and cumulative writes need a documented deadlock-safe order.
- Server 00:00 UTC resets each allowance. Previous-day delivery never spends the
  new day's budget. No per-second SQL writes, new polling or per-account cron.
- Paid/trial/manual access retains existing precedence, capacities and expiry.
  Guest participation does not consume guest allowance or require host proof.
  Buying while hosting retains the room and settles already consumed free time.
  Late payment does not revive an ended room.

## Integration and compatibility

Scope attachment to an existing room is a serialized host-transfer operation,
not an ordinary SQL claim side effect. Web verifies the requesting host/context;
the DO first durably records the transfer and detaches the old host connection
through the existing presence/accounting lifecycle. With no host spending, settle
the old cumulative interval, attach the additional SQL scopes, refresh and persist
the effective checkpoint, then permit the new host claim/connection. Same-context
reconnect needs no such transfer. Lost response/restart must resume or fail closed
from the durable transfer record; a client abort must not strand a smaller SQL
allowance behind a larger active DO budget. A terminal room never resumes. This
does not alter ordinary guest, camera or microphone controls.

Transfer intent and the stopped meter are one durable write. Recovery loads this
fence before restoring old host sockets, and pending transfer blocks host JOIN and
metering. The existing 60-second host-disconnect deadline bounds recovery and is
never extended by retries. An applied exact-payload receipt survives restart so
duplicate delivery cannot detach the replacement host. Settlement uses the
existing nonterminal `settleOnly` path; terminal departure is not a transfer.

The browser cookie must be observed on both enrollment requests. A browser that
blocks it must not receive a usable context from the challenge alone. A dedicated
endpoint accepts authenticated requests from the configured extension/site;
the trial endpoint's first-party Origin guard is retained unchanged.

Use additive, default-off SQL and runtime gates. Old public RPC entry points must
not bypass enforcement; final locked plan selection handles paid expiry races.
Already created rooms must have an explicit preservation strategy. Activation
requires compatible runtime and no unprotected live Free20 rooms; do not silently
reset usage or backfill unverifiable old-browser ownership.

The extension's idle, live and exhausted screens must show the effective budget.
Account-only status is not an acceptable fallback after a context-required error.
Paid layout and guest entry stay free of quota placeholders and upsell controls.
The web's browser-context display must not promise more time than its known scope;
unavailable installation-specific authority must be honest rather than inventing
a complete 20 minutes. Room actions always enforce the final server decision.

## Delivery and evidence

First implement additive schema, proof/context and cross-plane consumers behind
disabled gates. Verify actual SQL concurrency, proof replay/forgery/account switch,
marker replacement, cumulative settlement, paid/guest behavior, UTC rollover,
extension lifecycle regression suites, narrow build and exact artifact identity.
Review independently before a staging PR. Activation is a separate controlled
step after compatible delivery; no source-only claim of enabled protection.

No production flag, main promotion, real payment or account data mutation is
authorized here. Reuse synthetic isolated SQL/runtime/browser fixtures. Preserve
the pre-existing .serena/project.yml modification.
