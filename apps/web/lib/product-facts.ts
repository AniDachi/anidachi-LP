import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";

/**
 * One source for what AniDachi is and supports (ANI-41). Used by `/llms.txt` and the
 * SoftwareApplication JSON-LD; the directory page (ANI-40) and hub template (ANI-43)
 * should reuse it. Keep it in line with "Product truth" in docs/seo-content-guidelines.md,
 * and add a platform here only once the store build supports it.
 */

export type SupportedPlatform = {
  name: string;
  hubPath: string;
  /** Link text for the hub, matching how people search for it. */
  hubLabel: string;
};

export const SUPPORTED_PLATFORMS: readonly SupportedPlatform[] = [
  { name: "Crunchyroll", hubPath: "/watch-crunchyroll-together", hubLabel: "Crunchyroll watch party" },
  { name: "Netflix", hubPath: "/netflix-watch-party", hubLabel: "Netflix watch party" },
  { name: "YouTube", hubPath: "/watch-youtube-together", hubLabel: "Watch YouTube together" },
];

/** Shown on the homepage as "coming soon". Not supported: never describe them as working. */
export const PLANNED_PLATFORMS: readonly string[] = ["Hulu", "Disney+", "Paramount+"];

const supportedList = "Crunchyroll, Netflix and YouTube";

export const PRODUCT_FACTS = [
  `AniDachi is a Chrome extension for desktop that lets friends watch ${supportedList} together, in sync.`,
  "Each person plays the video on their own account; AniDachi keeps everyone's player at the same moment and adds chat, reactions, and voice and video calls.",
  "Friends join from an invite link.",
  `${PRICING_FREE20_SUMMARY} Plus rooms hold up to 6 people and Pro rooms up to 15.`,
  "It does not work on phones, tablets or TV apps.",
].join(" ");

export const PRODUCT_FEATURE_LIST: readonly string[] = [
  ...SUPPORTED_PLATFORMS.map((platform) => `Synced watch parties on ${platform.name}`),
  "Chat and reactions on the player",
  "Voice and video calls",
  "Invite links for friends",
  "Personal watch history",
];
