import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const groups = [
  {
    heading: "Watch together",
    links: [
      { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
      { href: "/netflix-watch-party", label: "Netflix watch party" },
      { href: "/watch-youtube-together", label: "YouTube watch party" },
      { href: "/discord-watch-party", label: "Discord watch party" },
      { href: "/watch-anime-together", label: "Watch anime together" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { href: "/guides", label: "All guides" },
      { href: "/watch", label: "Anime A–Z" },
      { href: "/compare", label: "Compare watch party apps" },
      { href: "/tools", label: "Free anime tools" },
      { href: "/glossary", label: "Glossary" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/extension", label: "Install the extension" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact support" },
    ],
  },
];

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <article className="container mx-auto max-w-3xl px-4 py-14 lg:py-20">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.08em] text-ani-muted">404</p>
        <h1 className="mb-4 text-balance text-4xl font-semibold tracking-[-0.03em] text-ani-text md:text-5xl md:leading-[1.08]">
          This page doesn&apos;t exist
        </h1>
        <p className="mb-8 leading-relaxed text-ani-muted">
          The link may be old or mistyped. These pages are a good place to start:
        </p>
        <div className="grid gap-8 sm:grid-cols-3">
          {groups.map((group) => (
            <section key={group.heading} aria-labelledby={`not-found-${group.heading}`}>
              <h2
                id={`not-found-${group.heading}`}
                className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-ani-muted"
              >
                {group.heading}
              </h2>
              <ul className="space-y-3">
                {group.links.map((link) => (
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
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
