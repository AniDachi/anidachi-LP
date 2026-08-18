# Pre-release Security And Reliability Readiness Design

Status: Approved design; implementation plan reviewed; implementation not started

Date: 2026-08-18

## Summary

AniDachi will close the validated pre-release security and reliability gaps by
strengthening existing product boundaries rather than introducing a new
security platform. The work keeps the current Next.js, Supabase, Cloudflare
Durable Object, WXT extension, and shared protocol architecture. It does not
replace Watch History v2, room synchronization, provider adapters, or the
local-first extension experience.

The design covers all 20 validated findings from the read-only security review
at revision `5af88fd2e1ad3440a4e9959e52332ac19e0c633f`, plus the already-known
bounded Watch History response gap. The current `origin/staging` tree was
rechecked before this document was created.

This is a readiness and hardening design, not a release plan. It explicitly
excludes merging to `main`, production deployment, public launch, and the
remaining product UI/UX redesign. Those decisions happen later after the
product surfaces are complete.

## Why This Approach

Three approaches were considered:

1. independent patches for every finding;
2. focused hardening of existing trust boundaries;
3. a new centralized security gateway, rate-limit service, and generic job
   platform.

AniDachi will use option 2. Independent patches would duplicate validation and
make future drift likely. A new security platform would add operational and MVP
complexity without being required to close the confirmed risks. The selected
approach adds narrow shared helpers, explicit contracts, database constraints,
and bounded lifecycle jobs only where current owners need them.

## Fixed Decisions

1. Before every implementation wave, re-read the then-current `origin/staging`
   source, migrations, deployed configuration evidence, and affected consumers.
   The plan is amended when the repository no longer matches an assumption.
2. No release, `main` merge, or production deployment is part of this work.
3. Staging deployment is allowed only as verification evidence after the
   corresponding local and automated gates pass.
4. UI/UX redesign, social polish, friend/group product polish, and new product
   features are outside this scope.
5. No new always-on service, generic security framework, polling loop, durable
   queue platform, or second account-data authority is introduced.
6. Cross-plane payload changes begin in `packages/protocol`, then update every
   producer and consumer in the same compatibility wave.
7. Existing server-owned state stays authoritative. Extension local state stays
   a responsive cache/outbox and never becomes an auth, room, social, or durable
   history authority.
8. Watch History receipt retention remains exactly 14 days. There is no
   arbitrary outbox TTL or fixed key-count limit.
9. Resource limits must be tied to an existing product bound, measured payload,
   provider/platform limit, or an explicitly recorded abuse budget. Numbers
   without one of those justifications are not accepted.
10. The existing signing secret may remain for MVP only when verifiers enforce
    exact `typ`, `issuer`, `audience`, algorithm, subject, and lifetime. Separate
    signing keys remain optional defense in depth, not a blocking redesign.
11. Security failures are fail-closed for privileged operations but must not
    make normal playback, local progress display, sign-out, or room cleanup
    hang indefinitely.
12. Every destructive migration or credential change needs a tested rollback or
    forward-recovery path before staging.

## Goals

- Remove the three confirmed high-severity pre-release blockers.
- Prevent website, extension, and room capabilities from crossing channels.
- Keep private credentials and CRM data unreachable through public media paths.
- Preserve seamless local-first Watch History while bounding server reads,
  writes, retention, and retry artifacts.
- Prevent supported-site JavaScript from reading diagnostics or triggering
  privileged extension actions.
- Bound server-side fetch, image decode, WebSocket, login, and public-form work.
- Keep delayed offline and shared-room history truthful without indefinite
  capability replay.
- Produce repeatable local, staging, and two-profile evidence before the work is
  declared ready for later product development.

## Non-Goals

