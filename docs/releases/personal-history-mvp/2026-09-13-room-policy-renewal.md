# Room policy renewal under the runtime role

The September 13 private production test exposed an incorrect five-minute room
shutdown while the host still had valid Pro access. The database lease remained
at revision 1; the runtime failed its first renewal.

`renew_room_media_lease_v2` is intentionally SECURITY INVOKER, but its direct
`SELECT ... FOR SHARE` on `personal_history_policy` requires UPDATE privilege.
The runtime role has SELECT only on that operator-controlled table. This query
and the added runtime-role regression both reproduce SQLSTATE 42501 before the
fix. Earlier rollback smoke used an administrative role and missed this boundary.

The migration delegates that same policy row lock to the existing server-only
`check_personal_history_operation_v1(owner, 'privacy')` helper, then retains the
original account entitlement resolution and room lock. The helper does not
require paid history access or change policy. Renewal stays SECURITY INVOKER;
no role gains UPDATE on the activation flag. Plan expiry, frozen room limits,
renewal revisions and the terminal five-minute deadline are unchanged.

Validation: `apps/web/supabase/tests/room_policy_runtime_role.test.sql` uses
synthetic Free/Pro accounts and the real service_role. It checks renewal, caps,
expiry, stable denial deadlines and privilege boundaries. All fixtures roll back.
Run it on staging after migration, then production after accepted promotion.
Existing rooms already closed by the Worker must be recreated; the fix does not
reopen ended rooms or cancel a terminal deadline in an existing Worker.

No extension or Worker release is required for this database correction.
No secrets, Stripe changes, policy activation changes or table grants are added.
Rollback: restore the previous function definition through a new migration if
necessary; that restores the known renewal failure, so prefer a reviewed forward
fix. Never grant broad UPDATE just to suppress this error.

Graphify refresh is deferred for this emergency one-function correction: paths
and ownership are unchanged, and the source migration plus runtime-role SQL test
are the authoritative evidence. The next combined release graph update can include
this document. No broad room/P2P harness is needed for unchanged signaling/media.
