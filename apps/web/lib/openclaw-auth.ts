import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export function validateOpenClawSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-openclaw-secret");
  if (!secret || !process.env.OPENCLAW_API_SECRET) return false;

  const expected = Buffer.from(process.env.OPENCLAW_API_SECRET, "utf-8");
  const received = Buffer.from(secret, "utf-8");

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function unauthorizedResponse(code: string = "AUTH_FAILED") {
  return NextResponse.json(
    { success: false, error: "Invalid or missing API secret", code },
    { status: 401 }
  );
}
