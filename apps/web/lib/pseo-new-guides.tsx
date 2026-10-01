import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const ARTICLE_IMAGE = `${SITE_URL}${BRAND_OG_PATH}`;

type AnimePick = {
	slug: string;
	title: string;
	reason: string;
};

type ListiclePage = {
	slug: string;
	title: string;
	h1: string;
	description: string;
	ogDescription: string;
	intro: string;
	sectionIntro: string;
	picks: AnimePick[];
	faq: { question: string; answer: string }[];
	relatedTags: string[];
};

type GuideSection = {
	id: string;
	title: string;
	body: string[];
	bullets?: string[];
};

type GuidePage = {
	slug: string;
	title: string;
	h1: string;
	description: string;
	ogDescription: string;
	intro: string;
	howToName: string;
	howToDescription: string;
	steps: { name: string; text: string }[];
	sections: GuideSection[];
	faq: { question: string; answer: string }[];
	relatedTags: string[];
};

const sharedPicks = {
	longDistance: [
		{
			slug: "your-name",
			title: "Your Name",
			reason:
				"A one-movie date night with a huge emotional turn, easy to schedule across time zones and perfect for a same-weekend reaction thread.",
		},
		{
			slug: "spy-x-family",
			title: "Spy x Family",
			reason:
				"Warm, episodic comedy keeps long-distance sessions light. Missing one night does not derail the whole group.",
		},
		{
			slug: "frieren-beyond-journeys-end",
			title: "Frieren: Beyond Journey's End",
			reason:
				"Quiet episodes reward reflection, making it one of the best shows for async notes after each person watches.",
		},
		{
			slug: "haikyuu",
			title: "Haikyuu!!",
			reason:
				"Match arcs create natural checkpoints, so friends can finish a set and compare reactions without spoilers.",
		},
		{
			slug: "fullmetal-alchemist-brotherhood",
			title: "Fullmetal Alchemist: Brotherhood",
			reason:
				"A complete 64-episode run with strong cliffhangers, ideal for weekly long-distance watchroom cadence.",
		},
		{
			slug: "demon-slayer",
			title: "Demon Slayer: Kimetsu no Yaiba",
			reason:
				"Big visual episodes feel event-worthy, but short arcs still work when someone has to catch up the next day.",
		},
		{
			slug: "kaguya-sama",
			title: "Kaguya-sama: Love is War",
			reason:
				"Fast romantic comedy with easy stop points, perfect for couples who want a low-pressure shared ritual.",
		},
		{
			slug: "a-silent-voice",
			title: "A Silent Voice",
			reason:
				"A reflective film that works better when partners have space to process before talking afterward.",
		},
	],
	onlineTogether: [
		{
			slug: "jujutsu-kaisen",
			title: "Jujutsu Kaisen",
			reason:
				"Punchy episodes, quick reactions, and cliffhanger-heavy arcs make it an obvious online watch party pick.",
		},
		{
			slug: "attack-on-titan",
			title: "Attack on Titan",
			reason:
				"Twists land harder in a shared room, and episode checkpoints help protect friends who are behind.",
		},
		{
			slug: "one-punch-man",
			title: "One Punch Man",
			reason:
				"Short, funny, action-heavy episodes keep online groups engaged even when people are new to anime.",
		},
		{
			slug: "mob-psycho-100",
			title: "Mob Psycho 100",
			reason:
				"Big visual payoffs and sincere character moments give chat something to react to every episode.",
		},
		{
			slug: "chainsaw-man",
			title: "Chainsaw Man",
			reason:
				"Twelve tight first-season episodes make it easy to run a focused online group watch.",
		},
		{
			slug: "spy-x-family",
			title: "Spy x Family",
			reason:
				"Comedy, action, and family chaos make it friendly for mixed-experience anime groups.",
		},
		{
			slug: "solo-leveling",
			title: "Solo Leveling",
			reason:
				"Level-up pacing gives online groups clear moments to celebrate, pause, and compare reactions.",
		},
		{
			slug: "dandadan",
			title: "Dan Da Dan",
			reason:
				"Chaotic humor and supernatural set pieces make it a high-energy watchroom choice.",
		},
	],
	girlfriend: [
		{
			slug: "kaguya-sama",
			title: "Kaguya-sama: Love is War",
			reason:
				"Romantic mind games, short arcs, and lots of laugh-out-loud moments make it an easy recurring date-night show.",
		},
		{
			slug: "your-name",
			title: "Your Name",
			reason:
				"A beautiful first anime movie date with romance, mystery, and one huge shared emotional payoff.",
		},
		{
			slug: "fruits-basket",
			title: "Fruits Basket",
			reason:
				"Warm character drama gives couples plenty to talk about after each episode without needing nonstop action.",
		},
		{
			slug: "spy-x-family",
			title: "Spy x Family",
			reason:
				"Cute, funny, and low-pressure, especially when you want something cozy after work or school.",
		},
		{
			slug: "horimiya",
			title: "Horimiya",
			reason:
				"A short, direct romance pick for couples who want character chemistry without a huge episode commitment.",
		},
		{
			slug: "a-silent-voice",
			title: "A Silent Voice",
			reason:
				"Best saved for a thoughtful night; it is emotional, conversation-heavy, and memorable.",
		},
	],
	boyfriend: [
		{
			slug: "jujutsu-kaisen",
			title: "Jujutsu Kaisen",
			reason:
				"Fast fights and supernatural stakes make it a strong pick when one partner wants action first.",
		},
		{
			slug: "kaguya-sama",
			title: "Kaguya-sama: Love is War",
			reason:
				"Romantic comedy that still moves quickly, with episode-length bits that are easy to watch casually.",
		},
		{
			slug: "demon-slayer",
			title: "Demon Slayer: Kimetsu no Yaiba",
			reason:
				"A polished, emotional action series that works well for couples new to watching anime together.",
		},
		{
			slug: "one-punch-man",
			title: "One Punch Man",
			reason:
				"Funny, easy to enter, and great for a low-commitment first watchroom night.",
		},
		{
			slug: "your-name",
			title: "Your Name",
			reason:
				"A compact romance movie pick when you want a complete date night instead of starting a long show.",
		},
		{
			slug: "chainsaw-man",
			title: "Chainsaw Man",
			reason:
				"Messy, stylish, and short enough to finish quickly if both of you like darker action.",
		},
	],
};

