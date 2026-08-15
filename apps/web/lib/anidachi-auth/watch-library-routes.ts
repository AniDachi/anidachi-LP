import { NextResponse } from "next/server";
import { WatchLibraryApiError } from "./watch-library";

export function watchLibraryUpgradeRequiredResponse(): NextResponse {
  return NextResponse.json(
    { code: "UPGRADE_REQUIRED", message: "Upgrade to Watch History v2" },
    { status: 426 },
  );
}

export function watchLibraryErrorResponse(error: unknown): NextResponse {
  if (error instanceof WatchLibraryApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[anidachi/watch-library] Unexpected API error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
