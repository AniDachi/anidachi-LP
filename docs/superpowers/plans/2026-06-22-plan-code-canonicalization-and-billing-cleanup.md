# Plan Code Canonicalization And Billing Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace legacy AniDachi subscription names and internal codes with clean `free`, `plus`, and `pro` plan codes across active runtime code, billing, database state, extension contracts, and product UI without breaking existing Stripe events, rooms, or installed staging extensions.

**Architecture:** Treat this as a compatibility migration, not a string replacement. First add canonical plan helpers that accept old values and emit new values, then migrate database rows and runtime contracts, then remove legacy fallbacks after staging and production have both run the bridge code. Historical applied migrations may retain old strings as immutable history; active code, active docs, UI, env names, and new data must use `free`, `plus`, and `pro`.

**Tech Stack:** Next.js 15, TypeScript, Supabase Postgres migrations/RLS, Stripe Checkout/webhooks, Vercel Preview/Production env vars, Cloudflare Worker/Durable Objects, WXT extension, `@anidachi/protocol`, pnpm/Turborepo, Vitest/tsx tests.

---

## Evidence Reviewed

Project files reviewed before writing this plan:

- `AGENTS.md`
- `docs/project-operating-manual.md`
- `docs/current-development-state.md`
- `docs/project-architecture-and-development.md`
- `docs/environment-and-secrets-matrix.md`
- `docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md`
- `apps/web/lib/anidachi-auth/plan-entitlements.ts`
- `apps/web/lib/anidachi-auth/stripe-plans.ts`
- `apps/web/lib/anidachi-auth/stripe-env.ts`
- `apps/web/app/api/create-checkout-session/route.ts`
- `apps/web/app/api/stripe/webhook/route.ts`
- `apps/web/app/api/save-discord-credentials/route.ts`
- `apps/web/lib/anidachi-auth/db.ts`
- `apps/web/supabase/migrations/20260525_anidachi_auth.sql`
- `apps/web/supabase/migrations/20260620_billing_entitlements.sql`
- `apps/web/supabase/migrations/20260623_room_capabilities.sql`
- `packages/protocol/src/types.ts`
- `apps/api/src/room-state.ts`
- `apps/extension/src/auth-tokens.ts`
- `apps/extension/src/watch-library-client.ts`
- `apps/web/components/pricing.tsx`
- `apps/web/components/nav-bar-client.tsx`
- `apps/web/components/plan-survey/plan-survey-modal.tsx`
- `apps/web/lib/home-survey.ts`
- `apps/web/lib/kreatli-crm/survey-lead-shared.ts`
- `apps/web/scripts/stripe/create-crunchyroll-subscriber-price.ts`
- `apps/web/scripts/stripe/create-anime-junkie-price.ts`
- `apps/web/scripts/stripe/register-subscription-webhook.ts`

Graphify query checked:

```bash
graphify query "Trace AniDachi subscription plan codes watcher nakama junkie plus pro across web api extension protocol database migrations Stripe checkout webhook"
```

Official docs checked:

- Stripe Checkout subscriptions: `https://docs.stripe.com/payments/checkout/build-subscriptions`
- Stripe webhooks: `https://docs.stripe.com/webhooks`
- Stripe API keys and test/live separation: `https://docs.stripe.com/keys`
- Vercel environments: `https://vercel.com/docs/deployments/environments`
- Vercel environment variables: `https://vercel.com/docs/environment-variables`
- Supabase migrations: `https://supabase.com/docs/guides/deployment/database-migrations`
- Supabase Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- PostgreSQL `ALTER TABLE` and `NOT VALID` constraints: `https://www.postgresql.org/docs/current/sql-altertable.html`

## Current Problems

The current product names are inconsistent:

- Runtime plan codes are `watcher`, `nakama`, and `junkie`.
- Product labels are partly `Free`, `Plus`, and `Pro`.
- Public/marketing UI still contains `Crunchyroll Subscriber` and `Anime Junkie`.
- Checkout accepts legacy tier ids `crunchyroll_subscriber` and `anime_junkie`.
- Stripe scripts still create legacy product/price names.
- Supabase check constraints only allow old runtime codes.
- The Worker, protocol package, extension auth tokens, room harness, room quota tests, and watch library fallbacks all reference old codes.
- `apps/web/app/api/save-discord-credentials/route.ts` still creates a Stripe client using `NODE_ENV` and the old unsuffixed `STRIPE_SECRET_KEY`, while the main checkout/webhook code now uses the safer mode-aware `stripe-env.ts` helper.

The correct target model is:

```txt
Canonical DB/API/protocol codes: free | plus | pro
Paid canonical codes: plus | pro
Display labels: Free | Plus | Pro
Stripe products: AniDachi Plus | AniDachi Pro
Stripe price nicknames: anidachi_plus_monthly | anidachi_pro_monthly
```

Temporary legacy input mapping:

```txt
watcher -> free
nakama -> plus
junkie -> pro
crunchyroll_subscriber -> plus
anime_junkie -> pro
```

## Hard Rules

- Do not push directly to `main`.
- Branch from latest `staging`.
- Do not force-push `staging` or `main`.
- Do not edit already-applied Supabase migration files to rewrite history. Add new migrations.
- Do not remove legacy fallbacks before staging and production both run bridge code.
- Do not expose Stripe secrets, Supabase service-role keys, OAuth secrets, JWT signing secrets, Cloudflare tokens, or TURN secrets to browser or extension bundles.
- Staging must remain password-gated and noindex.
- The extension must tolerate old stored auth tokens during the transition.
- Stripe webhooks must remain idempotent and signature-verified.
- Stripe test and live keys/objects must stay structurally separated by env name and runtime mode.

## File Structure

Create:

- `apps/web/lib/anidachi-auth/plan-codes.ts`  
  Canonical and legacy plan-code parsing/mapping for the web app.

- `apps/web/lib/anidachi-auth/plan-codes.test.ts`  
  Unit tests for old-to-new mapping and paid-plan parsing.

- `apps/web/supabase/migrations/20260622_plan_code_canonicalization_bridge.sql`  
  First database migration: broaden constraints, canonicalize existing data, keep old inputs allowed during bridge window.

- `apps/web/supabase/migrations/20260622_plan_code_canonicalization_tighten.sql`  
  Second database migration: tighten constraints to canonical codes only. Apply only after the bridge release is deployed to staging and production and old extension builds are no longer expected to write old codes.

- `apps/web/scripts/stripe/ensure-subscription-prices.ts`  
  Replacement Stripe script that creates/verifies `AniDachi Plus` and `AniDachi Pro` monthly prices for either test or live mode.

Modify:

- `apps/web/lib/anidachi-auth/plan-entitlements.ts`
- `apps/web/lib/anidachi-auth/plan-entitlements.test.ts`
- `apps/web/lib/anidachi-auth/stripe-plans.ts`
- `apps/web/lib/anidachi-auth/stripe-plans.test.ts`
- `apps/web/lib/anidachi-auth/extension-session.ts`
- `apps/web/lib/anidachi-auth/db.ts`
- `apps/web/lib/room-quota.ts`
- `apps/web/lib/room-quota.test.ts`
- `apps/web/lib/anidachi-auth/watch-library.ts`
- `apps/web/lib/anidachi-auth/watch-library.test.ts`
- `apps/web/app/api/create-checkout-session/route.ts`
- `apps/web/app/api/stripe/webhook/route.ts`
- `apps/web/app/api/save-discord-credentials/route.ts`
- `apps/web/app/account/layout.tsx`
- `apps/web/app/account/watch-library/watch-library-client.tsx`
- `apps/web/components/pricing.tsx`
- `apps/web/components/nav-bar-client.tsx`
- `apps/web/components/plan-survey/plan-survey-modal.tsx`
- `apps/web/components/json-ld.tsx`
- `apps/web/lib/home-survey.ts`
- `apps/web/lib/kreatli-crm/survey-lead-shared.ts`
- `apps/web/scripts/stripe/register-subscription-webhook.ts`
- `apps/web/package.json`
- `apps/web/.env.example`
- `packages/protocol/src/types.ts`
- `packages/protocol/test/protocol.test.ts`
- `apps/api/src/room-state.ts`
- `apps/api/test/room-state.test.ts`
- `apps/api/test/auth.test.ts`
- `apps/extension/src/auth-tokens.ts`
- `apps/extension/src/watch-library-client.ts`
- `apps/extension/test/auth-client.test.ts`
- `scripts/room-signaling-harness.mjs`
- `docs/current-development-state.md`
- `docs/environment-and-secrets-matrix.md`
- `docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md`

