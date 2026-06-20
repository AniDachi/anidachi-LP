"use client";

import Link from "next/link";
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

  return (
    <nav aria-label="Account sections" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
              active
                ? "bg-violet-500 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
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
  );
}