export const listiclePages: Record<string, ListiclePage> = {
	"best-anime-to-watch-long-distance": {
		slug: "best-anime-to-watch-long-distance",
		title: "Best Anime to Watch Long Distance — AniDachi",
		h1: "8 Best Anime to Watch Long Distance in 2026",
		description:
			"Best anime to watch long distance with friends or a partner. Pick shows for live AniDachi watchrooms or independent viewing followed by a conversation.",
		ogDescription:
			"Long-distance anime picks for couples, friend groups, and live Crunchyroll watchrooms.",
		intro:
			"The best anime to watch long distance gives your group clear episode checkpoints, strong reactions, and enough flexibility for missed nights. AniDachi keeps live playback in sync. A host with Plus or Pro, including an active trial, can invite friends who join on Free accounts.",
		sectionIntro:
			"These picks favor emotional payoffs, clean stopping points, and Crunchyroll-friendly group watching.",
		picks: sharedPicks.longDistance,
		relatedTags: ["long-distance", "async", "pillar-watch-anime"],
		faq: [
			{
				question: "What anime is best for long-distance couples?",
				answer:
					"Your Name, Kaguya-sama: Love is War, Fruits Basket, and Spy x Family are strong long-distance picks because they are easy to schedule and leave room for conversation after each episode.",
			},
			{
				question:
					"Can we watch anime long distance without being online at the same time?",
				answer:
					"You can watch independently and discuss the episode later in a separate chat. AniDachi rooms currently sync live playback; Async catch-up with replayed reactions is coming soon.",
			},
			{
				question:
					"Do friends need to pay to join a long-distance AniDachi room?",
				answer:
					"Friends can join on Free accounts. Creating a room requires the host's own Plus or Pro access, including an active trial. See pricing for the three-day card trial and subscription terms.",
			},
		],
	},
	"best-anime-to-watch-online-together": {
		slug: "best-anime-to-watch-online-together",
		title: "Best Anime to Watch Online Together — AniDachi",
		h1: "8 Best Anime to Watch Online Together in 2026",
		description:
			"Best anime to watch online together with friends. Choose shows built for live reactions, synced Crunchyroll rooms, and post-episode discussion.",
		ogDescription:
			"Anime picks for online watch parties, synced rooms, and friend groups on Crunchyroll.",
		intro:
			"The best anime to watch online together is easy to start, fun to react to, and safe to pause when someone falls behind. AniDachi adds the watchroom layer on top of Crunchyroll so everyone streams locally while the group stays synced.",
		sectionIntro:
			"Use these shows when you want a fast first session, a weekly group ritual, or a series that can survive imperfect schedules.",
		picks: sharedPicks.onlineTogether,
		relatedTags: ["online", "watch-party", "pillar-watch-anime"],
		faq: [
			{
				question: "What anime should friends watch online together first?",
				answer:
					"Spy x Family, One Punch Man, Jujutsu Kaisen, and Demon Slayer are good first picks because they are easy to enter and have frequent reaction moments.",
			},
			{
				question: "How do we watch anime online together in sync?",
				answer:
					"Install AniDachi, open the same Crunchyroll episode, create a watchroom, and share the invite link. Everyone streams from their own account while playback stays aligned.",
			},
			{
				question: "Is online anime watching better with screen share or sync?",
				answer:
					"Sync is usually better for quality because everyone watches their own Crunchyroll stream. Screen share is quick, but it can lower video quality and depends on one person's connection.",
			},
		],
	},
	"best-anime-to-watch-with-girlfriend": {
		slug: "best-anime-to-watch-with-girlfriend",
		title: "Best Anime to Watch With Girlfriend — AniDachi",
		h1: "6 Best Anime to Watch With Girlfriend in 2026",
		description:
			"Best anime to watch with girlfriend for cozy dates, romance, comedy, and long-distance watchrooms on Crunchyroll.",
		ogDescription:
			"Anime date-night picks for watching live with your girlfriend or discussing after independent viewing.",
		intro:
			"The best anime to watch with girlfriend should feel like a date, not homework. Pick shows with chemistry, humor, and clear stopping points, then use an AniDachi watchroom so either person can host recurring nights without forcing both schedules to match perfectly.",
		sectionIntro:
			"These picks balance romance, comfort, and enough story momentum to keep a weekly watchroom going.",
		picks: sharedPicks.girlfriend,
		relatedTags: ["long-distance", "listicle", "pillar-watch-anime"],
		faq: [
			{
				question: "What anime should I watch with my girlfriend?",
				answer:
					"Kaguya-sama: Love is War, Your Name, Fruits Basket, Spy x Family, Horimiya, and A Silent Voice are strong picks because they mix emotion, comedy, and approachable episode lengths.",
			},
			{
				question: "What is a good long-distance anime date night setup?",
				answer:
					"A host with Plus or Pro, including an active trial, creates an AniDachi room. Open the same Crunchyroll episode and pick a clear stop point. If one person misses the time, watch independently and arrange a later conversation.",
			},
			{
				question: "Do couples both need Crunchyroll?",
				answer:
					"Yes, each person needs their own Crunchyroll access for the video. AniDachi provides live playback sync, chat, cameras, and microphones.",
			},
		],
	},
	"best-anime-to-watch-with-boyfriend": {
		slug: "best-anime-to-watch-with-boyfriend",
		title: "Best Anime to Watch With Boyfriend — AniDachi",
		h1: "6 Best Anime to Watch With Boyfriend in 2026",
		description:
			"Best anime to watch with boyfriend for action, romance, comedy, and long-distance Crunchyroll watchrooms.",
		ogDescription:
			"Anime date-night picks for watching live with your boyfriend or discussing after independent viewing.",
		intro:
			"The best anime to watch with boyfriend depends on the mood: action for an easy first night, romance for a real date, or comedy when you just want to unwind together. AniDachi keeps the room synced on Crunchyroll and lets one host invite the other for free.",
		sectionIntro:
			"These picks are easy to start, fun to react to live, and worth discussing when you both finish.",
		picks: sharedPicks.boyfriend,
		relatedTags: ["long-distance", "listicle", "pillar-watch-anime"],
		faq: [
			{
				question: "What anime should I watch with my boyfriend?",
				answer:
					"Jujutsu Kaisen, Demon Slayer, One Punch Man, Kaguya-sama: Love is War, Your Name, and Chainsaw Man are strong choices depending on whether you want action, comedy, romance, or a complete movie night.",
			},
			{
				question: "Can AniDachi work for long-distance anime dates?",
				answer:
					"Yes, when both people are online for a synced AniDachi session. If one person watches later, discuss it separately afterward. Async catch-up is coming soon.",
			},
			{
				question: "Who needs a paid AniDachi plan for couples?",
				answer:
					"The host needs Plus or Pro access, including an active trial. The other person can join on Free. Recording and editing personal history requires each viewer's own Plus or Pro access.",
			},
		],
	},
};