Delete after replacement:

- `apps/web/scripts/stripe/create-crunchyroll-subscriber-price.ts`
- `apps/web/scripts/stripe/create-anime-junkie-price.ts`

## Task 0: Branch And Baseline Hygiene

**Files:**
- No source edits.

- [x] **Step 1: Confirm current working tree before touching source**

Run:

```bash
git status --short --branch
```

Expected:

```txt
## codex/... or staging
```

If only `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`, and `graphify-out/manifest.json` are dirty, record that they were pre-existing dirty graph artifacts. Do not stage them with this migration unless this migration intentionally refreshes the team graph artifacts at the end.

- [x] **Step 2: Start from latest staging**

Run:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c codex/plan-code-canonicalization
```

Expected:

```txt
Switched to a new branch 'codex/plan-code-canonicalization'
```

- [x] **Step 3: Install with the repo-pinned package manager**

Run:

```bash
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install --frozen-lockfile
```

Expected: install completes without lockfile changes.

- [x] **Step 4: Run focused baseline checks**

Run:

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
pnpm dev:check
```

Expected: all commands pass before source changes. If a baseline fails, stop and record the failure in the PR before continuing.

## Task 1: Centralize Canonical Plan Code Parsing

**Files:**
- Create: `apps/web/lib/anidachi-auth/plan-codes.ts`
- Create: `apps/web/lib/anidachi-auth/plan-codes.test.ts`
- Modify: `apps/web/lib/anidachi-auth/plan-entitlements.ts`
- Modify: `apps/web/lib/anidachi-auth/plan-entitlements.test.ts`

- [x] **Step 1: Create failing tests for canonical and legacy values**

Create `apps/web/lib/anidachi-auth/plan-codes.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_PLAN_CODE,
  PAID_PLAN_CODES,
  checkoutInputToPaidPlanCode,
  isCanonicalPlanCode,
  isPaidPlanCode,
  normalizePlanCode,
  normalizePaidPlanCode,
} from "./plan-codes";

test("normalizes old plan codes to canonical plan codes", () => {
  assert.equal(normalizePlanCode("watcher"), "free");
  assert.equal(normalizePlanCode("nakama"), "plus");
  assert.equal(normalizePlanCode("junkie"), "pro");
});

test("accepts canonical plan codes unchanged", () => {
  assert.equal(normalizePlanCode("free"), "free");
  assert.equal(normalizePlanCode("plus"), "plus");
  assert.equal(normalizePlanCode("pro"), "pro");
});

test("defaults unknown plan values to free", () => {
  assert.equal(FREE_PLAN_CODE, "free");
  assert.equal(normalizePlanCode("unknown"), "free");
  assert.equal(normalizePlanCode(null), "free");
});

test("paid plan parser rejects free and accepts plus/pro legacy aliases", () => {
  assert.deepEqual(PAID_PLAN_CODES, ["plus", "pro"]);
  assert.equal(normalizePaidPlanCode("plus"), "plus");
  assert.equal(normalizePaidPlanCode("pro"), "pro");
  assert.equal(normalizePaidPlanCode("nakama"), "plus");
  assert.equal(normalizePaidPlanCode("junkie"), "pro");
  assert.equal(normalizePaidPlanCode("free"), null);
  assert.equal(normalizePaidPlanCode("watcher"), null);
});

test("checkout parser keeps legacy public tier ids as bridge inputs", () => {
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "plus" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "pro" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "nakama" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "junkie" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ tier: "crunchyroll_subscriber" }), "plus");
  assert.equal(checkoutInputToPaidPlanCode({ tier: "anime_junkie" }), "pro");
  assert.equal(checkoutInputToPaidPlanCode({ planCode: "free" }), null);
});

test("type guards only expose canonical names", () => {
  assert.equal(isCanonicalPlanCode("free"), true);
  assert.equal(isCanonicalPlanCode("watcher"), false);
  assert.equal(isPaidPlanCode("plus"), true);
  assert.equal(isPaidPlanCode("nakama"), false);
});
```

- [x] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm --filter @anidachi/web test -- lib/anidachi-auth/plan-codes.test.ts
```

Expected: FAIL because `plan-codes.ts` does not exist.

- [x] **Step 3: Create the canonical plan-code helper**

Create `apps/web/lib/anidachi-auth/plan-codes.ts`:

```ts
export type CanonicalPlanCode = "free" | "plus" | "pro";
export type PlanCode = CanonicalPlanCode;
export type PaidPlanCode = Exclude<PlanCode, "free">;
export type LegacyPlanCode = "watcher" | "nakama" | "junkie";
export type AcceptedPlanCode = PlanCode | LegacyPlanCode;
export type LegacyCheckoutTier = "crunchyroll_subscriber" | "anime_junkie";

export const FREE_PLAN_CODE: PlanCode = "free";
export const PAID_PLAN_CODES = ["plus", "pro"] as const satisfies readonly PaidPlanCode[];

const LEGACY_PLAN_TO_CANONICAL: Record<LegacyPlanCode, PlanCode> = {
  watcher: "free",
  nakama: "plus",
  junkie: "pro",
};

const LEGACY_TIER_TO_CANONICAL: Record<LegacyCheckoutTier, PaidPlanCode> = {
  crunchyroll_subscriber: "plus",
  anime_junkie: "pro",
};

export function isCanonicalPlanCode(value: unknown): value is PlanCode {
  return value === "free" || value === "plus" || value === "pro";
}

export function isLegacyPlanCode(value: unknown): value is LegacyPlanCode {
  return value === "watcher" || value === "nakama" || value === "junkie";
}

export function isAcceptedPlanCode(value: unknown): value is AcceptedPlanCode {
  return isCanonicalPlanCode(value) || isLegacyPlanCode(value);
}

export function isPaidPlanCode(value: unknown): value is PaidPlanCode {
  return value === "plus" || value === "pro";
}

export function normalizePlanCode(value: unknown): PlanCode {
  if (isCanonicalPlanCode(value)) return value;
  if (isLegacyPlanCode(value)) return LEGACY_PLAN_TO_CANONICAL[value];
  return FREE_PLAN_CODE;
}

export function normalizePaidPlanCode(value: unknown): PaidPlanCode | null {
  const planCode = normalizePlanCode(value);
  return isPaidPlanCode(planCode) ? planCode : null;
}

export function legacyTierToPlanCode(tier: unknown): PaidPlanCode | null {
  if (tier === "crunchyroll_subscriber") return LEGACY_TIER_TO_CANONICAL[tier];
  if (tier === "anime_junkie") return LEGACY_TIER_TO_CANONICAL[tier];
  return null;
}

