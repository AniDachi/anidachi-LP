import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import { Hero } from "@/components/hero";
import { MobileInstallProvider } from "@/components/mobile-install-panel";
import { InstallLink } from "@/components/install-link";
import { INSTALL_HUB_PATH } from "@/lib/install-cta";

export const metadata: Metadata = { title: "Mobile install preview", robots: { index: false, follow: false } };

export default async function MobileInstallPreview({ searchParams }: { searchParams: Promise<{ frame?: string; width?: string; height?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  if (params.frame === "1") return <MobileInstallProvider mobilePreview>
    <main id="main-content" style={{ minHeight: "100dvh", background: "#0c0d0e" }}>
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <AnidachiLogoLink size={29} />
        <InstallLink href={INSTALL_HUB_PATH} className="rounded-full bg-ani-primary px-5 py-2 text-sm font-semibold text-ani-on-primary">Install</InstallLink>
      </header>
      <Hero />
    </main>
  </MobileInstallProvider>;

  const width = params.width === "320" ? 320 : params.width === "430" ? 430 : 390;
  const height = params.height === "568" ? 568 : 844;
  return <main id="main-content" className="min-h-screen bg-[#090a0b] px-4 py-8">
    <div className="mx-auto mb-6 flex max-w-[900px] items-center justify-between gap-4">
      <div><h1 className="text-lg font-medium text-ani-text">Mobile install</h1><p className="mt-1 text-sm text-ani-muted">Local preview · tap Install</p></div>
      <Link href="/" className="text-sm text-ani-muted underline underline-offset-4">Open website</Link>
    </div>
    <iframe src="/dev/mobile-install?frame=1" title="AniDachi mobile install preview" style={{ display: "block", width, maxWidth: "100%", height: `min(${height}px, calc(100dvh - 136px))`, minHeight: 480, margin: "0 auto", border: "1px solid #ffffff1c", borderRadius: 28, background: "#0c0d0e" }} />
  </main>;
}
