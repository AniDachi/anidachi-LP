import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getUserById } from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import { ensureProfileForUser } from "@/lib/anidachi-auth/social";
import { AccountNav } from "./account-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
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

  return (
    <main id="main-content" className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
              Account
            </p>
            <h1 className="mt-2 truncate text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 truncate text-sm text-slate-400">{session.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-violet-100">
              {PLAN_LABELS[session.plan] ?? session.plan}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:border-r lg:border-white/10 lg:pr-4">
            <AccountNav />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}
