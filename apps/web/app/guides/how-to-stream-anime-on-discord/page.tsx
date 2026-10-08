import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import {
	SeoGuideAnswer,
	SeoGuideRelated,
	SeoGuideSteps,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/how-to-stream-anime-on-discord";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
	{
		name: "Join the Discord voice channel",
		text: "Use the call for talking. Leave Go Live off for the episode.",
	},
	{
		name: "Open the same anime",
		text: "Each person uses their own Crunchyroll account, or a full YouTube watch page, in desktop Chrome.",
	},
	{
		name: "Sync the tabs",
		text: "Install AniDachi, create a watchroom, and paste the invite in Discord chat.",
	},
];

export const metadata: Metadata = {
	title: "How to Stream Anime on Discord",
	description:
		"Stream anime with a Discord call up by keeping voice in Discord and playing Crunchyroll or YouTube on each person's own tab.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "How to Stream Anime on Discord",
		description: "Voice in Discord. The episode on each account.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "How to Stream Anime on Discord",
		description: "Stay in the call. Skip Go Live for the episode.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do you stream anime on Discord?",
		answer:
			"Join a Discord voice channel, have each person open the same episode on their own account in desktop Chrome, and sync those tabs with AniDachi. Go Live shares one window and often blacks out Crunchyroll.",
	},
	{
		question: "Can Discord play Crunchyroll by itself?",
		answer:
			"Discord can share a window. It does not give each friend a Crunchyroll player. The Crunchyroll-specific black-screen note is on the stream Crunchyroll page.",
	},
	{
		question: "What about YouTube anime?",
		answer:
			"A full youtube.com/watch page can be synced the same way. Shorts, embeds, and the YouTube mobile app are not supported.",
	},
	{
		question: "Does everyone need their own account?",
		answer:
			"Yes for Crunchyroll. AniDachi does not share one login. Each person needs their own access to the episode.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "steps", label: "Steps", level: 2 },
	{ id: "golive", label: "Go Live", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function HowToStreamAnimeOnDiscordPage() {
	return (
		<>
			<HowToJsonLd
				name="How to stream anime on Discord"
				description="Keep Discord for voice and sync each person's anime tab."
				steps={howToSteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{ name: "Discord watch party", url: "/discord-watch-party" },
					{ name: "Stream anime on Discord", url: PAGE_PATH },
				]}
				title="How to stream anime on Discord"
				description="Voice in Discord, the episode on each person's account."
				url={PAGE_PATH}
				datePublished="2026-10-08"
				dateModified="2026-10-08"
				faq={faq}
				headings={tocHeadings}
				articleImage={articleImage}
				aboveFoldCta
			>
				<SeoGuideTitle>How to stream anime on Discord</SeoGuideTitle>
				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<p>
						Stay in the Discord voice channel and have each person open the same
						anime on their own account. AniDachi keeps those players on the same
						moment. Sending the player through Go Live makes one person the
						broadcaster, and Crunchyroll often goes black.
					</p>
				</SeoGuideAnswer>
				<h2
					id="steps"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Steps
				</h2>
				<SeoGuideSteps steps={howToSteps} />
				<p className="mb-8 leading-relaxed text-ani-muted">
					Install from{" "}
					<Link href="/extension" className="text-brand-orange hover:underline">
						the install page
					</Link>
					. The longer Discord night is{" "}
					<Link
						href="/guides/how-to-watch-anime-with-friends-on-discord"
						className="text-brand-orange hover:underline"
					>
						how to watch anime with friends on Discord
					</Link>
					. Crunchyroll capture problems are on{" "}
					<Link
						href="/guides/can-you-stream-crunchyroll-on-discord"
						className="text-brand-orange hover:underline"
					>
						can you stream Crunchyroll on Discord
					</Link>
					.
				</p>
				<h2
					id="golive"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Go Live
				</h2>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Go Live is the share button, not a second streaming service. What it
					sends, and when to stop it, is on{" "}
					<Link
						href="/guides/discord-go-live"
						className="text-brand-orange hover:underline"
					>
						Discord Go Live
					</Link>
					. Netflix watch pages are also supported.
				</p>
				<SeoGuideRelated
					links={[
						{ href: "/discord-watch-party", label: "Discord watch party" },
						{ href: "/guides/discord-go-live", label: "Discord Go Live" },
						{
							href: "/guides/discord-watch-together",
							label: "Discord watch together",
						},
					]}
				/>
			</SeoPageLayout>
		</>
	);
}
