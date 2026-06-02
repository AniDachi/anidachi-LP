import { NextRequest, NextResponse } from "next/server";
import { consumeExtensionAuthCode } from "@/lib/anidachi-auth/extension-codes";
import { issueExtensionTokenPair } from "@/lib/anidachi-auth/extension-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    state?: string;
  } | null;

  if (!body?.code || !body.state) {
    return NextResponse.json({ error: "code and state are required" }, { status: 400 });
  }

  const consumed = await consumeExtensionAuthCode({
    code: body.code,
    state: body.state,
  });
  if (!consumed) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  const tokens = await issueExtensionTokenPair(consumed.userId);
  return NextResponse.json(tokens);
}
