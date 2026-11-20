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
  /** What works on this platform, in one sentence (directory page). */
  scope: string;
};

export const SUPPORTED_PLATFORMS: readonly SupportedPlatform[] = [
  { name: "Crunchyroll", hubPath: "/watch-crunchyroll-together", hubLabel: "Crunchyroll watch party", scope: "Episode pages on crunchyroll.com. Each viewer signs in to their own Crunchyroll account." },
  { name: "Netflix", hubPath: "/netflix-watch-party", hubLabel: "Netflix watch party", scope: "Movie and episode pages on netflix.com. Each viewer needs their own Netflix access to the same title." },
  { name: "YouTube", hubPath: "/watch-youtube-together", hubLabel: "Watch YouTube together", scope: "Full youtube.com/watch pages. Not Shorts, embedded players or the phone app." },
];

/** Planned, not supported: listed in llms.txt as not available. Never describe them as working. Move a platform to SUPPORTED_PLATFORMS only once the store build supports it. */
export const PLANNED_PLATFORMS: readonly string[] = ["Prime Video", "Hulu", "Disney+", "Paramount+"];

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
