import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/chrome-watch-party";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
	title: "Chrome Watch Party for Crunchyroll and YouTube",
	description:
		"A Chrome watch party with AniDachi runs in desktop Chrome. Add the extension, open Crunchyroll or a full YouTube watch page, and share the room link.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Chrome Watch Party",
		description:
			"Desktop Chrome, the AniDachi extension, each person on their own account.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Chrome Watch Party",
		description: "Desktop Chrome. Crunchyroll or a full YouTube watch page.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do I start a Chrome watch party?",
		answer:
			"Install AniDachi in desktop Chrome, open a Crunchyroll catalog page or a full YouTube watch page, create a room, and send the link. Friends join in desktop Chrome on their own accounts.",
	},
	{
		question: "Does it work in mobile Chrome?",
		answer:
			"Live watchrooms need desktop Chrome with the extension. The phone site can open your account and saved watch history. It does not host the room.",
	},
	{
		question: "Is this a Chrome Web Store extension?",
		answer:
			"Yes. Install from the official AniDachi listing, linked on the install page. Do not load an unpacked zip for the public install.",
	},
	{
		question: "Which sites can the room sync?",
		answer:
			"Crunchyroll catalog pages and full youtube.com/watch pages. Netflix is coming soon and is not supported yet. Shorts and embeds are not supported.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "browser", label: "Which Chrome", level: 2 },
	{ id: "room", label: "Start the room", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function ChromeWatchPartyPage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Watch party app", url: "/watch-party-app" },
				{ name: "Chrome watch party", url: PAGE_PATH },
			]}
			title="Chrome watch party"
			description="Desktop Chrome extension for Crunchyroll and YouTube watchrooms."
			url={PAGE_PATH}
			datePublished="2026-10-08"
			dateModified="2026-10-08"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
		>
			<SeoGuideTitle>Chrome watch party</SeoGuideTitle>
			<h2 id="answer" className="scroll-mt-24">
				Short answer
			</h2>
			<SeoGuideAnswer>
				<p>
					A Chrome watch party with AniDachi is a room in desktop Chrome. Add
					the extension, open Crunchyroll or a full YouTube watch page, and send
					one link. Each person uses their own account. Mobile Chrome and Safari
					do not host the room.
				</p>
			</SeoGuideAnswer>
			<h2
				id="browser"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Which Chrome
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Desktop Chrome is the browser that loads the extension on the player.
				The YouTube mobile app, Shorts, and embeds are outside the room. The
				broader app page is{" "}
				<Link
					href="/watch-party-app"
					className="text-brand-orange hover:underline"
				>
					watch party app
				</Link>
				. Platform comparisons live on{" "}
				<Link
					href="/guides/crunchyroll-watch-party-chrome-extension"
					className="text-brand-orange hover:underline"
				>
					Crunchyroll watch party Chrome extensions
				</Link>{" "}
				and{" "}
				<Link
					href="/guides/youtube-watch-party-chrome-extension"
					className="text-brand-orange hover:underline"
				>
					YouTube watch party Chrome extensions
				</Link>
				.
			</p>
			<h2
				id="room"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Start the room
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Install from{" "}
				<Link href="/extension" className="text-brand-orange hover:underline">
					the install page
				</Link>
				, then choose Add to Chrome on the official listing. Hosting a room
				needs Plus or Pro, including a trial. Friends join on Free. Prices are
				on{" "}
				<Link href="/pricing" className="text-brand-orange hover:underline">
					pricing
				</Link>
				.
			</p>
			<SeoGuideRelated
				links={[
					{ href: "/watch-party-app", label: "Watch party app" },
					{ href: "/extension", label: "Install AniDachi" },
					{
						href: "/guides/crunchyroll-watch-party-chrome-extension",
						label: "Crunchyroll Chrome extensions",
					},
				]}
			/>
		</SeoPageLayout>
	);
}