export function checkoutInputToPaidPlanCode(input: {
  planCode?: unknown;
  tier?: unknown;
}): PaidPlanCode | null {
  return normalizePaidPlanCode(input.planCode) ?? legacyTierToPlanCode(input.tier);
}
```

- [x] **Step 4: Update `plan-entitlements.ts` to use canonical names**

In `apps/web/lib/anidachi-auth/plan-entitlements.ts`, import plan-code types and helpers from `./plan-codes`, remove local `watcher/nakama/junkie` type definitions, and make `PLAN_ENTITLEMENTS` canonical:

```ts
import {
  FREE_PLAN_CODE,
  type LegacyCheckoutTier,
  type PaidPlanCode,
  type PlanCode,
  checkoutInputToPaidPlanCode,
  isCanonicalPlanCode,
  isPaidPlanCode,
  legacyTierToPlanCode,
  normalizePlanCode,
} from "./plan-codes";

export {
  FREE_PLAN_CODE,
  checkoutInputToPaidPlanCode,
  isPaidPlanCode,
  legacyTierToPlanCode,
  normalizePlanCode,
};
export type { LegacyCheckoutTier, PaidPlanCode, PlanCode };
```

Then replace the entitlement keys and ranks:

```ts
export const PLAN_ENTITLEMENTS: Record<PlanCode, PlanEntitlements> = {
  free: {
    planCode: "free",
    label: "Free",
    room: {
      dailyHostSeconds: 30 * 60,
      maxParticipants: 4,
      maxMediaSeats: 0,
      canNameRoom: false,
      canSendPushInvites: false,
    },
    account: {
      maxOwnedGroups: 1,
      maxActiveTrackedTitles: 3,
      historyRetentionDays: 7,
    },
  },
  plus: {
    planCode: "plus",
    label: "Plus",
    room: {
      dailyHostSeconds: "unlimited",
      maxParticipants: 6,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    },
    account: {
      maxOwnedGroups: 5,
      maxActiveTrackedTitles: 15,
      historyRetentionDays: 92,
    },
  },
  pro: {
    planCode: "pro",
    label: "Pro",
    room: {
      dailyHostSeconds: "unlimited",
      maxParticipants: 15,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    },
    account: {
      maxOwnedGroups: 15,
      maxActiveTrackedTitles: 50,
      historyRetentionDays: 366,
    },
  },
};

const PLAN_RANK: Record<PlanCode, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};
```

Make `getPlanEntitlements` and capability validation normalize old input but emit canonical output:

```ts
export function isPlanCode(value: unknown): value is PlanCode {
  return isCanonicalPlanCode(value);
}

export function getPlanEntitlements(planCode: unknown): PlanEntitlements {
  return PLAN_ENTITLEMENTS[normalizePlanCode(planCode)];
}
```

- [x] **Step 5: Update entitlement tests**

In `apps/web/lib/anidachi-auth/plan-entitlements.test.ts`, replace old assertions:

```ts
const free = getPlanEntitlements("free");
const plus = getPlanEntitlements("plus");
const pro = getPlanEntitlements("pro");

assert.equal(getPlanEntitlements("watcher").planCode, "free");
assert.equal(getPlanEntitlements("nakama").planCode, "plus");
assert.equal(getPlanEntitlements("junkie").planCode, "pro");
assert.equal(getPlanEntitlements("unknown").planCode, "free");

assert.deepEqual(roomCapabilitiesForPlan("free"), {
  hostPlanCode: "free",
  maxParticipants: 4,
  maxMediaSeats: 0,
  canNameRoom: false,
  canSendPushInvites: false,
});

assert.deepEqual(roomCapabilitiesForPlan("pro"), {
  hostPlanCode: "pro",
  maxParticipants: 15,
  maxMediaSeats: 4,
  canNameRoom: true,
  canSendPushInvites: true,
});

assert.equal(maxPlanCode(["free", "plus"]), "plus");
assert.equal(maxPlanCode(["pro", "plus", "free"]), "pro");
```

- [x] **Step 6: Run web plan-code tests**

Run:

```bash
pnpm --filter @anidachi/web test -- lib/anidachi-auth/plan-codes.test.ts lib/anidachi-auth/plan-entitlements.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit Task 1**

Run:

```bash
git add apps/web/lib/anidachi-auth/plan-codes.ts apps/web/lib/anidachi-auth/plan-codes.test.ts apps/web/lib/anidachi-auth/plan-entitlements.ts apps/web/lib/anidachi-auth/plan-entitlements.test.ts
git commit -m "refactor(web): introduce canonical subscription plan codes"
```

## Task 2: Update Stripe Plan Mapping And Checkout Inputs

**Files:**
- Modify: `apps/web/lib/anidachi-auth/stripe-plans.ts`
- Modify: `apps/web/lib/anidachi-auth/stripe-plans.test.ts`
- Modify: `apps/web/app/api/create-checkout-session/route.ts`
- Modify: `apps/web/app/api/stripe/webhook/route.ts`
- Modify: `apps/web/app/api/save-discord-credentials/route.ts`

- [x] **Step 1: Update Stripe plan mapping tests first**

In `apps/web/lib/anidachi-auth/stripe-plans.test.ts`, change expectations so Plus/Pro map to canonical codes:

```ts
assert.equal(stripePriceIdForPlanCode("plus"), "price_plus_test");
assert.equal(stripePriceIdForPlanCode("pro"), "price_pro_test");
assert.equal(stripePlanCodeForPriceId("price_plus_test"), "plus");
assert.equal(stripePlanCodeForPriceId("price_pro_test"), "pro");

assert.equal(effectivePlanForSubscription({ planCode: "plus", status: "active" }), "plus");
assert.equal(effectivePlanForSubscription({ planCode: "pro", status: "trialing" }), "pro");
assert.equal(effectivePlanForSubscription({ planCode: "pro", status: "unpaid" }), "free");
assert.equal(
  effectivePlanFromSubscriptions([
    { planCode: "plus", status: "active" },
    { planCode: "pro", status: "canceled" },
  ]),
  "plus",
);
assert.equal(
  effectivePlanFromSubscriptions([
    { planCode: "plus", status: "active" },
    { planCode: "pro", status: "trialing" },
  ]),
  "pro",
);
```

Add explicit metadata bridge tests:

```ts
assert.equal(planCodeFromStripeMetadata({ planCode: "nakama" }), "plus");
assert.equal(planCodeFromStripeMetadata({ planCode: "junkie" }), "pro");
assert.equal(planCodeFromStripeMetadata({ planCode: "watcher" }), "free");
```

- [x] **Step 2: Run Stripe plan tests and verify failure**

Run:

```bash
pnpm --filter @anidachi/web test -- lib/anidachi-auth/stripe-plans.test.ts
```

Expected: FAIL because implementation still emits `nakama/junkie/watcher`.

- [x] **Step 3: Update Stripe mapping implementation**

In `apps/web/lib/anidachi-auth/stripe-plans.ts`, use canonical paid codes:

```ts
import {
  FREE_PLAN_CODE,
  type PaidPlanCode,
  type PlanCode,
  isPaidPlanCode,
  maxPlanCode,
  normalizePlanCode,
  normalizePaidPlanCode,
} from "./plan-entitlements";
```

Change `stripePriceIdForPlanCode`:

```ts
export function stripePriceIdForPlanCode(planCode: PaidPlanCode): string | null {
  if (planCode === "plus") {
    return (
      stripeEnvForMode("STRIPE_PRICE_ID_PLUS") ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS ??
      process.env.STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      null
    );
  }

  return (
    stripeEnvForMode("STRIPE_PRICE_ID_PRO") ??
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO ??
    process.env.STRIPE_PRICE_ID_ANIME_JUNKIE ??
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE ??
    null
  );
}
```

Change price lookup:

```ts
if (plusIds.includes(priceId)) return "plus";
if (proIds.includes(priceId)) return "pro";
```

Change metadata parsing:

