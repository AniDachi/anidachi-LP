"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, CircleHelp, Crown, Library, LogOut, User, Users } from "lucide-react";

export type NavUser = {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  plan: string;
};

const destinations = [
  { href: "/account/watch-library", label: "Watch Library", Icon: Library },
  { href: "/account/friends", label: "Friends & Groups", Icon: Users },
  { href: "/account/billing", label: "Subscription", Icon: Crown },
  { href: "/account/profile", label: "Profile", Icon: User },
];

export function AccountEntryLink({ onClick }: { onClick?: () => void }) {
  return <Link href="/account" onClick={onClick} className="site-account-entry">My account</Link>;
}

export function UserMenu({ user, compact = false, onOpen }: {
  user: NavUser;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname, user.email]);
  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    const proceed = async () => {
      setSigningOut(true);
      setError(null);
      try {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) throw new Error("Sign out failed");
        window.location.href = "/";
      } catch {
        setOpen(true);
        setError("Could not sign out. Please try again.");
      } finally { setSigningOut(false); }
    };
    // Preserve the account editor's Save / Discard / Stay interception.
    const intent = new CustomEvent("anidachi:before-sign-out", { cancelable: true, detail: proceed });
    if (window.dispatchEvent(intent)) await proceed();
  }

  const initial = (user.displayName.trim() || user.email).slice(0, 1).toUpperCase();
  const avatar = (size: number) => user.avatarUrl ? (
    <Image src={user.avatarUrl} alt="" width={size} height={size} className="site-account-avatar" />
  ) : <span className="site-account-avatar site-account-initial" aria-hidden="true">{initial}</span>;

  return (
    <div ref={ref} className={`site-account-menu${compact ? " site-account-menu-compact" : ""}`}>
      <button ref={trigger} type="button" className="site-account-trigger"
        aria-label="Account menu" aria-expanded={open} aria-controls={id}
        onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}>
        {avatar(32)}
        <span className="site-account-trigger-name">{user.displayName}</span>
        <ChevronDown className="site-account-chevron" size={15} aria-hidden="true" />
      </button>
      {open && (
        <nav id={id} aria-label="Account shortcuts" className="site-account-panel">
          <div className="site-account-summary">
            {avatar(44)}
            <div className="site-account-details">
              <div className="site-account-name-line">
                <span className="site-account-name" title={user.displayName}>{user.displayName}</span>
                <span className="site-account-plan">{user.plan}</span>
              </div>
              <p className="site-account-email" title={user.email}>{user.email}</p>
            </div>
          </div>
          <div className="site-account-links">
            {destinations.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="site-account-item"
                aria-current={pathname === href ? "page" : undefined}
                onClick={() => setOpen(false)}>
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
                <ChevronRight size={16} className="site-account-item-arrow" aria-hidden="true" />
              </Link>
            ))}
          </div>
          <div className="site-account-footer">
            <Link href="/account/help" className="site-account-item" onClick={() => setOpen(false)}
              aria-current={pathname === "/account/help" ? "page" : undefined}>
              <CircleHelp size={20} aria-hidden="true" /><span>Help</span>
            </Link>
            <button type="button" className="site-account-item" disabled={signingOut} onClick={handleSignOut}>
              <LogOut size={20} aria-hidden="true" /><span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
            {error && <p role="alert" className="site-account-error">{error}</p>}
          </div>
        </nav>
      )}
    </div>
  );
}
