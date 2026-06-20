import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { listWatchLibrary } from "@/lib/anidachi-auth/watch-library";
import { WatchLibraryClient } from "./watch-library-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watch Library",
  robots: { index: false, follow: false },
};

export default async function AccountWatchLibraryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Fwatch-library");

  const library = await listWatchLibrary(session.userId);
  return <WatchLibraryClient initialLibrary={library} />;
}
