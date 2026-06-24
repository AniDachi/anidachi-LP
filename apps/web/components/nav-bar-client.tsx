"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import { Menu, X, LogOut, ChevronDown, Users } from "lucide-react";
import { NavPricingButton } from "@/components/nav-pricing-button";
import { NavPricingLink } from "@/components/nav-pricing-link";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";
import { cn } from "@/lib/utils";

type NavUser = {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  plan: string;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex min-h-9 items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pl-1 pr-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.displayName}
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[--brand-orange] text-xs font-bold text-[--primary-foreground]">
            {initials}
          </span>
        )}
        <span className="max-w-[120px] truncate">{user.displayName}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-64 rounded-xl border border-[--brand-border] bg-[--brand-surface] shadow-2xl glow-orange-sm">
          {/* User info */}
          <div className="flex items-center gap-3 border-b border-[--brand-border] px-4 py-3">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[--brand-orange] text-sm font-bold text-[--primary-foreground]">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{user.displayName}</p>
              <p className="truncate text-xs text-foreground/50">{user.email}</p>
            </div>
          </div>

          {/* Plan badge */}
          <div className="px-4 py-2.5">
            <span className="inline-block rounded-full bg-[--brand-orange]/15 border border-[--brand-orange]/30 px-2.5 py-0.5 text-xs font-medium text-[--brand-orange-bright]">
              {PLAN_LABELS[user.plan] ?? user.plan}
            </span>
          </div>

          {/* Actions */}
          <div className="border-t border-[--brand-border] px-2 py-2">
            <Link
              href="/account/friends"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-[--brand-orange]/10 hover:text-foreground"
            >
              <Users className="h-4 w-4" aria-hidden />
              Friends
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-[--brand-orange]/10 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileSignOut({ onDone }: { onDone: () => void }) {
  async function handleSignOut() {
    onDone();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-base text-foreground/70 transition-colors hover:bg-[--brand-orange]/10 hover:text-foreground"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      Sign out
    </button>
  );
}

const navLinks = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/watch-anime-together", label: "Watch" },
  { href: "mailto:goshan.tolochko@gmail.com", label: "Contact" },
] as const;

function isExternalNavLink(href: string) {
  return href.startsWith("mailto:") || href.startsWith("http");
}

export function NavBarClient({ user }: { user?: NavUser | null }) {
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
        "top-0 z-[90] flex min-h-14 w-full items-center border-b border-[--brand-border] bg-background/80 backdrop-blur-xl",
        surveyOpen ? "fixed left-0 right-0" : "sticky",
      )}
    >
      <div className="container mx-auto flex w-full items-center justify-between gap-2 px-4 py-3">
        <AnidachiLogoLink
          size={28}
          wordmarkClassName="text-white"
          className="min-h-11"
          priority
        />

        {/* Desktop inline nav */}
        <ul className="hidden items-center gap-4 text-sm md:flex md:gap-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              {isExternalNavLink(link.href) ? (
                <a
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-foreground/70 transition-colors hover:text-[--brand-orange-bright]"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-foreground/70 transition-colors hover:text-[--brand-orange-bright]"
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
          <li>
            <NavPricingButton />
          </li>
          <li>
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-9 items-center rounded-full border border-[--brand-border] px-4 text-sm font-semibold text-foreground transition-colors hover:border-[--brand-orange]/50 hover:text-[--brand-orange-bright]"
              >
                Sign in
              </Link>
            )}
          </li>
        </ul>

        {/* Mobile: pricing + menu */}
        <div className="flex items-center gap-1 md:hidden">
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center sm:hidden">
            <NavPricingLink className="inline-flex min-h-11 items-center rounded-full bg-[--brand-orange]/15 border border-[--brand-orange]/30 px-3 text-sm font-semibold text-[--brand-orange-bright] transition-colors hover:bg-[--brand-orange]/25" />
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
                className="inline-flex min-h-11 items-center text-foreground/70 transition-colors hover:text-[--brand-orange-bright]"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="hidden sm:block">
            <NavPricingLink className="inline-flex min-h-11 items-center font-semibold text-[--brand-orange-bright] transition-colors hover:text-[--brand-orange]" />
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
            className="fixed inset-x-0 top-14 z-[46] max-h-[min(70dvh,calc(100dvh-3.5rem))] overflow-y-auto overscroll-contain border-b border-[--brand-border] bg-background/95 backdrop-blur-xl px-4 py-4 shadow-lg md:hidden"
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
                      className="flex min-h-11 items-center rounded-lg px-3 text-base text-foreground/70 transition-colors hover:bg-[--brand-orange]/10 hover:text-[--brand-orange-bright]"
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="flex min-h-11 items-center rounded-lg px-3 text-base text-foreground/70 transition-colors hover:bg-[--brand-orange]/10 hover:text-[--brand-orange-bright]"
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
                  className="flex min-h-11 items-center rounded-lg px-3 text-base text-foreground/70 transition-colors hover:bg-[--brand-orange]/10 hover:text-[--brand-orange-bright]"
                  onClick={() => setMenuOpen(false)}
                >
                  FAQ
                </Link>
              </li>
              <li className="pt-2" onClick={() => setMenuOpen(false)}>
                <NavPricingButton />
              </li>
              {user ? (
                <>
                  <li className="mt-3 border-t border-[--brand-border] pt-3">
                    <div className="flex items-center gap-3 px-3 py-1">
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={user.displayName}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[--brand-orange] text-sm font-bold text-[--primary-foreground]">
                          {user.displayName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
                        <p className="truncate text-xs text-foreground/50">{user.email}</p>
                      </div>
                    </div>
                  </li>
                  <li>
                    <Link
                      href="/account/friends"
                      className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-base text-foreground/70 transition-colors hover:bg-[--brand-orange]/10 hover:text-foreground"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Users className="h-4 w-4" aria-hidden />
                      Friends
                    </Link>
                  </li>
                  <li>
                    <MobileSignOut onDone={() => setMenuOpen(false)} />
                  </li>
                </>
              ) : (
                <li className="mt-2 border-t border-[--brand-border] pt-2" onClick={() => setMenuOpen(false)}>
                  <Link
                    href="/login"
                    className="flex min-h-11 items-center rounded-lg px-3 text-base font-semibold text-foreground transition-colors hover:bg-[--brand-orange]/10 hover:text-[--brand-orange-bright]"
                  >
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </nav>
  );
}
