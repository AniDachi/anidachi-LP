import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { FriendsClient } from "./friends-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Friends",
  robots: { index: false, follow: false },
};

export default async function FriendsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=%2Ffriends");
  }

  const user = await getUserById(session.userId);

  return (
    <FriendsClient
      currentUser={{
        userId: session.userId,
        displayName: user?.display_name ?? "AniDachi user",
        email: session.email,
        plan: session.plan,
      }}
    />
  );
}
