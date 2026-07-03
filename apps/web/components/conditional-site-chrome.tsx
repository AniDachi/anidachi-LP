"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthMinimalNav } from "@/components/auth-minimal-nav";

type MinimalChromeConfig = {
  backHref: string;
  backLabel: string;
  hint?: string;
};

function minimalChromeForPath(pathname: string): MinimalChromeConfig | null {
  if (pathname === "/login") {
    return { backHref: "/", backLabel: "Back to home" };
  }
  if (pathname.startsWith("/room/")) {
    return { backHref: "/account", backLabel: "Account" };
  }
  if (pathname.startsWith("/extension/connect")) {
    return {
      backHref: "/",
      backLabel: "Back to home",
      hint: "After sign-in, return to Chrome on your computer to finish connecting the extension.",
    };
  }
  return null;
}

export function ConditionalNav({ marketingNav }: { marketingNav: ReactNode }) {
  const pathname = usePathname();
  const minimal = minimalChromeForPath(pathname);
  if (minimal) {
    return (
      <AuthMinimalNav
        backHref={minimal.backHref}
        backLabel={minimal.backLabel}
        hint={minimal.hint}
      />
    );
  }
  return marketingNav;
}

export function ConditionalFooter({ marketingFooter }: { marketingFooter: ReactNode }) {
  const pathname = usePathname();
  if (minimalChromeForPath(pathname)) {
    return null;
  }
  return marketingFooter;
}
