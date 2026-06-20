import { NextResponse } from "next/server";
import { SocialApiError } from "./social";

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
