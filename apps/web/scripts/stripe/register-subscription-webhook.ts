import Stripe from "stripe";

const EVENT = "checkout.session.completed" as const;
const PATH = "/api/stripe/webhook";
const DEFAULT_LIVE_URL = `https://anidachi.app${PATH}`;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function normalizeWebhookUrl(raw: string): string {
  const u = raw.trim();
  if (!u.startsWith("https://")) {
    throw new Error("Webhook URL must start with https://");
  }
  return u;
}

async function main() {
  const mode = (process.argv[2] ?? "live").toLowerCase();
  if (mode !== "test" && mode !== "live") {
    throw new Error('First argument must be "test" or "live"');
  }

  const urlArg = process.argv[3];
  if (!urlArg?.trim() && mode === "test") {
    throw new Error(
      'For test mode pass the full webhook URL, e.g. https://your-app.vercel.app/api/stripe/webhook (Stripe test webhooks cannot reach localhost unless you use stripe listen).',
    );
  }
  const webhookUrl = normalizeWebhookUrl(urlArg?.trim() || DEFAULT_LIVE_URL);

  const key =
    mode === "live"
      ? required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY)
      : required("STRIPE_SECRET_KEY_TEST", process.env.STRIPE_SECRET_KEY_TEST);

  const stripe = new Stripe(key, { apiVersion: "2025-06-30.basil" });

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const duplicate = existing.data.find((e) => e.url === webhookUrl);
  if (duplicate) {
    process.stdout.write(
      `Webhook endpoint already exists for this URL (${duplicate.id}).\n` +
        `Stripe only shows the signing secret once at creation — open the Dashboard to copy or rotate it, or delete this endpoint and run this script again.\n`,
    );
    return;
  }

  const created = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [EVENT],
    description: "AniDachi: new subscription alert (checkout.session.completed)",
    api_version: "2025-06-30.basil",
  });

  process.stdout.write(
    `Registered ${mode} webhook endpoint ${created.id}\n` +
      `URL: ${webhookUrl}\n` +
      `Event: ${EVENT}\n\n` +
      `Add this to your deployment secrets (e.g. Vercel):\n` +
      `STRIPE_WEBHOOK_SECRET=${created.secret}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
