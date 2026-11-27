import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";
import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveDataTable } from "@/components/responsive-data-table";
import {
	SeoGuideAnswer,
	SeoGuideBulletList,
	SeoGuideNote,
	SeoGuideRelated,
	SeoGuideSteps,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;
const PAGE_PATH = "/guides/watch-movies-together-online";

const PAGE_TITLE = "How to Watch Movies Together Online: 4 Ways";
const PAGE_DESCRIPTION =
	"How to watch movies together online with friends: four ways compared, from a sync extension to Discord, FaceTime SharePlay and a call with a countdown.";

const SOURCES = [
	{ href: "https://www.teleparty.com/", label: "Teleparty home page" },
	{ href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
	{
		href: "https://support.apple.com/en-us/HT212823",
		label: "Apple support: SharePlay in FaceTime",
	},
	{
		href: "https://support.apple.com/en-us/109364",
		label: "Apple support: joining FaceTime from Android or Windows",
	},
];

export const metadata: Metadata = {
	title: PAGE_TITLE,
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
		question: "How do I watch movies together online with friends?",
		answer:
			"Pick a film everyone can play on their own account, then use a sync tool so the players stay together. With AniDachi in desktop Chrome, the host opens the Netflix, YouTube or Crunchyroll movie, creates a room and shares the link; friends join free and the host's play and pause apply to everyone.",
	},
	{
		question: "What is the best way to watch movies together online?",
		answer:
			"For one film with friends in different homes, a sync extension: everyone plays the film on their own account and the players stay together, so the picture stays sharp. Which one depends on where the movie is. AniDachi covers Netflix, full YouTube watch pages and Crunchyroll in desktop Chrome, with voice and video in the room. Teleparty lists more services, including Disney+, Hulu and HBO Max; its support FAQ says voice and video chat need Teleparty Premium. For any service, a voice call plus a countdown works with no extra app.",
	},
	{
		question: "Can we watch a movie together on FaceTime?",
		answer:
			"Yes, with SharePlay, if everyone joins the FaceTime call from an Apple device and the streaming app supports SharePlay. Each person needs their own access to the film. Check the app before the night: not every streaming app supports it. Friends on Android or Windows join FaceTime on the web, where SharePlay isn't available.",
	},
	{
		question: "Is there a watch party website for movies?",
		answer:
			"Most work as a browser extension plus a website for invites, because each person must play the film on their own streaming account. AniDachi's room link opens on anidachi.app and the movie plays in each person's own Netflix, YouTube or Crunchyroll tab.",
	},
	{
		question: "Can we watch a Netflix movie together online?",
		answer:
			"Yes. AniDachi supports Netflix movie and episode pages in desktop Chrome. Each viewer needs their own Netflix access to the same title in their region. We have not yet confirmed AniDachi with Netflix's plan with ads, so test that first.",
	},
	{
		question: "Can I watch movies with friends online on my phone?",
		answer:
			"Not with AniDachi. It runs as an extension in desktop Chrome or Chromium Edge, so everyone needs a computer. On phones, a voice call and a countdown is the simplest fallback.",
	},
	{
		question: "What if we are in different cities?",
		answer:
			"The same room works across cities and countries, as long as the film plays in each person's region. Keep the room's voice on, or stay on a separate call. The long-distance version is in our watch movies together long distance guide.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "options", label: "4 ways, compared", level: 2 },
	{ id: "best-way", label: "Best way for your group", level: 3 },
	{ id: "flow", label: "Movie-night flow", level: 2 },
	{ id: "where", label: "Netflix, YouTube or anime films", level: 2 },
	{ id: "picks", label: "Picking the film", level: 2 },
	{ id: "limits", label: "Limits to know", level: 2 },
	{ id: "sources", label: "Sources", level: 2 },
	{ id: "related", label: "Related", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

const flowSteps = [
	{
		name: "Agree on the film and start time",
		text: "Post two or three options in the group chat and vote. Set the start in each person's time zone so nobody turns up an hour late.",
	},
	{
		name: "Everyone checks the film plays",
		text: "Each person opens the movie on their own Netflix, YouTube or Crunchyroll account the day before. Regions and plans differ.",
	},
	{
		name: "Install AniDachi in desktop Chrome",
		text: "Everyone adds the extension from the official Chrome Web Store listing, starting at /extension.",
	},
	{
		name: "Host creates the room",
		text: "On Free, Plus, or Pro, the host opens the movie, clicks the AniDachi capsule on the player and chooses Create room.",
	},
	{
		name: "Share the link and press play",
		text: "Friends open the invite on free accounts. The host's play, pause and seek apply to the whole room; chat, voice and video run on the player.",
	},
];

const optionRows = [
	{
		option: "Sync extension: AniDachi",
		services: "Netflix, full YouTube watch pages, Crunchyroll",
		devices: "Desktop Chrome or Chromium Edge",
		talk: "On-player chat, voice and video",
		cost: "Free: 30 host minutes per UTC day for up to 4 people; Plus / Pro: no daily hosting time limit",
	},
	{
		option: "Sync extension: Teleparty",
		services: "Lists Netflix, YouTube, Disney+, HBO Max, Hulu, Amazon and more",
		devices: "Desktop and mobile, per its site",
		talk: "Chat; voice and video chat need Premium",
		cost: "Free tier and Premium",
	},
	{
		option: "Discord screen share",
		services: "Whatever one person shares",
		devices: "Desktop and mobile apps",
		talk: "Discord voice",
		cost: "Free; protected films often show black",
	},
	{
		option: "FaceTime with SharePlay",
		services: "Streaming apps that support SharePlay",
		devices: "Apple devices only (not FaceTime on the web)",
		talk: "FaceTime voice and video",
		cost: "Free with FaceTime",
	},
	{
		option: "Call plus countdown",
		services: "Any service everyone has",
		devices: "Any",
		talk: "Your call app",
		cost: "Free; no sync after the start",
	},
];

export default function WatchMoviesTogetherOnlinePage() {
	return (
		<>
			<HowToJsonLd
				name="How to watch movies together online"
				description="Pick a film everyone can play, install AniDachi in desktop Chrome, and let the host's room keep every player in sync."
				steps={flowSteps}
			/>
			<SeoPageLayout
				breadcrumbs={[
					{ name: "Home", url: "/" },
					{ name: "Guides", url: "/guides" },
					{
						name: "How to watch movies together online",
						url: PAGE_PATH,
					},
				]}
				title="How to watch movies together online with friends"
				description={PAGE_DESCRIPTION}
				url={PAGE_PATH}
				datePublished="2026-09-26"
				dateModified="2026-11-20"
				faq={faq}
				headings={tocHeadings}
				articleImage={articleImage}
				aboveFoldCta
			>
				<SeoGuideTitle>How to Watch Movies Together Online with Friends</SeoGuideTitle>

				<h2 id="answer" className="scroll-mt-24">
					Short answer
				</h2>
				<SeoGuideAnswer>
					<strong>
						There are four ways to watch a movie or film together online: a
						sync extension, Discord screen share, FaceTime with SharePlay, or a
						call with a countdown. The smoothest is a sync extension: everyone
						opens the same film on their own account and the extension keeps
						the players together. AniDachi does this in desktop Chrome for
						Netflix films, full YouTube movies and anime films on Crunchyroll,
						with chat, voice and video in the room. Friends join free;{" "}
						{PRICING_FREE20_SUMMARY}
					</strong>
				</SeoGuideAnswer>

				<p className="mb-6 leading-relaxed text-ani-muted">
					This guide is for one film with friends who are not in the same
					room. It compares the four ways, then gives a movie-night flow you
					can copy. If you already know you want an app, AniDachi lets you{" "}
					<Link href="/">watch movies together online</Link> in sync, the{" "}
					<Link href="/watch-party-app">supported streaming services</Link> page lists
					where it works, and the{" "}
					<Link href="/netflix-watch-party">Netflix watch party guide</Link>{" "}
					covers Netflix in detail.
				</p>

				<h2
					id="options"
					className="mt-10 mb-4 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					4 ways to watch movies with friends online, compared
				</h2>
				<p className="mb-4 leading-relaxed text-ani-muted">
					Whether you call it a movie night or a film night, the options are
					the same. They differ in which streaming services they work with,
					which devices everyone needs, and whether you can hear each other.
				</p>
				<ResponsiveDataTable
					titleKey="option"
					columns={[
						{ key: "option", label: "Option" },
						{ key: "services", label: "Where the movie is" },
						{ key: "devices", label: "Devices" },
						{ key: "talk", label: "Talking" },
						{ key: "cost", label: "Cost" },
					]}
					rows={optionRows}
				/>
				<h3
					id="best-way"
					className="mt-8 mb-3 scroll-mt-24 text-xl font-semibold text-ani-text"
				>
					Best way for your group
				</h3>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Use AniDachi when your film is on Netflix, YouTube or Crunchyroll and
					you want faces and voices on the player. Use Teleparty when the film
					is on Disney+, Hulu or another service AniDachi does not support. Use
					FaceTime with SharePlay when everyone has an Apple device and the
					streaming app supports it. Use a countdown when someone only has a
					phone.{" "}
					<InstallLink href="/extension" className="text-brand-orange hover:underline">
						Add AniDachi to Chrome
					</InstallLink>{" "}
					if it fits your group.
				</p>

				<h2
					id="flow"
					className="mt-10 mb-4 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Movie-night flow
				</h2>
				<SeoGuideSteps steps={flowSteps} />
				<p className="mb-8 leading-relaxed text-ani-muted">
					Plus rooms hold up to 6 people and Pro rooms up to 15, host included.
					Hold V to talk with push-to-talk so the film&apos;s audio is not
					drowned out, and agree before the start whether you want a mid-film
					break. Only the host can pause the room, so tell them in chat. A full
					evening plan, with themes and snacks, is on{" "}
					<Link href="/virtual-movie-night" className="text-brand-orange hover:underline">
						virtual movie night
					</Link>
					.
				</p>

				<h2
					id="where"
					className="mt-10 mb-4 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Netflix, YouTube or anime films
				</h2>
				<SeoGuideBulletList
					items={[
						{
							title: "Netflix movies",
							body: (
								<>
									Open the film&apos;s watch page in desktop Chrome. Everyone
									needs their own Netflix access to that title in their country.
									Kids profiles or maturity settings can hide a film, so use a
									profile that shows it. We have not yet confirmed Netflix&apos;s
									plan with ads, so test that first. Details:{" "}
									<Link href="/netflix-watch-party">Netflix watch party</Link>
									{" "}and{" "}
									<Link href="/virtual-movie-night">Netflix movie night</Link>
									.
								</>
							),
						},
						{
							title: "YouTube movies",
							body: (
								<>
									Use a full youtube.com/watch page that plays for everyone.
									Shorts, embedded players and the YouTube mobile app are not
									supported. If a YouTube ad plays for the host, AniDachi pauses
									the room until it ends. More on the{" "}
									<Link href="/watch-youtube-together">YouTube watch party</Link>{" "}
									page.
								</>
							),
						},
						{
							title: "Anime films on Crunchyroll",
							body: (
								<>
									Anime movies on Crunchyroll work like episodes: everyone signs
									in to their own account, and the room keeps the players
									together. For titles that suit a group, see{" "}
									<Link href="/guides/best-anime-movies-to-watch-with-friends">
										best anime movies to watch with friends
									</Link>
									.
								</>
							),
						},
					]}
				/>
				<SeoGuideNote>
					One room is one service. If the group switches from a YouTube trailer
					to the Netflix film, the host ends the room and starts a new one on
					the Netflix tab.
				</SeoGuideNote>

				<h2
					id="picks"
					className="mt-10 mb-4 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Picking the film
				</h2>
				<p className="mb-4 leading-relaxed text-ani-muted">
					The film matters more than the app. A few rules that save a night:
				</p>
				<SeoGuideBulletList
					items={[
						{
							title: "Check runtime against time zones",
							body: "A 2-hour film that starts at 9 pm for one friend can start at 3 am for another. Shorter films suit wide time gaps.",
						},
						{
							title: "Subtitles or dub",
							body: "Decide before the vote. Mixed groups often pick subtitles so everyone hears the same audio.",
						},
						{
							title: "Rewatch or first watch",
							body: "First watches keep chat quiet; rewatches are better for jokes and reactions.",
						},
						{
							title: "Same catalog for all",
							body: "Netflix and Crunchyroll catalogs change by country. Pick from what everyone can open.",
						},
					]}
				/>

				<h2
					id="limits"
					className="mt-10 mb-4 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Limits to know
				</h2>
				<p className="mb-4 leading-relaxed text-ani-muted">
					AniDachi syncs players; it does not stream the film to anyone. Every
					viewer needs their own access on Netflix, YouTube or Crunchyroll.
					Disney+, Hulu and Prime Video are not supported yet (for Prime Video
					nights, see{" "}
					<Link href="/prime-video-watch-party" className="text-brand-orange hover:underline">
						Prime Video watch party
					</Link>
					), and there is no mobile app. Everyone needs desktop Chrome 121 or newer, or Chromium
					Edge.
				</p>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Two people in different cities? Use{" "}
					<Link
						href="/watch-movies-together-long-distance"
						className="text-brand-orange hover:underline"
					>
						watch movies together long distance
					</Link>
					, which covers calls and time zones for couples.
				</p>

				<h2
					id="sources"
					className="mt-10 mb-4 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Sources
				</h2>
				<p className="mb-8 leading-relaxed text-ani-muted">
					Teleparty details checked 20 Oct 2026; Apple SharePlay details
					checked 20 Nov 2026:{" "}
					{SOURCES.map((source, index) => (
						<span key={source.href}>
							{index > 0 ? ", " : null}
							<a
								href={source.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-brand-orange hover:underline"
							>
								{source.label}
							</a>
						</span>
					))}
					. AniDachi is not affiliated with Netflix, YouTube, Crunchyroll,
					Teleparty or Apple.
				</p>

				<h2
					id="related"
					className="mt-10 mb-4 scroll-mt-24 text-2xl font-bold text-ani-text"
				>
					Related
				</h2>
				<SeoGuideRelated
					links={[
						{ href: "/netflix-watch-party", label: "Netflix watch party" },
						{ href: "/virtual-movie-night", label: "Virtual movie night" },
						{
							href: "/guides/best-anime-movies-to-watch-with-friends",
							label: "Best anime movies to watch with friends",
						},
						{ href: "/watch-party-app", label: "Supported streaming services" },
						{
							href: "/watch-movies-together-long-distance",
							label: "Watch movies long distance",
						},
					]}
				/>
			</SeoPageLayout>
		</>
	);
}
