"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { trackEvent } from "@/lib/gtag";

type Props = {
  waitlistPosition: number;
  referralLink: string;
  referralCount: number;
};

export function AccountWaitlistCard({
  waitlistPosition,
  referralLink,
  referralCount,
}: Props) {
  const [copied, setCopied] = useState(false);

  const inviteFriends = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else if (typeof document !== "undefined") {
        const el = document.createElement("textarea");
        el.value = referralLink;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      trackEvent("referral_link_copied", { placement: "account_overview" });
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard permission denied.
    }
  }, [referralLink]);

  return (
    <section className="ac-referral">
      <div>
        <h2>
          Early access <span className="ac-count">#{waitlistPosition}</span>
        </h2>
        <p>
          {referralCount > 0
            ? `${referralCount} friend${referralCount === 1 ? "" : "s"} joined via your link.`
            : "Move up 10 spots for each friend who joins the waitlist."}
        </p>
      </div>
      <button
        type="button"
        aria-label={copied ? "Link copied" : "Copy referral link"}
        className="ac-button"
        onClick={inviteFriends}
      >
        {copied ? (
          <Check size={16} aria-hidden />
        ) : (
          <Copy size={16} aria-hidden />
        )}
        <span role="status">
          {copied ? "Link copied" : "Copy referral link"}
        </span>
      </button>
    </section>
  );
}
