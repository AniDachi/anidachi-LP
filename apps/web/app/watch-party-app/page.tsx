import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideBulletList,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { EXTENSION_BROWSER_LABEL } from "@/lib/extension-store";
import { PLATFORM_GLYPHS, PLATFORM_LOGOS } from "@/lib/platforms";
import { PLANNED_PLATFORMS, SUPPORTED_PLATFORMS } from "@/lib/product-facts";
import {
	PRICING_FREE20_SUMMARY,
	PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
	PRICING_IS_ANIDACHI_FREE_ANSWER,
} from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

/**
 * Platform directory (ANI-40). Platforms come from lib/product-facts.ts. The homepage owns "watch party app" since ANI-36,
 * so this page lists where AniDachi works and links each hub. The URL stays
 * /watch-party-app; the title must not start with "Watch Party App".
 */
const PAGE_PATH = "/watch-party-app";
const PAGE_TITLE = "Streaming Services That Work with AniDachi";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const supportedNames = SUPPORTED_PLATFORMS.map((p) => p.name);
const upcomingNames = [...PLANNED_PLATFORMS];

function listNames(names: string[]): string {
	if (names.length <= 1) return names.join("");
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Built from lib/product-facts.ts so a platform launch updates the snippet too.
const PAGE_DESCRIPTION = `AniDachi works on ${listNames(supportedNames)} in ${EXTENSION_BROWSER_LABEL}. ${listNames(upcomingNames)} are coming soon. See what works on each.`;

export const metadata: Metadata = {
	title: { absolute: PAGE_TITLE },
	description: PAGE_DESCRIPTION,
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: PAGE_TITLE,
		description: PAGE_DESCRIPTION,
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: PAGE_TITLE,
		description: PAGE_DESCRIPTION,
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "Which streaming services does AniDachi work with?",
		answer: `${listNames(supportedNames)}, in ${EXTENSION_BROWSER_LABEL}. ${listNames(upcomingNames)} are coming soon.`,
	},
	{
		question: "Does AniDachi work with Prime Video?",
		answer:
			"Not yet. Prime Video is the next platform on the list. The Prime Video watch party page covers what works today and will be updated when support arrives.",
	},
	{
		question: "Does AniDachi work on a phone or a TV?",
		answer: `No. Watch parties run in ${EXTENSION_BROWSER_LABEL}. On a phone, copy the install link and open it on your computer.`,
	},
	{
		question: "Does everyone need their own subscription?",
		answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
	},
	{
		question: "Is AniDachi free?",
		answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "supported", label: "Supported today", level: 2 },
	{ id: "coming-soon", label: "Coming soon", level: 2 },
	{ id: "every-platform", label: "The same on every platform", level: 2 },
	{ id: "occasions", label: "Pick by occasion", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function WatchPartyAppPage() {
	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Supported streaming services", url: PAGE_PATH },
			]}
			title="Streaming services that work with AniDachi"
			description={PAGE_DESCRIPTION}
			url={PAGE_PATH}
			datePublished="2026-05-08"
			dateModified="2026-11-19"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
			aboveFoldStyle="hero"
			conversionTemplate="pillar"
			itemList={SUPPORTED_PLATFORMS.map((p, i) => ({
				name: p.hubLabel,
				url: p.hubPath,
				position: i + 1,
			}))}
		>
			<SeoGuideTitle>Streaming services that work with AniDachi</SeoGuideTitle>
			<h2 id="answer" className="scroll-mt-24">
				Short answer
			</h2>
			<SeoGuideAnswer>
				<p>
					AniDachi works on {listNames(supportedNames)} today, in{" "}
					{EXTENSION_BROWSER_LABEL}. Everyone watches on their own player with
					their own access, and AniDachi keeps play, pause and seeking in sync.{" "}
					{listNames(upcomingNames)} are coming soon. New to it? Start with the{" "}
					<Link href="/">watch party app</Link>.
				</p>
			</SeoGuideAnswer>

			<h2 id="supported" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				Supported today
			</h2>
			<ul className="not-prose mb-8 grid gap-3 sm:grid-cols-3">
				{SUPPORTED_PLATFORMS.map((platform) => {
					const glyph = PLATFORM_GLYPHS[platform.name];
					return (
					<li key={platform.name}>
						<Link
							href={platform.hubPath}
							className="flex h-full flex-col gap-3 rounded-[20px] border border-ani-line bg-ani-panel p-5 transition-colors hover:border-ani-control-border-hover"
						>
							<span className="flex items-center gap-3">
								{glyph ? (
									<svg
										viewBox={glyph.viewBox}
										className="h-6 w-6 shrink-0"
										aria-hidden="true"
										style={{ color: glyph.color }}
									>
										{glyph.paths.map((d) => (
											<path key={d} d={d} fill="currentColor" />
										))}
										{glyph.playTriangle ? <path d={glyph.playTriangle} fill="#fff" /> : null}
									</svg>
								) : null}
								<span className="text-base font-semibold text-ani-text">{platform.name}</span>
							</span>
							<span className="text-sm leading-relaxed text-ani-muted">{platform.scope}</span>
							<span className="mt-auto text-sm font-medium text-ani-text">
								{platform.hubLabel} <span aria-hidden="true">→</span>
							</span>
						</Link>
					</li>
					);
				})}
			</ul>

			<h2 id="coming-soon" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				Coming soon
			</h2>
			<p className="mb-4 leading-relaxed text-ani-muted">
				These platforms are planned. Each one is listed as supported only once
				the Chrome Web Store version of AniDachi works with it.
			</p>
			<ul className="not-prose mb-8 flex flex-wrap gap-2">
				{PLANNED_PLATFORMS.map((name) => {
					const href = PLATFORM_LOGOS[name]?.href;
					return (
					<li key={name}>
						{href ? (
							<Link
								href={href}
								className="inline-flex rounded-full border border-ani-control-border px-4 py-2 text-sm text-ani-text transition-colors hover:border-ani-control-border-hover"
							>
								{name} watch party (coming soon)
							</Link>
						) : (
							<span className="inline-flex rounded-full border border-ani-line px-4 py-2 text-sm text-ani-muted">
								{name}
							</span>
						)}
					</li>
					);
				})}
			</ul>

			<h2 id="every-platform" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				The same on every platform
			</h2>
			<SeoGuideBulletList
				items={[
					{
						title: "Your own player",
						body: "Each person watches on their own tab and account. Nothing is screen shared, so the picture stays sharp and there is no screen-share black screen.",
					},
					{
						title: "In sync",
						body: "Play, pause and seeking stay together for everyone in the room.",
					},
					{
						title: "Chat and calls",
						body: "Chat and reactions on the player, plus voice and video calls.",
					},
					{
						title: "Free to start",
						body: `${PRICING_FREE20_SUMMARY} Friends join free.`,
					},
					{
						title: "Desktop only",
						body: `AniDachi runs in ${EXTENSION_BROWSER_LABEL}. It does not work in phone or TV apps.`,
					},
				]}
			/>

			<h2 id="occasions" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				Pick by occasion
			</h2>
			<SeoGuideBulletList
				items={[
					{
						title: "On Discord",
						body: (
							<>
								Screen sharing a streaming service often shows a black screen. See{" "}
								<Link href="/discord-watch-party">Discord watch party</Link>.
							</>
						),
					},
					{
						title: "Long distance",
						body: (
							<>
								Friends or a partner in another city:{" "}
								<Link href="/watch-movies-together-long-distance">
									watch movies together long distance
								</Link>
								.
							</>
						),
					},
					{
						title: "Movie night",
						body: (
							<>
								One film the group can finish in one sitting:{" "}
								<Link href="/virtual-movie-night">virtual movie night</Link>.
							</>
						),
					},
					{
						title: "Anime",
						body: (
							<>
								Crunchyroll or YouTube anime with friends:{" "}
								<Link href="/watch-anime-together">watch anime together</Link>.
							</>
						),
					},
					{
						title: "Free plan",
						body: (
							<>
								What Free includes and when Plus or Pro helps:{" "}
								<Link href="/pricing">pricing</Link>.
							</>
						),
					},
				]}
			/>

			<SeoGuideRelated
				links={[
					...SUPPORTED_PLATFORMS.map((p) => ({ href: p.hubPath, label: p.hubLabel })),
					{ href: "/prime-video-watch-party", label: "Prime Video watch party" },
					{ href: "/guides/chrome-watch-party", label: "Chrome watch party" },
					{ href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
					{ href: "/compare/anidachi-vs-kosmi", label: "Kosmi alternatives" },
					{ href: "/compare", label: "Best watch party apps" },
					{ href: "/guides/watch-movies-together-online", label: "How to watch movies together online" },
				]}
			/>
		</SeoPageLayout>
	);
}
