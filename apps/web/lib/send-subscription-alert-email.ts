import { getGmailRedirectUri, isGmailConfigured, sendPlaintextEmail } from "@/lib/kreatli-crm/gmail";
import { readGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";

export type SubscriptionAlertPayload = {
  sessionId: string;
  customerEmail: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  amountTotalCents: number | null;
  currency: string | null;
};

/** Public site origin for OAuth redirect URI when `GOOGLE_GMAIL_REDIRECT_URI` is unset. */
function serverOriginForGmailCallback(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) return site;
  const v = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (v) return `https://${v}`;
  return "https://anidachi.app";
}

function buildAlertText(payload: SubscriptionAlertPayload): { subject: string; body: string } {
  const amount =
    payload.amountTotalCents != null && payload.currency
      ? `${(payload.amountTotalCents / 100).toFixed(2)} ${payload.currency.toUpperCase()}`
      : "—";

  const subject = payload.customerEmail
    ? `New AniDachi subscription: ${payload.customerEmail}`
    : "New AniDachi subscription (checkout completed)";

  const body = [
    "A new subscription was purchased via Stripe Checkout.",
    "",
    `Session: ${payload.sessionId}`,
    `Customer email: ${payload.customerEmail ?? "—"}`,
    `Customer ID: ${payload.customerId ?? "—"}`,
    `Subscription ID: ${payload.subscriptionId ?? "—"}`,
    `Amount (checkout): ${amount}`,
  ].join("\n");

  return { subject, body };
}

/**
 * Sends an internal alert when a new subscription checkout completes.
 * Uses the same Gmail OAuth connection as Kreatli CRM (`sendPlaintextEmail`).
 *
 * Requires `SUBSCRIPTION_NOTIFY_EMAILS` (comma-separated) and Gmail connected with
 * `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` plus stored tokens (CRM → Connect Gmail).
 */
export async function sendSubscriptionAlertEmail(
  payload: SubscriptionAlertPayload,
): Promise<void> {
  const toRaw = process.env.SUBSCRIPTION_NOTIFY_EMAILS;
  if (!toRaw?.trim()) {
    console.warn(
      "[subscription-alert] Missing SUBSCRIPTION_NOTIFY_EMAILS; skipping alert email",
    );
    return;
  }

  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) {
    console.warn("[subscription-alert] SUBSCRIPTION_NOTIFY_EMAILS has no addresses; skipping");
    return;
  }

  if (!isGmailConfigured()) {
    console.warn(
      "[subscription-alert] Gmail is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET); skipping",
    );
    return;
  }

  const tokens = await readGmailTokens();
  if (!tokens?.refresh_token) {
    console.warn(
      "[subscription-alert] Gmail not connected (no refresh token). Open Kreatli CRM and connect Gmail; skipping",
    );
    return;
  }

  const redirectUri = getGmailRedirectUri(serverOriginForGmailCallback());
  const { subject, body } = buildAlertText(payload);

  for (const address of to) {
    await sendPlaintextEmail(redirectUri, { to: address, subject, body });
  }
}
