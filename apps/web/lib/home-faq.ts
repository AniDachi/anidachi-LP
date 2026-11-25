import { getPlanPolicy } from "@anidachi/protocol";
import {
  PRICING_FREE20_METERING_NOTE,
  PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  PRICING_IS_ANIDACHI_FREE_ANSWER,
} from "./pricing-copy";

export const homeFAQ = [
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
  {
    question: "How do my free minutes work?",
    answer: PRICING_FREE20_METERING_NOTE,
  },
  {
    question: "What streaming services does AniDachi support?",
    answer:
      "Crunchyroll, YouTube and Netflix in desktop Chrome. AniDachi syncs each person’s own player and adds chat, reactions, voice and video. YouTube Shorts, embeds and homepage feeds are not supported.",
  },
  {
    question: "How do I watch Crunchyroll with friends using AniDachi?",
    answer:
      "Install AniDachi in desktop Chrome and open an episode on Crunchyroll. Open the AniDachi panel, click Create room and share the invite link. Friends need the extension and their own access to the episode.",
  },
  {
    question: "Do all my friends need an AniDachi subscription?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
  {
    question: "What's the difference between Plus and Pro?",
    answer:
      `Plus supports up to ${getPlanPolicy("plus").maxParticipants} people; Pro supports up to ${getPlanPolicy("pro").maxParticipants}, including the host. Both have no daily time limit and include personal watch history. Pro also has more microphones and priority support. Both offer monthly or yearly billing.`,
  },
  {
    question: "What is a watch party app?",
    answer:
      "A watch party app lets people in different places watch the same show or movie at the same time. Each person plays it on their own screen and account, the app keeps play, pause and seeking in sync, and you chat or talk while you watch. AniDachi is a watch party app for Crunchyroll, Netflix and YouTube in desktop Chrome.",
  },
  {
    question: "Can you watch together online on any streaming service?",
    answer:
      "Not on every service yet. AniDachi works on Crunchyroll, Netflix and YouTube today, in desktop Chrome. Everyone uses their own account on the service, so nobody shares a login or a screen, and each person sees the video at full quality.",
  },
  {
    question: "Is AniDachi a watch party website or an extension?",
    answer:
      "An extension. AniDachi runs in desktop Chrome on top of each person's own streaming tab, so the video plays from the service itself. Watch party websites such as Watch2Gether play shared links in their own room, which suits public YouTube videos but not Crunchyroll or Netflix episodes. The AniDachi website is where you manage your account and watch history.",
  },
  {
    question: "Can I watch YouTube together with AniDachi?",
    answer:
      "Yes. Open a full youtube.com/watch page in desktop Chrome. A Free, Plus, or Pro host creates the room and shares the invite; friends join for free on their own video pages. Shorts, embeds, and the mobile apps are not supported. Async catch-up is coming soon.",
  },
  {
    question: "Can I watch anime with friends asynchronously?",
    answer:
      "Not yet. AniDachi currently supports live rooms where you watch and chat together. Async catch-up is coming soon.",
  },
  {
    question: "Do all my friends need a Crunchyroll account?",
    answer:
      "For Crunchyroll anime nights, each person needs their own Crunchyroll account to stream. For YouTube watchrooms, each person uses their own YouTube session. For Netflix, each person needs their own access to the same title. AniDachi handles the sync, watchrooms, and chat layer on top of the services that are available today.",
  },
  {
    question: "Does Crunchyroll have a built-in watch party feature?",
    answer:
      "No. Crunchyroll does not offer a native watch-together feature. AniDachi fills this gap with a Chrome extension that syncs playback, detects anime automatically, and adds real-time chat on top of your existing Crunchyroll account.",
  },
  {
    question: "How is AniDachi different from Teleparty?",
    answer:
      "Teleparty is free on Netflix, YouTube and most services with text chat; Crunchyroll and voice or video chat need Teleparty Premium. AniDachi includes chat, reactions, voice and video in every room on Crunchyroll, YouTube and Netflix, and Plus and Pro also save your personal watch progress.",
  },
  {
    question: "Does AniDachi work on mobile?",
    answer:
      "You can access your account and manage saved watch history on the website from your phone. Live watchrooms require desktop Chrome with the AniDachi extension installed.",
  },
];
