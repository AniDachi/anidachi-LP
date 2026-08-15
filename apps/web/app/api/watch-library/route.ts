import { watchLibraryUpgradeRequiredResponse } from "@/lib/anidachi-auth/watch-library-routes";

export const dynamic = "force-dynamic";

export async function GET() {
  return watchLibraryUpgradeRequiredResponse();
}

export async function DELETE() {
  return watchLibraryUpgradeRequiredResponse();
}
