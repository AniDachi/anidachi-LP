import { DISCORD_SERVER_INVITE_URL } from "@/lib/community-discord";

export const PUBLIC_SOCIAL_LINKS = [
  {
    label: "Reddit",
    href: "https://www.reddit.com/r/AniDachi/",
  },
  {
    label: "Discord",
    href: DISCORD_SERVER_INVITE_URL,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@anidachiapp?lang=en",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/anidachiapp/",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/channel/UCwlL4hAuo3eJkV_rnQhEEZw",
  },
] as const;
