import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getPlanEntitlements } from "@/lib/anidachi-auth/plan-entitlements";
import { getSession } from "@/lib/anidachi-auth/session";
import { ensureProfileForUser } from "@/lib/anidachi-auth/social";
import { AccountNav } from "./account-nav";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import { UserMenu } from "@/components/nav-bar-client";
import { AccountWorkspaceProvider } from "@/components/account/account-workspace-state";
import { AccountNotifications } from "@/components/account/account-notifications";
import "./account.css";
import "./social.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=%2Faccount");
  }

  const [user, profile] = await Promise.all([
    getUserById(session.userId),
    ensureProfileForUser(session.userId),
  ]);
  const displayName =
    profile?.display_name ?? user?.display_name ?? "AniDachi user";
  const effectivePlan = user?.plan ?? session.plan;
  const planLabel = getPlanEntitlements(effectivePlan).label;

  return (
    <AccountWorkspaceProvider key={session.userId}>
    <main id="main-content" className="account-workspace min-h-screen bg-background text-foreground/90">
      <header className="account-header">
        <AnidachiLogoLink size={28} />
        <div className="account-identity">
          <span className="account-plan">{planLabel}</span>
          <AccountNotifications key={session.userId} ownerUserId={session.userId} />
          <UserMenu user={{ displayName, email: session.email, plan: effectivePlan,
            avatarUrl: profile?.avatar_url ?? user?.avatar_url ?? null }} />
        </div>
      </header>
      <div className="account-frame">
          <aside className="account-sidebar">
            <p className="account-nav-label">YOUR SPACE</p>
            <AccountNav />
          </aside>
          <section className="account-content min-w-0">{children}</section>
      </div>
    </main>
    </AccountWorkspaceProvider>
  );
}
