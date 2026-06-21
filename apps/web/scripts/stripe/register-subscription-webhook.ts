import {
  STRIPE_API_VERSION,
  createStripeClient,
  type StripeMode,
} from "../../lib/anidachi-auth/stripe-env";

const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "entitlements.active_entitlement_summary.updated",
] as const;
const PATH = "/api/stripe/webhook";
const DEFAULT_LIVE_URL = `https://www.anidachi.app${PATH}`;
const DEFAULT_TEST_URL = `https://staging.anidachi.app${PATH}`;

function normalizeWebhookUrl(raw: string): string {
  const u = raw.trim();
  if (!u.startsWith("https://")) {
    throw new Error("Webhook URL must start with https://");
  }
  return u;
}

async function main() {
  const mode = (process.argv[2] ?? "live").toLowerCase() as StripeMode;
  if (mode !== "test" && mode !== "live") {
    throw new Error('First argument must be "test" or "live"');
  }

  const urlArg = process.argv[3];
  const defaultUrl = mode === "live" ? DEFAULT_LIVE_URL : DEFAULT_TEST_URL;
  const webhookUrl = normalizeWebhookUrl(urlArg?.trim() || defaultUrl);

  const stripe = createStripeClient(mode);

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
    enabled_events: [...EVENTS],
    description: "AniDachi: subscription and entitlement sync",
    api_version: STRIPE_API_VERSION,
  });

  process.stdout.write(
    `Registered ${mode} webhook endpoint ${created.id}\n` +
      `URL: ${webhookUrl}\n` +
      `Events: ${EVENTS.join(", ")}\n\n` +
      `Add this to your deployment secrets (e.g. Vercel):\n` +
      `STRIPE_WEBHOOK_SECRET_${mode === "live" ? "LIVE" : "TEST"}=${created.secret}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