```ts
export function planCodeFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined,
): PlanCode | null {
  if (!metadata?.planCode) return null;
  return normalizePlanCode(metadata.planCode);
}

export function paidPlanCodeFromStripeSubscription(
  subscription: Stripe.Subscription,
): PaidPlanCode | null {
  const firstPriceId = subscription.items.data[0]?.price.id;
  const fromPrice = stripePlanCodeForPriceId(firstPriceId);
  if (fromPrice) return fromPrice;

  return normalizePaidPlanCode(subscription.metadata.planCode);
}
```

- [x] **Step 4: Update checkout route typing**

In `apps/web/app/api/create-checkout-session/route.ts`, keep `tier` accepted as a bridge input, but return canonical `planCode`:

```ts
const body = (await request.json()) as {
  tier?: LegacyCheckoutTier;
  planCode?: unknown;
};
```

Keep checkout metadata as canonical:

```ts
metadata: {
  userId: authSession.userId,
  planCode,
},
subscription_data: {
  metadata: {
    userId: authSession.userId,
    planCode,
  },
},
```

Expected runtime behavior: any old UI still sending `tier: "crunchyroll_subscriber"` creates a `plus` subscription; any old UI still sending `tier: "anime_junkie"` creates a `pro` subscription.

- [x] **Step 5: Update webhook route to store canonical plans**

In `apps/web/app/api/stripe/webhook/route.ts`, keep the current event handling but verify `planCode` passed to `upsertSubscription` is canonical by relying on updated `paidPlanCodeFromStripeSubscription` and `planCodeFromStripeMetadata`.

Add a narrow defensive normalization before write:

```ts
const planCode = paidPlanCode ?? metadataPlanCode;
```

Expected: `planCode` is now `plus`, `pro`, or `free`; paid subscriptions should be `plus` or `pro`.

- [x] **Step 6: Move `save-discord-credentials` onto mode-aware Stripe config**

Replace the local Stripe helper in `apps/web/app/api/save-discord-credentials/route.ts`:

```ts
import { createStripeClient } from "@/lib/anidachi-auth/stripe-env";
```

Use the shared helper:

```ts
let stripe: Stripe;
try {
  stripe = createStripeClient();
} catch (error) {
  console.error("[save-discord-credentials] Stripe is not configured:", error);
  return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
}
```

Remove the local `getStripeSecretKey` and local `createStripeClient` functions.

- [x] **Step 7: Run Stripe and route-related checks**

Run:

```bash
pnpm --filter @anidachi/web test -- lib/anidachi-auth/stripe-plans.test.ts lib/anidachi-auth/stripe-env.test.ts
pnpm --filter @anidachi/web check
```

Expected: PASS.

- [x] **Step 8: Commit Task 2**

Run:

```bash
git add apps/web/lib/anidachi-auth/stripe-plans.ts apps/web/lib/anidachi-auth/stripe-plans.test.ts apps/web/app/api/create-checkout-session/route.ts apps/web/app/api/stripe/webhook/route.ts apps/web/app/api/save-discord-credentials/route.ts
git commit -m "fix(web): canonicalize Stripe subscription plan mapping"
```

## Task 3: Add Supabase Bridge Migration

**Files:**
- Create: `apps/web/supabase/migrations/20260622_plan_code_canonicalization_bridge.sql`
- Modify: `apps/web/lib/anidachi-auth/db.ts`

- [x] **Step 1: Create bridge migration**

Create `apps/web/supabase/migrations/20260622_plan_code_canonicalization_bridge.sql`:

```sql
-- Canonicalize AniDachi subscription plan codes.
--
-- Bridge window:
-- - old writes are still accepted so existing deployed clients do not break;
-- - existing rows are backfilled to canonical values;
-- - new app code writes only free/plus/pro.

alter table public.users
  drop constraint if exists users_plan_check;

alter table public.users
  add constraint users_plan_check
  check (plan in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

alter table public.users
  alter column plan set default 'free';

update public.users
set plan = case plan
  when 'watcher' then 'free'
  when 'nakama' then 'plus'
  when 'junkie' then 'pro'
  else plan
end
where plan in ('watcher', 'nakama', 'junkie');

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_code_check;

alter table public.subscriptions
  add constraint subscriptions_plan_code_check
  check (plan_code in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

update public.subscriptions
set plan_code = case plan_code
  when 'watcher' then 'free'
  when 'nakama' then 'plus'
  when 'junkie' then 'pro'
  else plan_code
end
where plan_code in ('watcher', 'nakama', 'junkie');

alter table public.rooms
  drop constraint if exists rooms_host_plan_code_check;

alter table public.rooms
  add constraint rooms_host_plan_code_check
  check (host_plan_code in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

alter table public.rooms
  alter column host_plan_code set default 'free';

update public.rooms
set host_plan_code = case host_plan_code
  when 'watcher' then 'free'
  when 'nakama' then 'plus'
  when 'junkie' then 'pro'
  else host_plan_code
end
where host_plan_code in ('watcher', 'nakama', 'junkie');
```

- [x] **Step 2: Update typed row shapes**

In `apps/web/lib/anidachi-auth/db.ts`, keep `plan`, `plan_code`, and `host_plan_code` typed as canonical `PlanCode`. No old-code type should leak from typed row shapes.

Expected declarations:

```ts
plan: PlanCode;
plan_code: PlanCode;
host_plan_code: PlanCode;
```

- [x] **Step 3: Add a local SQL review command**

Run:

```bash
rg -n "watcher|nakama|junkie" apps/web/supabase/migrations/20260622_plan_code_canonicalization_bridge.sql apps/web/lib/anidachi-auth/db.ts
```

Expected:

```txt
apps/web/supabase/migrations/20260622_plan_code_canonicalization_bridge.sql:...
```

Only the bridge migration should mention old plan codes in this task output.

- [x] **Step 4: Commit Task 3**

Run:

```bash
git add apps/web/supabase/migrations/20260622_plan_code_canonicalization_bridge.sql apps/web/lib/anidachi-auth/db.ts
git commit -m "feat(db): bridge subscription plan codes to canonical values"
```

## Task 4: Update Protocol, Worker, Room Quota, And Extension Bridge

**Files:**
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Modify: `apps/api/src/room-state.ts`
- Modify: `apps/api/test/room-state.test.ts`
- Modify: `apps/api/test/auth.test.ts`
- Modify: `apps/web/lib/room-quota.ts`
- Modify: `apps/web/lib/room-quota.test.ts`
- Modify: `apps/web/lib/anidachi-auth/extension-session.ts`
- Modify: `apps/extension/src/auth-tokens.ts`
- Modify: `apps/extension/src/watch-library-client.ts`
- Modify: `apps/extension/test/auth-client.test.ts`
- Modify: `scripts/room-signaling-harness.mjs`

- [x] **Step 1: Update protocol schema**

In `packages/protocol/src/types.ts`, change room capability plan schema:

```ts
const CanonicalPlanCodeSchema = z.enum(["free", "plus", "pro"]);
const LegacyPlanCodeSchema = z.enum(["watcher", "nakama", "junkie"]);

export const RoomCapabilitiesSchema = z.object({
  hostPlanCode: z.union([CanonicalPlanCodeSchema, LegacyPlanCodeSchema]).transform((value) => {
    if (value === "watcher") return "free";
    if (value === "nakama") return "plus";
    if (value === "junkie") return "pro";
    return value;
  }),
  maxParticipants: z.number().int().min(1).max(50),
  maxMediaSeats: z.number().int().min(0).max(16),
  canNameRoom: z.boolean(),
  canSendPushInvites: z.boolean(),
});
```

Expected effect: old signed room tokens can still parse, but parsed server/client snapshots use canonical `free/plus/pro`.

- [x] **Step 2: Update protocol tests**

In `packages/protocol/test/protocol.test.ts`, replace capability expectations:

