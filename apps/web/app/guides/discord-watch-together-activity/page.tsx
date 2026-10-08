import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/discord-watch-together-activity";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
	title: "Discord Watch Together Activity vs a Watchroom",
	description:
		"Discord's Watch Together Activity plays YouTube inside Discord. AniDachi keeps the voice channel and syncs a Crunchyroll episode or a full YouTube watch page in Chrome.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Discord Watch Together Activity",
		description: "Discord's YouTube activity is not a Crunchyroll watchroom.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Discord Watch Together Activity",
		description: "YouTube inside Discord, or Crunchyroll in each person's tab.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "What is Discord's Watch Together Activity?",
		answer:
			"It is Discord's own activity for playing YouTube inside the Discord window. It is not AniDachi, and it does not open Crunchyroll.",
	},
	{
		question: "Can the Activity sync Crunchyroll?",
		answer:
			"No. Crunchyroll plays in a browser on each person's account. AniDachi syncs those tabs while the Discord voice channel stays up.",
	},
	{
		question: "Can I use both?",
		answer:
			"Use the Activity when you want YouTube inside Discord. Use an AniDachi room when you want a full youtube.com/watch page or a Crunchyroll episode in desktop Chrome.",
	},
	{
		question: "Does AniDachi install inside Discord?",
		answer:
			"No. AniDachi is a Chrome extension. Discord stays the voice call. The video stays in Chrome.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "activity", label: "The Discord activity", level: 2 },
	{ id: "room", label: "A watchroom in the same call", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordWatchTogetherActivityPage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Discord watch party", url: "/discord-watch-party" },
				{ name: "Watch Together Activity", url: PAGE_PATH },
			]}
			title="Discord Watch Together Activity"
			description="Discord's YouTube activity, and a Crunchyroll or YouTube watchroom beside the call."
			url={PAGE_PATH}
			datePublished="2026-10-08"
			dateModified="2026-10-08"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
		>
			<SeoGuideTitle>Discord Watch Together Activity</SeoGuideTitle>
			<h2 id="answer" className="scroll-mt-24">
				Short answer
			</h2>
			<SeoGuideAnswer>
				<p>
					Discord's Watch Together Activity plays YouTube inside Discord.
					AniDachi does not replace that activity. It keeps the voice channel
					and syncs a Crunchyroll episode, or a full YouTube watch page, in each
					person's desktop Chrome tab.
				</p>
			</SeoGuideAnswer>
			<h2
				id="activity"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				The Discord activity
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Start Watch Together from Discord when the group wants YouTube in the
				Discord window. That activity does not load a Crunchyroll catalog page.
				Screen share is a third option, covered on{" "}
				<Link
					href="/guides/discord-go-live"
					className="text-brand-orange hover:underline"
				>
					Discord Go Live
				</Link>
				.
			</p>
			<h2
				id="room"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				A watchroom in the same call
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Leave the voice channel up. Install from{" "}
				<Link href="/extension" className="text-brand-orange hover:underline">
					the install page
				</Link>
				, open the same title, and share the room link in chat. The habit page
				is{" "}
				<Link
					href="/guides/discord-watch-together"
					className="text-brand-orange hover:underline"
				>
					Discord watch together
				</Link>
				. YouTube nights that stay on youtube.com are{" "}
				<Link
					href="/guides/youtube-watch-party-with-discord"
					className="text-brand-orange hover:underline"
				>
					YouTube watch party with Discord
				</Link>
				.
			</p>
			<SeoGuideRelated
				links={[
					{ href: "/discord-watch-party", label: "Discord watch party" },
					{
						href: "/guides/discord-watch-together",
						label: "Discord watch together",
					},
					{ href: "/guides/discord-go-live", label: "Discord Go Live" },
				]}
			/>
		</SeoPageLayout>
	);
}
