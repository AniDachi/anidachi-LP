"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CreditCard, CircleHelp, Lightbulb, Users } from "lucide-react";

const PRIMARY = [
  { href: "/account/watch-library", label: "Watch Library", icon: BookOpen },
  { href: "/account/friends", label: "Friends & Groups", icon: Users },
  { href: "/account/billing", label: "Subscription", icon: CreditCard },
] as const;
const SECONDARY = [
  { href: "/account/feature-requests", label: "Share an idea", icon: Lightbulb },
  { href: "/account/help", label: "Help", icon: CircleHelp },
] as const;

export function AccountNav() {
  const pathname = usePathname();
  const links = (items: ReadonlyArray<{ href: string; label: string; icon: typeof BookOpen }>) => items.map(item => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
      <Icon size={18} aria-hidden /><span>{item.label}</span>
    </Link>;
  });
  return <div className="account-navigation">
    <nav className="account-primary-nav" aria-label="Account sections">{links(PRIMARY)}</nav>
    <nav className="account-secondary-nav" aria-label="Help and feedback">{links(SECONDARY)}</nav>
  </div>;
}
