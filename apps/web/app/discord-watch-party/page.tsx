import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";
import type { Metadata } from "next";
import Link from "next/link";
import { getPlanPolicy } from "@anidachi/protocol";
import { HubCtaBand } from "@/components/hub-cta-band";
import {
	HUB_INSTALL_STEP,
	HubFeatureGrid,
	HubLandingLayout,
} from "@/components/hub-landing-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { JoinDiscordButton } from "@/components/join-discord-button";
import {
	SeoGuideOptions,
	SeoGuideRelated,
} from "@/components/seo-guide-blocks";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import type { TocHeading } from "@/components/table-of-contents";
import { getGuideLinks } from "@/lib/guide-links";
import { PRICING_PLUS_SHORT, PRICING_PRO_SHORT } from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/discord-watch-party";
const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;
const FREE_ROOM = getPlanPolicy("free").maxParticipants;
const PLUS_ROOM = getPlanPolicy("plus").maxParticipants;
const PRO_ROOM = getPlanPolicy("pro").maxParticipants;

/** One step list for the visible "How it works" section and the HowTo JSON-LD, so they always match. */
const howToSteps = [
	HUB_INSTALL_STEP,
	{
		name: "Join the Discord call",
		text: "Join a voice channel, or start a call in a DM or group DM. Keep AniDachi's microphone off so voices don't come through twice.",
	},
	{
		name: "Open the same title",
		text: "Everyone opens the same episode or video on their own Crunchyroll, YouTube or Netflix account in desktop Chrome.",
	},
	{
		name: "Create the room and paste the invite",
		text: "The host creates an AniDachi room from the capsule on the player and pastes the invite in the Discord chat. Friends join free.",
	},
];

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
			`A Go Live stream allows 50 viewers plus the streamer, and a scheduled event in a voice channel is limited to 99 participants. An AniDachi room holds up to ${FREE_ROOM} people on Free, ${PLUS_ROOM} with a Plus host or ${PRO_ROOM} with a Pro host, including the host.`,
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
	{ id: "how-it-works", label: "How it works", level: 2 },
	{ id: "three-ways", label: "Three ways compared", level: 2 },
	{ id: "which", label: "Which one to use", level: 2 },
	{ id: "checklist", label: "What everyone needs", level: 2 },
	{ id: "setup", label: "Setup by platform", level: 2 },
	{ id: "server-events", label: "Server event tips", level: 2 },
	{ id: "faq", label: "FAQ", level: 2 },
];

