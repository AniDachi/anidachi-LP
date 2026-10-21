import type { Metadata } from "next";
import Link from "next/link";
import {
	SeoGuideAnswer,
	SeoGuideBulletList,
	SeoGuideNote,
	SeoGuideOptions,
	SeoGuideRelated,
	SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { PRICING_PLUS_SHORT, PRICING_PRO_SHORT } from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/discord-watch-party";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const SOURCES = [
	{
		href: "https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together-FAQ",
		label: "Discord: Watch Together FAQ",
	},
	{
		href: "https://support-apps.discord.com/hc/en-us/articles/26593412574359-How-to-Use-Apps",
		label: "Discord: How to Use Apps",
	},
	{
		href: "https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share",
		label: "Discord: Go Live and Screen Share",
	},
	{
		href: "https://support.discord.com/hc/en-us/articles/360058862134--Mobile-Screenshare-FAQ",
		label: "Discord: Mobile Screenshare FAQ",
	},
	{
		href: "https://support.discord.com/hc/en-us/articles/4409494125719-Scheduled-Events",
		label: "Discord: Scheduled Events",
	},
];

export const metadata: Metadata = {
	title: "Discord Watch Party: 3 Ways to Watch Together",
	description:
		"Three ways to run a Discord watch party: the Watch Together activity, Go Live screen share, or Discord voice plus synced Crunchyroll, YouTube or Netflix.",
	alternates: { canonical: PAGE_PATH },
	openGraph: {
		title: "Discord Watch Party: 3 Ways to Watch Together",
		description:
			"Watch Together activity vs screen share vs synced players, with setups for Crunchyroll, YouTube and Netflix.",
		url: PAGE_PATH,
		images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Discord Watch Party: 3 Ways to Watch Together",
		description:
			"Which Discord watch party method fits YouTube, Crunchyroll and Netflix.",
		images: ["/opengraph-image.png"],
	},
};

const faq = [
	{
		question: "How do you have a watch party on Discord?",
		answer:
			"Pick one of three methods. For YouTube, start Discord's Watch Together activity in a voice call. For anything on your screen, use Go Live. For Crunchyroll or Netflix, stay in the Discord call for voice and sync each person's own player with AniDachi in desktop Chrome.",
	},
	{
		question: "How do you watch anime with friends on Discord?",
		answer:
			"Keep the Discord voice channel open, and have everyone open the same Crunchyroll episode on their own account in desktop Chrome. The host creates an AniDachi room and pastes the invite in Discord; friends join free. Go Live of Crunchyroll usually shows a black screen.",
	},
	{
		question: "Can you stream Netflix or Crunchyroll on Discord?",
		answer:
			"Not reliably. Both services protect their video with DRM, so Discord's screen capture usually shows black. Discord's mobile FAQ says Netflix can't be screenshared from the app at all. Syncing each person's own player avoids the problem.",
	},
	{
		question: "Is Discord Watch Together free?",
		answer:
			"Discord's Watch Together FAQ doesn't mention a fee. It plays YouTube through the embedded player, limits playback to 180 minutes per person in a group before a 10-minute cool-down, and doesn't let you sign in to YouTube, so Premium members still see ads.",
	},
	{
		question: "How many people can join a Discord watch party?",
		answer:
			"A Go Live stream allows 50 viewers plus the streamer, and a scheduled event in a voice channel is limited to 99 participants. An AniDachi room holds up to 6 people with a Plus host or 15 with a Pro host, including the host.",
	},
	{
		question: "Should we leave the Discord call when using AniDachi?",
		answer:
			"No. Stay in the Discord voice call if that's where your group talks, and keep AniDachi's microphone off so voices don't come through twice. AniDachi then handles only playback sync, on-player chat and reactions.",
	},
	{
		question: "Does AniDachi work inside the Discord app?",
		answer:
			"No. AniDachi is a Chrome extension, not a Discord activity or bot. The video plays in each person's Chrome tab; Discord stays open beside it for voice.",
	},
];

