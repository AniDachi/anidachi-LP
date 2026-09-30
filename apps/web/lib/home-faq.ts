import { getPlanPolicy } from "@anidachi/protocol";

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
      "Install AniDachi in desktop Chrome and open an episode on Crunchyroll. AniDachi detects the title automatically. Open the AniDachi panel, click 'Create room,' and share the invite link. Each friend needs the extension and access to the episode on their own Crunchyroll account.",
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
    answer:
      "Yes. You can join a Plus, Pro or trial host's room with a Free account. To create your own rooms and save personal watch progress, choose Plus or Pro. If you haven't used a trial before, you can try either plan for 3 days with a card. After that, your chosen monthly or yearly plan renews automatically unless you cancel.",
  },
  {
    question: "Do all my friends need an AniDachi subscription?",
    answer:
      "No. Only the host needs Plus or Pro, including during a trial. Friends join with Free accounts, and the host's plan sets the room size. Everyone needs the AniDachi extension and their own access to the video. Recording personal watch progress requires each viewer's own Plus or Pro plan.",
  },
  {
    question: "What's the difference between Plus and Pro?",
    answer:
      `Plus lets you invite up to ${getPlanPolicy("plus").maxParticipants - 1} friends for free; Pro supports up to ${getPlanPolicy("pro").maxParticipants - 1}. Both include hosting without a daily time limit, chat, reactions, voice and video calls, and personal watch progress. Pro also includes more microphones and priority support. You can choose monthly or yearly billing for either plan.`,
  },
  {
    question: "How is AniDachi different from Teleparty or Crunchyroll Party?",
    answer:
      "AniDachi covers Crunchyroll and YouTube watchrooms, auto-detects titles, and tracks personal watch progress on paid plans. Unlike Teleparty or Crunchyroll Party, async catch-up is planned for a later batch so friends won’t need to be online at the same time when that ships. Live sync and on-player overlay are available now.",
  },
  {
    question: "Does AniDachi work on mobile?",
    answer:
      "You can access your account and manage saved watch history on the website from your phone. Live watchrooms require desktop Chrome with the AniDachi extension installed.",
  },
];