- Releasing AniDachi or promoting staging to production.
- Completing Popup, account dashboard, People, Groups, Inbox, or room UI/UX.
- Replacing Supabase, Vercel Blob, Cloudflare Durable Objects, WXT, or Next.js.
- Moving all internal tools into a new service.
- Adding a universal rate-limit database or event-sourcing system.
- Removing offline Watch History or reducing the user's durable history.
- Reopening Watch History v1 compatibility work.
- Automatically rotating credentials without first proving that their objects
  were reachable in the deployed Blob configuration.

## Source And Standards Baseline

The implementation must recheck these primary sources when the relevant wave
starts:

- Next.js security advisories for the installed 15.5 line:
  `https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6`
  and
  `https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj`.
  The current minimum compatible fixed floor is `15.5.21`.
- Chrome Identity API redirect behavior:
  `https://developer.chrome.com/docs/extensions/reference/api/identity`.
- OAuth 2.0 Security Best Current Practice:
  `https://datatracker.ietf.org/doc/rfc9700/`.
- JOSE `jwtVerify` claim validation:
  `https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md`.
- Vercel private Blob access:
  `https://vercel.com/docs/vercel-blob/private-storage`.
- Supabase RLS and database security:
  `https://supabase.com/docs/guides/database/postgres/row-level-security`.
- Cloudflare Durable Object WebSocket guidance:
  `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`.
- OWASP server-side request forgery prevention:
  `https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html`.

## Architecture

### 1. Public Media And Private Credential Boundary

The catch-all media route must never translate an arbitrary caller path into a
server-token Blob read. Public media is addressed through an explicit media
namespace or an application-issued media identifier. Credential, integration,
CRM, and PII namespaces are always rejected before any Blob call.

The implementation begins with a read-only deployed configuration and object
prefix inventory. If public media and credentials share one store, the minimum
safe cutover is:

1. immediately constrain the public route to known media prefixes and content
   types;
2. place new credentials in a private-only namespace or private store;
3. migrate existing credential objects with read-old/write-new compatibility
   only for the shortest verified transition;
4. remove old reads after staging proof;
5. rotate credentials only when inventory shows that exposure cannot be
   excluded.

The media proxy returns `404` for disallowed paths so it does not become a
credential-prefix oracle. It streams bounded allowed media and sets
`X-Content-Type-Options: nosniff`. It never exposes the Blob service token.

### 2. Explicit Website And Extension Auth Channels

Website and extension sessions remain in the existing auth system but become
cryptographically and durably channel-bound.

Access tokens require:

```txt
alg = HS256
iss = anidachi-auth
aud = anidachi-web | anidachi-extension
typ = website_access | extension_access
sub = current AniDachi user
iat + exp = mandatory
```

Every verifier supplies the expected issuer, audience, required claims, and
algorithm to `jose`, then validates the application `typ`. A website verifier
never accepts an extension access token, and the reverse path is equally
explicit.

Refresh-token rows gain a client channel, token family, absolute session
expiry, current token hash, rotation/revocation state, and device identity where
already available. Refresh rotates atomically. Reuse of a predecessor revokes
the family. Absolute expiry never slides. Existing sessions use a bounded
pre-release compatibility transition rather than an unbounded dual-mode path.

### 3. Extension Authorization Code Binding

Extension connection uses the exact environment-approved AniDachi extension
IDs and exact callback paths. A hostname merely ending in
`.chromiumapp.org` is insufficient.

The extension creates a PKCE verifier and sends only the S256 challenge with the
connection request. The server-issued one-time authorization code is bound to:

- approved extension ID;
- exact redirect URI;
- PKCE challenge and method;
- authenticated user;
- short expiry;
- single-use state.

Exchange requires the matching verifier and redirect URI, consumes the code
atomically, and issues only extension-channel tokens. Production, staging, and
local unpacked extension IDs are configured explicitly; broad wildcards are
forbidden.

### 4. Browser OAuth Transaction Binding

Google and Discord login initiation generates at least 128 random bits for a
one-time state value. Provider, sanitized return path, PKCE verifier/challenge,
creation time, and intended client channel are bound to the same transaction.
The callback consumes the transaction once and clears its cookie/state even on
failure. Deterministic base64 JSON is not accepted as authorization state.