const tocHeadings: TocHeading[] = [
	{ id: "answer", label: "Short answer", level: 2 },
	{ id: "three-ways", label: "Three ways compared", level: 2 },
	{ id: "which", label: "Which one to use", level: 2 },
	{ id: "checklist", label: "What everyone needs", level: 2 },
	{ id: "setup", label: "Setup by platform", level: 2 },
	{ id: "crunchyroll", label: "Crunchyroll", level: 3 },
	{ id: "youtube", label: "YouTube", level: 3 },
	{ id: "netflix", label: "Netflix", level: 3 },
	{ id: "server-events", label: "Server event tips", level: 2 },
	{ id: "sources", label: "Sources", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordWatchPartyPage() {
	const discordGuides = getGuideLinks({
		includeTags: ["pillar-discord-watch-party"],
		excludeHref: PAGE_PATH,
		limit: 6,
	});

	return (
		<SeoPageLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Discord watch party", url: PAGE_PATH },
			]}
			title="Discord watch party"
			description="Discord's Watch Together activity, Go Live screen share, and Discord voice with synced Crunchyroll, YouTube or Netflix."
			url={PAGE_PATH}
			datePublished="2026-09-26"
			dateModified="2026-10-20"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
			aboveFoldCta
			itemList={[
				{
					name: "Discord Watch Together",
					url: "/guides/discord-watch-together",
					position: 1,
				},
				{
					name: "Can you screen share Crunchyroll on Discord?",
					url: "/guides/can-you-screen-share-crunchyroll-on-discord",
					position: 2,
				},
				{
					name: "How to stream Netflix on Discord",
					url: "/guides/how-to-screen-share-netflix-on-discord",
					position: 3,
				},
				{
					name: "Can you screen share YouTube on Discord?",
					url: "/guides/can-you-screen-share-youtube-on-discord",
					position: 4,
				},
				{
					name: "How to watch anime with friends on Discord",
					url: "/guides/how-to-watch-anime-with-friends-on-discord",
					position: 5,
				},
				{
					name: "Discord screen share black screen",
					url: "/guides/discord-screen-share-black-screen",
					position: 6,
				},
			]}
		>
			<SeoGuideTitle>Discord Watch Party: Three Ways to Watch Together</SeoGuideTitle>
			<h2 id="answer" className="scroll-mt-24">
				Short answer
			</h2>
			<SeoGuideAnswer>
				<p>
					<strong>
						There are three ways to run a Discord watch party. Discord&apos;s
						Watch Together activity plays YouTube inside the call. Go Live
						shares one person&apos;s screen, but Netflix and Crunchyroll
						usually show black. For those, stay in Discord for voice and
						sync everyone&apos;s own player with a watch-party extension.
					</strong>{" "}
					AniDachi does that for Crunchyroll, YouTube and Netflix in desktop
					Chrome.
				</p>
			</SeoGuideAnswer>

			<h2
				id="three-ways"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Watch Together vs screen share vs AniDachi
			</h2>
			<p className="mb-4 leading-relaxed text-ani-muted">
				Most groups already live in Discord, so the real question is not
				whether to use Discord but what carries the video. Discord offers two
				built-in answers, and both have hard limits that matter for a full
				episode or a film. The table below compares them with the third
				option: keep Discord for talking and let each person&apos;s own
				streaming account carry the picture.
			</p>
			<ResponsiveCompareTable
				columns={[
					{ id: "activity", label: "Watch Together activity" },
					{ id: "golive", label: "Go Live screen share" },
					{ id: "anidachi", label: "Discord voice + AniDachi", highlight: true },
				]}
				rows={[
					{
						feature: "What you can watch",
						values: {
							activity: "YouTube only",
							golive: "Any window or screen",
							anidachi: "Crunchyroll, YouTube watch pages, Netflix movies and episodes",
						},
					},
					{
						feature: "Netflix and Crunchyroll",
						values: {
							activity: "no",
							golive: "Usually black (DRM)",
							anidachi: "yes",
						},
					},
					{
						feature: "Where the video comes from",
						values: {
							activity: "YouTube's embedded player",
							golive: "The streamer's upload",
							anidachi: "Each person's own account",
						},
					},
					{
						feature: "Picture quality",
						values: {
							activity: "YouTube embed",
							golive: "Up to 720p/30fps; Nitro up to 4K/60fps",
							anidachi: "Each person's own stream",
						},
					},
					{
						feature: "Time limits",
						values: {
							activity: "180 min per person in a group, then a 10-min cool-down",
							golive: "None stated",
							anidachi: "No daily limit on Plus or Pro",
						},
					},
					{
						feature: "Group size",
						values: {
							activity: "Not stated",
							golive: "50 viewers plus the streamer",
							anidachi: "6 (Plus) or 15 (Pro), host included",
						},
					},
					{
						feature: "Sign in to the service",
						values: {
							activity: "No YouTube login; Premium users see ads",
							golive: "Only the streamer",
							anidachi: "Everyone uses their own login",
						},
					},
					{
						feature: "Devices",
						values: {
							activity: "Discord desktop, browser and mobile",
							golive: "Desktop, browser and mobile",
							anidachi: "Desktop Chrome only",
						},
					},
					{
						feature: "Cost",
						values: {
							activity: "No fee mentioned by Discord",
							golive: "Free; Nitro for higher quality",
							anidachi: `Friends free; host Plus ${PRICING_PLUS_SHORT}, Pro ${PRICING_PRO_SHORT} or trial`,
						},
					},
				]}
			/>

			<h2 id="which" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				Which one to use
			</h2>
			<SeoGuideOptions
				options={[
					{
						title: "YouTube clips and music videos: the Watch Together activity",
						body: (
							<>
								It is built into Discord, runs on phones as well as computers,
								and anyone can add videos to a shared playlist. It can&apos;t
								open other sites, and long sessions hit Discord&apos;s 180-minute
								limit. Details and setup are in{" "}
								<Link href="/guides/discord-watch-together">Discord Watch Together</Link>.
							</>
						),
					},
					{
						title: "Showing something quickly: Go Live",
						body: (
							<>
								Good for a game, a website, or a short clip that isn&apos;t
								DRM-protected. Everyone watches one person&apos;s upload, so
								quality and delay depend on that connection. The basics are on{" "}
								<Link href="/guides/how-to-screen-share-on-discord">
									how to screen share on Discord
								</Link>
								.
							</>
						),
					},
					{
						title: "Anime, films and full YouTube pages: Discord voice plus AniDachi",
						body: (
							<>
								Each person plays the same title on their own account in desktop
								Chrome, and AniDachi keeps the players together. Talk stays in
								Discord. This is the only one of the three that works on
								Crunchyroll and Netflix.
							</>
						),
						highlight: true,
					},
				]}
			/>
			<p className="mb-8 leading-relaxed text-ani-muted">
				The honest limits of the third option: everyone needs desktop Chrome,
				everyone needs their own access to the title, and the host needs Plus,
				Pro or a trial. If your group mixes phones and computers, or watches
				on Disney+, Hulu or Max, AniDachi won&apos;t cover it. For the
				feature-by-feature version, see{" "}
				<Link href="/compare/anidachi-vs-discord-screen-share">
					AniDachi vs Discord screen share
				</Link>
				.
			</p>

			<h2 id="checklist" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				What everyone needs, and who pays
			</h2>
			<p className="mb-4 leading-relaxed text-ani-muted">
				A Discord watch party has two separate costs that people tend to mix
				up: access to the video, and the tool that keeps it in sync. Discord
				voice and Go Live are free, Nitro only raises screen share quality,
				and Discord&apos;s Watch Together FAQ mentions no fee. The video side
				depends on the service.
			</p>
			<SeoGuideBulletList
				items={[
					{
						title: "A Discord account for everyone who talks",
						body: "Voice works the same whichever method carries the video, so nobody needs to change servers or channels.",
					},
					{
						title: "Their own streaming access",
						body: "On Crunchyroll and Netflix, each viewer signs in to their own account, and the title has to be available in their country. Netflix's terms say an account is for one household. Most YouTube videos need no subscription.",
					},
					{
						title: "Desktop Chrome, for the AniDachi route",
						body: "AniDachi is a Chrome extension for computers. Friends on phones can stay in the Discord call, but they can't join the synced room from the phone.",
					},
					{
						title: "One host with Plus, Pro or a trial",
						body: "The person who creates the AniDachi room needs a paid plan or an eligible 3-day trial. Everyone else joins free and only needs the extension.",
					},
				]}
			/>
			<p className="mb-8 leading-relaxed text-ani-muted">
				So for a group of five watching Crunchyroll, the usual bill is five
				Crunchyroll accounts and one AniDachi host plan. For a YouTube night with the activity, it is
				nothing at all, with the activity&apos;s limits. Prices and room sizes
				are on <Link href="/pricing">AniDachi pricing</Link>.
			</p>

			<h2 id="setup" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				Setup by platform
			</h2>
			<p className="mb-6 leading-relaxed text-ani-muted">
				The Discord side is the same every time: join a voice channel, or start
				a call in a DM or group DM. What changes is where the video lives. Before
				the first night, have everyone{" "}
				<InstallLink href="/extension">add AniDachi to Chrome</InstallLink> so
				nobody is installing things while the opening song plays.
			</p>

			<h3 id="crunchyroll" className="mt-8 scroll-mt-24 text-xl font-semibold text-ani-text">
				Crunchyroll on Discord
			</h3>
			<p className="mb-4 leading-relaxed text-ani-muted">
				Crunchyroll protects its video, so a Go Live share of the player
				usually shows a black screen and the Watch Together activity can&apos;t
				open it at all. The working setup: everyone opens the same episode on
				their own Crunchyroll account in Chrome, the host creates an AniDachi
				room from the capsule on the player, and pastes the invite in the
				Discord chat. Subtitle language and video quality stay each person&apos;s own
				choice.
			</p>
			<p className="mb-6 leading-relaxed text-ani-muted">
				Why the share fails is covered in{" "}
				<Link href="/guides/can-you-screen-share-crunchyroll-on-discord">
					can you screen share Crunchyroll on Discord
				</Link>
				. A step-by-step night with a server is{" "}
				<Link href="/guides/crunchyroll-watch-party-with-discord">
					Crunchyroll watch party with Discord
				</Link>
				, and the wider anime version is{" "}
				<Link href="/guides/how-to-watch-anime-with-friends-on-discord">
					how to watch anime with friends on Discord
				</Link>
				.
			</p>

			<h3 id="youtube" className="mt-8 scroll-mt-24 text-xl font-semibold text-ani-text">
				YouTube on Discord
			</h3>
			<p className="mb-4 leading-relaxed text-ani-muted">
				YouTube is the one service where Discord&apos;s own activity is a real
				option. Use it for a playlist of short videos where anyone can queue
				the next one. Switch to AniDachi when you want the full youtube.com
				watch page: your own signed-in account (so YouTube Premium works the way
				you pay for it), your own quality settings, and no 180-minute cap.
				AniDachi works on full watch pages only, not Shorts, embeds or the
				mobile app.
			</p>
			<p className="mb-6 leading-relaxed text-ani-muted">
				More in{" "}
				<Link href="/guides/youtube-watch-party-with-discord">
					YouTube watch party with Discord
				</Link>{" "}
				and{" "}
				<Link href="/guides/can-you-screen-share-youtube-on-discord">
					can you screen share YouTube on Discord
				</Link>
				.
			</p>

			<h3 id="netflix" className="mt-8 scroll-mt-24 text-xl font-semibold text-ani-text">
				Netflix on Discord
			</h3>
			<p className="mb-6 leading-relaxed text-ani-muted">
				Netflix behaves like Crunchyroll on desktop: the shared window goes
				black because the video is DRM-protected. On phones Discord says
				Netflix can&apos;t be screenshared at all. So the Netflix setup is the
				same split: Discord for voice, each person on their own Netflix
				account in Chrome, one AniDachi room for the movie or episode. The
				full walkthrough, including what people try for the black screen, is
				in{" "}
				<Link href="/guides/how-to-screen-share-netflix-on-discord">
					how to stream Netflix on Discord
				</Link>
				, and the Netflix side is on{" "}
				<Link href="/netflix-watch-party">Netflix watch party</Link>.
			</p>

			<h2
				id="server-events"
				className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
			>
				Tips for a Discord server watch party
			</h2>
			<p className="mb-4 leading-relaxed text-ani-muted">
				A weekly anime night in a server runs better with a little structure.
				These are the things that go wrong most often, and how to head them off.
			</p>
			<SeoGuideBulletList
				items={[
					{
						title: "Schedule it as a Discord event",
						body: "Discord's Scheduled Events let members see the time and get notified when it starts. Events in a voice channel are limited to 99 participants, and you need the Create Events permission.",
					},
					{
						title: "Size the room to the group",
						body: "An AniDachi room holds 6 people with a Plus host or 15 with Pro. For a bigger server night, run two rooms with two hosts on the same episode, or keep the room for the core group.",
					},
					{
						title: "Check access a day early",
						body: "Everyone needs their own account on the service, and catalogs differ by country. Post the exact title and episode in advance so people can confirm it plays for them.",
					},
					{
						title: "Pick one voice channel and stick to it",
						body: "If the group talks in Discord, keep AniDachi's microphone off so nobody hears voices twice. If you use AniDachi's calls instead, push-to-talk (hold V) keeps background noise out of quiet scenes.",
					},
					{
						title: "Use headphones",
						body: "With open speakers, the episode audio leaks into your microphone and everyone hears it twice and slightly out of step.",
					},
					{
						title: "Post the invite where only the group sees it",
						body: "Share the room link in the event's text channel or a private thread rather than a public announcement channel.",
					},
					{
						title: "Start on the host's signal",
						body: "Let the host press play once the room shows everyone joined. Late arrivals open the same title, join from the invite and land on the room's current moment.",
					},
				]}
			/>
			<SeoGuideNote>
				Go Live needs the Video permission in the voice channel, and Watch
				Together needs the Use Activities permission. If someone can&apos;t
				see the button, check the role permissions before troubleshooting
				anything else.
			</SeoGuideNote>

			<h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
				Sources
			</h2>
			<p className="mb-8 leading-relaxed text-ani-muted">
				Discord details checked 20 Oct 2026:{" "}
				{SOURCES.map((source, index) => (
					<span key={source.href}>
						{index > 0 ? ", " : null}
						<a href={source.href} target="_blank" rel="noopener noreferrer">
							{source.label}
						</a>
					</span>
				))}
				. AniDachi is not affiliated with Discord, Crunchyroll, YouTube or
				Netflix.
			</p>

			<SeoGuideRelated
				links={[
					...discordGuides.map((g) => ({ href: g.href, label: g.label })),
					{ href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
					{ href: "/watch-youtube-together", label: "YouTube watch party" },
					{ href: "/netflix-watch-party", label: "Netflix watch party" },
				]}
			/>
		</SeoPageLayout>
	);
}
