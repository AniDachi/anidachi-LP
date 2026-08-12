import { type NextRequest, NextResponse } from "next/server";
import type { ContactCategory } from "@/lib/kreatli-crm/contact-message-shared";
import {
  appendContactMessage,
  isContactCategory,
} from "@/lib/kreatli-crm/contact-messages";
import {
  getGmailRedirectUri,
  isGmailConfigured,
  sendPlaintextEmail,
} from "@/lib/kreatli-crm/gmail";
import { readGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";
import { isValidEmail, normalizeEmail } from "@/lib/kreatli-crm/validation";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const MAX_NAME = 120;
const MAX_SUBJECT = 160;
const MAX_MESSAGE = 4000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

const rateBucket = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

export async function POST(request: NextRequest) {
  if (rateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  }

  let name: string;
  let email: string;
  let subject: string;
  let message: string;
  let category: string;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const honeypot =
      typeof body.company_website === "string" ? body.company_website : "";
    if (honeypot.trim()) {
      return NextResponse.json({ ok: true });
    }

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    if (typeof body.subject !== "string" || !body.subject.trim()) {
      return NextResponse.json(
        { error: "Subject is required." },
        { status: 400 },
      );
    }
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }
    if (!isContactCategory(body.category)) {
      return NextResponse.json(
        { error: "Pick a valid topic." },
        { status: 400 },
      );
    }

    name = body.name.trim().slice(0, MAX_NAME);
    email = normalizeEmail(body.email.trim());
    subject = body.subject.trim().slice(0, MAX_SUBJECT);
    message = body.message.trim().slice(0, MAX_MESSAGE);
    category = body.category;

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    await appendContactMessage({
      name,
      email,
      subject,
      message,
      category: category as ContactCategory,
    });
  } catch (error) {
    console.error("[contact] Failed to store message", error);
    return NextResponse.json(
      { error: "Could not send your message. Please try again." },
      { status: 500 },
    );
  }

  const responsePayload = { ok: true as const };
  const toRaw = process.env.SUBSCRIPTION_NOTIFY_EMAILS;
  if (!toRaw?.trim() || !isGmailConfigured()) {
    console.warn("[contact] Email not sent — Gmail not configured");
    return NextResponse.json(responsePayload);
  }

  const tokens = await readGmailTokens();
  if (!tokens?.refresh_token) {
    console.warn("[contact] Gmail not connected; skipping alert");
    return NextResponse.json(responsePayload);
  }

  const redirectUri = getGmailRedirectUri(getResolvedSiteOrigin());
  const emailBody = [
    "New contact form message from /contact",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Category: ${category}`,
    `Subject: ${subject}`,
    "",
    message,
  ].join("\n");

  for (const address of toRaw.split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      await sendPlaintextEmail(redirectUri, {
        to: address,
        subject: `AniDachi contact (${category}): ${subject}`,
        body: emailBody,
      });
    } catch (error) {
      console.error("[contact] Failed to email", address, error);
    }
  }

  return NextResponse.json(responsePayload);
}