```ts
hostPlanCode: "pro",
```

Add a legacy parse assertion:

```ts
const parsed = RoomCapabilitiesSchema.parse({
  hostPlanCode: "junkie",
  maxParticipants: 15,
  maxMediaSeats: 4,
  canNameRoom: true,
  canSendPushInvites: true,
});
assert.equal(parsed.hostPlanCode, "pro");
```

- [x] **Step 3: Update Worker fallback capabilities**

In `apps/api/src/room-state.ts`, change the fallback:

```ts
export const LEGACY_ROOM_CAPABILITIES: RoomCapabilities = {
  hostPlanCode: "free",
  maxParticipants: 4,
  maxMediaSeats: 4,
  canNameRoom: false,
  canSendPushInvites: false,
};
```

Keep the comment explaining old room tokens. The fallback object name may remain `LEGACY_ROOM_CAPABILITIES` because it describes old tokens, not a product plan.

- [x] **Step 4: Update room quota helpers and tests**

In `apps/web/lib/room-quota.ts`, change metered free logic to canonical:

```ts
export function isMeteredPlan(plan: PlanCode): boolean {
  return plan === "free";
}
```

In `apps/web/lib/room-quota.test.ts`, replace plan values:

```ts
assert.equal(planDailyHostSeconds("free"), 30 * 60);
assert.equal(isMeteredPlan("free"), true);
assert.equal(isMeteredPlan("plus"), false);
assert.equal(isMeteredPlan("pro"), false);
```

- [x] **Step 5: Update web extension session parsing**

In `apps/web/lib/anidachi-auth/extension-session.ts`, replace old-plan validation with canonical normalization:

```ts
import { normalizePlanCode } from "./plan-entitlements";
```

When reading token payload:

```ts
const plan = normalizePlanCode(payload.plan);
```

Expected: old extension tokens still refresh into canonical user data.

- [x] **Step 6: Update extension auth token normalization**

In `apps/extension/src/auth-tokens.ts`, use canonical output with legacy input tolerance:

```ts
export type AuthenticatedUserPlan = "free" | "plus" | "pro";

function normalizePlan(value: unknown): AuthenticatedUserPlan | null {
  if (value === "free" || value === "watcher") return "free";
  if (value === "plus" || value === "nakama") return "plus";
  if (value === "pro" || value === "junkie") return "pro";
  return null;
}
```

Then in `normalizeAuthenticatedUser`:

```ts
const plan = normalizePlan(value.plan);
if (!plan) return null;
```

Return `plan`.

- [x] **Step 7: Update extension watch-library fallback**

In `apps/extension/src/watch-library-client.ts`, replace fallback limits:

```ts
limits: {
  planCode: "free",
  maxActiveTrackedTitles: 0,
  activeTrackedTitleCount: 0,
  historyRetentionDays: 0,
  retainedSince: new Date(0).toISOString(),
},
```

- [x] **Step 8: Update API, extension, protocol, and harness tests**

Replace old plan literals in tests and harness with:

```txt
watcher -> free
nakama -> plus
junkie -> pro
```

Add one old-token compatibility test in API auth tests:

```ts
hostPlanCode: "junkie"
```

Expected parse result in the decoded capabilities:

```ts
hostPlanCode: "pro"
```

- [x] **Step 9: Run cross-plane checks**

Run:

```bash
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
pnpm test
pnpm harness:rooms
```

Expected: PASS.

- [x] **Step 10: Commit Task 4**

Run:

```bash
git add packages/protocol/src/types.ts packages/protocol/test/protocol.test.ts apps/api/src/room-state.ts apps/api/test/room-state.test.ts apps/api/test/auth.test.ts apps/web/lib/room-quota.ts apps/web/lib/room-quota.test.ts apps/web/lib/anidachi-auth/extension-session.ts apps/extension/src/auth-tokens.ts apps/extension/src/watch-library-client.ts apps/extension/test/auth-client.test.ts scripts/room-signaling-harness.mjs
git commit -m "refactor: canonicalize room and extension plan contracts"
```

## Task 5: Clean Product UI, Survey, CRM, And JSON-LD Names

**Files:**
- Modify: `apps/web/components/pricing.tsx`
- Modify: `apps/web/components/nav-bar-client.tsx`
- Modify: `apps/web/components/plan-survey/plan-survey-modal.tsx`
- Modify: `apps/web/components/json-ld.tsx`
- Modify: `apps/web/lib/home-survey.ts`
- Modify: `apps/web/lib/kreatli-crm/survey-lead-shared.ts`
- Modify: `apps/web/app/account/layout.tsx`
- Modify: `apps/web/app/account/watch-library/watch-library-client.tsx`
- Modify: `apps/web/app/kreatli-email-crm/crm-client.tsx`

- [x] **Step 1: Replace public tier ids in survey/domain types**

In `apps/web/lib/home-survey.ts`, change:

```ts
export type CheckoutTier = "plus" | "pro";
```

Update recommendation logic:

```ts
if (a.priority === "host_controls") return "pro";
if (a.segment === "Community_mod") return "pro";
if (a.group_size === "9_plus") return "pro";
return "plus";
```

Update CTA copy:

```ts
if (tier === "pro") return "Unlock Pro";
return "Unlock Plus";
```

- [x] **Step 2: Update pricing card labels and click handlers**

In `apps/web/components/pricing.tsx`, replace visible and functional names:

```txt
Crunchyroll Subscriber -> Plus
Anime Junkie -> Pro
crunchyroll_subscriber -> plus
anime_junkie -> pro
Everything in Crunchyroll Subscriber -> Everything in Plus
Start Anime Junkie -> Start Pro
```

Expected checkout body from pricing UI:

```ts
handleSubscribe("plus")
handleSubscribe("pro")
```

- [x] **Step 3: Update nav/account plan labels**

In `apps/web/components/nav-bar-client.tsx`, use:

```ts
const PLAN_LABELS = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
} as const;
```

In account layouts/watch-library client, use the same label map.

- [x] **Step 4: Update survey modal**

In `apps/web/components/plan-survey/plan-survey-modal.tsx`, replace:

```txt
Anime Junkie -> Pro
Crunchyroll Subscriber -> Plus
$38/month -> $14.99/month
$8/month -> $7.99/month
Everything in Crunchyroll Subscriber -> Everything in Plus
```

Expected recommended tier comparisons:

```ts
recommendedTier === "pro"
recommendedTier === "plus"
```

- [x] **Step 5: Update CRM and JSON-LD**

In `apps/web/lib/kreatli-crm/survey-lead-shared.ts`, change plan labels:

```ts
return tier === "pro" ? "Pro" : "Plus";
```

In `apps/web/components/json-ld.tsx`, change product/subscription names to:

```txt
AniDachi Plus
AniDachi Pro
```

In `apps/web/app/kreatli-email-crm/crm-client.tsx`, replace:

```ts
const isHostTier = planLabel === "Pro";
```

- [x] **Step 6: Run UI naming scan**

Run:

```bash
rg -n "Crunchyroll Subscriber|Anime Junkie|crunchyroll_subscriber|anime_junkie|Nakama|nakama|junkie|watcher" apps/web/components apps/web/lib apps/web/app/account apps/web/app/kreatli-email-crm
```

Expected: no matches outside bridge helpers/tests that intentionally accept legacy input.

- [x] **Step 7: Run web checks**

