import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/discord-go-live";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
	title: "Discord Go Live for a Watch Party",
	description:
		"Discord Go Live is screen share inside a voice call. Crunchyroll often goes black. Keep the call, and sync each person's own Crunchyroll or YouTube tab.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Discord Go Live for a Watch Party",
		description:
			"Go Live shares one window. A watchroom plays the video on each account.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Discord Go Live for a Watch Party",
		description: "The call can stay. The episode should play locally.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "What is Discord Go Live?",
		answer:
			"Go Live is Discord's screen share in a voice channel. One person sends a window. Everyone else watches that capture inside the call.",
	},
	{
		question: "Can I Go Live a Crunchyroll episode?",
		answer:
			"You can start the share. The Crunchyroll player often shows a black window because the video path is protected. For the episode, each person should open it on their own account.",
	},
	{
		question: "Does Go Live work for YouTube?",
		answer:
			"A full YouTube watch page can appear in the share. Quality still depends on the host's upload, and guests do not get their own player. AniDachi syncs each person's youtube.com/watch page instead.",
	},
	{
		question: "Should we leave the Discord call?",
		answer:
			"No. Stay in the voice channel. Use Go Live for a short look at a menu. Stop it for the episode.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "share", label: "What Go Live sends", level: 2 },
	{ id: "watch", label: "Watch the episode", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordGoLivePage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Discord watch party", url: "/discord-watch-party" },
				{ name: "Discord Go Live", url: PAGE_PATH },
			]}
			title="Discord Go Live"
			description="Screen share inside a Discord voice call, and when to stop it."
			url={PAGE_PATH}
			datePublished="2026-10-08"
			dateModified="2026-10-08"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
		>
			<SeoGuideTitle>Discord Go Live</SeoGuideTitle>
			<h2 id="answer" className="scroll-mt-24">
				Short answer
			</h2>
			<SeoGuideAnswer>
				<p>
					Discord Go Live is screen share in a voice channel. One person sends a
					window. Crunchyroll often shows a black window. YouTube can appear,
					then everyone's picture depends on that one upload. For the episode,
					stay in the call and play the video on each person's own tab.
				</p>
			</SeoGuideAnswer>
			<h2
				id="share"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				What Go Live sends
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				The click path is Share Your Screen in the call controls. Those steps
				are on{" "}
				<Link
					href="/guides/how-to-screen-share-on-discord"
					className="text-brand-orange hover:underline"
				>
					how to screen share on Discord
				</Link>
				. Friends see a capture, not a second licensed player. They cannot pause
				their own stream or change their own subtitles.
			</p>
			<h2
				id="watch"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Watch the episode
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Stop the share for a full episode. Each person opens the same
				Crunchyroll episode or full YouTube watch page in desktop Chrome and
				joins one AniDachi room. The hub is{" "}
				<Link
					href="/discord-watch-party"
					className="text-brand-orange hover:underline"
				>
					Discord watch party
				</Link>
				. Install from{" "}
				<Link href="/extension" className="text-brand-orange hover:underline">
					the install page
				</Link>
				. Netflix watch pages are also supported. Discord's built-in YouTube activity is a
				different feature:{" "}
				<Link
					href="/guides/discord-watch-together-activity"
					className="text-brand-orange hover:underline"
				>
					Discord Watch Together Activity
				</Link>
				.
			</p>
			<SeoGuideRelated
				links={[
					{ href: "/discord-watch-party", label: "Discord watch party" },
					{
						href: "/guides/how-to-screen-share-on-discord",
						label: "How to screen share on Discord",
					},
					{
						href: "/guides/how-to-stream-anime-on-discord",
						label: "How to stream anime on Discord",
					},
				]}
			/>
		</SeoPageLayout>
	);
}
