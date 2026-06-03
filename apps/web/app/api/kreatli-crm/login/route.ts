import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  kreatliCrmSessionToken,
  verifyKreatliPassword,
} from "@/lib/kreatli-crm/auth";

export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password = body.password ?? "";
  if (!verifyKreatliPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = kreatliCrmSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "Server misconfigured: set KREATLI_CRM_PASSWORD and KREATLI_CRM_SESSION_SECRET" },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
