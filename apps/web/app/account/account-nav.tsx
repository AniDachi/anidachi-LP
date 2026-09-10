"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, CreditCard, CircleHelp, Lightbulb, Menu, Users, X } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const desktop = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const currentLabel = [...PRIMARY, ...SECONDARY].find(item => isActive(item.href))?.label
    ?? (isActive("/account/profile") ? "Profile" : "Your account");
  const close = useCallback(() => {
    dialog.current?.close();
    setOpen(false);
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => { close(); }, [pathname, close]);
  useEffect(() => {
    const element = dialog.current;
    const desktopWidth = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      if (!desktopWidth.matches || !element?.open) return;
      close();
      const activeLink = desktop.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')
        ?? desktop.current?.querySelector<HTMLAnchorElement>("a");
      activeLink?.focus();
    };
    desktopWidth.addEventListener("change", update);
    return () => { desktopWidth.removeEventListener("change", update); element?.close(); };
  }, [close]);

  const links = (items: ReadonlyArray<{ href: string; label: string; icon: typeof BookOpen }>, mobile = false) => items.map(item => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
      onNavigate={mobile ? close : undefined}>
      <Icon size={18} aria-hidden /><span>{item.label}</span>
    </Link>;
  });
  const navigation = (mobile = false) => <div className="account-navigation">
      <nav className="account-primary-nav" aria-label="Account sections">{links(PRIMARY, mobile)}</nav>
      <nav className="account-secondary-nav" aria-label="Help and feedback">{links(SECONDARY, mobile)}</nav>
    </div>;

  return <>
    <div className="account-desktop-nav" ref={desktop}>
      <p className="account-nav-label">YOUR SPACE</p>
      {navigation()}
    </div>
    <div className="account-mobile-nav-bar">
      <button ref={trigger} type="button" className="account-nav-trigger"
        aria-label="Open account navigation" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(true)}>
        <Menu size={19} aria-hidden /><span>Menu</span>
      </button>
      <span className="account-current-section">{currentLabel}</span>
    </div>
    <dialog ref={dialog} id={id} className="account-mobile-drawer" aria-labelledby={`${id}-title`}
      onCancel={event => { event.preventDefault(); close(); }}
      onClose={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
      <div className="account-drawer-heading">
        <h2 id={`${id}-title`}>Your account</h2>
        <button type="button" className="account-drawer-close" aria-label="Close account navigation" onClick={close}>
          <X size={20} aria-hidden />
        </button>
      </div>
      {navigation(true)}
    </dialog>
  </>;
}