export default function DiscordWatchPartyPage() {
	const discordGuides = getGuideLinks({
		includeTags: ["pillar-discord-watch-party"],
		excludeHref: PAGE_PATH,
		limit: 6,
	});

	return (
		<>
		<HowToJsonLd
			name="How to run a Discord watch party with synced video"
			description="Keep Discord for voice and sync Crunchyroll, YouTube or Netflix in desktop Chrome with AniDachi."
			steps={howToSteps}
		/>
		<HubLandingLayout
			breadcrumbs={[
				{ name: "Home", url: "/" },
				{ name: "Discord Watch Party", url: PAGE_PATH },
			]}
			title="Discord watch party"
			description="Discord's Watch Together activity, Go Live screen share, and Discord voice with synced Crunchyroll, YouTube or Netflix."
			url={PAGE_PATH}
			datePublished="2026-09-26"
			dateModified="2026-11-07"
			faq={faq}
			headings={tocHeadings}
			articleImage={articleImage}
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
			h1="Discord Watch Party"
			heroLead="Keep Discord for voice. AniDachi syncs the video."
			heroCtaLabel="Sync Your Discord Watch Party"
			heroWorksOnLabel="Works with"
			heroWorksOn={["your Discord call", "Crunchyroll", "YouTube", "Netflix"]}
			heroFinePrint="20 free minutes a day. Friends join free."
			answer={
				<>
					<strong>
						There are three ways to run a Discord watch party: the Watch
						Together activity for YouTube, Go Live screen share, or Discord
						voice plus a sync extension. Netflix and Crunchyroll usually show
						black on Go Live, so AniDachi syncs everyone&apos;s own player in
						desktop Chrome instead.
					</strong>
				</>
			}
			steps={{
				id: "how-it-works",
				heading: "How to Run a Discord Watch Party with Synced Video",
				intro: "Discord carries the voice. Each person's own account carries the picture.",
				items: howToSteps,
			}}
		>
			<h2
				id="three-ways"
				className="scroll-mt-24"
			>
				Watch Together vs screen share vs AniDachi
			</h2>
			<p>
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
							activity: "180 min per person in a group (30 alone), then a 10-min cool-down",
							golive: "None stated",
							anidachi: "20 host minutes a day on Free; none on Plus or Pro",
						},
					},
					{
						feature: "Group size",
						values: {
							activity: "Not stated",
							golive: "50 viewers plus the streamer",
							anidachi: `${FREE_ROOM} (Free), ${PLUS_ROOM} (Plus) or ${PRO_ROOM} (Pro), host included`,
						},
					},
					{
						feature: "Cost",
						values: {
							activity: "No fee mentioned by Discord",
							golive: "Free; Nitro for higher quality",
							anidachi: `Friends free; Free host: 20 minutes per UTC day, up to 4 people; Plus ${PRICING_PLUS_SHORT}, Pro ${PRICING_PRO_SHORT}`,
						},
					},
				]}
			/>

			<p className="text-sm">
				Also worth knowing: Watch Together can&apos;t sign in to YouTube, so
				Premium members still see ads, and it runs on Discord desktop, browser
				and mobile. Go Live works on desktop, browser and mobile, and only the
				streamer signs in. With AniDachi, everyone uses their own login, in
				desktop Chrome only.
			</p>

			<h2 id="which" className="scroll-mt-24">
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
			<p>
				The honest limits of the third option: everyone needs desktop Chrome,
				everyone needs their own access to the title, and Free hosts get 20 host minutes per UTC day for up to 4 people. If your group mixes phones and computers, or watches
				on Disney+, Hulu or HBO Max, AniDachi won&apos;t cover it. For the
				feature-by-feature version, see{" "}
				<Link href="/compare/anidachi-vs-discord-screen-share">
					AniDachi vs Discord screen share
				</Link>
				.
			</p>

			<HubCtaBand
				pagePath={PAGE_PATH}
				ctaLabel="Sync Your Discord Watch Party"
				heading="Sync your next Discord watch party"
				body="Stay in your Discord call. Install AniDachi, open the episode and paste the invite. 20 free minutes a day, and friends join free."
			/>

			<h2 id="checklist" className="scroll-mt-24">
				What everyone needs, and who pays
			</h2>
			<p>
				A Discord watch party has two separate costs that people tend to mix
				up: access to the video, and the tool that keeps it in sync. Discord
				voice and Go Live are free, Nitro only raises screen share quality,
				and Discord&apos;s Watch Together FAQ mentions no fee. The video side
				depends on the service.
			</p>
			<HubFeatureGrid
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
						title: "Free daily hosting, or Plus and Pro",
						body: `${PRICING_FREE20_SUMMARY} Everyone else joins free and only needs the extension.`,
					},
				]}
			/>
			<p>
				So for a group of five watching Crunchyroll, the usual bill is five
				Crunchyroll accounts and one AniDachi host who needs Plus or Pro. Free&apos;s
				four-person cap includes the host, so it is too small for this group.
				For a YouTube night with the activity, it is
				nothing at all, with the activity&apos;s limits. Prices and room sizes
				are on <Link href="/pricing">AniDachi pricing</Link>.
			</p>

			<h2 id="setup" className="scroll-mt-24">
				Setup by platform
			</h2>
			<p>
				The Discord side is the same every time: join a voice channel, or start
				a call in a DM or group DM. What changes is where the video lives. Before
				the first night, have everyone{" "}
				<Link href="/extension">add AniDachi to Chrome</Link> so
				nobody is installing things while the opening song plays.
			</p>

			<HubFeatureGrid
				columns={3}
				items={[
					{
						id: "crunchyroll",
						title: "Crunchyroll on Discord",
						body: (
							<>
								Go Live of the player usually shows black, and Watch Together
								can&apos;t open Crunchyroll. Everyone opens the same episode on
								their own account in Chrome; the host creates the AniDachi room
								and pastes the invite in Discord. Why the share fails:{" "}
								<Link href="/guides/can-you-screen-share-crunchyroll-on-discord">
									can you screen share Crunchyroll on Discord
								</Link>
								. Full nights:{" "}
								<Link href="/guides/crunchyroll-watch-party-with-discord">
									Crunchyroll watch party with Discord
								</Link>{" "}
								and{" "}
								<Link href="/guides/how-to-watch-anime-with-friends-on-discord">
									anime with friends on Discord
								</Link>
								.
							</>
						),
					},
					{
						id: "youtube",
						title: "YouTube on Discord",
						body: (
							<>
								Use Watch Together for a shared playlist of short videos. Switch
								to AniDachi for full youtube.com watch pages: your own signed-in
								account, your own quality and no 180-minute cap (not Shorts,
								embeds or the mobile app). More:{" "}
								<Link href="/guides/youtube-watch-party-with-discord">
									YouTube watch party with Discord
								</Link>{" "}
								and{" "}
								<Link href="/guides/can-you-screen-share-youtube-on-discord">
									screen sharing YouTube on Discord
								</Link>
								.
							</>
						),
					},
					{
						id: "netflix",
						title: "Netflix on Discord",
						body: (
							<>
								Netflix goes black in a desktop share, and Discord says it
								can&apos;t be screenshared from the mobile app at all. Same split:
								Discord for voice, each person on their own Netflix in Chrome, one
								AniDachi room. Walkthrough:{" "}
								<Link href="/guides/how-to-screen-share-netflix-on-discord">
									how to stream Netflix on Discord
								</Link>
								; Netflix side:{" "}
								<Link href="/netflix-watch-party">Netflix watch party</Link>.
							</>
						),
					},
				]}
			/>

			<h2
				id="server-events"
				className="scroll-mt-24"
			>
				Tips for a Discord server watch party
			</h2>
			<p>
				A weekly anime night in a server runs better with a little structure.
				These are the things that go wrong most often, and how to head them off.
			</p>
			<HubFeatureGrid
				items={[
					{
						title: "Schedule it as a Discord event",
						body: "Discord's Scheduled Events let members see the time and get notified when it starts. Events in a voice channel are limited to 99 participants, and you need the Create Events permission.",
					},
					{
						title: "Size the room to the group",
						body: `An AniDachi room holds ${FREE_ROOM} people on Free, ${PLUS_ROOM} with a Plus host or ${PRO_ROOM} with Pro. For a bigger server night, run two rooms with two hosts on the same episode, or keep the room for the core group.`,
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
						title: "Check role permissions first",
						body: "Go Live needs the Video permission in the voice channel, and Watch Together needs Use Activities. If someone can't see the button, check their role before troubleshooting anything else.",
					},
					{
						title: "Start on the host's signal",
						body: "Let the host press play once the room shows everyone joined. Late arrivals open the same title, join from the invite and land on the room's current moment.",
					},
				]}
			/>

			<p className="mt-8 text-center">
				Want people to watch with? Find anime nights and other AniDachi fans
				in our community server:{" "}
				<JoinDiscordButton
					variant="hero"
					placement="discord_hub_community"
					className="inline-flex w-auto h-auto min-h-0 border-0 bg-transparent px-0 py-0 align-baseline text-base font-medium text-ani-text underline decoration-ani-line underline-offset-4 shadow-none hover:bg-transparent hover:text-ani-progress"
				/>
			</p>

			<h2 id="sources" className="scroll-mt-24">
				Sources
			</h2>
			<p>
				Discord details checked 7 Nov 2026:{" "}
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

			<h2 id="related" className="scroll-mt-24">
				Related Guides
			</h2>
			<SeoGuideRelated
				className="divide-y-0 sm:grid sm:grid-cols-2 sm:gap-x-10 [&>li]:border-b [&>li]:border-ani-line"
				links={[
					...discordGuides.map((g) => ({ href: g.href, label: g.label })),
					{ href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
					{ href: "/watch-youtube-together", label: "YouTube watch party" },
					{ href: "/netflix-watch-party", label: "Netflix watch party" },
				]}
			/>
		</HubLandingLayout>
		</>
	);
}
