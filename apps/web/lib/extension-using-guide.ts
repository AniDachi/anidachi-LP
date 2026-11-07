import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";
import { INSTALL_HUB_PATH } from "./install-cta";

/** Post-install overlay usage on /extension#using. Live sync only. */
export const EXTENSION_USING_HASH = "using";

/** Anchor for one overlay step, shared by the install hub and account Help. */
export function extensionUsingStepAnchor(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${EXTENSION_USING_HASH}-${slug}`;
}

export function extensionUsingStepHref(name: string) {
  return `${INSTALL_HUB_PATH}#${extensionUsingStepAnchor(name)}`;
}

export const extensionUsingSteps = [
  {
    name: "Open the capsule",
    text: "Click the capsule at the top-right of your player to open room controls.",
  },
  {
    name: "Create a room",
    text: `Choose Create room to start your room. ${PRICING_FREE20_SUMMARY}`,
  },
  {
    name: "Invite a friend",
    text: "Click Invite friends to open Friends & groups, then choose Invite beside a friend or group. Or copy the room link and share it.",
  },
  {
    name: "Media seats",
    text: "In People, the host controls microphone and camera access with the round button: white means on, gray means off. Guests without access can still listen and chat. Up to four cameras can be on at once.",
  },
  {
    name: "Reactions",
    text: "In Settings → Reactions, turn on Quick reactions. Press 1–9 or 0 to send its emoji. Click an emoji to change it.",
  },
  {
    name: "Send a message",
    text: "Press Enter while watching to open the message field. Type your message, then press Enter again to send it.",
  },
  {
    name: "Layout",
    text: "In Settings → Layout, drag the cameras and chat to where you want them. Adjust their size, then choose Apply to save your layout.",
  },
  {
    name: "Microphone & camera",
    text: "Hold V to talk. Click the microphone to keep it on; click again to switch back. Click the camera to turn video on or off. These examples never use your microphone or camera.",
  },
  {
    name: "Interface",
    text: "In Settings → Interface, choose when controls appear. Auto hide shows the capsule when you hover near the player edge. Smart shows participant pills when someone speaks or you hover the edge.",
  },
  {
    name: "Room",
    text: "In Settings → Room, choose how your microphone and camera start. Use Last used to remember your previous choice, or pick a fixed mode.",
  },
] as const;
