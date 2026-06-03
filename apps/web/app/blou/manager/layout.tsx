import type { Metadata } from "next";
import Link from "next/link";
import { requireBlouAccess } from "@/lib/blou-access";
import { BlouManagerLogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blou Content Manager",
  description: "Internal tool to publish reels and carousels to Instagram and TikTok.",
  robots: { index: false, follow: false },
};

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBlouAccess("/blou/manager");

  return (
    <main className="min-h-screen bg-[#f0f7f4]">
      <header className="sticky top-14 z-40 border-b border-teal-200/60 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/blou/manager"
            className="text-lg font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            Blou
          </Link>
          <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link
              href="/blou/manager"
              className="text-sm text-stone-500 hover:text-teal-600 transition-colors"
            >
              Connect
            </Link>
            <Link
              href="/blou/manager/publish"
              className="text-sm text-stone-500 hover:text-teal-600 transition-colors"
            >
              Publish
            </Link>
            <BlouManagerLogoutButton />
          </nav>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">{children}</div>
    </main>
  );
}
