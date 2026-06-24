import { DiscordContact } from "@/components/discord-contact";
import { FOUNDER_DISCORD_USERNAME } from "@/lib/founder-discord";

export interface PrePurchaseDiscordWalkthroughProps {
  username?: string;
  className?: string;
}

/**
 * Pre-purchase CTA: guided walkthrough framing + founder Discord contact card.
 * Used on the plan survey recommendation step (not on /success).
 */
export function PrePurchaseDiscordWalkthrough({
  username = FOUNDER_DISCORD_USERNAME,
  className = "",
}: PrePurchaseDiscordWalkthroughProps) {
  return (
    <div
      className={`rounded-xl border border-brand-orange/20 bg-brand-orange/5 px-4 py-3 text-sm ${className}`.trim()}
    >
      <p className="font-semibold text-foreground mb-1">Happy to do a guided walkthrough.</p>
      <p className="text-foreground/70 text-xs mb-2">
        Message the founder on Discord and we&apos;ll set up a live demo for your group — no
        commitment needed.
      </p>
      <DiscordContact username={username} className="border border-brand-border bg-brand-surface" />
    </div>
  );
}
