"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { NavPricingButton } from "@/components/nav-pricing-button";
import { NavPricingLink } from "@/components/nav-pricing-link";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/watch-anime-together", label: "Watch" },
  { href: "mailto:goshan.tolochko@gmail.com", label: "Contact" },
] as const;

function isExternalNavLink(href: string) {
  return href.startsWith("mailto:") || href.startsWith("http");
}

export function NavBarClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isOpen: surveyOpen } = usePlanSurvey();

  useEffect(() => {
    if (surveyOpen) setMenuOpen(false);
  }, [surveyOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "top-0 z-[90] flex min-h-14 w-full items-center border-b border-white/10 bg-purple-900/95 backdrop-blur-md",
        surveyOpen ? "fixed left-0 right-0" : "sticky",
      )}
    >
      <div className="container mx-auto flex w-full items-center justify-between gap-2 px-4 py-3">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Image
            src="/Anidachi_logo.webp"
            alt="AniDachi logo"
            width={28}
            height={28}
            sizes="28px"
            className="object-contain"
          />
          AniDachi
        </Link>

        {/* Desktop inline nav */}
        <ul className="hidden items-center gap-4 text-sm md:flex md:gap-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              {isExternalNavLink(link.href) ? (
                <a
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-purple-100 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-purple-100 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
          <li>
            <NavPricingButton />
          </li>
        </ul>

        {/* Mobile: pricing + menu */}
        <div className="flex items-center gap-1 md:hidden">
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center sm:hidden">
            <NavPricingLink className="inline-flex min-h-11 items-center rounded-full bg-white/15 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/25" />
          </span>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Tablet: show text pricing link, hide hamburger until md */}
        <ul className="hidden items-center gap-4 text-sm sm:flex md:hidden">
          {navLinks.slice(0, 2).map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center text-purple-100 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="hidden sm:block">
            <NavPricingLink className="inline-flex min-h-11 items-center font-semibold text-white transition-colors hover:text-purple-100" />
          </li>
        </ul>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[45] bg-black/50 md:hidden touch-none"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="mobile-nav-menu"
            className="fixed inset-x-0 top-14 z-[46] max-h-[min(70dvh,calc(100dvh-3.5rem))] overflow-y-auto overscroll-contain border-b border-white/10 bg-purple-900/98 px-4 py-4 shadow-lg md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
          >
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  {isExternalNavLink(link.href) ? (
                    <a
                      href={link.href}
                      className="flex min-h-11 items-center rounded-lg px-3 text-base text-purple-100 transition-colors hover:bg-white/10 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="flex min-h-11 items-center rounded-lg px-3 text-base text-purple-100 transition-colors hover:bg-white/10 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
              <li>
                <Link
                  href="/#faq"
                  className="flex min-h-11 items-center rounded-lg px-3 text-base text-purple-100 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  FAQ
                </Link>
              </li>
              <li className="pt-2" onClick={() => setMenuOpen(false)}>
                <NavPricingButton />
              </li>
            </ul>
          </div>
        </>
      )}
    </nav>
  );
}
