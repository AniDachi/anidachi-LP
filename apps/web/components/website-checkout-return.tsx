"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BillingOwnerChangedError, guardBillingNavigation } from "@/lib/billing-navigation";
import { EXTENSION_WELCOME_PATH } from "@/lib/extension-welcome";

/** Render only after the exact Checkout and its subscription were confirmed. */
export function WebsiteCheckoutReturn({ owner }: { owner: string }) {
  const [failed, setFailed] = useState<"account" | "network" | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    let departures = 0;
    const onBlur = () => { departures++; };
    const onVisibility = () => { if (document.visibilityState === "hidden") departures++; };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setTimeout(() => {
      void guardBillingNavigation(owner, abort.signal, true, () => departures).then(() => {
        if (!abort.signal.aborted) window.location.replace(EXTENSION_WELCOME_PATH);
      }, error => {
        if (!abort.signal.aborted) setFailed(error instanceof BillingOwnerChangedError ? "account" : "network");
      });
    }, 0);
    return () => {
      clearTimeout(timer); abort.abort();
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [owner]);
  return <p className="my-6 text-center text-sm text-ani-muted" role="status">
    {failed === "account" ? "Your account changed. Open your account to check your subscription."
      : failed === "network" ? <Link className="underline underline-offset-4" href={EXTENSION_WELCOME_PATH}>Continue to watching</Link>
      : "Getting you ready to watch…"}
  </p>;
}
