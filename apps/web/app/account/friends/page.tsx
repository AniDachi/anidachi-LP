import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FriendsClient } from "@/app/friends/friends-client";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { ensureProfileForUser } from "@/lib/anidachi-auth/social";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Friends & Groups",
  robots: { index: false, follow: false },
};

export default async function AccountFriendsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Ffriends");

  const [user, profile] = await Promise.all([
    getUserById(session.userId),
    ensureProfileForUser(session.userId),
  ]);

  return (
    <FriendsClient
      currentUser={{
        userId: session.userId,
        displayName: profile?.display_name ?? user?.display_name ?? "AniDachi user",
        email: session.email,
        plan: session.plan,
      }}
    />
  );
}
