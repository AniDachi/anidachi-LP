# Maintenance admission preparation

This is the application admission slice of
[production preparation Task 3](../../superpowers/plans/2026-09-12-production-promotion-preparation.md).
It is disabled by default. Delivering this code does not install an external
traffic freeze, stop live rooms, authorize a database transition, or close the
hosted recovery and physical-media acceptance gates.

## Contract

Web and Worker consume the server-only `ANIDACHI_MAINTENANCE_MODE` variable
through one shared pure protocol helper.

| Configuration | Effective mode |
| --- | --- |
| Unset, empty string, or exact `open` | Existing behavior |
| Exact `closed` | Refuse application admission |
| Any other nonempty value | Refuse application admission |

Denied requests receive HTTP `503`, `Cache-Control: no-store`, `Retry-After: 60`
and `X-Anidachi-Maintenance: closed`. Web responses also retain
`X-Robots-Tag: noindex, nofollow`. API responses use:

```json
{
  "error": "MAINTENANCE",
  "message": "AniDachi is temporarily unavailable. Please try again shortly."
}
```

Web document requests receive a self-contained temporary HTML page. The check
runs before staging configuration, JWT verification, session refresh, redirects
and page rendering. It covers mutating GETs as well as POST/PATCH/DELETE,
including OAuth callbacks, extension connection, history, billing, invitations,
internal delivery and server actions. Closed mode has no query, cookie, bearer,
internal-secret or administrator bypass. No session cookies are changed.

The existing middleware asset/metadata exclusions remain in place. The excluded
robots and sitemap generators use local metadata and do not mutate product
state. Next.js image optimization can still fetch allowlisted images and update
its image cache; this gate is not a complete HTTP-egress or cache-write fence.

Worker HTTP admission is checked before room, ICE, WebSocket and internal route
handlers. Existing CORS preflight and read-only `GET /` health remain available;
health identifies only this deployment's configured admission mode. The
notification recovery timer skips outgoing HTTP delivery while closed, leaving
the durable Web outbox intact. Its open-mode timeout and retry behavior remain.

## Data and retry boundaries

- A rejected Stripe webhook is not consumed or acknowledged as processed. Stripe
  retries failed deliveries, for up to three days in LIVE and a shorter window
  in Sandbox. Keep the destination enabled, inspect the actual failed events,
  and verify backlog processing after reopening; a `503` alone does not prove
  eventual delivery.
- The existing extension client classifies `503` as retryable and retains
  unacknowledged history entries. The response does not grant capture access:
  normal lease expiry, account-generation, consent and entitlement fences still
  apply. This is not a promise to record arbitrary viewing through a long outage
  or replay old-generation events after the production transition.
- The website client retains the HTTP failure rather than starting an auth
  refresh for `503`. Existing editor drafts and error handling remain under
  their current account-owner guards.
- In-flight requests admitted before closure can finish. The admission flag
  neither locks the database nor stops external writes, Postgres cron, existing
  WebSockets, Durable Object alarms or already dispatched callbacks.

## Operating sequence and remaining gates

1. Complete independent hosted update-and-restore rehearsal. Free project
   capacity or a separately approved paid target is an operational choice;
   implementing this gate requires neither a new project nor a plan upgrade.
2. Prepare and verify external controls against every production-connected Web
   deployment and Worker ingress. An environment variable on a new deployment
   does not change old deployment URLs or cancel queued builds. GitHub Team's
   private-repository deployment-reviewer limitation must be accounted for
   before repository visibility or release controls change.
3. Establish a separately reviewed admission-drain procedure on the existing
   compatible runtime. Let rooms finish normally and verify pending callbacks,
   jobs and transactions have settled. A Worker code deployment disconnects
   WebSockets; never use it as the draining mechanism.
4. Close external traffic, stop relevant schedules, drain in-flight work and
   take a fresh recoverable checkpoint before the preservation/migration chain.
   The current code can only be delivered in the reviewed compatible order.
5. Keep the accepted candidate closed through deployment and read-only checks.
   A controlled, authenticated probe path under continuing external maintenance
   is a separate unimplemented prerequisite; this slice deliberately provides
   no bypass. Do not open public admission just to run a positive write probe.
6. Reopen only after the database/runtime probes pass. Restore the one approved
   notification scheduler and reconcile deferred work. Recheck historical
   deployment exposure and record the actual deployed mode and release IDs.

No dashboard variable, Worker publication setting, webhook, scheduler or
production runtime is changed by this source preparation.

## Verification boundary

Local checks exercise shared configuration parsing, actual Web middleware early
returns, Worker admission, scheduler suppression and existing client retry
semantics. Protocol tests (183), API tests (229), native Workerd tests (63) and
focused extension client tests (122) passed. The Web suite passed 567 tests with
six existing optional evidence skips; a final middleware-only noindex change
passed its five focused tests. All four package typechecks and the local Next.js
production build passed. Independent source/contract review found no actionable
issues. These are local preparation results, not deployed acceptance.

Staging closed-mode activation, external denial, live drain, hosted
recovery, operator probes and production reopening require separate evidence in
the [transition runbook](production-35-to-60-transition.md).

## References

- [Next.js middleware responses](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware#producing-a-response)
- [Cloudflare WebSocket behavior on deployment](https://developers.cloudflare.com/durable-objects/best-practices/websockets/#websocket-disconnection-on-deploy)
- [Stripe automatic webhook retries](https://docs.stripe.com/webhooks#automatic-retries)
- [GitHub environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
