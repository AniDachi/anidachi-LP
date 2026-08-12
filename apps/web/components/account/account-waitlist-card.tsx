"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, UserPlus } from "lucide-react";
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
    <section className="relative overflow-hidden rounded-2xl border border-brand-orange/30 bg-brand-surface p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_0%_0%,oklch(0.71_0.20_45_/_0.16),transparent_55%)]"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-brand-orange">
            EARLY ACCESS WAITLIST
          </p>
          <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-foreground tabular-nums">
            #{waitlistPosition}
            <span className="ml-2 text-base font-medium tracking-normal text-foreground/50">
              in line
            </span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
            {referralCount > 0
              ? `${referralCount} friend${referralCount === 1 ? "" : "s"} joined via your link.`
              : "Invite friends to move up 10 spots per signup."}
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 bg-brand-orange font-semibold text-primary-foreground transition-[transform,background-color] duration-200 hover:bg-brand-orange-deep active:scale-[0.98]"
          onClick={inviteFriends}
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              Link copied
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Invite friends
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
