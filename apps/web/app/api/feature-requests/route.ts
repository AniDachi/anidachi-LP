import { type NextRequest, NextResponse } from "next/server";
import {
  appendFeatureRequest,
  isFeatureRequestCategory,
} from "@/lib/kreatli-crm/feature-requests";
import type { FeatureRequestCategory } from "@/lib/kreatli-crm/feature-request-shared";
import {
  getGmailRedirectUri,
  isGmailConfigured,
  sendPlaintextEmail,
} from "@/lib/kreatli-crm/gmail";
import { readGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";
import { isValidEmail, normalizeEmail } from "@/lib/kreatli-crm/validation";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const MAX_NAME = 120;
const MAX_TITLE = 160;
const MAX_DESCRIPTION = 4000;
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

function buildEmail(input: {
  name: string;
  email: string;
  title: string;
  description: string;
  category: string;
}): { subject: string; body: string } {
  return {
    subject: `AniDachi feature request: ${input.title}`,
    body: [
      "New feature request from /feature-requests",
      "",
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Category: ${input.category}`,
      `Title: ${input.title}`,
      "",
      input.description,
    ].join("\n"),
  };
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
  let title: string;
  let description: string;
  let category: string;
  let honeypot: string;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    honeypot = typeof body.company_website === "string" ? body.company_website : "";
    if (honeypot.trim()) {
      // Silent success for bots
      return NextResponse.json({ ok: true });
    }

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json(
        { error: "Description is required." },
        { status: 400 },
      );
    }
    if (!isFeatureRequestCategory(body.category)) {
      return NextResponse.json(
        { error: "Pick a valid category." },
        { status: 400 },
      );
    }

    name = body.name.trim().slice(0, MAX_NAME);
    email = normalizeEmail(body.email.trim());
    title = body.title.trim().slice(0, MAX_TITLE);
    description = body.description.trim().slice(0, MAX_DESCRIPTION);
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
    await appendFeatureRequest({
      name,
      email,
      title,
      description,
      category: category as FeatureRequestCategory,
    });
  } catch (error) {
    console.error("[feature-requests] Failed to store request", error);
    return NextResponse.json(
      { error: "Could not save your request. Please try again." },
      { status: 500 },
    );
  }

  const responsePayload = { ok: true as const };

  const toRaw = process.env.SUBSCRIPTION_NOTIFY_EMAILS;
  if (!toRaw?.trim() || !isGmailConfigured()) {
    console.warn(
      "[feature-requests] Email not sent — Gmail not configured or no notify address",
    );
    return NextResponse.json(responsePayload);
  }

  const tokens = await readGmailTokens();
  if (!tokens?.refresh_token) {
    console.warn("[feature-requests] Gmail not connected; skipping alert");
    return NextResponse.json(responsePayload);
  }

  const redirectUri = getGmailRedirectUri(getResolvedSiteOrigin());
  const { subject, body: emailBody } = buildEmail({
    name,
    email,
    title,
    description,
    category,
  });

  for (const address of toRaw.split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      await sendPlaintextEmail(redirectUri, {
        to: address,
        subject,
        body: emailBody,
      });
    } catch (error) {
      console.error("[feature-requests] Failed to email", address, error);
    }
  }

  return NextResponse.json(responsePayload);
}
