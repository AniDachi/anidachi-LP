import { NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import { getAllCredentials } from "@/lib/instagram/storage";

export async function GET() {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  const accounts = await getAllCredentials();

  if (accounts.length === 0) {
    return NextResponse.json({ connected: false, accounts: [] });
  }

  return NextResponse.json({
    connected: true,
    // Keep top-level username for backwards-compat with any existing callers
    username: accounts[0].igUsername,
    igUserId: accounts[0].igUserId,
    accounts: accounts.map((a) => ({
      igUserId: a.igUserId,
      username: a.igUsername,
      connected: true,
    })),
  });
}