No new state service is required. The implementation uses a compact
service-role-only transaction table containing only state and browser-correlation
hashes plus bounded metadata. Each login attempt receives its own HttpOnly,
Secure, SameSite correlation cookie selected by a non-secret state digest, so
concurrent tabs do not overwrite one shared cookie slot. The callback consumes
the exact transaction and cookie once without storing a raw state, correlation
secret, or PKCE verifier.

### 5. Room History Capability Lifecycle

Room-history authority continues using the signed Worker attestation already
implemented for Watch History v2. It gains mandatory `exp`, `jti`, exact
issuer/audience/type checks, and a server-enforced maximum age.

The acceptance model distinguishes:

- live room/source activity;
- a delayed terminal event observed before leave/end;
- a replay after the allowed delayed-delivery window.

Shared offline delivery receives a bounded grace period derived from the
documented offline-room product promise and staging measurements. The grace is
one named server configuration used by Worker issuance, web verification, and
SQL acceptance tests. It is not silently inferred from receipt retention.
Receipts remain 14 days for idempotency, but a 14-day receipt does not make a
room capability valid for 14 days.

A 24-hour grace is the initial MVP candidate because it covers an overnight
client/network interruption without retaining room authority for the receipt
lifetime. It is not an approved invariant until the execution evidence gate
confirms the actual product promise and reconnect behavior. Any different value
requires a reviewed design/plan amendment before implementation.

An exact accepted event remains idempotent after capability expiry. A new event
using an expired/replayed attestation is rejected and cannot refresh Recent
People evidence or shared-session metadata.

### 6. Bounded Watch History Without Losing History

The durable user history remains complete. The bound applies to one response
and one query, not to stored titles or episodes.

The existing title keyset page and summary projection remain. For every visible
title, episode rows become keyset-paginated behind a shared protocol contract.
The first title page contains a bounded recent episode slice and an explicit
continuation marker. The website may request further episode pages when a title
is expanded. The Popup keeps its recent compact view and does not eagerly load
an entire long-running title.

The implementation should reuse the existing catalog episode ceiling of 500 as
an input-validation ceiling, not as a claim that every history response may
carry 500 episodes for every visible title. Exact page sizes are chosen from a
payload/RSS/query benchmark and recorded in the plan report. The existing
501-title/13,200-episode fixture remains a regression baseline.

Backward-compatible clients must either receive the bounded default slice they
already understand or receive an explicit protocol version error. The server
must not silently truncate data while claiming the title is complete.

### 7. Durable History And Credential Artifact Bounds

Watch History receipts retain exactly 14 days. A scheduled service-role-only
cleanup removes expired receipts globally in bounded batches. The implementation
first checks whether the current Supabase project supports the required
database scheduling extension. If not, an authenticated Vercel cron route is
the documented fallback; both paths call the same bounded SQL function.

No arbitrary `500 keys` or outbox TTL is added. New-session creation and unique
event mutation budgets are based on measured normal multi-tab/device behavior.
The budget limits abusive creation of new durable identities while allowing
normal heartbeats for an existing session. Quota refusal is explicit and does
not delete current progress or an existing terminal outbox event.

Extension authorization codes are deleted immediately after successful
exchange. Expired codes and refresh families are cleaned in bounded batches.
Active-device caps, if needed, are based on the existing account/device model
and provide a visible revoke-old-device path rather than silently deleting the
current session.

### 8. Extension/Page Isolation

Routine diagnostics move from page-origin `localStorage` to extension-owned
session storage or bounded in-memory storage. Titles, reaction text, tokens,
attestations, identifiers, and user-authored content are absent from routine
diagnostics. Explicit support exports are short-lived and sanitized.

The content-script overlay uses a closed shadow root as defense in depth.
Privileged actions such as sign-out and end-room require a trusted native user
event and a narrow background command that rechecks the current account, room,
role, and generation before mutation. Synthetic page clicks cannot invoke the
action. Normal player observation is not blocked by this check.

