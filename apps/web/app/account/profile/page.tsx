import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { ensureProfileForUser } from "@/lib/anidachi-auth/social";
import { getAccountWaitlistStatus } from "@/lib/kreatli-crm/survey-lead";
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
  const [user, profile, waitlist] = await Promise.all([
    getUserById(session.userId),
    ensureProfileForUser(session.userId),
    getAccountWaitlistStatus(session.email),
  ]);
  return (
    <ProfileClient
      key={session.userId}
      ownerUserId={session.userId}
      email={session.email}
      initialProfile={{
        displayName: profile?.display_name ?? user?.display_name ?? "AniDachi user",
        handle: profile?.handle ?? null,
        avatarUrl: profile?.avatar_url ?? user?.avatar_url ?? null,
      }}
      waitlist={waitlist}
    />
  );
}
