import type { ExtensionUninstallCapability } from "@anidachi/protocol";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Ships with /uninstall and its APIs, after their schema has been deployed.
// Availability does not imply eligibility or that a retention campaign is on.
export function GET() {
  return NextResponse.json({ version: 1, available: true } satisfies ExtensionUninstallCapability, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
