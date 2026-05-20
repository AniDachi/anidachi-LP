import { DiscordContact } from "@/components/discord-contact";

export interface PrePurchaseDiscordWalkthroughProps {
  username?: string;
  profileUrl?: string;
  className?: string;
}

/**
 * Pre-purchase CTA: guided walkthrough framing + founder Discord contact card.
 * Used on the plan survey recommendation step (not on /success).
 */
export function PrePurchaseDiscordWalkthrough({
  username = ".profun",
  profileUrl,
  className = "",
}: PrePurchaseDiscordWalkthroughProps) {
  return (
    <div
      className={`rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm ${className}`.trim()}
    >
      <p className="font-semibold text-purple-900 mb-1">Happy to do a guided walkthrough.</p>
      <p className="text-purple-800 text-xs mb-2">
        Message the founder on Discord and we&apos;ll set up a live demo for your group — no
        commitment needed.
      </p>
      <DiscordContact
        username={username}
        profileUrl={profileUrl}
        className="border border-purple-200 bg-white"
      />
    </div>
  );
}
