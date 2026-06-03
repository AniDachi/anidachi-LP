import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "kreatli_crm_auth";

function getPassword(): string {
  const p = process.env.KREATLI_CRM_PASSWORD;
  if (p) return p;
  if (process.env.NODE_ENV === "development") return "ewoste";
  return "";
}

function getSessionSecret(): string {
  const s = process.env.KREATLI_CRM_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "development") {
    return "kreatli-crm-dev-session-secret";
  }
  return "";
}

export function kreatliCrmSessionToken(): string {
  const secret = getSessionSecret();
  const password = getPassword();
  if (!secret || !password) return "";
  return createHmac("sha256", secret)
    .update(`kreatli-crm:${password}`)
    .digest("hex");
}

export function verifyKreatliPassword(attempt: string): boolean {
  const expected = getPassword();
  if (!expected || !attempt) return false;
  try {
    const a = Buffer.from(attempt, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function verifyKreatliCrmSession(): Promise<boolean> {
  const expected = kreatliCrmSessionToken();
  if (!expected) return false;
  const cookieStore = await cookies();
  const val = cookieStore.get(COOKIE_NAME)?.value;
  if (!val) return false;
  try {
    const a = Buffer.from(val, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
