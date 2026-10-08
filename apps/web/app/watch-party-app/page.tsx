import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideBulletList,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { PRICING_IS_ANIDACHI_FREE_ANSWER } from "@/lib/pricing-copy";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
	title: "Watch Party App for Crunchyroll, YouTube and Netflix",
	description:
		"AniDachi is a watch party app for Crunchyroll, YouTube and Netflix. Add it from the Chrome Web Store, share a link, and watch in sync on desktop Chrome.",
	alternates: { canonical: "/watch-party-app" },
	openGraph: {
		title: "Watch Party App for Crunchyroll, YouTube and Netflix",
		description:
			"A Chrome extension watchroom. Each person uses their own account.",
		url: "/watch-party-app",
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Watch Party App for Crunchyroll, YouTube and Netflix",
		description: "Sync Crunchyroll, YouTube or Netflix from a shared room link.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "What is a watch party app?",
		answer:
			"A watch party app keeps friends on the same moment of a video. AniDachi does that for Crunchyroll catalog pages and full YouTube watch pages in desktop Chrome.",
	},
	{
		question: "Is AniDachi a watch party website?",
		answer:
			"The room link lives on the site. The sync runs in the Chrome extension on each person’s own Crunchyroll, YouTube or Netflix tab. It is not a new streaming site.",
	},
	{
		question: "Is there a free watch party app?",
		answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
	},
	{
		question: "Can we watch a movie together?",
		answer:
			"Yes on YouTube, or an anime film on Crunchyroll. See watch movies together online. AniDachi also syncs Netflix.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "same-search", label: "Same search, one app", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function WatchPartyAppPage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Watch party app", url: "/watch-party-app" },
			]}
			title="Watch party app"
			description="Crunchyroll, YouTube and Netflix watch parties in desktop Chrome."
			url="/watch-party-app"
			datePublished="2026-05-08"
			dateModified="2026-10-08"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
			conversionTemplate="pillar"
			itemList={[
				{
					name: "Watch movies together online",
					url: "/guides/watch-movies-together-online",
					position: 1,
				},
				{
					name: "Best watch party apps for anime",
					url: "/guides/best-watch-party-apps-for-anime",
					position: 2,
				},
			]}
		>
			<SeoGuideTitle>Watch party app for Crunchyroll, YouTube and Netflix</SeoGuideTitle>
			<SeoGuideAnswer>
				<p>
					Add AniDachi from the Chrome Web Store, open the same Crunchyroll
					episode or YouTube video, and share a room link. Friends watch on
					their own accounts while playback stays together.
				</p>
			</SeoGuideAnswer>
			<h2
				id="same-search"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Same search, one app
			</h2>
			<SeoGuideBulletList
				items={[
					{
						title: "Watch party website",
						body: "The link is a web page. The player stays on Crunchyroll, YouTube or Netflix.",
					},
					{
						title: "Watch together app",
						body: "Desktop Chrome is the app surface. There is no separate phone player.",
					},
					{
						title: "Online or virtual watch party",
						body: "Anyone with the link can join from their own computer. You do not need to be in the same room.",
					},
					{
						title: "Browser watch party",
						body: "It runs in Chrome. Shorts, embeds, and the YouTube mobile app are not supported.",
					},
					{
						title: "Free watch party",
						body: "Free friends can join an active Plus, Pro, or trial host. Hosting requires your own Plus/Pro access; personal history also needs your recording permission.",
					},
				]}
			/>
			<p className="mb-6 leading-relaxed text-ani-muted">
				For a film, use{" "}
				<Link
					href="/guides/watch-movies-together-online"
					className="text-brand-orange hover:underline"
				>
					watch movies together online
				</Link>
				. Ranked anime options are on{" "}
				<Link
					href="/guides/best-watch-party-apps-for-anime"
					className="text-brand-orange hover:underline"
				>
					best watch party apps for anime
				</Link>
				. Install from{" "}
				<Link href="/extension" className="text-brand-orange hover:underline">
					/extension
				</Link>
				.
			</p>
			<SeoGuideRelated
				links={[
					{ href: "/guides/chrome-watch-party", label: "Chrome watch party" },
					{
						href: "/watch-crunchyroll-together",
						label: "Crunchyroll watch party",
					},
					{ href: "/watch-youtube-together", label: "YouTube watch party" },
					{
						href: "/compare/anidachi-vs-teleparty",
						label: "AniDachi vs Teleparty",
					},
				]}
			/>
		</SeoPageLayout>
	);
}
