import Stripe from "stripe";
import {
  STRIPE_API_VERSION,
  createStripeClient,
  type StripeMode,
} from "../../lib/anidachi-auth/stripe-env";

type SubscriptionPlanConfig = {
  code: "plus" | "pro";
  name: string;
  description: string;
  lookupKey: string;
  unitAmount: number;
};

const PLANS: SubscriptionPlanConfig[] = [
  {
    code: "plus",
    name: "AniDachi Plus",
    description: "Unlimited host time, group invites, and up to 4 media seats.",
    lookupKey: "anidachi_plus_monthly",
    unitAmount: 799,
  },
  {
    code: "pro",
    name: "AniDachi Pro",
    description: "Bigger watch parties with Pro room limits and up to 4 media seats.",
    lookupKey: "anidachi_pro_monthly",
    unitAmount: 1499,
  },
];

function parseMode(argv: string[]): StripeMode {
  const args = new Set(argv.map((arg) => arg.toLowerCase()));
  if (args.has("--live") || args.has("live")) return "live";
  if (args.has("--test") || args.has("test")) return "test";
  return "test";
}

function validatePrice(price: Stripe.Price, plan: SubscriptionPlanConfig): void {
  const interval = price.recurring?.interval;
  if (
    price.type !== "recurring" ||
    price.currency !== "usd" ||
    price.unit_amount !== plan.unitAmount ||
    interval !== "month"
  ) {
    throw new Error(
      [
        `Existing Stripe price ${price.id} uses lookup key ${plan.lookupKey},`,
        `but it does not match ${plan.name}: expected usd ${plan.unitAmount} monthly.`,
        "Create a new lookup key or archive the incorrect price before retrying.",
      ].join(" "),
    );
  }
}

async function findProduct(
  stripe: Stripe,
  plan: SubscriptionPlanConfig,
): Promise<Stripe.Product | null> {
  const products = await stripe.products.search({
    query: `active:'true' AND metadata['anidachi_plan']:'${plan.code}'`,
    limit: 1,
  });
  return products.data[0] ?? null;
}

async function ensureProduct(
  stripe: Stripe,
  plan: SubscriptionPlanConfig,
): Promise<Stripe.Product> {
  const existing = await findProduct(stripe, plan);
  if (!existing) {
    return await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { anidachi_plan: plan.code },
    });
  }

  if (existing.name === plan.name && existing.description === plan.description) {
    return existing;
  }

  return await stripe.products.update(existing.id, {
    name: plan.name,
    description: plan.description,
    metadata: { ...existing.metadata, anidachi_plan: plan.code },
  });
}

async function ensurePrice(
  stripe: Stripe,
  plan: SubscriptionPlanConfig,
): Promise<Stripe.Price> {
  const existingPrices = await stripe.prices.list({
    active: true,
    lookup_keys: [plan.lookupKey],
    limit: 1,
  });
  const existingPrice = existingPrices.data[0];
  if (existingPrice) {
    validatePrice(existingPrice, plan);
    return existingPrice;
  }

  const product = await ensureProduct(stripe, plan);
  return await stripe.prices.create({
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
  const mode = parseMode(process.argv.slice(2));
  const stripe = createStripeClient(mode);

  process.stdout.write(
    `Ensuring AniDachi subscription prices in Stripe ${mode} mode (API ${STRIPE_API_VERSION}).\n`,
  );

  for (const plan of PLANS) {
    const price = await ensurePrice(stripe, plan);
    process.stdout.write(
      `${plan.name}: ${price.id} (${plan.lookupKey}, $${(plan.unitAmount / 100).toFixed(2)}/mo)\n`,
    );
  }

  process.stdout.write(
    [
      "",
      "Set these Vercel env vars for the matching environment:",
      mode === "live"
        ? "STRIPE_PRICE_ID_PLUS_LIVE and STRIPE_PRICE_ID_PRO_LIVE"
        : "STRIPE_PRICE_ID_PLUS_TEST and STRIPE_PRICE_ID_PRO_TEST",
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
