"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hreflangPairFor } from "@/lib/hreflang";

/**
 * Footer language links (German pilot). Each language links to the matching page when the
 * current page has a translation, otherwise to that language's homepage. No automatic redirect.
 */
export function LanguageSwitcher() {
  const pathname = usePathname() || "/";
  const pair = hreflangPairFor(pathname);
  const onGerman = pathname === "/de" || pathname.startsWith("/de/");
  const links = [
    { lang: "en", label: "English", href: pair?.en ?? "/", active: !onGerman },
    { lang: "de", label: "Deutsch", href: pair?.de ?? "/de", active: onGerman },
  ];
  return (
    <nav aria-label="Language / Sprache" className="mb-3 flex justify-center gap-3">
      {links.map((link, i) => (
        <span key={link.lang} className="flex items-center gap-3">
          {i > 0 ? <span aria-hidden="true">·</span> : null}
          {link.active ? (
            <span aria-current="page" className="text-ani-text">
              {link.label}
            </span>
          ) : (
            <Link href={link.href} hrefLang={link.lang} lang={link.lang} className="hover:text-ani-text transition-colors">
              {link.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
