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
    text: "Choose Create room, then copy the invite to share it with friends. Hosting needs Plus or Pro, including an active trial.",
  },
  {
    name: "Invite a friend",
    text: "Click the person-plus button next to End room to open Friends & groups. Choose Invite beside a friend or group. You can also copy the room link and send it yourself.",
  },
  {
    name: "Media seats",
    text: "Hosts control microphone and camera access in People. The round radio button is white when access is on and grey when it is off. Guests without access can still listen and chat. Up to four cameras can be on at once.",
  },
  {
    name: "Reactions",
    text: "In Settings → Reactions, turn on Quick reactions. Press a number from 1–0 to send its emoji. Click an emoji slot to choose a different one.",
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
    text: "Yellow microphone: hold V to talk. Click it for an always-on microphone in green; click again to return to push to talk. The camera button turns video on or off. These examples never use your microphone or camera.",
  },
  {
    name: "Interface",
    text: "In Settings → Interface, choose when the player controls appear. Auto hide reveals the capsule near the player edge. Smart shows participant pills when someone speaks or you hover the edge.",
  },
  {
    name: "Room",
    text: "In Settings → Room, choose how your microphone and camera start in each room. Last used remembers your previous choice. You can also set a fixed starting mode.",
  },
] as const;
