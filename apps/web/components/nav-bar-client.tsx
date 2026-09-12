"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnidachiLogoLink } from "@/components/anidachi-logo";
import { Menu, X, ChevronDown } from "lucide-react";
import { NavPricingButton } from "@/components/nav-pricing-button";
import { NavPricingLink } from "@/components/nav-pricing-link";
import { JoinDiscordButton } from "@/components/join-discord-button";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { AccountEntryLink, UserMenu, type NavUser } from "./account-menu";
import "./account-menu.css";
export { UserMenu } from "./account-menu";

type MeResponse = {
  user?: {
    email?: string;
    displayName?: string;
    avatarUrl?: string | null;
    plan?: string;
  };
};

async function fetchNavUser(): Promise<NavUser | null> {
  let response = await fetch("/api/me");
  if (response.status === 401) {
    const refreshResponse = await fetch("/api/auth/refresh", { method: "POST" });
    if (!refreshResponse.ok) return null;
    response = await fetch("/api/me");
  }
  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as MeResponse | null;
  const user = data?.user;
  if (
    !user ||
    typeof user.email !== "string" ||
    typeof user.displayName !== "string" ||
    typeof user.plan !== "string"
  ) {
    return null;
  }

  return {
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    email: user.email,
    plan: user.plan,
  };
}

/** Sibling hubs under Watch — platforms are peers of the anime vertical (not nested under anime). */
const watchHubLinks = [
  {
    href: "/watch-anime-together",
    label: "Watch Anime Together",
    description: "Anime vertical hub",
  },
  {
    href: "/watch-crunchyroll-together",
    label: "Crunchyroll Watch Party",
    description: "Crunchyroll platform",
  },
  {
    href: "/watch-youtube-together",
    label: "YouTube Watch Party",
    description: "YouTube platform",
  },
] as const;

function isWatchClusterPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (
    pathname === "/watch-anime-together" ||
    pathname === "/watch-crunchyroll-together" ||
    pathname === "/watch-youtube-together" ||
    pathname === "/anime-watch-party-toolkit" ||
    pathname === "/anime-watch-party" ||
    pathname.startsWith("/watch-crunchyroll-") ||
    pathname.startsWith("/watch-youtube-") ||
    pathname.startsWith("/watch/")
  ) {
    return true;
  }
  // Genre hubs: /watch-{genre}-anime-with-friends
  if (/^\/watch-[a-z0-9-]+-anime-with-friends$/.test(pathname)) {
    return true;
  }
  // Platform-tagged guide/compare URLs only (avoid lighting Watch on every SEO page)
  return (
    pathname.startsWith("/guides/") || pathname.startsWith("/compare/")
  ) &&
    (pathname.includes("youtube") ||
      pathname.includes("crunchyroll") ||
      pathname.includes("watch2gether") ||
      pathname.includes("teleparty") ||
      pathname.includes("watch-party") ||
      pathname.includes("anime"));
}

