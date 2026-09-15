import {
  PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  PRICING_IS_ANIDACHI_FREE_ANSWER,
  PRICING_PLUS_VS_PRO_ANSWER,
} from "@/lib/pricing-copy";

export const homeFAQ = [
  {
    question: "What streaming services does AniDachi support?",
    answer:
      "AniDachi’s Chrome extension supports full watchrooms on Crunchyroll and YouTube — live synced playback and chat on each person’s own stream today. Async catch-up is coming soon in a later batch. Shorts, embeds, and homepage feeds are not supported. Netflix, Disney+, and other services are not supported yet.",
  },
  {
    question: "Does Crunchyroll have a built-in watch party feature?",
    answer:
      "No. Crunchyroll does not offer a native watch-together feature. AniDachi fills this gap with a Chrome extension that syncs playback, detects anime automatically, and adds real-time chat on top of your existing Crunchyroll account.",
  },
  {
    question: "How do I watch Crunchyroll with friends using AniDachi?",
    answer:
      "Install the AniDachi Chrome extension, navigate to any anime on Crunchyroll, click 'Detect Anime,' then create a watchroom. Share the invite link with friends — everyone watches in sync with built-in chat.",
  },
  {
    question: "Can I watch YouTube together with AniDachi?",
    answer:
      "Yes. Open a full youtube.com/watch page in desktop Chrome, create a YouTube watchroom, and share the invite. Friends join on their own YouTube sessions for live sync today. Async catch-up is coming soon in a later batch. Shorts, embeds, and the mobile apps are not supported.",
  },
  {
    question: "Can I watch anime with friends asynchronously?",
    answer:
      "Not yet — async catch-up is coming soon in a later batch. Today, AniDachi is built for live watchrooms: create a room, sync playback, and chat while everyone is online together. When async ships, you’ll be able to mark episodes and leave reactions for friends who catch up later.",
  },
  {
    question: "Do all my friends need a Crunchyroll account?",
    answer:
      "For Crunchyroll anime nights, each person needs their own Crunchyroll account to stream. For YouTube watchrooms, each person uses their own YouTube session. AniDachi handles the sync, watchrooms, and chat layer on top.",
  },
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
  {
    question: "Do all my friends need an AniDachi subscription?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
  {
    question: "What's the difference between Plus and Pro?",
    answer: PRICING_PLUS_VS_PRO_ANSWER,
  },
  {
    question: "How is AniDachi different from Teleparty or Crunchyroll Party?",
    answer:
      "AniDachi covers Crunchyroll and YouTube watchrooms, auto-detects titles, and tracks personal watch progress on paid plans. Unlike Teleparty or Crunchyroll Party, async catch-up is planned for a later batch so friends won’t need to be online at the same time when that ships. Live sync and on-player overlay are available now.",
  },
  {
    question: "Does AniDachi work on mobile?",
    answer:
      "The Chrome extension requires a desktop browser. The watchroom chat and progress tracking will be accessible on mobile via the web app in a future update.",
  },
];