### 9. WebSocket Admission Before Allocation

Room-token verification remains before Durable Object admission. The Worker
also applies a small pending-socket budget by authenticated subject and room
before retaining the socket, plus a JOIN deadline. The budget is derived from
the supported number of tabs/devices and current room participant ceiling. Once
JOIN succeeds, existing participant replacement and room capacity rules remain
authoritative.

Two pending sockets per authenticated participant and a ten-second JOIN
deadline are initial candidates for the current two-tab/device reconnect model.
They become constants only after current reconnect traces and staging behavior
support them; otherwise the design and plan are amended before code changes.

Rate limiting aggregates by authenticated participant/room rather than giving
every new socket a fresh independent budget. Hibernation-compatible attachment
state records the minimum identity/admission fields needed after wake-up.

### 10. Server-side Fetch And Decode Boundary

Bloü and OpenClaw reuse one narrow server-only media intake helper instead of
maintaining separate incomplete URL checks. The helper enforces:

- permitted schemes and, where product-known, an origin allowlist;
- no credentials or fragments in URLs;
- public IP resolution for every redirect target;
- disabled redirects or manual revalidation of every redirect;
- connect and total timeout;
- streamed byte limit before buffering;
- allowed content type plus magic-byte verification;
- image dimension and total-pixel limits before expensive transforms;
- bounded file count, aggregate bytes, and processing concurrency.

DNS validation must be bound to the actual connection and repeated for every
redirect hop. If the deployed runtime cannot prove that binding, arbitrary
remote URLs are not supported: the feature accepts application-issued Blob
identifiers or a fixed product origin allowlist only.

Application-issued Blob identifiers are preferred over arbitrary remote URLs.
Rejected input never returns internal fetch details.

### 11. Route Ownership, Redirect, Enumeration, And Abuse Controls

- `save-discord-credentials` requires the current AniDachi account and verifies
  checkout ownership plus expected payment state before customer mutation.
- Room creation canonicalizes supported Crunchyroll and YouTube watch URLs.
  Unsupported destinations are rejected; room joins never auto-redirect to an
  arbitrary host.
- The legacy ICE query-token path is removed after confirming zero consumers;
  Authorization bearer remains the only route.
- Waitlist lookup becomes uniform or proof-of-email based and does not reveal
  membership to an arbitrary caller.
- Public interest subscription is idempotent and bounded before CRM/email work.
- Staging and CRM login gates use durable or platform-level throttling. The
  implementation first inventories existing Vercel/edge controls so it does
  not duplicate a platform feature blindly.

## Finding Coverage

| Finding | Owning boundary | Readiness class |
| --- | --- | --- |
| 1 extension redirect wildcard | Extension authorization | Required before further auth rollout |
| 2 vulnerable Next.js | Dependency/runtime | Required immediately |
| 3 Blob proxy disclosure | Media/private data | Required immediately |
| 4 interest amplification | Public abuse controls | Required before public access |
| 5 OAuth state | Browser OAuth | Required before public access |
| 6 token channel confusion | Auth channel | Required before public access |
| 7 attestation replay | Room capability | Required before shared-history release |
| 8 Bloü SSRF | Media intake | Required before enabling that route publicly |
| 9 password guessing | Edge/auth throttling | Required before public access to those gates |
| 10 origin diagnostics | Extension isolation | Required before store/public artifact |
| 11 synthetic privileged action | Extension isolation | Required before store/public artifact |
| 12 arbitrary room redirect | Room source contract | Required before public rooms |
| 13 history storage exhaustion | History lifecycle | Required before public access |
| 14 checkout ownership | Billing ownership | Required before public billing |
| 15 OpenClaw decode bounds | Media intake | Required before enabling that integration |
| 16 refresh replay | Auth lifecycle | Required before public access |
| 17 pre-JOIN socket exhaustion | Worker admission | Required before public rooms |
| 18 ICE query token | Worker compatibility | Remove when consumer audit is clean |
| 19 waitlist enumeration | Public privacy | Low-risk readiness cleanup |
| 20 auth artifact retention | Auth lifecycle | Readiness cleanup |
| Unbounded visible-title episodes | History read model | Required before public history access |

