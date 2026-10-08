import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideBulletList,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
	title: "Discord Watch Together — Voice in Discord, Video in Sync",
	description:
		"Discord watch together keeps the call for voice. AniDachi syncs the same Crunchyroll episode or YouTube video on each person’s account.",
	alternates: { canonical: "/guides/discord-watch-together" },
	openGraph: {
		title: "Discord Watch Together",
		description: "Stay in the Discord call. Play the video locally.",
		url: "/guides/discord-watch-together",
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Discord Watch Together",
		description: "The call stays up. The episode stays in sync.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do you watch together on Discord?",
		answer:
			"Join a Discord voice channel for talking. Each person opens the same Crunchyroll episode or YouTube video in desktop Chrome and joins one AniDachi watchroom.",
	},
	{
		question: "Is Discord watch together the same as a Discord watch party?",
		answer:
			"Same night, two names. The watch party page is the hub. This page is the habit of leaving the call up while the video plays somewhere else.",
	},
	{
		question: "Can a Discord bot sync two streams?",
		answer:
			"No. A bot can post a link. It cannot keep two Crunchyroll or YouTube players on the same moment.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "split", label: "What stays in Discord", level: 2 },
	{ id: "party", label: "Watch together vs watch party", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordWatchTogetherPage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Discord watch party", url: "/discord-watch-party" },
				{
					name: "Discord watch together",
					url: "/guides/discord-watch-together",
				},
			]}
			title="Discord watch together"
			description="Watch Crunchyroll or YouTube while a Discord call stays up."
			url="/guides/discord-watch-together"
			datePublished="2026-09-27"
			dateModified="2026-10-08"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
		>
			<SeoGuideTitle>Discord watch together</SeoGuideTitle>
			<SeoGuideAnswer>
				<p>
					Discord watch together means the call stays open while you watch.
					Discord carries the voices.{" "}
					<Link href="/discord-watch-party">AniDachi</Link> keeps the
					Crunchyroll episode or YouTube video on the same moment. Discord does
					not sync two players by itself.
				</p>
			</SeoGuideAnswer>
			<h2
				id="split"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				What stays in Discord
			</h2>
			<SeoGuideBulletList
				items={[
					{
						title: "Voice",
						body: "Talk, react, and pause the conversation in the channel you already use.",
					},
					{
						title: "The video",
						body: "Each person opens the same title on their own account in desktop Chrome.",
					},
					{
						title: "A short share",
						body: "Point at a menu if you need to. Stop the share for the episode. The picture gets worse, and Crunchyroll often goes black.",
					},
				]}
			/>
			<h2
				id="party"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Discord watch together and a Discord watch party
			</h2>
			<p className="mb-6 leading-relaxed text-ani-muted">
				People search both phrases for the same night. The party name lives on
				the hub. This page is the split: call here, video there. For Crunchyroll
				specifically, read{" "}
				<Link
					href="/guides/can-you-stream-crunchyroll-on-discord"
					className="text-brand-orange hover:underline"
				>
					can you stream Crunchyroll on Discord
				</Link>
				. Install from{" "}
				<Link href="/extension" className="text-brand-orange hover:underline">
					/extension
				</Link>
				. YouTube nights use a full watch page. Netflix is coming soon and is not supported yet.
			</p>
			<SeoGuideRelated
				links={[
					{ href: "/discord-watch-party", label: "Discord watch party" },
					{ href: "/guides/discord-go-live", label: "Discord Go Live" },
					{
						href: "/guides/discord-watch-together-activity",
						label: "Discord Watch Together Activity",
					},
					{
						href: "/guides/how-to-watch-anime-with-friends-on-discord",
						label: "Watch anime on Discord",
					},
					{
						href: "/guides/youtube-watch-party-with-discord",
						label: "YouTube watch party with Discord",
					},
				]}
			/>
		</SeoPageLayout>
	);
}
