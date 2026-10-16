# Cardless trial abuse protection

Approved by the owner on 2026-10-15. Scope: implementation and staging only.

## Contract

A new cardless trial requires an eligible verified account and a server-issued
browser cookie. When the current extension responds, also use its installation
marker. An absent/old extension must never prevent cookie-only activation.
No CAPTCHA, fingerprint, IP ban, phone check or change to paid entitlements.

Website cookie: host-only, HttpOnly, Secure on HTTPS, SameSite=Lax, Path=/,
365 days. Sign a random 256-bit value with a purpose/origin-separated server key;
store only its digest in the abuse ledger. Never send it to JavaScript.
Extension: a locally generated P-256 key pair is the installation marker.
Keep it across sign-out; uninstall removes it. Sign a short-lived server challenge
bound to website account, cookie, origin and request ID. Only exact configured
website origins may request this signature. It proves possession of a resettable
installation key, not hardware identity or an untampered official extension.
No durable identifier, private key, proof or cookie in URLs, logs or analytics.

Before Stripe creates anything, one database transaction locks the account and
sorted marker digests and reserves them. Another account cannot reserve a used
or pending marker. Same-operation retries resume their original activation.
Only verified creation changes reserved markers to consumed. Unknown outcomes
stay reserved; only the existing verified-failure operator path releases them.
Old activations recover without new markers. New server code always uses the
new reservation; a database flag fences older servers from new unguarded trials.

Marker records survive account deletion. Consumed marker history expires after
365 days (checked during reservation; daily bounded PostgreSQL cleanup removes expired hashes); pending unknown outcomes never expire
merely because time passed. This supplements the existing account trial ledger.
A different person sharing the same browser/installation can also be denied;
this is the chosen one-trial-per-marker tradeoff. Clearing both markers plus a
new account can bypass v1. Old trials cannot be attributed retroactively.

## User experience

Amended by the approved [October 16 preflight design](2026-10-16-trial-offer-preflight-design.md).
Create/refresh browser context and collect optional bounded extension proof before
showing a cardless trial offer, and again for an explicit activation. The preflight
only reads marker history; the final atomic reservation remains authoritative.
Used marker: ordinary priced subscription with explicit Subscribe confirmation.
Pending other-account marker or infrastructure/invalid proof: retry, never a
paid-only decision or silent discard of a supplied invalid proof. A race after
Start explains the changed offer before any new paid confirmation.
A signed ten-minute account/browser-bound HttpOnly receipt enables the existing
server-only ordinary purchase RPC; eligibility is rechecked independently of
receipt expiry. Existing paid access, current trial, recovery, login and guest
joining survive. Extension/onboarding use neutral View plans until website checks.

## Rollout

Additive migration with enforcement flag off, compatible web/extension release,
then staging enforcement and functional verification. Production unchanged.
Rollback keeps all marker/activation data and recovery; disable enforcement only
as a deliberate temporary weakening before reverting to older code.
