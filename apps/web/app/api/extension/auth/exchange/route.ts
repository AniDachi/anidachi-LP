import { ExtensionAuthExchangeRequestSchema } from "@anidachi/protocol";
import { NextRequest, NextResponse } from "next/server";
import {
  consumeExtensionAuthCode,
  isSafeExtensionRedirectUri,
  readApprovedExtensionClientId,
} from "@/lib/anidachi-auth/extension-codes";
import { issueExtensionTokenPair } from "@/lib/anidachi-auth/extension-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = ExtensionAuthExchangeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const approvedClientId = readApprovedExtensionClientId();
  if (!approvedClientId || parsed.data.clientId !== approvedClientId) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }
  if (!isSafeExtensionRedirectUri(parsed.data.redirectUri, "/auth", approvedClientId)) {
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  try {
    const consumed = await consumeExtensionAuthCode(parsed.data);
    if (!consumed) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 401 });
    }

    const tokens = await issueExtensionTokenPair(consumed.userId);
    return NextResponse.json(tokens);
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
