import "../../friends/friends.css";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FriendsClient } from "@/app/friends/friends-client";
import { getAccountIdentity } from "@/lib/anidachi-auth/account-identity";
import { listFriends } from "@/lib/anidachi-auth/social";
import { createAccountResponseMeta } from "@/lib/anidachi-auth/account-response";
import { getSession } from "@/lib/anidachi-auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Friends & Groups",
  robots: { index: false, follow: false },
};

export default async function AccountFriendsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Ffriends");

  const clientNavigation = (await headers()).get("rsc") === "1";
  const [{ user, profile }, directory] = await Promise.all([
    getAccountIdentity(session.userId),
    clientNavigation ? null : listFriends(session.userId).then(data => ({ ...data, meta: createAccountResponseMeta() })).catch(() => null),
  ]);

  return (
    <FriendsClient
      key={session.userId}
      initial={directory ? { ownerUserId: session.userId, directory } : undefined}
      currentUser={{
        userId: session.userId,
        displayName: profile?.display_name ?? user?.display_name ?? "AniDachi user",
        email: session.email,
        plan: user?.plan ?? session.plan,
      }}
    />
  );
}
