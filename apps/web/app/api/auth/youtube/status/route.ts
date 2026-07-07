import { NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import { getAllCredentials } from "@/lib/youtube/storage";

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
      channelId: a.channelId,
      channelTitle: a.channelTitle,
      thumbnailUrl: a.thumbnailUrl,
      connected: true,
    })),
  });
}