export const guidePages: Record<string, GuidePage> = {
	"anime-date-night-ideas-long-distance": {
		slug: "anime-date-night-ideas-long-distance",
		title: "Anime Date Night Ideas Long Distance — AniDachi",
		h1: "Anime Date Night Ideas Long Distance",
		description:
			"Anime date night ideas for long-distance couples. Plan live Crunchyroll watchrooms, cozy themes, or independent viewing followed by a call.",
		ogDescription:
			"Long-distance anime date ideas for synced Crunchyroll watchrooms and later conversations.",
		intro:
			"Anime date night ideas long distance couples can actually keep should be simple, repeatable, and forgiving when time zones get messy. Use an AniDachi watchroom when you can meet live: one person hosts and both stream on Crunchyroll. If schedules do not overlap, watch separately and plan a conversation afterward.",
		howToName: "How to plan a long-distance anime date night",
		howToDescription:
			"Set up a Crunchyroll watchroom, choose a mood, invite your partner, and keep reactions spoiler-safe.",
		steps: [
			{
				name: "Pick the mood",
				text: "Choose cozy, funny, action-heavy, or emotional before selecting a show.",
			},
			{
				name: "Create the watchroom",
				text: "Open the Crunchyroll episode or movie; AniDachi detects it automatically. With your own Plus or Pro access, including an active trial, choose Create room.",
			},
			{
				name: "Share the invite",
				text: "Send the room link to your partner and agree on a shared start time.",
			},
			{
				name: "Choose a stop point",
				text: "Decide whether you are watching one episode, one arc, or a full movie.",
			},
			{
				name: "Leave reactions",
				text: "Use chat and episode context so late reactions do not spoil the next session.",
			},
		],
		sections: [
			{
				id: "cozy",
				title: "Cozy one-episode date",
				body: [
					"Pick a comforting episode of Spy x Family, Frieren, or Fruits Basket and keep the plan intentionally small. A good long-distance date does not need a four-hour marathon.",
					"This format works well on weeknights: a partner with Plus or Pro, including an active trial, hosts and the other joins free. Keep the live session short enough for both schedules.",
				],
			},
			{
				id: "movie",
				title: "One-movie emotional night",
				body: [
					"Your Name, A Silent Voice, and Suzume work when you want a complete date in one sitting. Start with snacks, keep chat open, and plan ten minutes afterward to talk through the ending.",
				],
			},
			{
				id: "async",
				title: "Async catch-up date",
				body: [
					"If one person is asleep or working, set a 24-hour watch window and discuss the episode afterward in a separate chat. This is independent viewing; AniDachi Async catch-up with replayed reactions is coming soon.",
				],
				bullets: [
					"Use one episode or one movie per date.",
					"Avoid posting future-episode spoilers.",
					"Save big finale episodes for live sessions when possible.",
				],
			},
		],
		relatedTags: ["long-distance", "async", "pillar-watch-anime"],
		faq: [
			{
				question: "What anime is good for a long-distance date night?",
				answer:
					"Your Name, Spy x Family, Kaguya-sama: Love is War, Fruits Basket, and Frieren are strong choices because they create conversation without requiring a huge commitment.",
			},
			{
				question: "How do long-distance couples watch anime together?",
				answer:
					"They can use AniDachi to create a Crunchyroll watchroom, share an invite link, sync playback, and react together in live chat.",
			},
			{
				question: "Can an anime date night be async?",
				answer:
					"Yes. Agree on a watch window, keep personal notes, and talk after both people finish. AniDachi rooms currently run live, so use a separate chat for this later discussion.",
			},
		],
	},
	"watch-party-app-for-crunchyroll": {
		slug: "watch-party-app-for-crunchyroll",
		title: "Watch Party App for Crunchyroll — AniDachi",
		h1: "Watch Party App for Crunchyroll",
		description:
			"Looking for a watch party app for Crunchyroll? Compare AniDachi, Teleparty, Crunchyroll Party, and Discord for anime groups.",
		ogDescription:
			"Best watch party app options for Crunchyroll anime groups, compared fairly.",
		intro:
			"A watch party app for Crunchyroll should sync playback without making one person stream video to everyone else. AniDachi is built for anime watchrooms, Teleparty and Crunchyroll Party cover simpler live sync, and Discord is quick but quality depends on screen share.",
		howToName: "How to use a watch party app for Crunchyroll",
		howToDescription:
			"Install a browser watch party tool, create a room, invite friends, and choose the right setup for your group.",
		steps: [
			{
				name: "Choose a tool",
				text: "Pick AniDachi for Crunchyroll live rooms, chat, cameras, and microphones; compare other tools for your group's platform needs.",
			},
			{
				name: "Install the extension",
				text: "Add the Chrome extension and open the Crunchyroll episode.",
			},
			{
				name: "Create the room",
				text: "Start a room from the episode page and copy the invite link.",
			},
			{
				name: "Invite friends",
				text: "Each friend opens Crunchyroll with their own account and joins the room.",
			},
			{
				name: "Start watching",
				text: "Use sync, chat, and clear stop points to keep the group together.",
			},
		],
		sections: [
			{
				id: "options",
				title: "Best Crunchyroll watch party app options",
				body: [
					"AniDachi fits Crunchyroll-first groups that want anime detection, live playback sync, chat, cameras, and microphones. The host needs Plus or Pro access, including an active trial; friends can join on Free accounts.",
					"Teleparty and Crunchyroll Party are useful for simpler live sessions. Discord is best when speed matters more than quality, because screen share can reduce resolution and does not give everyone their own synced stream.",
				],
				bullets: [
					"AniDachi: Crunchyroll and YouTube live rooms with chat and calling.",
					"Teleparty: general-purpose live watch party extension.",
					"Crunchyroll Party: simple Crunchyroll live sync.",
					"Discord: fast screen share, weaker playback quality.",
				],
			},
			{
				id: "choose",
				title: "Which app should your group choose?",
				body: [
					"Choose AniDachi if Crunchyroll is your main anime source and your group wants synced playback, live conversation, and a host who can invite friends without making everyone subscribe.",
					"Choose a simpler extension if basic live sync is all your group needs. Check platform support and current pricing before choosing.",
				],
			},
		],
		relatedTags: ["pillar-watch-crunchyroll"],
		faq: [
			{
				question: "What is the best watch party app for Crunchyroll?",
				answer:
					"AniDachi fits Crunchyroll groups that want live watchrooms, sync, chat, cameras, and microphones. Teleparty and Crunchyroll Party are other live-sync options.",
			},
			{
				question: "Does Crunchyroll have its own watch party app?",
				answer:
					"No. Crunchyroll does not currently provide a built-in group watch room, so users rely on third-party tools or screen sharing.",
			},
			{
				question: "Do all friends need Crunchyroll for a watch party app?",
				answer:
					"For synced local playback, yes. Each person streams through their own Crunchyroll access while the app syncs the room.",
			},
		],
	},
	"crunchyroll-group-watch": {
		slug: "crunchyroll-group-watch",
		title: "Crunchyroll Group Watch — AniDachi",
		h1: "Crunchyroll Group Watch",
		description:
			"Crunchyroll group watch guide: what exists, what Crunchyroll lacks, and how AniDachi creates synced anime watchrooms.",
		ogDescription:
			"How to create a Crunchyroll group watch room with synced playback and friends joining free.",
		intro:
			"Crunchyroll group watch is possible, but not with a native Crunchyroll button. The practical solution is a third-party room tool: everyone streams locally on Crunchyroll, while AniDachi keeps the group synced and lets friends join a host's room free.",
		howToName: "How to start a Crunchyroll group watch",
		howToDescription:
			"Create a synced Crunchyroll group watch using AniDachi and invite friends to the room.",
		steps: [
			{
				name: "Open Crunchyroll",
				text: "Pick the anime episode your group wants to watch.",
			},
			{
				name: "Start AniDachi",
				text: "AniDachi detects the episode automatically. With your own Plus or Pro access, including an active trial, choose Create room and share the invite.",
			},
			{ name: "Invite the group", text: "Share the room link with friends." },
			{
				name: "Confirm access",
				text: "Each person uses their own Crunchyroll access for the video.",
			},
			{
				name: "Watch together live",
				text: "Start together and use live chat while playback stays in sync.",
			},
		],
		sections: [
			{
				id: "native",
				title: "Does Crunchyroll have group watch?",
				body: [
					"Crunchyroll does not provide a native group watch room for friends. A third-party tool can add room invites, synchronized playback, and live chat.",
					"AniDachi fills that gap by adding a watchroom layer on top of the Crunchyroll episode your group is already watching.",
				],
			},
			{
				id: "quality",
				title: "Why group watch beats screen share",
				body: [
					"With screen share, one person streams video to everyone else. With a group watch room, each person streams locally, so quality is not limited by the host's upload speed.",
				],
			},
		],
		relatedTags: ["pillar-watch-crunchyroll"],
		faq: [
			{
				question: "Can you group watch on Crunchyroll?",
				answer:
					"Yes, but you need a third-party tool such as AniDachi because Crunchyroll does not have a built-in group watch feature.",
			},
			{
				question: "Is Crunchyroll group watch free?",
				answer:
					"Friends can join AniDachi rooms on Free accounts. Hosting requires Plus or Pro access, including an active trial. Everyone still needs their own access to the Crunchyroll episode.",
			},
			{
				question: "Is group watch better than Discord screen share?",
				answer:
					"Usually yes for video quality. Group watch lets everyone stream locally, while Discord screen share depends on one person's stream quality.",
			},
		],
	},
	"crunchyroll-watch-party-free": {
		slug: "crunchyroll-watch-party-free",
		title: "Crunchyroll Watch Party Free — AniDachi",
		h1: "Crunchyroll Watch Party Free",
		description:
			"Crunchyroll watch party free options compared: AniDachi free joining, Crunchyroll Party, Teleparty, and Discord screen share.",
		ogDescription:
			"Free and paid Crunchyroll watch party options for anime groups.",
		intro:
			"A Crunchyroll watch party can be free to join, but each tool has different requirements. With AniDachi, friends join on Free accounts and the host needs Plus or Pro access, including an active trial. Compare other sync tools and screen sharing if nobody wants to host with a subscription.",
		howToName: "How to run a free Crunchyroll watch party",
		howToDescription:
			"Compare free watch party options and choose the setup with the right quality and room limits.",
		steps: [
			{
				name: "Pick the free path",
				text: "Use AniDachi free joining, a free sync extension, or Discord screen share.",
			},
			{
				name: "Set expectations",
				text: "Tell friends whether they need their own Crunchyroll access.",
			},
			{
				name: "Create or join",
				text: "The host starts the room or stream and sends the invite.",
			},
			{
				name: "Watch one episode",
				text: "Keep the first session short so you can test sync and chat.",
			},
			{
				name: "Check hosting access",
				text: "AniDachi hosts need Plus or Pro, including an active trial. Review pricing and trial terms before creating a room.",
			},
		],
		sections: [
			{
				id: "free-options",
				title: "Free Crunchyroll watch party options",
				body: [
					"Discord screen share is the lowest-friction free option, but it can reduce video quality and does not sync everyone's own Crunchyroll player.",
					"AniDachi is built around a host model: the host needs Plus or Pro access, including an active trial, while friends can join free.",
				],
				bullets: [
					"Best free quick test: Discord screen share.",
					"Best free joining model: AniDachi room hosted by one person.",
					"Best quality path: everyone streams locally with a sync tool.",
				],
			},
			{
				id: "when-upgrade",
				title: "When free stops being enough",
				body: [
					"Free lets you join a friend's active room. To create your own, choose Plus or Pro. Eligible accounts can try either plan for three days with a card; see pricing for renewal and cancellation terms.",
				],
			},
		],
		relatedTags: ["pillar-watch-crunchyroll"],
		faq: [
			{
				question: "Can I make a Crunchyroll watch party for free?",
				answer:
					"You can join an AniDachi room free when its host has active Plus or Pro access, including a trial. Creating your own AniDachi room requires that access. Other tools may offer free hosting with different limitations.",
			},
			{
				question: "Do friends pay to join AniDachi?",
				answer:
					"Friends can join with Free accounts. The host needs active Plus or Pro access, including a trial, to create the room.",
			},
			{
				question: "What is the catch with free screen sharing?",
				answer:
					"Screen sharing is quick, but quality and smoothness depend on the host's connection, and viewers are not streaming locally from their own Crunchyroll players.",
			},
		],
	},
	"how-to-watch-anime-together-without-screen-share": {
		slug: "how-to-watch-anime-together-without-screen-share",
		title: "Watch Anime Together Without Screen Share — AniDachi",
		h1: "How to Watch Anime Together Without Screen Share",
		description:
			"How to watch anime together without screen share: use synced Crunchyroll watchrooms so everyone streams locally in better quality.",
		ogDescription:
			"Skip low-quality screen share and watch anime together with synced local Crunchyroll playback.",
		intro:
			"To watch anime together without screen share, use a synced watchroom instead of broadcasting one person's browser. AniDachi lets everyone stream the Crunchyroll episode locally while the room handles live sync and chat.",
		howToName: "How to watch anime together without screen share",
		howToDescription:
			"Use AniDachi to create a synced anime watchroom where everyone streams locally.",
		steps: [
			{
				name: "Install AniDachi",
				text: "Add the Chrome extension before opening your anime episode.",
			},
			{
				name: "Open Crunchyroll",
				text: "Go to the episode your group wants to watch.",
			},
			{
				name: "Create a watchroom",
				text: "AniDachi detects the episode automatically. With your own Plus or Pro access, including an active trial, choose Create room and share the invite.",
			},
			{ name: "Share the invite", text: "Send the room link to friends." },
			{
				name: "Stream locally",
				text: "Each person watches on their own Crunchyroll account while the room syncs playback.",
			},
		],
		sections: [
			{
				id: "why-not-screen-share",
				title: "Why avoid screen share?",
				body: [
					"Screen share makes one person's device and upload connection responsible for everyone else's viewing quality. It is quick, but it can introduce blur, lag, and audio delay.",
					"Synced local playback is cleaner: each viewer uses their own stream, and the watchroom only coordinates timing and discussion.",
				],
			},
			{
				id: "best-for",
				title: "When synced rooms are better",
				body: [
					"Use synced rooms for weekly anime nights, long-distance couples, big finale episodes, and any group where people care about full video quality.",
				],
				bullets: [
					"Everyone gets their own stream quality.",
					"Pauses and seeks stay coordinated.",
					"Late friends can watch independently before your next live meeting.",
				],
			},
		],
		relatedTags: ["online", "crunchyroll", "watch-party"],
		faq: [
			{
				question: "Can you watch anime together without screen sharing?",
				answer:
					"Yes. Use a watchroom tool such as AniDachi so everyone streams the episode locally while playback stays synced.",
			},
			{
				question: "Is synced playback better than Discord screen share?",
				answer:
					"For quality, yes. Synced playback avoids one host's stream becoming the bottleneck for every viewer.",
			},
			{
				question: "Do all viewers need Crunchyroll?",
				answer:
					"For Crunchyroll anime, each viewer needs their own Crunchyroll access. AniDachi does not replace the streaming service; it adds the room layer.",
			},
		],
	},
	"anime-watch-party-app": {
		slug: "anime-watch-party-app",
		title: "Anime Watch Party App — AniDachi",
		h1: "Anime Watch Party App",
		description:
			"Looking for an anime watch party app? Compare live sync, chat, calling, Crunchyroll support, and free joining with AniDachi.",
		ogDescription:
			"What to look for in an anime watch party app for Crunchyroll groups.",
		intro:
			"An anime watch party app should help friends share a live session. Look for Crunchyroll support, room invites, chat, calling, and a host model where friends can join without every person paying.",
		howToName: "How to choose an anime watch party app",
		howToDescription:
			"Compare watch party app features and choose the best setup for recurring anime nights.",
		steps: [
			{
				name: "Check platform fit",
				text: "Make sure the app supports where your group actually watches anime.",
			},
			{
				name: "Check sync quality",
				text: "Prefer local playback sync over one-person screen share for better quality.",
			},
			{
				name: "Check group features",
				text: "Look for room invites, live chat, reactions, cameras, and microphones.",
			},
			{
				name: "Check pricing",
				text: "A host-paid model is easier than asking every friend to subscribe before joining.",
			},
			{
				name: "Test one episode",
				text: "Run a short first session before committing to a weekly anime night.",
			},
		],
		sections: [
			{
				id: "features",
				title: "Anime watch party app feature checklist",
				body: [
					"A general watch party app can work for anime. Check Crunchyroll support, playback controls, live conversation, and the room size your group needs.",
				],
				bullets: [
					"Crunchyroll support",
					"Local playback sync",
					"Invite links",
					"Chat and reactions",
					"Cameras and microphones",
					"Friends can join free",
				],
			},
			{
				id: "why-anidachi",
				title: "Why AniDachi fits anime groups",
				body: [
					"AniDachi adds live watchrooms to Crunchyroll and YouTube. The host creates a room, friends join from the invite, and the group watches and reacts together in real time.",
					"That makes it a stronger fit for long-running shows, seasonal simulcasts, long-distance couples, and friend groups that use Crunchyroll as their main anime source.",
				],
			},
		],
		relatedTags: ["watch-party", "crunchyroll", "pillar-watch-anime"],
		faq: [
			{
				question: "What is an anime watch party app?",
				answer:
					"It is a tool that helps friends watch anime together online with synced playback, room invites, and live conversation. Available features vary by tool.",
			},
			{
				question: "What is the best anime watch party app for Crunchyroll?",
				answer:
					"AniDachi fits Crunchyroll-first anime groups that want synced live rooms, chat, cameras, microphones, and free joining for friends.",
			},
			{
				question: "Can friends join an anime watch party app for free?",
				answer:
					"With AniDachi, friends can join rooms on Free accounts when the host has active Plus or Pro access, including a trial. Free accounts cannot create their own rooms.",
			},
		],
	},
};

