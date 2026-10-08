import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/virtual-movie-night";
const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
	title: "Virtual Movie Night on Crunchyroll or YouTube",
	description:
		"Host a virtual movie night on a Crunchyroll film or a full YouTube watch page. Each person uses their own account. Netflix is coming soon.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Virtual Movie Night",
		description:
			"One film, each person on their own Crunchyroll or YouTube tab.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Virtual Movie Night",
		description:
			"Crunchyroll or YouTube. One sitting. Each person presses play locally.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do you do a virtual movie night?",
		answer:
			"Pick a film on Crunchyroll or a full YouTube watch page, have each person open it in desktop Chrome, and join one AniDachi room so play stays aligned.",
	},
	{
		question: "Can this sync Netflix?",
		answer:
			"Not yet. Netflix is coming soon and is not supported. Disney+, Hulu, and Prime Video are not supported. The film has to be on Crunchyroll or YouTube.",
	},
	{
		question: "How long should the film be?",
		answer:
			"Choose a length the group can finish in one sitting. A feature around 90 to 130 minutes leaves time to talk at the end.",
	},
	{
		question: "Does everyone need an account?",
		answer:
			"Yes. Each person uses their own access to the film. The room syncs the players. It does not share one login.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "pick", label: "Pick the film", level: 2 },
	{ id: "start", label: "Start the night", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function VirtualMovieNightPage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{
					name: "Best anime movies with friends",
					url: "/guides/best-anime-movies-to-watch-with-friends",
				},
				{ name: "Virtual movie night", url: PAGE_PATH },
			]}
			title="Virtual movie night"
			description="A Crunchyroll or YouTube film, synced for one sitting."
			url={PAGE_PATH}
			datePublished="2026-10-08"
			dateModified="2026-10-08"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
		>
			<SeoGuideTitle>Virtual movie night</SeoGuideTitle>
			<h2 id="answer" className="scroll-mt-24">
				Short answer
			</h2>
			<SeoGuideAnswer>
				<p>
					A virtual movie night on AniDachi is one film on Crunchyroll or a full
					YouTube watch page. Each person opens it in desktop Chrome. The room
					keeps play aligned. Netflix is coming soon and is not supported yet.
					Disney+, Hulu, and Prime Video are not synced.
				</p>
			</SeoGuideAnswer>
			<h2
				id="pick"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Pick the film
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Use a feature the group can finish together. A list of anime films that
				fit a first night is{" "}
				<Link
					href="/guides/best-anime-movies-to-watch-with-friends"
					className="text-brand-orange hover:underline"
				>
					best anime movies to watch with friends
				</Link>
				. Watching movies online in general is{" "}
				<Link
					href="/guides/watch-movies-together-online"
					className="text-brand-orange hover:underline"
				>
					watch movies together online
				</Link>
				.
			</p>
			<h2
				id="start"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Start the night
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Install from{" "}
				<Link href="/extension" className="text-brand-orange hover:underline">
					the install page
				</Link>
				. The host needs Plus or Pro, including a trial. Friends join on Free
				with their own access to the film. Crunchyroll setup is on{" "}
				<Link
					href="/watch-crunchyroll-together"
					className="text-brand-orange hover:underline"
				>
					Crunchyroll watch party
				</Link>
				. YouTube setup is on{" "}
				<Link
					href="/watch-youtube-together"
					className="text-brand-orange hover:underline"
				>
					YouTube watch party
				</Link>
				.
			</p>
			<SeoGuideRelated
				links={[
					{
						href: "/guides/best-anime-movies-to-watch-with-friends",
						label: "Best anime movies with friends",
					},
					{
						href: "/guides/watch-movies-together-online",
						label: "Watch movies together online",
					},
					{
						href: "/watch-crunchyroll-together",
						label: "Crunchyroll watch party",
					},
				]}
			/>
		</SeoPageLayout>
	);
}
