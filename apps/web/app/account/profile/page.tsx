import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountIdentity } from "@/lib/anidachi-auth/account-identity";
import { getSession } from "@/lib/anidachi-auth/session";
import { ProfileClient } from "./profile-client";
import "./profile.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Fprofile");
  const { user, profile } = await getAccountIdentity(session.userId);
  return (
    <ProfileClient
      key={session.userId}
      ownerUserId={session.userId}
      email={session.email}
      initialProfile={{
        displayName:
          profile?.display_name ?? user?.display_name ?? "AniDachi user",
        handle: profile?.handle ?? null,
        avatarUrl: profile?.avatar_url ?? user?.avatar_url ?? null,
      }}
    />
  );
}
