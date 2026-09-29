# Public community signup counter

Owner decision, September 30, 2026: use **1,409** as the historical starting
figure and continue with new account registrations. Do not reconcile the old
waitlist against account emails for this change.

## Definition

- The baseline combines 555 production `public.users` rows and 854 CRM waitlist
  records observed on September 29, 2026. Their overlap was not checked; test
  accounts were not excluded. This is a signup figure, not unique people or
  active users.
- The fixed measurement boundary is `2026-09-29T18:03:46.456294Z`, the timestamp
  returned with the production account count. It must not move on deployment.
- Display `1409 + count(public.users where created_at > boundary)`.
- Count accounts of every plan. Logging in again, linking another provider to
  an existing account, opening another device, or buying a subscription does not
  create an extra count. Separate accounts still count separately.
- The original waitlist contribution is frozen in the baseline. New waitlist
  submissions do not increment this counter. The CRM and its own waitlist
  statistics keep their existing behavior.
- Removing an account created after the boundary removes it from the additional
  count. Removing an older account does not rewrite the historical baseline.

## Implementation and environment boundary

`GET /api/community-stats` returns only `{ count }`. Its server helper uses the
existing service client and an exact HEAD count, without downloading emails or
account rows. No schema migration, auth-flow change, additional secret, Worker,
or extension change is needed.

Each deployment reads its own configured Supabase database. Staging uses the
same display baseline plus new staging registrations for testing; it never
reads production account data. Production uses production registrations after
the original measurement, including any made before this code is released.

The homepage uses this endpoint and labels the figure as sign-ups to AniDachi
and the waitlist. The old `/api/waitlist-stats` remains CRM-only. Successful
responses allow five minutes of shared cache and five minutes of stale
revalidation. Existing staging protection can override caching with no-store.
There is no continuous browser polling.

Database reads time out after 2.5 seconds. On failure or missing count the route
returns 503 with `count: null` and no-store; the component hides the figure until
a valid value is available. It does not present the baseline as a successful
fresh count during an outage.

## Delivery

Implementation is local on `codex/staging-trial-rehearsal`. No staging or
production deployment is included. Before release, verify one new account adds
one, repeat login adds nothing, and the homepage displays the cached value.
Rollback the website change to restore the old waitlist-only homepage counter;
there is no data migration to undo.

Local verification: web TypeScript check passed; web suite passed 821 tests with
six existing skips. Route tests exercise the real Supabase client against stubbed
HTTP, checking the fixed date filter, repeated reads and failure responses.
Read-only production SQL at September 29, 18:14:14 UTC returned zero accounts
after the boundary, giving 1,409 with the new formula. No accounts were created
or changed for verification.

The local Next.js server has no database credentials and correctly returns 503
with the counter hidden. Desktop (1280px) and mobile (390px) rendering were
inspected using a browser-local mocked `{ count: 1409 }` response. The override
was removed afterwards. This proves rendering, not a deployed end-to-end count;
real website/database acceptance remains a staging check.
