# Free20 host client admission — minimal implementation contract

Planned contract for Task 3 of the [staging readiness plan](../plans/2026-11-01-free20-staging-readiness.md), accepted for implementation by the controller under the owner-authorized staging transition. This document specifies candidate behavior; source presence or this design is not proof of deployment, enabled acceptance or Store support.

## Invariant

Every newly admitted HOST session targeting a room marked hosting_time_mode='daily_free20' requires current Free20 client capability. This includes same-request create replay/replacement, reconnect and marked rooms whose current time authority became paid/trial/manual/unlimited. Ordinary newly created paid/trial/manual rooms remain unmarked and do not acquire the new requirement. Old guests retain their existing media/membership/host-authority requirements. Guest budget is not host budget.

This is HTTP/SQL admission, not a retroactive socket or lease policy. Do NOT add the new check to require_room_hosting_admission_v1, check_room_hosting_socket_v1, renew_room_media_lease_v2/v3, Worker JOIN/socket validation, payment delivery or alarms. They are shared with ongoing connections/renewal. Existing old sockets must not be closed or denied renewal merely because the admission capability is absent. An old host later requesting a NEW connect/reconnect token for a marked room receives426, intentionally. Already-issued tokens/runtime socket paths remain governed by existing rules; this capability is version negotiation, not security attestation.

## HTTP/protocol

Add packages/protocol/src/free20-client.ts, exported through index.ts:
- FREE20_CLIENT_HEADER = 'x-anidachi-free20-client'
- FREE20_CLIENT_VERSION = 1
- parseFree20ClientVersion(value: string | null): 1 | null => value === '1' ? 1 : null.

No numeric coercion, trimming by application, semver guessing or >= comparisons. HTTP Headers itself normalizes legal outer whitespace; test the value actually returned by request.headers.get. Absent/blank/'0'/'2'/'01'/'1, 1'/arbitrary text => unsupported. Existing media header remains independently required. Frozen0.1.4 already sends X-Anidachi-Media-Protocol:3, so that is not the new capability.

Current extension sends X-Anidachi-Free20-Client:1 only on explicit background HTTP create and connect fetches in src/room-client.ts (createWebsiteRoomFromApi ~579; connectWebsiteRoomFromApi ~668). Use shared constant; add no new browser permissions, endpoint origins or credentials. Existing JOIN hostingTimeVersion:1 stays unchanged.

Unsupported marked host => HTTP426:
{"code":"ROOM_UPDATE_REQUIRED","error":"Update required","message":"Update AniDachi to use your daily free hosting time. You can still join friends' rooms."}

Use a shared Web body helper to avoid divergent create/connect strings. This is an existing error family; successful strict payloads and legacy hosting/quota contracts are unchanged. If distinguishing generic media incompatibility is necessary, expose internal Free20 guard error detail to Web and normalize the public code to ROOM_UPDATE_REQUIRED; do not falsely describe every unrelated media426 as a Free20 denial. Simpler safe fallback for generic update errors: 'Update AniDachi to host or join this room.'

0.1.4 create parser displays message then appends(426). Old restore/connect maps426 to fixed 'Update Anidachi to join this room.', retires local restore/reconnect state and stops retry. Do not promise a new install/update link in old code. Current error handling must not turn426 into a subscription paywall or quota notice.

## Current SQL/source topology

Latest public create_v3: 16 args (15 base + media protocol); body originally 20260914063511_room_media_seats_v3.sql, modified by 20260927144056_paid_hosting_room_admission.sql (authority/reuse guards), 20261007235706_netflix_history_and_room_sources.sql (Netflix input support), 20261031074738_daily_free20_room_admission.sql (v3 Free20 media guard). It calls anidachi_room_private.create_room_with_active_session_v1 with15 args. That private body comes from 20260908065520_room_media_capabilities_v2.sql, moved into private schema by20260908070552 and patched for Netflix. It reruns canonical plan resolution, disregards caller plan/capacity, finds locked same-request room, then may delete/update/replace assignments before inserting room.

Public create_v1(15 args) -> public create_v3(...,media1).
Public create_v2(16 args) -> public create_v3(...,media1or2), retaining its existing validation.
Public create_v3 -> private create_v1 core.
Public claim_v3(5 args) -> private claim_v1(4 args).
Public claim_v2(5 args) -> public claim_v3, retaining v1/v2 media validation.
Public claim_v1(4 args) independently checks non-null media lease then -> private claim_v1; it currently DOES NOT pass through public claim_v3.
Private claim_v1 has require_room_hosting_admission_v1 injected at entry by20260927144056; existing core validates input/role, locks user/room and mutates active assignment.

