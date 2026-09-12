import { NextResponse } from "next/server";
import { SocialApiError } from "./social";
import { SOCIAL_OWNER_HEADER } from "../social-editor-contracts";

// Optional on established APIs to retain extension compatibility. The new web
// client supplies it; authentication always determines the actual owner.
export function socialOwnerError(request: Request, ownerUserId: string) {
  const expected = request.headers.get(SOCIAL_OWNER_HEADER);
  return expected && expected !== ownerUserId
    ? NextResponse.json({ error: "Your account changed. Reload before continuing." }, { status: 409 })
    : null;
}

export function socialErrorResponse(error: unknown): NextResponse {
  if (error instanceof SocialApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[anidachi/social] Unexpected API error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
