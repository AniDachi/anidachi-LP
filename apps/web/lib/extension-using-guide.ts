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
    name: "Open the bubble",
    text: "On a Crunchyroll title or a full YouTube watch page, look at the top-right of the player. Click the AniDachi bubble — logo, green dot, and a number.",
  },
  {
    name: "Create a room",
    text: "AniDachi detects the title. Click Create room — the orange button under your name. After the room starts, click the copy icon next to End room and send that invite. Friends open it on their own player.",
  },
  {
    name: "Invite a friend",
    text: "Next to End room, click the person-plus icon. Friends & groups opens — Invite a friend or a group from the list. Copy invite still works for one-off links.",
  },
  {
    name: "Media seats",
    text: "In People, hosts tap the round radio button on a person. White means they have microphone and camera access. Grey means listening and chat only. Tap to give or take a seat. Up to four cameras can be on at once.",
  },
  {
    name: "Reactions",
    text: "Open Settings → Reactions. Turn Quick reactions on. Keys 1–0 each map to an emoji — click a slot to change it. In a room, press that number to send it.",
  },
  {
    name: "Send a message",
    text: "While watching in a room, press Enter to open the message field. Type your message, then press Enter again to send it.",
  },
  {
    name: "Layout",
    text: "Open Settings → Layout. Drag cameras or chat in the preview to reposition them. Under Video, enlarge Camera size, then Apply.",
  },
  {
    name: "Voice",
    text: "Open Settings → Voice. Leave Push to talk selected on the left. Hold V to speak. Use Open mic only if you want the mic live without holding a key.",
  },
  {
    name: "Interface",
    text: "Open Settings → Interface. Both controls are visible by default. Choose Auto hide to reveal the main control near the player edge, or Smart for participant pills that appear when someone speaks or you hover the edge.",
  },
  {
    name: "Room",
    text: "Open Settings → Room. Room defaults are your starting mic and camera for every room. Microphone: Last used, Push to talk, or Open mic. Camera: Last used, Off, or On.",
  },
] as const;