function guideMetadata(
	page: Pick<
		ListiclePage | GuidePage,
		"title" | "description" | "slug" | "ogDescription"
	>,
): Metadata {
	const url = `/guides/${page.slug}`;
	return {
		title: page.title,
		description: page.description,
		alternates: { canonical: url },
		openGraph: {
			title: page.title.replace(" — AniDachi", ""),
			description: page.ogDescription,
			url,
			images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
		},
		twitter: {
			card: "summary_large_image",
			title: page.title.replace(" — AniDachi", ""),
			description: page.ogDescription,
			images: [BRAND_OG_PATH],
		},
	};
}

export function getListicleMetadata(
	slug: keyof typeof listiclePages,
): Metadata {
	return guideMetadata(listiclePages[slug]);
}

export function getGuideMetadata(slug: keyof typeof guidePages): Metadata {
	return guideMetadata(guidePages[slug]);
}

export function PseoListiclePage({
	slug,
}: {
	slug: keyof typeof listiclePages;
}) {
	const page = listiclePages[slug];
	const url = `/guides/${page.slug}`;
	const headings: TocHeading[] = [
		{ id: "picks", label: "Top anime picks", level: 2 },
		{ id: "setup", label: "How to watch together", level: 2 },
		{ id: "related", label: "Related guides", level: 2 },
		{ id: "faq", label: "FAQ", level: 2 },
	];
	const itemList = page.picks.map((pick, index) => ({
		name: `Watch ${pick.title} with friends`,
		url: `/watch/${pick.slug}-with-friends`,
		position: index + 1,
	}));
	const related = getGuideLinks({
		includeTags: page.relatedTags,
		excludeHref: url,
		limit: 4,
	});

	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Guides", url: "/watch-anime-together" },
				{ name: page.h1.replace(/ in 2026$/, ""), url },
			]}
			title={page.h1}
			description={page.description}
			url={url}
			datePublished="2026-07-12"
			dateModified="2026-10-01"
			faq={page.faq}
			headings={headings}
			itemList={itemList}
			articleImage={ARTICLE_IMAGE}
			conversionTemplate="listicle"
			aboveFoldCta
		>
			<h1 className="text-4xl font-bold text-foreground mb-6">{page.h1}</h1>
			<p className="text-xl text-foreground/80 leading-relaxed mb-10">
				<strong>{page.intro}</strong>
			</p>

			<h2
				id="picks"
				className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
			>
				Top Anime Picks
			</h2>
			<p className="text-foreground/80 leading-relaxed mb-6">
				{page.sectionIntro}
			</p>
			<ol className="space-y-5 text-foreground/80 mb-10">
				{page.picks.map((pick, index) => (
					<li key={pick.slug}>
						<h3 className="text-xl font-semibold text-foreground mb-1">
							{index + 1}. {pick.title}
						</h3>
						<p className="leading-relaxed">
							{pick.reason}{" "}
							<Link
								href={`/watch/${pick.slug}-with-friends`}
								className="font-medium text-brand-orange hover:underline"
							>
								Watch {pick.title} with friends
							</Link>
							.
						</p>
					</li>
				))}
			</ol>

			<h2
				id="setup"
				className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
			>
				How to Watch Together
			</h2>
			<ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
					<li>Pick one anime and agree on a shared start time.</li>
				<li>Open the episode on Crunchyroll.</li>
				<li>Create an AniDachi watchroom and share the invite link.</li>
				<li>
						The host needs Plus or Pro access, including an active trial;
						friends can join on Free accounts.
				</li>
				<li>
						Use live room chat for reactions and agree on an episode boundary
						before discussing spoilers.
				</li>
			</ol>

			<h2
				id="related"
				className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
			>
				Related Guides
			</h2>
			<ul className="space-y-2 text-brand-orange mb-8">
				<li>
					<Link href="/watch-anime-together" className="hover:underline">
						Watch anime together online
					</Link>
				</li>
				<li>
					<Link href="/watch-crunchyroll-together" className="hover:underline">
						Watch Crunchyroll together
					</Link>
				</li>
				{related.map((guide) => (
					<li key={guide.href}>
						<Link href={guide.href} className="hover:underline">
							{guide.label}
						</Link>
					</li>
				))}
			</ul>
		</SeoPageLayout>
	);
}