Run:

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
```

Expected: PASS.

- [x] **Step 8: Commit Task 5**

Run:

```bash
git add apps/web/components/pricing.tsx apps/web/components/nav-bar-client.tsx apps/web/components/plan-survey/plan-survey-modal.tsx apps/web/components/json-ld.tsx apps/web/lib/home-survey.ts apps/web/lib/kreatli-crm/survey-lead-shared.ts apps/web/app/account/layout.tsx apps/web/app/account/watch-library/watch-library-client.tsx apps/web/app/kreatli-email-crm/crm-client.tsx
git commit -m "fix(web): rename subscription surfaces to Free Plus Pro"
```

## Task 6: Replace Stripe Setup Scripts And Env Docs

**Files:**
- Create: `apps/web/scripts/stripe/ensure-subscription-prices.ts`
- Delete: `apps/web/scripts/stripe/create-crunchyroll-subscriber-price.ts`
- Delete: `apps/web/scripts/stripe/create-anime-junkie-price.ts`
- Modify: `apps/web/scripts/stripe/register-subscription-webhook.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/.env.example`
- Modify: `docs/environment-and-secrets-matrix.md`
- Modify: `docs/current-development-state.md`

- [x] **Step 1: Add unified Stripe price script**

Create `apps/web/scripts/stripe/ensure-subscription-prices.ts`:

```ts
import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-08-27.basil";

type Mode = "test" | "live";
type Plan = {
  code: "plus" | "pro";
  productName: string;
  lookupKey: string;
  unitAmount: number;
};

const PLANS: Plan[] = [
  {
    code: "plus",
    productName: "AniDachi Plus",
    lookupKey: "anidachi_plus_monthly",
    unitAmount: 799,
  },
  {
    code: "pro",
    productName: "AniDachi Pro",
    lookupKey: "anidachi_pro_monthly",
    unitAmount: 1499,
  },
];

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function modeFromArgs(): Mode {
  return process.argv.includes("--live") ? "live" : "test";
}

function keyForMode(mode: Mode): string {
  const key =
    mode === "live"
      ? required("STRIPE_SECRET_KEY_LIVE", process.env.STRIPE_SECRET_KEY_LIVE)
      : required("STRIPE_SECRET_KEY_TEST", process.env.STRIPE_SECRET_KEY_TEST);
  const expectedPrefix = mode === "live" ? "sk_live" : "sk_test";
  if (!key.startsWith(expectedPrefix)) {
    throw new Error(`${mode} mode requires a ${expectedPrefix} key`);
  }
  return key;
}

async function findOrCreateProduct(stripe: Stripe, plan: Plan): Promise<Stripe.Product> {
  const products = await stripe.products.search({
    query: `metadata['anidachi_plan']:'${plan.code}' AND active:'true'`,
    limit: 1,
  });
  const existing = products.data[0];
  if (existing) return existing;
  return stripe.products.create({
    name: plan.productName,
    metadata: { anidachi_plan: plan.code },
  });
}

async function findOrCreatePrice(stripe: Stripe, product: Stripe.Product, plan: Plan): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({
    lookup_keys: [plan.lookupKey],
    active: true,
    limit: 1,
  });
  const existing = prices.data[0];
  if (existing) return existing;
  return stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan.unitAmount,
    recurring: { interval: "month" },
    lookup_key: plan.lookupKey,
    nickname: plan.lookupKey,
    metadata: { anidachi_plan: plan.code },
  });
}

