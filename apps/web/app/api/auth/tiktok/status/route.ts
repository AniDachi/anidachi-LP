import { NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import { getAllCredentials } from "@/lib/tiktok/storage";

export async function GET() {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  const accounts = await getAllCredentials();

  if (accounts.length === 0) {
    return NextResponse.json({ connected: false, accounts: [] });
  }

  return NextResponse.json({
    connected: true,
    accounts: accounts.map((a) => ({
      openId: a.openId,
      username: a.username,
      avatarUrl: a.avatarUrl,
      connected: true,
    })),
  });
}