export function PseoGuidePage({ slug }: { slug: keyof typeof guidePages }) {
	const page = guidePages[slug];
	const url = `/guides/${page.slug}`;
	const isCrunchyrollCluster = page.relatedTags.includes(
		"pillar-watch-crunchyroll",
	);
	const headings: TocHeading[] = [
		...page.sections.map((section) => ({
			id: section.id,
			label: section.title,
			level: 2 as const,
		})),
		{ id: "steps", label: "Step-by-step setup", level: 2 },
		{ id: "related", label: "Related guides", level: 2 },
		{ id: "faq", label: "FAQ", level: 2 },
	];
	const related = getGuideLinks({
		includeTags: isCrunchyrollCluster
			? ["pillar-watch-crunchyroll"]
			: page.relatedTags,
		excludeHref: url,
		limit: 4,
	});

	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				isCrunchyrollCluster
					? {
							name: "Watch Crunchyroll Together",
							url: "/watch-crunchyroll-together",
						}
					: { name: "Guides", url: "/watch-anime-together" },
				{ name: page.h1, url },
			]}
			title={page.h1}
			description={page.description}
			url={url}
			datePublished="2026-07-12"
			dateModified="2026-10-01"
			faq={page.faq}
			headings={headings}
			articleImage={ARTICLE_IMAGE}
			conversionTemplate="guide"
			aboveFoldCta
		>
			<HowToJsonLd
				name={page.howToName}
				description={page.howToDescription}
				steps={page.steps}
			/>
			<h1 className="text-4xl font-bold text-foreground mb-6">{page.h1}</h1>
			<p className="text-xl text-foreground/80 leading-relaxed mb-8">
				<strong>{page.intro}</strong>
			</p>

			{page.sections.map((section) => (
				<section key={section.id}>
					<h2
						id={section.id}
						className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
					>
						{section.title}
					</h2>
					{section.body.map((paragraph) => (
						<p
							key={paragraph}
							className="text-foreground/80 leading-relaxed mb-4"
						>
							{paragraph}
						</p>
					))}
					{section.bullets ? (
						<ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
							{section.bullets.map((bullet) => (
								<li key={bullet}>{bullet}</li>
							))}
						</ul>
					) : null}
				</section>
			))}

			<h2
				id="steps"
				className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
			>
				Step-by-step setup
			</h2>
			<ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
				{page.steps.map((step) => (
					<li key={step.name}>
						<strong>{step.name}:</strong> {step.text}
					</li>
				))}
			</ol>

			<h2
				id="related"
				className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
			>
				Related Guides
			</h2>
			<ul className="space-y-2 text-brand-orange mb-8">
				<li>
					<Link href="/watch-anime-together" className="hover:underline">
						Watch anime together online
					</Link>
				</li>
				<li>
					<Link href="/watch-crunchyroll-together" className="hover:underline">
						Watch Crunchyroll together
					</Link>
				</li>
				{related.map((guide) => (
					<li key={guide.href}>
						<Link href={guide.href} className="hover:underline">
							{guide.label}
						</Link>
					</li>
				))}
			</ul>
		</SeoPageLayout>
	);
}
