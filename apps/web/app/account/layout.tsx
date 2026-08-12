import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getPlanEntitlements } from "@/lib/anidachi-auth/plan-entitlements";
import { getSession } from "@/lib/anidachi-auth/session";
import { ensureProfileForUser } from "@/lib/anidachi-auth/social";
import { AccountNav } from "./account-nav";

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
    <main id="main-content" className="min-h-screen bg-background text-foreground/90">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-col justify-between gap-5 border-b border-brand-border/80 pb-7 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-brand-orange">
              ACCOUNT
            </p>
            <h1 className="mt-2 truncate text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 truncate text-sm text-foreground/45">
              {session.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-brand-orange/35 bg-brand-orange/12 px-3.5 py-1.5 text-xs font-semibold text-brand-orange-bright">
              {planLabel}
            </span>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:border-r lg:border-brand-border/70 lg:pr-5">
            <AccountNav />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}
