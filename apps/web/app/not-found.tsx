import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const links = [
  { href: "/watch-anime-together", label: "Watch anime together" },
  { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
  { href: "/watch-youtube-together", label: "YouTube watch party" },
  { href: "/extension", label: "Install the extension" },
  { href: "/pricing", label: "Pricing" },
];

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <article className="container mx-auto max-w-2xl px-4 py-14 lg:py-20">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.08em] text-ani-muted">404</p>
        <h1 className="mb-4 text-balance text-4xl font-semibold tracking-[-0.03em] text-ani-text md:text-5xl md:leading-[1.08]">
          This page doesn&apos;t exist
        </h1>
        <p className="mb-8 leading-relaxed text-ani-muted">
          The link may be old or mistyped. These pages are a good place to start:
        </p>
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="font-medium text-ani-text underline decoration-ani-line underline-offset-4 hover:decoration-ani-text"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </main>
  );
}
