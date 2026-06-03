import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";

/**
 * Bloü uses the same httpOnly session and password as Kreatli Email CRM
 * (`KREATLI_CRM_PASSWORD` / dev fallback `ewoste`).
 */
export async function requireBlouAccess(nextPath: string) {
  if (!(await verifyKreatliCrmSession())) {
    redirect(`/blou/login?next=${encodeURIComponent(nextPath)}`);
  }
}

/** For Route Handlers that back Bloü / the same shared password gate. */
export async function jsonUnauthorizedUnlessKreatliSession(): Promise<NextResponse | null> {
  if (!(await verifyKreatliCrmSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