## Additive parameterized topology (no cycles)

Use one new migration. Preserve current deployed function definitions, input validation, Netflix support, return columns, SECURITY DEFINER/INVOKER semantics and source/seat/idempotency logic. Add capability as an explicit parameter, never a GUC/session global. Prefer a reviewed full parameterized body or exact-occurrence guarded transformation over several rename/wrap levels. Migration must fail on missing/duplicate anchors rather than silently patch unknown source.

New public create_room_with_active_session_v4:
(
 p_host_user_id uuid, p_participant_session_id text,
 p_show_id text, p_episode_id text, p_source_provider text,
 p_source_url text, p_video_fingerprint text, p_source_generation bigint,
 p_title text, p_client_request_id text, p_host_plan_code text,
 p_max_participants integer, p_max_media_seats integer,
 p_can_name_room boolean, p_can_send_push_invites boolean,
 p_media_protocol_version integer default 1,
 p_free20_client_version integer default null
) returns table(outcome text,room_record jsonb,active_room jsonb).

It is current public v3 orchestration with explicit capability threading and early guarded denial, calling NEW private create_room_with_active_session_v2 (the same15 base args + p_free20_client_version integer default null). The privatev2 is current privatev1 with the FINAL capability check described below.

Public create_v3 retains its exact16-arg signature and becomes delegate -> public create_v4(...,null).
Existing public create_v1/v2 remain delegates through public create_v3 with their existing validations.
Private create_v1 retains15-arg signature and becomes delegate -> private create_v2(...,null), closing any old internal call route. Revoke all runtime/browser execution on both private versions. No v4 function calls publicv3; no privatev2 calls privatev1.

New public claim_active_room_session_v4(
 p_user_id uuid,p_room_id text,p_role text,p_participant_session_id text,
 p_media_protocol_version integer default 1,p_free20_client_version integer default null
) returns table(outcome text,active_room jsonb).

It is current public claimv3 media negotiation, then calls NEW private claim_active_room_session_v2(p_user_id uuid,p_room_id text,p_role text,p_participant_session_id text,p_free20_client_version integer default null). Privatev2 is current privatev1 with capability-safe prelude below.
Public claimv3 retains exact5-arg signature and delegates -> public claimv4(...,null).
Public claimv2 stays -> public claimv3 with original media validation.
Public claimv1 retains original4-arg signature and non-null media-lease rejection, then calls private claimv1 wrapper -> private claimv2(...,null). This explicitly closes its bypass without changing legacy media behavior.
Private claimv1 becomes delegate -> private claimv2(...,null). No reverse calls.

Public v4 functions: SECURITY DEFINER, search_path='', bounded lock/statement timeouts, EXECUTE granted only service_role and revoked from PUBLIC/anon/authenticated. Existing public signatures/grants remain service-only. Private new and old functions: no EXECUTE for PUBLIC/anon/authenticated/service_role; same owner can call them from definer wrappers. Do not grant USAGE on private schema, operator-policy UPDATE, broad table grants or browser RPC access. Verify pg_proc.prosecdef/proacl and all exact regprocedure signatures with real SQL.

## Guard placement and locks

Create wrapper initial order: validate full existing inputs/media -> lock_hosting_commercial_policy_v1 (personal-history FOR SHARE then commercial FOR SHARE) -> canonical resolve_watch_history_access_v1 (account advisory + settings locks) -> user row FOR UPDATE -> locked same-request room lookup.

After locked lookup and before old require_room_hosting_access_v1/quota guard, check capability against (a) existing target marker if reuse, or (b) currently authoritative Free plan + policy.free20_enabled for a genuinely new target. This gives unsupported host426 ahead of finite-quota denial, without treating caller p_host_plan_code as authority. Preserve legacy policy-disabled hosting403 and old media errors. For an existing unmarked target do not infer markedness from current Free plan. Unknown canonical authority remains unavailable503; it is not a Free plan. Then retain current hosting/reuse/media guards and call parameterized private core.

FINAL create-core check: after its OWN resolve_watch_history_access_v1 has selected p_host_plan_code and after locked v_has_existing_room/v_room lookup, BEFORE selecting/cleaning/updating/inserting active_room_sessions or inserting rooms. If existing target is daily_free20 OR (no existing target AND current locked policy.free20_enabled AND core-selected p_host_plan_code='free'), require p_free20_client_version=1, else raise ROOM_UPDATE_REQUIRED (or internal differentiated reason mapped to that public code). This check is required even after outer preflight: a paid grant can expire by clock time while all locks are held, before the private core re-resolves to Free. A route/outer-wrapper-only check would miss it. Do not use returned outcome='claimed' as newness: replacement sessions can also be claimed.

