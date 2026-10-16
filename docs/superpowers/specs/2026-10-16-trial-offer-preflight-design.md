# Trial offer preflight

Owner approved the in-chat design on October 16, 2026. Implementation and staging only.

Before rendering a cardless trial offer, the website checks account authority and the existing browser/optional installation marker ledger. Missing/old/unreachable extension keeps cookie-only support; supplied invalid proofs fail closed with retry. Preflight never reserves a marker, starts a trial, creates Stripe state or authorizes payment. The existing atomic v2 reservation remains final authority.

Use the existing context bootstrap and signed P-256 proof for a new same-origin, owner-bound POST trial/offer. Read markers through a service-role-only RPC on the private ledger. Consumed unexpired markers yield an explicit priced subscription offer; another pending marker yields retry, not a paid offer. Own pending/active operations take priority and remain recoverable. Deleted-account consumed markers remain effective, expired consumed claims do not, unresolved reservations never expire. Temporary denial receipts support the existing explicit paid purchase path, but never replace the durable preflight.

Checkout shows a compact accessible loading indicator, eligible trial confirmation, ordinary priced subscription, current billing or pending recovery. Race denial after Start briefly explains the changed offer and requires a fresh explicit paid click. No automatic checkout on denial. Network/context failures show Try again, never invented eligibility or denial. Prices and renewal terms remain visible before purchase. Signed-out users retain plan and period through login; eligibility is not promised before authentication.

Pricing and checkout share the preflight client. In-flight work is deduplicated by the existing component generation/owner fences; no new polling or persistent eligibility cache. Pricing expiry retires its offer; refresh on focus or action. Checkout rechecks on action, retains the original request ID for retries, and never resumes a new grant without fresh context/proof.

The extension cannot see website cookie authority. Hosting notices and onboarding therefore use neutral View plans until website verification; links preserve Plus/monthly selection. Existing paid access and free guest joining are unchanged. No permission, price, secret, Worker or room-protocol changes.

Validate read-only SQL, privilege boundaries, marker combinations/expiry/deletion, account switch, invalid proof, offline retry, double click, activation recovery and paid-consent boundaries. Deliver via feature PR to staging, record exact artifact/deployment. Production and Store publication remain separate.
