import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import {
  getWatchHistoryPreferencesV3,
  listWatchHistoryV3,
} from "@/lib/anidachi-auth/watch-history-v3";
import { WatchLibraryClient } from "./watch-library-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watch Library",
  robots: { index: false, follow: false },
};

export default async function AccountWatchLibraryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Fwatch-library");

  const [history, preferences] = await Promise.all([
    listWatchHistoryV3({ userId: session.userId, limit: 24 }),
    getWatchHistoryPreferencesV3({ userId: session.userId }),
  ]);
  return <WatchLibraryClient initialHistory={history} initialPreferences={preferences} />;
}
