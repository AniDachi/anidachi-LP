import Stripe from "stripe";

const NAME = "Crunchyroll Subscriber (Early Access)";
const AMOUNT_USD = 8;

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

async function ensurePrice(stripe: Stripe) {
  const products = await stripe.products.search({
    query: `active:'true' AND name:'${NAME.replace(/'/g, "\\'")}'`,
    limit: 1,
  });

  const product =
    products.data[0] ??
    (await stripe.products.create({
      name: NAME,
      description:
        "Watchrooms + sync + chat on top of your existing Crunchyroll tab.",
    }));

  const prices = await stripe.prices.search({
    query: `active:'true' AND product:'${product.id}'`,
    limit: 10,
  });

  const existing = prices.data.find(
    (p) =>
      p.type === "recurring" &&
      p.currency === "usd" &&
      (p.unit_amount ?? 0) === AMOUNT_USD * 100 &&
      p.recurring?.interval === "month"
  );

  if (existing) return existing;

  return await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: AMOUNT_USD * 100,
    recurring: { interval: "month" },
    nickname: "crunchyroll_subscriber_monthly",
  });
}

async function main() {
  const mode = process.argv[2] ?? "test";
  const key =
    mode === "live"
      ? required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY)
      : required("STRIPE_SECRET_KEY_TEST", process.env.STRIPE_SECRET_KEY_TEST);

  const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  const price = await ensurePrice(stripe);

  process.stdout.write(
    `Created/verified ${mode} Crunchyroll Subscriber price:\n${price.id}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