The final core checks its selected plan used for INSERT, not an earlier Web plan. Insert trigger still validates actual authority; if paid selection expires again, its existing refusal prevents forged paid-capacity insertion. Preserve current trigger, frozen caps and mode immutability. Post-return marker assertions are useful defense-in-depth only, not the primary check. No denial after an independent committed RPC.

Conflict precedence: after capability guard, preserve existing core conflict semantics. Thus unsupported candidate marked host can get426 even if another assignment would otherwise conflict; supported clients keep current409. All such denials preserve existing assignment/room. Document this deliberate precedence rather than mutating an assignment to discover the target. For truly unmarked candidate, existing conflict behavior is unchanged.

Claim core prelude: full original input validation first -> lock_hosting_commercial_policy_v1 -> inspect target host ID without row lock -> acquire caller+target-host advisory locks sorted by UUID, matching require_room_hosting_admission_v1 -> caller user row FOR UPDATE -> target room FOR UPDATE -> original existence/ended/role/membership validation -> capability check based on ACTUAL room.host_user_id=p_user_id and marker, not p_role alone -> existing require_room_hosting_admission_v1 -> unchanged assignment lookup/reuse/replace logic. Membership-role spoofing must not bypass host capability; preserve existing permission errors for nonparticipants. Missing/ended stays existing notfound behavior.

Do not first take room row FOR UPDATE and later acquire account advisory locks: that inverts existing policy/account/room order. The existing admission helper re-acquires already-held locks safely; the prelude must hold both account advisory locks before either user's mutable authority can be resolved. Re-read room under lock; if host identity could differ from preliminary read, reject/retry rather than acquire a newly discovered account lock out of order. rooms.host_user_id is expected stable but do not assume this for lock-order proof without verification.

The claim guard intentionally occurs before old quota admission, so unsupported marked host426 also applies when the day is exhausted or when the room is now unlimited. Unknown/malformed authority at Web preflight remains503. Unmarked-room claim continues old require_room_hosting_admission_v1 behavior; do not special-case it into Free20.

All SQL exceptions roll back the statement's lazy canonical reconciliation as well as any incidental changes, but requested implementation places the new gate BEFORE room/assignment mutation. Verify no host_connected_at/last_active_at/status/media-closing or token/handoff success after denial.

## Web adapters and routes

apps/web/lib/anidachi-auth/db.ts:
- createRoomWithActiveSession params add free20ClientVersion?:1|null; call create_room_with_active_session_v4, pass p_free20_client_version: params.free20ClientVersion ?? null. Keep15 existing fields and media default.
- claimActiveRoomSession similarly call claim_active_room_session_v4 with sixth parameter.
- Preserve ROOM_UPDATE_REQUIRED mapping, authority missing and lock timeout55P03/57014 => ROOM_AUTHORITY_UNAVAILABLE. If internal differentiated guard code is chosen, normalize consistently here while retaining enough reason for friendly body. No new generic500 on expected denial.

app/api/rooms/route.ts: parse header once after auth; pass to adapter. Optional current canonical Free preflight can give friendly426 before local quota403, but is not the enforcement boundary. Same-request reuse needs its actual target marker; SQL must decide it, especially if current account is paid. To guarantee426 precedence for all marked replays, do not let the route's pre-SQL quota check short-circuit those unsupported requests: either pass them through canonical SQL admission or use a scoped target lookup for UX only. Avoid broadening all Free accounts into update-required when Free20 is disabled. Existing old media and hosting policy checks remain.

app/api/rooms/[roomId]/connect/route.ts: after authentication, room existence, host/membership validation and authority read, add early isHost && room.hosting_time_mode==='daily_free20' && version!==1 =>426 before local quota403. Pass version to claim adapter regardless; SQL rechecks. Catch SQL426 identically. Gate must precede updateRoom (host_connected_at,last_active_at,lobby->live) and signRoomToken.

lib/anidachi-auth/room-create.ts: retain status union426 and consistent public body. Existing tests in free20-admission.test.ts and room-create tests can cover route/adapter mapping with mocks, but are not SQL race proof.

