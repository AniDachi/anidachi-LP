"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthMinimalNav } from "@/components/auth-minimal-nav";

const AUTH_GATE_PATHS = ["/login"] as const;

function isAuthGate(pathname: string) {
  return AUTH_GATE_PATHS.some((path) => pathname === path);
}

export function ConditionalNav({ marketingNav }: { marketingNav: ReactNode }) {
  const pathname = usePathname();
  if (isAuthGate(pathname)) {
    return <AuthMinimalNav />;
  }
  return marketingNav;
}

export function ConditionalFooter({ marketingFooter }: { marketingFooter: ReactNode }) {
  const pathname = usePathname();
  if (isAuthGate(pathname)) {
    return null;
  }
  return marketingFooter;
}
