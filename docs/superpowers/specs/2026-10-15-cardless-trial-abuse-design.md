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
365 days (checked during reservation); pending unknown outcomes never expire
merely because time passed. This supplements the existing account trial ledger.
A different person sharing the same browser/installation can also be denied;
this is the chosen one-trial-per-marker tradeoff. Clearing both markers plus a
new account can bypass v1. Old trials cannot be attributed retroactively.

## User experience

Create/refresh browser context when the trial confirmation is shown. Collect
optional extension proof only for the explicit activation, with a bounded wait.
The final server reservation is authoritative; the display does not grant access.
Used marker: “A free trial has already been used here” and “View plans”.
Pending other-account marker: retry message, never claim it was already used.
Infrastructure/invalid proof: retry, never silently discard a supplied bad proof.
Existing paid access, current trial, recovery, login and normal purchase survive.

## Rollout

Additive migration with enforcement flag off, compatible web/extension release,
then staging enforcement and functional verification. Production unchanged.
Rollback keeps all marker/activation data and recovery; disable enforcement only
as a deliberate temporary weakening before reverting to older code.