async function main() {
  const mode = modeFromArgs();
  const stripe = new Stripe(keyForMode(mode), { apiVersion: STRIPE_API_VERSION });
  for (const plan of PLANS) {
    const product = await findOrCreateProduct(stripe, plan);
    const price = await findOrCreatePrice(stripe, product, plan);
    console.log(`${mode} ${plan.code}: ${price.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [x] **Step 2: Update webhook registration script**

In `apps/web/scripts/stripe/register-subscription-webhook.ts`, use suffixed keys only:

```ts
const secretKey =
  mode === "live"
    ? required("STRIPE_SECRET_KEY_LIVE", process.env.STRIPE_SECRET_KEY_LIVE)
    : required("STRIPE_SECRET_KEY_TEST", process.env.STRIPE_SECRET_KEY_TEST);
```

Print mode-specific output:

```ts
console.log(`STRIPE_WEBHOOK_SECRET_${mode === "live" ? "LIVE" : "TEST"}=${created.secret}`);
```

Do not print or suggest unsuffixed `STRIPE_WEBHOOK_SECRET`.

- [x] **Step 3: Update package scripts**

In `apps/web/package.json`, replace old Stripe script names:

```json
{
  "stripe:prices:test": "tsx scripts/stripe/ensure-subscription-prices.ts",
  "stripe:prices:live": "tsx scripts/stripe/ensure-subscription-prices.ts --live",
  "stripe:webhook:subscription": "tsx scripts/stripe/register-subscription-webhook.ts"
}
```

- [x] **Step 4: Delete old price scripts**

Delete:

```txt
apps/web/scripts/stripe/create-crunchyroll-subscriber-price.ts
apps/web/scripts/stripe/create-anime-junkie-price.ts
```

- [x] **Step 5: Update `.env.example`**

In `apps/web/.env.example`, replace old Stripe env section with:

```bash
# Stripe server keys. Preview/staging and local development use test keys.
STRIPE_SECRET_KEY_TEST=
STRIPE_SECRET_KEY_LIVE=

# Stripe webhook signing secrets. Use the secret from the matching Stripe mode.
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
STRIPE_WEBHOOK_SECRET_LIVE=whsec_...

# Stripe prices. Test prices belong to Stripe sandbox/test mode; live prices
# belong to live mode. Objects from one mode cannot be used in the other mode.
STRIPE_PRICE_ID_PLUS_TEST=price_...
STRIPE_PRICE_ID_PLUS_LIVE=price_...
STRIPE_PRICE_ID_PRO_TEST=price_...
STRIPE_PRICE_ID_PRO_LIVE=price_...

# Optional public display-only price ids, only if a client component truly needs
# them. Server checkout must use the server-side STRIPE_PRICE_ID_* variables.
NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS=
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=
```

- [x] **Step 6: Update docs**

In `docs/environment-and-secrets-matrix.md`, replace old Stripe rows with:

```md
| `STRIPE_SECRET_KEY_TEST` | Preview / `staging`, Development | Server-only Stripe sandbox key. Must start with `sk_test_`. | Staging checkout creates a test Checkout Session; webhook accepts test signatures |
| `STRIPE_SECRET_KEY_LIVE` | Production | Server-only Stripe live key. Must start with `sk_live_`. | Production checkout creates a live Checkout Session |
| `STRIPE_WEBHOOK_SECRET_TEST` | Preview / `staging`, Development | Stripe test webhook signing secret for `https://staging.anidachi.app/api/stripe/webhook` | Unsigned POST returns `400 Missing stripe-signature`; signed test event returns 2xx |
| `STRIPE_WEBHOOK_SECRET_LIVE` | Production | Stripe live webhook signing secret for `https://www.anidachi.app/api/stripe/webhook` | Unsigned POST returns `400 Missing stripe-signature`; signed live event returns 2xx |
| `STRIPE_PRICE_ID_PLUS_TEST` / `STRIPE_PRICE_ID_PRO_TEST` | Preview / `staging`, Development | Stripe test prices for AniDachi Plus/Pro | Test checkout writes `plus`/`pro` subscription state |
| `STRIPE_PRICE_ID_PLUS_LIVE` / `STRIPE_PRICE_ID_PRO_LIVE` | Production | Stripe live prices for AniDachi Plus/Pro | Live checkout writes `plus`/`pro` subscription state |
```

In `docs/current-development-state.md`, add a billing note:

```md
Subscription plan codes are canonicalized to `free`, `plus`, and `pro`. Legacy
`watcher`, `nakama`, `junkie`, `crunchyroll_subscriber`, and `anime_junkie`
values are accepted only during the bridge window and must not be emitted by new
runtime code.
```

- [x] **Step 7: Run script/doc scan**

Run:

```bash
rg -n "Crunchyroll Subscriber|Anime Junkie|crunchyroll_subscriber|anime_junkie|STRIPE_SECRET_KEY\\b|STRIPE_WEBHOOK_SECRET\\b|STRIPE_PRICE_ID_CRUNCHYROLL|STRIPE_PRICE_ID_ANIME" apps/web/scripts apps/web/.env.example docs/environment-and-secrets-matrix.md docs/current-development-state.md
```

Expected: no matches except explanatory legacy text in `docs/current-development-state.md` during bridge window.

- [x] **Step 8: Run web checks**

Run:

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
```

Expected: PASS.

- [x] **Step 9: Commit Task 6**

Run:

```bash
git add apps/web/scripts/stripe/ensure-subscription-prices.ts apps/web/scripts/stripe/register-subscription-webhook.ts apps/web/package.json apps/web/.env.example docs/environment-and-secrets-matrix.md docs/current-development-state.md
git rm apps/web/scripts/stripe/create-crunchyroll-subscriber-price.ts apps/web/scripts/stripe/create-anime-junkie-price.ts
git commit -m "chore(stripe): replace legacy subscription setup names"
```

## Task 7: Tighten Database Constraints After Bridge Acceptance

**Files:**
- Create: `apps/web/supabase/migrations/20260622_plan_code_canonicalization_tighten.sql`

This task is not applied in the same PR unless staging acceptance confirms no old writers remain. Keep it as a follow-up migration PR if there is any uncertainty about old installed staging extensions.

- [ ] **Step 1: Confirm runtime is writing only canonical values**

Run against the target Supabase project:

```sql
select plan, count(*) from public.users group by plan order by plan;
select plan_code, count(*) from public.subscriptions group by plan_code order by plan_code;
select host_plan_code, count(*) from public.rooms group by host_plan_code order by host_plan_code;
```

Expected:

```txt
free / plus / pro only
```

No `watcher`, `nakama`, or `junkie` rows may remain.

- [ ] **Step 2: Create tighten migration**

Create `apps/web/supabase/migrations/20260622_plan_code_canonicalization_tighten.sql`:

```sql
-- Finalize canonical AniDachi subscription plan codes.
--
-- Apply only after bridge code is deployed to staging and production and old
-- clients are no longer expected to write watcher/nakama/junkie values.

alter table public.users
  drop constraint if exists users_plan_check;

alter table public.users
  add constraint users_plan_check
  check (plan in ('free', 'plus', 'pro'))
  not valid;

alter table public.users
  validate constraint users_plan_check;

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_code_check;

alter table public.subscriptions
  add constraint subscriptions_plan_code_check
  check (plan_code in ('free', 'plus', 'pro'))
  not valid;

alter table public.subscriptions
  validate constraint subscriptions_plan_code_check;

alter table public.rooms
  drop constraint if exists rooms_host_plan_code_check;

alter table public.rooms
  add constraint rooms_host_plan_code_check
  check (host_plan_code in ('free', 'plus', 'pro'))
  not valid;

alter table public.rooms
  validate constraint rooms_host_plan_code_check;
```

- [ ] **Step 3: Commit Task 7**

Run:

```bash
git add apps/web/supabase/migrations/20260622_plan_code_canonicalization_tighten.sql
git commit -m "feat(db): tighten subscription plan code constraints"
```

## Task 8: Staging/Production Billing Isolation Decision

**Files:**
- Modify: `docs/current-development-state.md`
- Create in a later PR when the shared-Supabase path is chosen: a dedicated billing isolation migration plan before live launch.

This task is a required decision gate before live billing is considered healthy.

- [ ] **Step 1: Verify whether staging and production share Supabase**

Check Vercel env values in the Vercel dashboard or with approved env-read access:

```txt
Preview/staging NEXT_PUBLIC_SUPABASE_URL
Production NEXT_PUBLIC_SUPABASE_URL
```

Expected ideal state:

```txt
Preview/staging uses a staging Supabase project.
Production uses a production Supabase project.
```

- [ ] **Step 2: If Supabase is shared, choose one of two safe paths**

Preferred path:

```txt
Create a separate Supabase staging project, apply migrations, copy only safe test seed data, update Vercel Preview env, and keep production data isolated.
```

Acceptable temporary path:

```txt
Keep shared Supabase only until pre-live testing is done, but add explicit `stripe_mode` to billing mirror tables before any real live billing verification.
```

Do not run real live subscription tests into a shared staging/production database without this decision recorded.

- [ ] **Step 3: Record the decision**

In `docs/current-development-state.md`, add one of:

```md
Billing data isolation: staging and production use separate Supabase projects.
```

or:

```md
Billing data isolation: staging and production temporarily share Supabase. Stripe
test/live rows must be distinguishable by mode before live billing is enabled.
```

- [ ] **Step 4: Commit Task 8**

Run:

```bash
git add docs/current-development-state.md
git commit -m "docs: record billing data isolation state"
```

## Task 9: Final Legacy Scan And Active Plan Update

**Files:**
- Modify: `docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/environment-and-secrets-matrix.md`

- [x] **Step 1: Update active social/subscription plan**

In `docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md`, replace the current internal code section:

```txt
watcher -> Free
nakama -> Plus
junkie -> Pro
```

with:

```txt
free -> Free
plus -> Plus
pro -> Pro
```

Add this bridge note near the plan-code section:

```md
Legacy plan values `watcher`, `nakama`, `junkie`, `crunchyroll_subscriber`, and
`anime_junkie` were migration-only aliases. New runtime code, database rows,
Stripe metadata, room tokens, and extension auth payloads must use `free`,
`plus`, and `pro`.
```

- [x] **Step 2: Run active-source legacy scan**

Run:

```bash
rg -n "Crunchyroll Subscriber|Anime Junkie|crunchyroll_subscriber|anime_junkie|\\bwatcher\\b|\\bnakama\\b|\\bjunkie\\b" apps packages scripts docs/current-development-state.md docs/environment-and-secrets-matrix.md docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md
```

Expected allowed matches at this point:

```txt
apps/web/lib/anidachi-auth/plan-codes.ts
apps/web/lib/anidachi-auth/plan-codes.test.ts
apps/web/lib/anidachi-auth/jwt.test.ts
apps/web/lib/anidachi-auth/plan-entitlements.test.ts
apps/web/lib/anidachi-auth/stripe-plans.test.ts
apps/web/lib/room-quota.test.ts
packages/protocol/src/types.ts
packages/protocol/test/protocol.test.ts
apps/api/test/auth.test.ts
apps/extension/src/auth-tokens.ts
apps/extension/test/auth-client.test.ts
apps/web/supabase/migrations/20260525_anidachi_auth.sql
apps/web/supabase/migrations/20260620_billing_entitlements.sql
apps/web/supabase/migrations/20260623_room_capabilities.sql
apps/web/supabase/migrations/20260622_plan_code_canonicalization_bridge.sql
docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md bridge note only
```

Historical applied migrations are allowed to retain old names. Runtime
compatibility boundaries may accept old names during the bridge window, but new
runtime emissions, database writes, Stripe metadata, room tokens, and extension
payloads must use `free`, `plus`, and `pro`.

- [x] **Step 3: Run full verification**

Run:

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
pnpm dev:check
pnpm check
pnpm test
pnpm harness:rooms
```

Expected: PASS.

- [x] **Step 4: Build and validate staging extension**

Run:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
```

Expected:

```txt
Staging extension artifact validates with staging endpoints and store-safe permissions.
```

- [ ] **Step 5: Commit Task 9**

Run:

```bash
git add docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md docs/current-development-state.md docs/environment-and-secrets-matrix.md
git commit -m "docs: document canonical subscription plan codes"
```

## Task 10: Staging Rollout And Acceptance

**Files:**
- No direct source edits unless staging findings require a fix.

- [ ] **Step 1: Push feature branch and open PR to staging**

Run:

```bash
git push -u origin codex/plan-code-canonicalization
gh pr create --base staging --head codex/plan-code-canonicalization --title "Canonicalize subscription plan codes" --body-file /tmp/anidachi-plan-code-pr.md
```

PR body must include:

```md
## Summary
- Renames active subscription codes to `free`, `plus`, `pro`.
- Keeps legacy inputs as bridge aliases.
- Adds Supabase bridge migration and documents the later tighten migration.
- Updates Stripe setup scripts/env docs to Plus/Pro names.

## Verification
- pnpm --filter @anidachi/web test
- pnpm --filter @anidachi/web check
- pnpm --filter @anidachi/api test
- pnpm --filter @anidachi/extension test
- pnpm --filter @anidachi/extension check
- pnpm dev:check
- pnpm harness:rooms
- pnpm build:extension:staging
- pnpm validate:extension:staging

## Security / Env Impact
- Stripe test/live env names stay suffixed.
- Legacy unsuffixed Stripe env fallbacks remain until production bridge deploy is complete.
- No secrets added to git.

## Staging Acceptance
- Staging checkout creates canonical `plus`/`pro` rows.
- Existing old-token rooms still parse.
- Extension auth refresh returns canonical plan codes.
- Pricing UI shows Free/Plus/Pro only.

## Rollback
- Revert PR before applying tighten migration.
- Keep bridge migration in place if already applied; it accepts old and new values.
```

- [ ] **Step 2: Merge to staging after CI**

Use the normal protected-branch PR flow. Do not force-push staging.

- [ ] **Step 3: Verify staging deployment**

Run:

```bash
curl -fsSI https://staging.anidachi.app | rg -i "x-robots-tag|content-type|location|http/"
curl -fsS -X POST https://staging.anidachi.app/api/stripe/webhook
```

Expected:

```txt
staging remains noindex/password-gated as appropriate
webhook returns 400 Missing stripe-signature
```

- [ ] **Step 4: Run staging product smoke**

Manual staging smoke:

```txt
1. Sign in on staging.
2. Start Plus test checkout using Stripe test card 4242 4242 4242 4242.
3. Confirm webhook event processes.
4. Confirm user plan is `plus` in Supabase.
5. Confirm `/account` and extension auth show Plus, not Nakama.
6. Create a room.
7. Confirm room host_plan_code is `plus`.
8. Join with another account.
9. Confirm Worker room snapshot exposes `plus`.
```

- [ ] **Step 5: Query Supabase after staging smoke**

Run in Supabase SQL editor or approved SQL access:

```sql
select plan, count(*) from public.users group by plan order by plan;
select plan_code, status, count(*) from public.subscriptions group by plan_code, status order by plan_code, status;
select host_plan_code, count(*) from public.rooms group by host_plan_code order by host_plan_code;
select event_type, processed_at is not null as processed, count(*) from public.stripe_events group by event_type, processed order by event_type, processed;
```

Expected:

```txt
New rows use free/plus/pro.
Stripe events are processed.
No new nakama/junkie rows appear after bridge deploy.
```

## Task 11: Production Promotion And Legacy Env Removal

**Files:**
- Possibly modify: `docs/current-development-state.md`
- Possibly modify: `docs/environment-and-secrets-matrix.md`

- [ ] **Step 1: Promote through PR, not direct push**

Open a PR from `staging` to `main`. Because this touches auth/billing/API/extension contracts, do not rely on site-only auto-promotion.

- [ ] **Step 2: Confirm production env before merge**

In Vercel Production env, confirm:

```txt
STRIPE_SECRET_KEY_LIVE starts with sk_live_
STRIPE_WEBHOOK_SECRET_LIVE starts with whsec_
STRIPE_PRICE_ID_PLUS_LIVE starts with price_
STRIPE_PRICE_ID_PRO_LIVE starts with price_
NEXT_PUBLIC_SITE_URL=https://www.anidachi.app
NEXT_PUBLIC_ROBOTS_NOINDEX is absent or false
```

In Vercel Preview/staging env, confirm:

```txt
STRIPE_SECRET_KEY_TEST starts with sk_test_
STRIPE_WEBHOOK_SECRET_TEST starts with whsec_
STRIPE_PRICE_ID_PLUS_TEST starts with price_
STRIPE_PRICE_ID_PRO_TEST starts with price_
NEXT_PUBLIC_SITE_URL=https://staging.anidachi.app
NEXT_PUBLIC_ROBOTS_NOINDEX=true
```

- [ ] **Step 3: Merge to main after CI and staging acceptance**

Use the protected branch PR merge. Do not push directly to `main`.

- [ ] **Step 4: Verify production webhook safety**

Run:

```bash
curl -fsS -X POST https://www.anidachi.app/api/stripe/webhook
```

Expected:

```txt
{"error":"Missing stripe-signature"}
```

- [ ] **Step 5: Remove legacy unsuffixed env only after production bridge is live**

In Vercel, remove:

```txt
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID_PLUS
STRIPE_PRICE_ID_PRO
STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER
STRIPE_PRICE_ID_ANIME_JUNKIE
NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER
NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE
```

Keep:

```txt
STRIPE_SECRET_KEY_TEST
STRIPE_SECRET_KEY_LIVE
STRIPE_WEBHOOK_SECRET_TEST
STRIPE_WEBHOOK_SECRET_LIVE
STRIPE_PRICE_ID_PLUS_TEST
STRIPE_PRICE_ID_PLUS_LIVE
STRIPE_PRICE_ID_PRO_TEST
STRIPE_PRICE_ID_PRO_LIVE
```

- [ ] **Step 6: Redeploy after env cleanup**

Trigger fresh Vercel deployments for staging and production after env removal.

Expected: checkout/webhook still work on the correct mode. Staging must fail closed if a live key is accidentally placed in a test env.

## Rollback Plan

If source code fails before DB migration:

```txt
Revert the feature branch or PR. No database action required.
```

If bridge migration has been applied:

```txt
Do not attempt to reverse the backfill unless there is a specific production incident.
The bridge migration accepts old and new values, so old code can still run.
When runtime rollback is required, revert the runtime PR while leaving widened constraints in place.
```

If tighten migration has been applied too early:

```sql
alter table public.users drop constraint if exists users_plan_check;
alter table public.users add constraint users_plan_check
  check (plan in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

alter table public.subscriptions drop constraint if exists subscriptions_plan_code_check;
alter table public.subscriptions add constraint subscriptions_plan_code_check
  check (plan_code in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

alter table public.rooms drop constraint if exists rooms_host_plan_code_check;
alter table public.rooms add constraint rooms_host_plan_code_check
  check (host_plan_code in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));
```

## Completion Criteria

This migration is complete only when all of the following are true:

- Active runtime code writes only `free`, `plus`, and `pro`.
- Public UI shows only Free, Plus, and Pro.
- Checkout creates Stripe subscription metadata with `planCode=plus` or `planCode=pro`.
- Webhooks store `subscriptions.plan_code` as `plus` or `pro`.
- `users.plan` stores `free`, `plus`, or `pro`.
- New rooms store `rooms.host_plan_code` as `free`, `plus`, or `pro`.
- Protocol/Worker/extension snapshots emit canonical plan codes.
- Staging test purchase succeeds and updates the user to `plus` or `pro`.
- Production env uses only live Stripe values, Preview/staging uses only test Stripe values.
- Unsuffixed and legacy Stripe env vars are removed after production bridge deploy.
- Old names remain only in historical applied migrations and explicit legacy bridge tests/helpers, or are fully removed after the final tighten migration and compatibility window.
