"use client";

import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountInboxResponse } from "@anidachi/protocol";
import { InvitesClient } from "@/app/account/invites/invites-client";
import { parseOwnedAccountInboxResponse } from "@/lib/anidachi-auth/account-inbox-client";
import { api } from "@/lib/client-api";

export function AccountNotifications({ ownerUserId }: { ownerUserId: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [counts, setCounts] = useState<AccountInboxResponse["counts"] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const visible = useRef(open);
  visible.current = open;

  const updateCounts = useCallback((value: AccountInboxResponse["counts"]) => {
    ++generation.current;
    setCounts(value);
  }, []);
  useEffect(() => {
    let disposed = false;
    const refreshBadge = async () => {
      if (disposed || visible.current || document.visibilityState === "hidden") return;
      const request = ++generation.current;
      try {
        const payload = await api<unknown>("/api/account/inbox?limit=1");
        const page = parseOwnedAccountInboxResponse(payload, ownerUserId);
        if (!disposed && generation.current === request) setCounts(page.counts);
      } catch { /* A badge refresh must not replace the user's working page. */ }
    };
    const socialChanged = (event: Event) => {
      if ((event as CustomEvent<{ ownerUserId: string }>).detail?.ownerUserId === ownerUserId) void refreshBadge();
    };
    void refreshBadge();
    const timer = window.setInterval(refreshBadge, 60_000);
    window.addEventListener("focus", refreshBadge);
    document.addEventListener("visibilitychange", refreshBadge);
    window.addEventListener("anidachi:account-social-changed", socialChanged);
    return () => {
      disposed = true; ++generation.current; window.clearInterval(timer);
      window.removeEventListener("focus", refreshBadge);
      document.removeEventListener("visibilitychange", refreshBadge);
      window.removeEventListener("anidachi:account-social-changed", socialChanged);
    };
  }, [ownerUserId]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open, mounted]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  const unread = counts?.unseen ?? 0;
  return <>
    <button className="account-bell" type="button" ref={trigger}
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { ++generation.current; setJoinError(null); setMounted(true); setOpen(true); }}>
      <Bell size={20} aria-hidden />
      {unread > 0 && <span className="account-unread" aria-hidden>{unread > 99 ? "99+" : unread}</span>}
    </button>
    {joinError && !open && <div className="account-join-error ac-notice ac-notice-error" role="alert">
      <p>{joinError}</p>
      <button type="button" className="ac-text-link" onClick={() => { setJoinError(null); setOpen(true); }}>View invitations</button>
      <button type="button" className="ac-button ac-button-icon ac-button-quiet" aria-label="Dismiss invitation error" onClick={() => setJoinError(null)}><X size={16} aria-hidden /></button>
    </div>}
    {mounted && <dialog ref={dialog} className="account-notifications" aria-labelledby="account-notification-title"
      onCancel={event => { event.preventDefault(); close(); }}
      onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      } }}>
      <div className="account-notification-heading"><h2 id="account-notification-title">Notifications</h2>
        <button className="ac-button ac-button-icon ac-button-quiet" type="button" aria-label="Close notifications" onClick={close}><X size={19} aria-hidden /></button>
      </div>
      <div className="account-notification-content">
        <InvitesClient ownerUserId={ownerUserId} embedded active={open} onCountsChange={updateCounts} onBeforeNavigate={close} onNavigateError={setJoinError} />
      </div>
    </dialog>}
  </>;
}
