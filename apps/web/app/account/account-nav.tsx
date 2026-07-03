"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Inbox, User, Users } from "lucide-react";

const ITEMS = [
  { href: "/account", label: "Overview", icon: User },
  { href: "/account/watch-library", label: "Watch Library", icon: BookOpen },
  { href: "/account/friends", label: "Friends & Groups", icon: Users },
  { href: "/account/invites", label: "Invites", icon: Inbox },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/account") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const activeEl = activeRef.current;
    const nav = navRef.current;
    if (!activeEl || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    if (activeRect.left < navRect.left || activeRect.right > navRect.right) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [pathname]);

  return (
    <div className="relative lg:static">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent lg:hidden"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent lg:hidden"
        aria-hidden
      />
      <nav
        ref={navRef}
        aria-label="Account sections"
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              ref={active ? activeRef : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                active
                  ? "bg-brand-orange text-primary-foreground"
                  : "text-foreground/70 hover:bg-brand-orange hover:text-primary-foreground"
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
