/** Post-install overlay usage on /extension#using. Live sync only. */
export const EXTENSION_USING_HASH = "using";

export const extensionUsingSteps = [
  {
    name: "Open the bubble",
    text: "On a Crunchyroll title or a full YouTube watch page, look at the top-right of the player. Click the AniDachi bubble — logo, green dot, and a number.",
  },
  {
    name: "Create a room",
    text: "AniDachi detects the title. Click Create room — the orange button under your name. After the room starts, click the copy icon next to Leave room and send that invite. Friends open it on their own player.",
  },
  {
    name: "Invite a friend",
    text: "Next to Leave room, click the person-plus icon. Friends & groups opens — Invite a friend or a group from the list. Copy invite still works for one-off links.",
  },
  {
    name: "Media seats",
    text: "In People, hosts tap the round radio button on a person. White means they have a media seat (camera and mic). Outline means chat-only — tap it to give a seat. Tap white again to take the seat back.",
  },
  {
    name: "Reactions",
    text: "Open Settings → Reactions. Turn Quick reactions on. Keys 1–0 each map to an emoji — click a slot to change it. In a room, press that number to send it.",
  },
  {
    name: "Layout",
    text: "Open Settings → Layout. Watch the preview: drag cameras, then chat on the grid. Under Video, enlarge Camera size, then Apply.",
  },
  {
    name: "Voice",
    text: "Open Settings → Voice. Leave Push to talk selected on the left. Hold V to speak. Use Open mic only if you want the mic live without holding a key.",
  },
  {
    name: "Interface",
    text: "Open Settings → Interface. Watch the preview: cursor to the top-right edge reveals the bubble when Main control is Auto hide. Participant pills Smart shows names when someone speaks or you hover the right edge.",
  },
  {
    name: "Room",
    text: "Open Settings → Room. Room defaults are your starting mic and camera for every room. Microphone: Last used, Push to talk, or Open mic. Camera: Last used, Off, or On.",
  },
] as const;
