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

const PAGE_PATH = "/guides/how-to-clear-watch-history-on-crunchyroll";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
	{
		name: "Log in on the website",
		text: "Open Crunchyroll in a browser and sign in to the profile whose history you want to clear.",
	},
	{
		name: "Open History",
		text: "Click your avatar, then History.",
	},
	{
		name: "Clear History",
		text: "Click Clear History. A confirmation message appears at the top. This deletes the whole episode list.",
	},
];

export const metadata: Metadata = {
	title: "How to Clear Watch History on Crunchyroll",
	description:
		"Clear Crunchyroll watch history from your avatar, then History, then Clear History. The trash icon deletes one episode instead of the whole list.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "How to Clear Watch History on Crunchyroll",
		description:
			"Clear History wipes the episode list. The trash icon deletes one episode.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "How to Clear Watch History on Crunchyroll",
		description: "Avatar, History, Clear History.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do I clear watch history on Crunchyroll?",
		answer:
			"On the website, click your avatar, then History, then Clear History. A confirmation appears at the top. That removes every episode from the history list.",
	},
	{
		question: "How do I delete one episode instead?",
		answer:
			"On the same History page, click the trash icon under that episode. Clear History is the control that deletes the whole list.",
	},
	{
		question: "Does Clear History cancel my membership?",
		answer:
			"No. Clear History is on the History page. Membership and payment settings live elsewhere in the account.",
	},
	{
		question: "Will Continue Watching go empty?",
		answer:
			"Clear History removes the episode records that feed the homepage row, including shows you are still watching. To drop one series and keep the rest, mark that series as watched or delete only its episodes.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "steps", label: "Clear the list", level: 2 },
	{ id: "one", label: "One show instead", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function HowToClearCrunchyrollWatchHistoryPage() {
	return (
		<>
			<HowToJsonLd
				name="How to clear watch history on Crunchyroll"
				description="Open History from your avatar and choose Clear History."
				steps={howToSteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{
						name: "Watch Crunchyroll Together",
						url: "/watch-crunchyroll-together",
					},
					{ name: "Clear watch history", url: PAGE_PATH },
				]}
				title="How to clear watch history on Crunchyroll"
				description="Clear History deletes the whole episode list."
				url={PAGE_PATH}
				datePublished="2026-10-08"
				dateModified="2026-10-08"
				faq={faq}
				headings={tocHeadings}
				articleImage={articleImage}
				aboveFoldCta
			>
				<SeoGuideTitle>How to clear watch history on Crunchyroll</SeoGuideTitle>
				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<p>
						Click your avatar, choose History, then click Clear History. A
						confirmation appears at the top. That deletes every episode in the
						list, including shows still on Continue Watching. The trash icon
						under one episode deletes only that episode.
					</p>
				</SeoGuideAnswer>
				<h2
					id="steps"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Clear the list
				</h2>
				<SeoGuideSteps steps={howToSteps} />
				<p className="mb-8 leading-relaxed text-ani-muted">
					Crunchyroll documents this on its website getting-started article.
					Checked 8 October 2026. The page that explains what the History list
					is:{" "}
					<Link
						href="/crunchyroll-watch-history"
						className="text-brand-orange hover:underline"
					>
						Crunchyroll watch history
					</Link>
					. AniDachi is not affiliated with Crunchyroll.
				</p>
				<h2
					id="one"
					className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					One show instead
				</h2>
				<p className="mb-8 leading-relaxed text-ani-muted">
					If other series should stay on the homepage row, skip Clear History.
					Use{" "}
					<Link
						href="/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll"
						className="text-brand-orange hover:underline"
					>
						how to remove shows from Continue Watching
					</Link>{" "}
					or the anime-specific steps in{" "}
					<Link
						href="/guides/how-to-remove-anime-from-continue-watching-on-crunchyroll"
						className="text-brand-orange hover:underline"
					>
						how to remove anime from Continue Watching
					</Link>
					. Clearing Crunchyroll history does not delete{" "}
					<Link
						href="/account/watch-library"
						className="text-brand-orange hover:underline"
					>
						AniDachi Watch Library
					</Link>
					.
				</p>
				<SeoGuideRelated
					links={[
						{
							href: "/crunchyroll-watch-history",
							label: "Crunchyroll watch history",
						},
						{
							href: "/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll",
							label: "Remove one show from Continue Watching",
						},
						{
							href: "/watch-crunchyroll-together",
							label: "Crunchyroll watch party",
						},
					]}
				/>
			</SeoPageLayout>
		</>
	);
}
