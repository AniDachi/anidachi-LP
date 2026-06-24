import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=%2Faccount");
  }

  const [user, profile] = await Promise.all([
    getUserById(session.userId),
    ensureProfileForUser(session.userId),
  ]);
  const displayName = profile?.display_name ?? user?.display_name ?? "AniDachi user";
  const effectivePlan = user?.plan ?? session.plan;
  const planLabel = getPlanEntitlements(effectivePlan).label;

  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground/90">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-brand-border pb-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-orange">
              Account
            </p>
            <h1 className="mt-2 truncate text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 truncate text-sm text-foreground/50">{session.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-brand-orange/30 bg-brand-orange/15 px-3 py-1.5 text-brand-orange">
              {planLabel}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:border-r lg:border-brand-border lg:pr-4">
            <AccountNav />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}