## Delivery Waves

The implementation plan will use small, independently reviewable waves:

1. evidence freeze, dependency patch, and private/public Blob boundary;
2. website/extension auth transaction and token-channel boundary;
3. room authority, Worker admission, and extension/page isolation;
4. bounded Watch History read/write/retention lifecycle;
5. server-side media intake, billing ownership, redirects, and public abuse
   controls;
6. integrated verification, staging acceptance, canonical documentation, and
   formal readiness closeout.

Each wave stops after its own review and verification. A later wave does not
hide a failing earlier gate.

## Migration And Compatibility

The product is still pre-release and current data is test data. Prefer a clean
pre-release cutover over indefinite legacy support, but preserve active test
accounts and staging evidence when compatibility is cheap and bounded.

- Database changes are additive first.
- Token/channel changes use a short documented compatibility window or force
  reauthentication in test environments; no permanent dual verifier remains.
- Extension ID allowlists contain explicit staging and local development IDs.
- Watch History response changes are versioned and update web/extension
  consumers in the same wave.
- Blob credential migration uses read-old/write-new only when deployed inventory
  proves it necessary.
- Removed compatibility paths receive a zero-consumer source and staging audit.

## Failure And Rollback Behavior

- Auth migration failure fails closed and leaves a user able to sign in again;
  it never accepts a token from the wrong channel.
- Blob migration failure leaves private data private; public media may return a
  temporary `404` rather than fall back to arbitrary reads.
- Watch History cleanup never deletes unexpired receipts, progress, or deletion
  fences. Quota enforcement refuses new abusive identities without silently
  evicting current history.
- Room-history authority expiry does not break solo history. A rejected delayed
  shared event remains local with a stable reason until it can be discarded or
  surfaced; it is not reclassified as solo.
- Worker admission changes can be rolled back independently of protocol/data
  migrations when token contracts are unchanged.
- Media intake rejects uncertain inputs; it does not retry without bounds.

## Verification Strategy

Every behavior change follows test-first RED/GREEN evidence. Required layers:

- protocol schema and exact-claim tests;
- web route/service and auth-channel tests;
- Supabase reset, lint, pgTAP, grants/RLS, concurrency, cleanup, and rollback;
- API/Worker unit, room harness, pre-JOIN exhaustion, and lifecycle tests;
- extension storage, hostile-page, trusted-action, auth-switch, outbox, and
  loaded-artifact tests;
- bounded Watch History payload/query/RSS benchmark;
- SSRF redirect/private-IP/timeout/size/image-bomb fixtures;
- staging login, extension connection, solo/offline history, and two-profile
  shared-room acceptance where affected.

`pnpm dev:check` selects the final repository profiles. CodeRabbit and manual
review remain separate gates. Graphify is updated after meaningful architecture
changes, then source is rechecked directly.

## Definition Of Ready

This hardening effort is ready to close only when:

- all three high findings are fixed and regression-tested;
- every medium finding is fixed, disabled behind an unreachable boundary, or
  explicitly deferred with a named owner and reason;
- low findings are fixed when cheap or recorded as deliberate pre-public
  follow-up;
- Watch History pages and cleanup are bounded without deleting user history;
- no public route can read credential/CRM Blob namespaces;
- website and extension credentials are rejected across channels;
- room authority and pre-JOIN sockets have tested lifecycle bounds;
- extension diagnostics/actions are isolated from hostile page JavaScript;
- local and staging evidence is current;
- canonical docs describe the resulting system;
- the repository is clean and the work is merged only to `staging` through the
  normal PR flow.

Production release remains a separate future decision after UI/UX and remaining
product work are complete.