Other caller: watch-history-v3-routes.ts:417 calls createRoomWithActiveSession without capability/media3; default remains unsupported and existing checkPersonalHistoryOperation(...,'legacy') plus HISTORY_CLIENT_UPDATE_REQUIRED mapping remain intact. Do not infer support from authenticated cookies or grant capability to this retired recreation route. Search all adapter/raw RPC references before implementation; inspected production TypeScript callers are only normal create, connect and this legacy history recreation.

## Compatibility boundaries

- Old0.1.4 ordinary paid/trial/manual create and unmarked host reconnect: existing behavior, no new gate.
- Old0.1.4 guest in marked room: existing media3 allowed, membership and host authority still checked. 'Guest unaffected' does not mean join a terminal/exhausted room becomes permitted.
- Old0.1.4 host create Free20/replay/reconnect:426; no successful mutation/token. Paid host reconnecting SAME marked room also426; creating a separate ordinary paid room is still allowed subject to existing active-room conflict.
- Existing unmarked Free room is not adopted/backfilled. Its existing post-cutover HOST_SUBSCRIPTION_REQUIRED behavior remains; after host pays it still is not a marked Free20 room. Do not claim all old rooms continue or are newly closed.
- Capability is not stored as account entitlement, not a JWT grant, not derived from version manifest, not authority for1200seconds. Existing Web/Worker flags and SQL policy remain independent default-off gates.
- Schema-first deployment makes old Web callers send null and therefore deny unsupported Free20 hosts; deploy new Web + new extension before controlled enable. No function drops/signature mutation that breaks old Web.

## Required proof

Protocol: exact header values and duplicated header serialization; no successful schema changes.
Web: create/connect current passes version; absent remainsnull; headers cannot override auth/role; friendly426; unavailable503; paid ordinary/old guests; existing marked paid-replay; no token/updateRoom on denial; zero-quota precedence; disabled flag/path; legacy recreation remains unsupported.
Extension: both background producer fetches send header on initial/retry/create/reconnect; unrelated requests unchanged; error bridge preserves426; current UI does not paywall it. Frozen b49bbab0 or exact archived0.1.4 staging artifact parser behavior is separate compatibility evidence; real loaded mixed-client scenario still required.

Real SQL using service_role (rollback-only pgTAP fixture plus actual two-session concurrency harness):
1. new Free v4null/0/2 rejects; v4=1 creates marked1200-minus-usage with frozen4/4 capacities. Existing publicv1/v2/v3 cannot bypass. Test each private function denied directly to service_role and browser roles.
2. marked same-request replay with same/different participant session unsupported rejects; room count, full assignment/session timestamps, room timestamps/status/media lease unchanged. Supported replay returns same room. Different request preserves old active room conflict/explicit precedence.
3. marked host claim unsupported denied, including p_role spoof attempt and paid-upgraded marker; guest claim without new header works with media3 + valid member; guest own quota exhausted irrelevant. Unsupported current host cannot refresh updated_at by 'reused'.
4. ordinary paid, trial, manual and unmarked legacy paths retained; unmarked Free post-cutover remains old denial; disabled Free20 same previous behavior.
5. Concurrent policy enable before/after canonical lock; grant revocation under account lock; paid expiry by time between OUTER read and INNER plan selection. Must force the last scenario with deterministic fixture synchronization/hook or suitably bounded short grant, not just two mocked reads. No unsupported marked room/assignment commits. Document which locking side wins.
6. Concurrent same-clientRequestId current/old caller and current/old host replacement: one current result; old denial leaves winner intact. Old Wrapper publicv3 tests execute actual SQL, not string inspection.
7. Claim rejection never changes media_closing_at, terminal intent, assignment or renewal; existing renew/check_room_hosting_socket remain callable without capability. Do not call end/release sockets in fixture cleanup against real rooms.
8. Migration grants under actual service_role, fixed search_path, explicit signature/defaults; source-preserving migration must still accept Netflix, media-v2 legacy shapes and v3 seat contracts. Run existing daily_free20_admission/media/active-room/cutover suites updated to pass capability only where successful Free20 creation is intended; preserve new explicit old-v3 rejection tests rather than changing all fixtures silently.

Likely file set: new protocol file/test+index; one migration; new SQL admission test + concurrency runner case; db.ts; create/connect routes; room-create/body helper; room-client.ts; free20-admission and room-client tests; current development state + bounded active plan/contract. No API Worker edits needed. Run protocol/web/extension checks and tests, SQL runtime-role/concurrency suite, extension staging build/validate and dev:check. Loaded current-host/old-guest and old-host426 across create/restore/reconnect remains a staging acceptance gate; this report does not establish it.