function ContactNavMenu({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "tablet" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const links = [
    {
      href: "/contact",
      label: "Contact",
      description: "Support, privacy, security, press",
    },
    {
      href: "/feature-requests",
      label: "Feature Requests",
      description: "Suggest watchroom product ideas",
    },
  ] as const;
  const active = pathname === "/contact" || pathname === "/feature-requests";
  const menuId = "contact-menu";

  useEffect(() => {
    if (variant === "mobile") return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, variant]);

  useEffect(() => {
    if (!open || variant === "mobile") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, variant]);

  if (variant === "mobile") {
    return (
      <li>
        <p
          id="mobile-contact-nav-label"
          className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground/40"
        >
          Contact
        </p>
        <ul
          className="flex flex-col gap-1"
          aria-labelledby="mobile-contact-nav-label"
        >
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 text-base transition-colors hover:bg-brand-orange hover:text-primary-foreground",
                  pathname === link.href
                    ? "text-brand-orange-bright"
                    : "text-foreground/70",
                )}
                onClick={onNavigate}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 transition-colors hover:text-brand-orange-bright",
          active || open ? "text-brand-orange-bright" : "text-foreground/70",
        )}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
      >
        Contact
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Contact options"
          className="absolute left-0 top-full z-[100] w-72 pt-2"
        >
          <div className="rounded-xl border border-brand-border bg-brand-surface p-2 shadow-2xl">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                className={cn(
                  "flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-brand-orange hover:text-primary-foreground",
                  pathname === link.href &&
                    "bg-brand-orange/10 text-brand-orange-bright",
                )}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                <span className="text-sm font-semibold">{link.label}</span>
                <span className="text-xs opacity-70">{link.description}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function WatchNavMenu({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "tablet" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const active = isWatchClusterPath(pathname);
  const menuId = "watch-hubs-menu";

  useEffect(() => {
    if (variant === "mobile") return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, variant]);

  useEffect(() => {
    if (!open || variant === "mobile") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, variant]);

  if (variant === "mobile") {
    return (
      <li>
        <p
          id="mobile-watch-nav-label"
          className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground/40"
        >
          Watch
        </p>
        <ul
          className="flex flex-col gap-1"
          aria-labelledby="mobile-watch-nav-label"
        >
          {watchHubLinks.map((hub) => (
            <li key={hub.href}>
              <Link
                href={hub.href}
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 text-base transition-colors hover:bg-brand-orange hover:text-primary-foreground",
                  pathname === hub.href
                    ? "text-brand-orange-bright"
                    : "text-foreground/70",
                )}
                onClick={onNavigate}
              >
                {hub.label}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 transition-colors hover:text-brand-orange-bright",
          active || open ? "text-brand-orange-bright" : "text-foreground/70",
        )}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
      >
        Watch
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Watch hubs"
          className="absolute left-0 top-full z-[100] w-72 pt-2"
        >
          <div className="rounded-xl border border-brand-border bg-brand-surface p-2 shadow-2xl glow-orange-sm">
            {watchHubLinks.map((hub) => (
              <Link
                key={hub.href}
                href={hub.href}
                role="menuitem"
                className={cn(
                  "flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-brand-orange hover:text-primary-foreground",
                  pathname === hub.href &&
                    "bg-brand-orange/10 text-brand-orange-bright",
                )}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                <span className="text-sm font-semibold">{hub.label}</span>
                <span className="text-xs opacity-70">{hub.description}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function NavBarClient({ user: initialUser }: { user?: NavUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<NavUser | null>(initialUser ?? null);
  const { isOpen: surveyOpen } = usePlanSurvey();

  useEffect(() => {
    if (initialUser !== undefined) {
      setUser(initialUser);
      return;
    }

    let cancelled = false;
    void fetchNavUser().then((nextUser) => {
      if (!cancelled) setUser(nextUser);
    });
    return () => {
      cancelled = true;
    };
  }, [initialUser]);

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

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useBodyScrollLock(menuOpen);

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "top-0 z-[90] flex min-h-14 w-full items-center border-b border-brand-border bg-background/80 pt-safe-top backdrop-blur-xl",
        surveyOpen ? "fixed left-0 right-0" : "sticky",
      )}
    >
      <div className="container mx-auto flex w-full items-center justify-between gap-2 px-4 py-3">
        <AnidachiLogoLink
          size={28}
          wordmarkClassName="hidden min-[400px]:inline text-white"
          className="min-h-11"
          priority
        />

        {/* Desktop inline nav */}
        <ul className="hidden items-center gap-5 text-sm xl:flex">
          <li>
            <Link
              href="/#how-it-works"
              className="inline-flex min-h-11 items-center text-foreground/70 transition-colors hover:text-brand-orange-bright"
            >
              How It Works
            </Link>
          </li>
          <WatchNavMenu variant="desktop" />
          <ContactNavMenu variant="desktop" />
          <li>
            <JoinDiscordButton variant="nav" placement="nav" className="min-h-11 rounded-xl px-4" />
          </li>
          <li>
            {user ? <AccountEntryLink /> : <NavPricingButton />}
          </li>
          <li>
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-9 items-center rounded-full border border-brand-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-brand-orange/50 hover:text-brand-orange-bright"
              >
                Sign in
              </Link>
            )}
          </li>
        </ul>

        {/* Keep account access visible on phones and tablets. */}
        <div className="flex items-center gap-2 xl:hidden">
          {user ? <AccountEntryLink onClick={() => setMenuOpen(false)} /> : (
            <>
              <NavPricingLink className="inline-flex min-h-11 items-center rounded-full border border-brand-orange/30 bg-brand-orange/15 px-3 text-sm font-semibold text-brand-orange-bright" />
              <Link href="/login" className="inline-flex min-h-11 items-center rounded-full border border-brand-border px-3 text-xs font-semibold text-foreground">Sign in</Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white/5"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
          {user && <UserMenu user={user} compact onOpen={() => setMenuOpen(false)} />}
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[45] bg-black/50 xl:hidden touch-none"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="mobile-nav-menu"
            data-scroll-lock-scrollable
            className="absolute inset-x-0 top-full z-[46] max-h-[min(70dvh,calc(100dvh-3.5rem-var(--safe-top)))] overflow-y-auto overscroll-contain border-b border-brand-border bg-background/95 backdrop-blur-xl px-4 py-4 shadow-lg xl:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
          >
            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  href="/#how-it-works"
                  className="flex min-h-11 items-center rounded-lg px-3 text-base text-foreground/70 transition-colors hover:bg-brand-orange hover:text-primary-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  How It Works
                </Link>
              </li>
              <WatchNavMenu
                variant="mobile"
                onNavigate={() => setMenuOpen(false)}
              />
              <ContactNavMenu
                variant="mobile"
                onNavigate={() => setMenuOpen(false)}
              />
              <li>
                <JoinDiscordButton
                  variant="nav"
                  placement="nav_mobile"
                  touchTarget
                  className="w-full"
                  onClick={() => setMenuOpen(false)}
                />
              </li>
              <li>
                  <Link
                  href="/#faq"
                  className="flex min-h-11 items-center rounded-lg px-3 text-base text-foreground/70 transition-colors hover:bg-brand-orange hover:text-primary-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  FAQ
                </Link>
              </li>
              {!user && (
                <>
                  <li className="pt-2" onClick={() => setMenuOpen(false)}><NavPricingButton /></li>
                  <li className="mt-2 border-t border-brand-border pt-2">
                    <Link href="/login" onClick={() => setMenuOpen(false)}
                      className="flex min-h-11 items-center rounded-lg px-3 text-base font-semibold text-foreground">Sign in</Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </>
      )}
    </nav>
  );
}
